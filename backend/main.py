from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import io
import csv
import traceback
import json
import time
import asyncio
from jose import jwt, JWTError
from terraform_runner import apply_for_deployment, destroy_for_deployment, TerraformError
from models import Deployment

# Local Imports
from database import get_db, engine
import models
import services
import storage
import vector_db
import chat_service
import auth
import websocket_routes
from store import active_autodrive_sessions
from cloud_providers.factory import get_provider
from fastapi import BackgroundTasks

# Initialize Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS CONFIG ---
origins = ["*"]  # Development mode

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.include_router(websocket_routes.router)

# --- AUTH SETUP ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
    # silent authentication failure
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise credentials_exception

    return user


# --- AUTH ENDPOINTS ---
@app.post("/register/")
def register(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = models.User(email=email, hashed_password=auth.get_password_hash(password))
    db.add(new_user)
    db.commit()
    return {"msg": "User registered"}


@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = auth.create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# --- STARTUP ---
@app.on_event("startup")
def startup_event():
    storage.init_bucket()
    vector_db.init_collections()


# --- JOB MANAGEMENT ---
@app.get("/jobs/")
def get_jobs(db: Session = Depends(get_db)):
    return db.query(models.Job).all()


@app.post("/jobs/")
def create_job(title: str = Form(...), description: str = Form(...),
               db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_job = models.Job(title=title, description=description)
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    try:
        services.get_embedding(f"{title}. {description}")
    except Exception as e:
        print("Embedding warning:", e)

    return {"id": new_job.id, "title": new_job.title}


@app.post("/jobs/upload/")
async def upload_jd(file: UploadFile = File(...), db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):

    content = await file.read()
    text = services.smart_extract(content, file.filename)
    jd = services.parse_jd(text)

    new_job = models.Job(title=jd["title"], description=jd["description"])
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {"id": new_job.id, "title": new_job.title}


@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):

    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    db.query(models.Application).filter(models.Application.job_id == job_id).delete()
    db.delete(job)
    db.commit()

    return {"message": "Deleted"}


# --- SINGLE SCREENING (WITH DRACONIAN SCORING) ---
@app.post("/screen/")
async def screen_candidate(
    job_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        content = await file.read()
        resume_text = services.smart_extract(content, file.filename)

        if not resume_text:
            raise HTTPException(400, "Could not parse document")

        job = db.query(models.Job).filter(models.Job.id == job_id).first()
        if not job:
            raise HTTPException(404, "Job not found")

        ai = services.analyze_candidate(resume_text, job.description)

        file_obj = io.BytesIO(content)
        path = storage.upload_file_to_lake(file_obj, file.filename)

        candidate = models.Candidate(
            name=ai.get("name", file.filename),
            email=ai.get("email", "Unknown"),
            resume_text=resume_text,
            file_path=path,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        application = models.Application(
            job_id=job.id,
            candidate_id=candidate.id,
            match_score=ai.get("score", 0),
            status=ai.get("status", "Reject"),
            reasoning=ai.get("reasoning", ""),
            experience_score=ai.get("experience_score", 0),
            skills_score=ai.get("skills_score", 0),
            role_alignment_score=ai.get("role_alignment_score", 0),
            stability_flag=ai.get("stability_flag", "OK"),
            missing_skills=ai.get("missing_skills", []),
            skills_found=ai.get("skills_found", []),
        )
        db.add(application)
        db.commit()

        # Vector DB store
        try:
            vec = services.get_embedding(resume_text)
            vector_db.store_resume_vector(
                candidate_id=candidate.id,
                vector=vec,
                metadata={"name": candidate.name, "email": candidate.email},
            )
        except Exception as e:
            print("Vector DB error:", e)

        return ai

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))


# --- BULK POOL UPLOAD (Scenario 2) ---
@app.post("/candidates/pool/")
async def upload_to_pool(
    file: UploadFile = File(...),
    batch_id: str = Form(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    text = services.smart_extract(content, file.filename)
    vector = services.get_embedding(text)

    candidate = models.Candidate(
        name=file.filename,
        email="pending@pool.com",
        resume_text=text,
        file_path=f"pool/{file.filename}",
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    vector_db.store_resume_vector(
        candidate_id=candidate.id,
        vector=vector,
        metadata={"name": file.filename, "text_preview": text[:200], "batch_id": batch_id},
    )

    return {"id": candidate.id}


# --- PLACEMENT DRIVE (Scenario 2) ---
class DriveRequest(BaseModel):
    job_ids: List[int]
    batch_id: str


@app.post("/drive/match/")
def run_drive(request: DriveRequest, db: Session = Depends(get_db)):
    results = {}

    for job_id in request.job_ids:
        job = db.query(models.Job).filter(models.Job.id == job_id).first()
        if not job:
            continue

        qv = services.get_embedding(f"{job.title}. {job.description}")
        matches = vector_db.search_resumes_for_job(qv, 10, batch_id=request.batch_id)

        results[job.title] = [
            {
                "id": m.id,
                "job_id": job.id,
                "name": m.payload.get("name", "Unknown"),
                "email": m.payload.get("email", "Unknown"),
                "score": round(m.score * 100, 1),
                "skills": m.payload.get("skills", ""),
            }
            for m in matches
        ]

    return results


# --- DEEP ANALYSIS WITH DRACONIAN SCORING ---
class ScreenExistingRequest(BaseModel):
    job_id: int
    candidate_id: int


@app.post("/screen/existing/")
def deep_analysis(req: ScreenExistingRequest, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == req.job_id).first()
    cand = db.query(models.Candidate).filter(models.Candidate.id == req.candidate_id).first()

    if not job or not cand:
        raise HTTPException(404, "Not found")

    ai = services.analyze_candidate(cand.resume_text, job.description)

    app_row = (
        db.query(models.Application)
        .filter(
            models.Application.job_id == job.id,
            models.Application.candidate_id == cand.id,
        )
        .first()
    )

    if not app_row:
        app_row = models.Application(job_id=job.id, candidate_id=cand.id)
        db.add(app_row)

    app_row.match_score = ai.get("score", 0)
    app_row.status = ai.get("status", "Reject")
    app_row.reasoning = ai.get("reasoning", "")
    app_row.experience_score = ai.get("experience_score", 0)
    app_row.skills_score = ai.get("skills_score", 0)
    app_row.role_alignment_score = ai.get("role_alignment_score", 0)
    app_row.stability_flag = ai.get("stability_flag", "OK")
    app_row.missing_skills = ai.get("missing_skills", [])
    app_row.skills_found = ai.get("skills_found", [])

    db.commit()

    return ai


# --- MATCHMAKER (Scenario 3: free-text search) ---
class MatchRequest(BaseModel):
    job_description: str
    limit: int = 20


@app.post("/match/")
async def semantic_match(
    job_description: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query_vector = services.get_embedding(job_description)
    points = vector_db.search_resumes_for_job(query_vector, 20, batch_id=None)

    matches = []
    for p in points:
        cand = db.query(models.Candidate).filter(models.Candidate.id == p.id).first()

        if cand:
            name = cand.name
            preview = cand.resume_text[:200]
        else:
            name = p.payload.get("name", "Unknown")
            preview = p.payload.get("text_preview", "")

        matches.append(
            {
                "score": p.score,
                "metadata": {
                    "name": name,
                    "skills": preview,
                },
            }
        )

    return {"matches": matches}


# --- NEW: SUPER BULK AUTO-DRIVE (Scenario 3) ---

# 1) Upload multiple JD docs (each may contain multiple JDs inside)
@app.post("/bulk/jds/")
async def upload_multi_jds(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    created_job_ids: List[int] = []

    for file in files:
        content = await file.read()
        text = services.smart_extract(content, file.filename)

        jd_blocks = services.split_multiple_jds(text)
        for jd_text in jd_blocks:
            if not jd_text.strip():
                continue

            jd = services.parse_jd(jd_text)
            job = models.Job(title=jd["title"], description=jd["description"])
            db.add(job)
            db.commit()
            db.refresh(job)

            # Optionally sync embedding
            try:
                services.get_embedding(f"{job.title}. {job.description}")
            except Exception as e:
                print("Bulk JD embedding warning:", e)

            created_job_ids.append(job.id)

    return {"created_job_ids": created_job_ids}


# 2) Upload all resumes (no batch filter, global pool)
@app.post("/bulk/resumes/")
async def upload_bulk_resumes(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    candidate_ids: List[int] = []

    for file in files:
        content = await file.read()
        text = services.smart_extract(content, file.filename)

        cand = models.Candidate(
            name=file.filename,
            email="unknown",
            resume_text=text,
            file_path=f"bulk/{file.filename}",
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)

        # Optional: store in Qdrant too
        try:
            vec = services.get_embedding(text)
            vector_db.store_resume_vector(
                candidate_id=cand.id,
                vector=vec,
                metadata={"name": cand.name, "text_preview": text[:250]},
            )
        except Exception as e:
            print("Bulk resume vector warning:", e)

        candidate_ids.append(cand.id)

    return {"candidate_ids": candidate_ids}


class MatrixRequest(BaseModel):
    job_ids: List[int]
    candidate_ids: List[int]


@app.post("/bulk/matrix/")
def matrix_view(
    request: MatrixRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    jobs = db.query(models.Job).filter(models.Job.id.in_(request.job_ids)).all()
    cands = (
        db.query(models.Candidate)
        .filter(models.Candidate.id.in_(request.candidate_ids))
        .all()
    )

    # Build result structure
    matrix = {
        "jobs": [{"id": j.id, "title": j.title} for j in jobs],
        "candidates": []
    }

    for cand in cands:
        row = {
            "candidate_id": cand.id,
            "candidate_name": cand.name,
            "scores": []
        }

        for job in jobs:
            app = (
                db.query(models.Application)
                .filter(
                    models.Application.job_id == job.id,
                    models.Application.candidate_id == cand.id,
                )
                .first()
            )

            if not app:
                row["scores"].append({
                    "score": None,
                    "status": "NA",
                    "stability_flag": "OK"
                })
            else:
                row["scores"].append({
                    "score": app.match_score,
                    "status": app.status,
                    "stability_flag": app.stability_flag
                })

        matrix["candidates"].append(row)

    return matrix

# --- CHAT & EXPORT ---

class ContextModel(BaseModel):
    view: Optional[str] = "unknown"
    job_id: Optional[int] = None
    candidate_id: Optional[int] = None

class ChatRequest(BaseModel):
    question: str
    context: Optional[ContextModel] = None


class DeploymentRequest(BaseModel):
    provider: str               # "aws" | "azure" | "gcp"
    region: str
    instance_type: Optional[str] = None

    # Credentials or identifiers – for a first version you can use access keys.
    # Later you should switch to safer mechanisms (OIDC, short-lived tokens, etc).
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None

    # Azure-specific
    subscription_id: Optional[str] = None
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

    # GCP-specific (e.g. base64 of service account JSON)
    service_account_json: Optional[str] = None

    # optional: domain name the user wants
    domain: Optional[str] = None


class DeploymentResponse(BaseModel):
    id: int
    provider: str
    status: str
    app_url: Optional[str] = None
    public_ip: Optional[str] = None
    error_message: Optional[str] = None


class DeploymentStatusResponse(BaseModel):
    id: int
    status: str
    app_url: Optional[str] = None
    public_ip: Optional[str] = None
    error_message: Optional[str] = None


@app.post("/chat/")
def ask_copilot(request: ChatRequest, db: Session = Depends(get_db)):
    """
    AI Recruiter Assistant endpoint.
    """
    try:
        # We pass the question to the service. 
        # Note: chat_service.ask_copilot currently doesn't use context, but we accept it in the API now.
        answer = chat_service.ask_copilot(request.question, db)
        return {"response": answer}
    except Exception as e:
        print(f"Chat Error: {e}")
        return {
            "response": {
                "reply": "I’m having trouble answering that right now.",
                "action": "NONE",
                "error": str(e),
            }
        }

# --- EXPORT ---
@app.get("/export/{job_id}")
def export(job_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(
            models.Candidate.name,
            models.Candidate.email,
            models.Application.match_score,
            models.Application.status,
            models.Application.reasoning,
        )
        .join(models.Application)
        .filter(models.Application.job_id == job_id)
        .all()
    )

    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Name", "Email", "Score", "Status", "Reason"])

    for r in rows:
        writer.writerow([r.name, r.email, r.match_score, r.status, r.reasoning])

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=export.csv"
    return response



# ============================================
# AUTO-DRIVE WEBSOCKET STREAMING (REAL DATA)
# ============================================
from fastapi import WebSocket, WebSocketDisconnect
from database import SessionLocal
import models, services
import asyncio


AUTO_DRIVE_JOBS: list[int] = []
AUTO_DRIVE_CANDIDATES: list[int] = []


@app.post("/bulk/autodrive/start")
async def autodrive_start(payload: dict):
    """
    Called from the frontend before opening the WebSocket.
    Just stores which jobs and candidates to process.
    """
    global AUTO_DRIVE_JOBS, AUTO_DRIVE_CANDIDATES

    AUTO_DRIVE_JOBS = payload.get("job_ids", []) or []
    AUTO_DRIVE_CANDIDATES = payload.get("candidate_ids", []) or []

    print(f"[SETUP] AutoDrive configured: {len(AUTO_DRIVE_JOBS)} jobs, {len(AUTO_DRIVE_CANDIDATES)} candidates")
    return {"status": "ready"}


@app.websocket("/ws/autodrive")
async def ws_autodrive(ws: WebSocket):
    """
    Streams real per-candidate results:
    - candidate_name from DB
    - deep_score + gate scores from analyze_candidate()
    - skills_found / missing_skills
    - full AI reasoning
    """
    print("[WS] /ws/autodrive incoming")
    await ws.accept()
    db = SessionLocal()

    try:
        # 1) Guard: make sure start endpoint was called
        if not AUTO_DRIVE_JOBS or not AUTO_DRIVE_CANDIDATES:
            msg = "Auto-Drive not configured. Call /bulk/autodrive/start first."
            print("[WS] ERROR:", msg)
            await ws.send_json({"type": "error", "message": msg})
            await ws.close()
            return

        # 2) Load jobs & candidates from DB
        jobs = (
            db.query(models.Job)
            .filter(models.Job.id.in_(AUTO_DRIVE_JOBS))
            .all()
        )
        candidates = (
            db.query(models.Candidate)
            .filter(models.Candidate.id.in_(AUTO_DRIVE_CANDIDATES))
            .all()
        )

        # Precompute candidate embeddings once
        candidate_vectors = {}
        for cand in candidates:
            try:
                candidate_vectors[cand.id] = services.get_embedding(cand.resume_text or "")
            except Exception as e:
                print(f"[WS] Embedding error for candidate {cand.id}: {e}")
                candidate_vectors[cand.id] = []

        # 3) Main streaming loop
        sent_pairs = set()
        for job in jobs:
            job_key = f"{job.title or 'Job'} (ID {job.id})"
            print("[WS] Processing job:", job_key)

            # Job embedding
            try:
                job_vec = services.get_embedding(f"{job.title}. {job.description}")
            except Exception as e:
                print(f"[WS] Embedding error for job {job.id}: {e}")
                job_vec = []

            for cand in candidates:
                pair = (job.id, cand.id)
                if pair in sent_pairs:
                    continue
                sent_pairs.add(pair)

                print(f"[WS] Processing candidate {cand.id} for job {job.id}")

                # Avoid UI freeze, tiny pause
                await asyncio.sleep(0.1)

                cand_vec = candidate_vectors.get(cand.id, [])
                try:
                  semantic = services.cosine_similarity(job_vec, cand_vec)
                except Exception:
                  semantic = 0.0

                try:
                    # Call your strict scoring LLM
                    ai = services.analyze_candidate(
                        cand.resume_text or "",
                        job.description or "",
                    )
                except Exception as e:
                    print(f"[WS] AI error for cand {cand.id}, job {job.id}: {e}")
                    ai = {
                        "score": 0,
                        "status": "Error",
                        "reasoning": f"AI Processing Error: {e}",
                        "experience_score": 0,
                        "skills_score": 0,
                        "role_alignment_score": 0,
                        "stability_flag": "OK",
                        "skills_found": [],
                        "missing_skills": [],
                    }

                # Upsert Application row (same as non-streaming route)
                try:
                    app_row = (
                        db.query(models.Application)
                        .filter(
                            models.Application.job_id == job.id,
                            models.Application.candidate_id == cand.id,
                        )
                        .first()
                    )

                    if not app_row:
                        app_row = models.Application(
                            job_id=job.id,
                            candidate_id=cand.id,
                        )
                        db.add(app_row)

                    app_row.match_score = ai.get("score", 0)
                    app_row.status = ai.get("status", "Reject")
                    app_row.reasoning = ai.get("reasoning", "")
                    app_row.experience_score = ai.get("experience_score", 0)
                    app_row.skills_score = ai.get("skills_score", 0)
                    app_row.role_alignment_score = ai.get("role_alignment_score", 0)
                    app_row.stability_flag = ai.get("stability_flag", "OK")
                    app_row.missing_skills = ai.get("missing_skills", [])
                    app_row.skills_found = ai.get("skills_found", [])
                    db.commit()
                except Exception as e:
                    print(f"[WS] DB save error for cand {cand.id}, job {job.id}: {e}")

                # Real candidate label: name → fallback
                label = cand.name.strip() if cand.name else f"Candidate {cand.id}"

                # 4) Send full enriched result to frontend
                await ws.send_json(
                    {
                        "type": "result",
                        "job_key": job_key,
                        "candidate": {
                            "candidate_id": cand.id,
                            "candidate_name": label,
                            "semantic_score": round(float(semantic or 0.0), 3),
                            "deep_score": ai.get("score", 0),
                            "status": ai.get("status", "Reject"),
                            "stability_flag": ai.get("stability_flag", "OK"),
                            "experience_score": ai.get("experience_score", 0),
                            "skills_score": ai.get("skills_score", 0),
                            "role_alignment_score": ai.get("role_alignment_score", 0),
                            "skills_found": ai.get("skills_found", []),
                            "missing_skills": ai.get("missing_skills", []),
                            "reasoning": ai.get("reasoning", ""),
                        },
                    }
                )

        # 5) Done
        await ws.send_json({"type": "done"})
        await ws.close()
        print("[WS] Streaming finished and closed")

    except WebSocketDisconnect:
        print("[WS] Client disconnected")

    except Exception as e:
        print("[WS] Fatal error:", e)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        finally:
            await ws.close()

    finally:
        db.close()


# --- DEPLOYMENT ENDPOINTS ---

@app.post("/deploy/start", response_model=DeploymentResponse)
def start_deployment(
    req: DeploymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if req.provider.lower() != "aws":
        # For now only AWS is implemented
        raise HTTPException(status_code=400, detail="Only AWS deployments are implemented currently")

    # Create DB record
    deployment = Deployment(
        user_id=current_user.id if current_user else None,
        provider=req.provider.lower(),
        region=req.region,
        instance_type=req.instance_type or "t3.medium",
        status="pending",
        config=req.dict(),
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    def run_provisioning(dep_id: int):
        from database import SessionLocal

        session = SessionLocal()
        try:
            dep = session.query(Deployment).get(dep_id)
            dep.status = "provisioning"
            session.commit()

            outputs = apply_for_deployment(dep)

            # Terraform outputs look like: { "instance_public_ip": {"value": "..."}, ... }
            public_ip = outputs.get("instance_public_ip", {}).get("value")
            app_url = outputs.get("app_url", {}).get("value")
            instance_id = outputs.get("instance_id", {}).get("value")

            dep.vm_id = instance_id
            dep.public_ip = public_ip
            dep.app_url = app_url
            dep.status = "running"
            session.commit()
        except TerraformError as te:
            dep = session.query(Deployment).get(dep_id)
            dep.status = "error"
            dep.error_message = str(te)
            session.commit()
        except Exception as e:
            import traceback
            dep = session.query(Deployment).get(dep_id)
            dep.status = "error"
            dep.error_message = f"{e}\n{traceback.format_exc()}"
            session.commit()
        finally:
            session.close()

    background_tasks.add_task(run_provisioning, deployment.id)

    return DeploymentResponse(
        id=deployment.id,
        provider=deployment.provider,
        status=deployment.status,
        app_url=deployment.app_url,
        public_ip=deployment.public_ip,
        error_message=deployment.error_message,
    )


@app.get("/deploy/{deployment_id}/status", response_model=DeploymentStatusResponse)
def get_deployment_status(
    deployment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    dep = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Optional: ensure user owns it
    # if dep.user_id != current_user.id and current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Not allowed")

    return DeploymentStatusResponse(
        id=dep.id,
        status=dep.status,
        app_url=dep.app_url,
        public_ip=dep.public_ip,
        error_message=dep.error_message,
    )


class UndeployRequest(BaseModel):
    deployment_id: int


@app.post("/deploy/undeploy", response_model=DeploymentStatusResponse)
def undeploy(
    req: UndeployRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    dep = db.query(Deployment).filter(Deployment.id == req.deployment_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Optional ownership check here

    if dep.status not in ("running", "error"):
        raise HTTPException(
            status_code=400, detail=f"Cannot undeploy in status {dep.status}"
        )

    dep.status = "destroying"
    db.commit()

    def run_destroy(dep_id: int):
        from database import SessionLocal

        session = SessionLocal()
        try:
            dep = session.query(Deployment).get(dep_id)
            destroy_for_deployment(dep)
            dep.status = "destroyed"
            session.commit()
        except TerraformError as te:
            dep = session.query(Deployment).get(dep_id)
            dep.status = "error"
            dep.error_message = str(te)
            session.commit()
        except Exception as e:
            dep = session.query(Deployment).get(dep_id)
            dep.status = "error"
            dep.error_message = str(e)
            session.commit()
        finally:
            session.close()

    background_tasks.add_task(run_destroy, dep.id)

    return DeploymentStatusResponse(
        id=dep.id,
        status=dep.status,
        app_url=dep.app_url,
        public_ip=dep.public_ip,
        error_message=dep.error_message,
    )
