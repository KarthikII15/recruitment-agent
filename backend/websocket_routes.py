from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from pydantic import BaseModel

from database import get_db
import models
import services
import chat_service

router = APIRouter()

# -----------------------------
# Global In-Memory State
# -----------------------------
CURRENT_AUTODRIVE_CONFIG = {
    "job_ids": [],
    "candidate_ids": []
}

class AutoDriveStartRequest(BaseModel):
    job_ids: List[int]
    candidate_ids: List[int]

# -----------------------------
# HTTP POST: Start AutoDrive
# -----------------------------
@router.post("/bulk/autodrive/start")
def start_autodrive(req: AutoDriveStartRequest):
    global CURRENT_AUTODRIVE_CONFIG
    CURRENT_AUTODRIVE_CONFIG["job_ids"] = req.job_ids
    CURRENT_AUTODRIVE_CONFIG["candidate_ids"] = req.candidate_ids
    print(f"AutoDrive Configured: {len(req.job_ids)} jobs, {len(req.candidate_ids)} candidates")
    return {"ok": True}


# -----------------------------
# Utility: safe float
# -----------------------------
def _safe_float(x):
    try:
        return float(x)
    except Exception:
        return 0.0


# -----------------------------
# WebSocket: AutoDrive Streaming
# -----------------------------
# -----------------------------
# WebSocket: AutoDrive Streaming
# -----------------------------
@router.websocket("/ws/autodrive")
async def ws_autodrive(websocket: WebSocket):
    await websocket.accept()

    # Identify user via the token in query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_json({"type": "error", "msg": "Missing credentials"})
        await websocket.close()
        return

    # Decode user ID from token
    try:
        from store import active_autodrive_sessions
        import auth
        from jose import jwt
        
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = str(payload.get("sub"))
        
        # We need to map email (sub) to user ID or use email as key
        # For simplicity, let's assume the session key is the user ID 
        # But wait, main.py uses user.id (int) converted to str as key.
        # We need to fetch the user to get the ID.
        
        db = next(get_db())
        user = db.query(models.User).filter(models.User.email == user_id).first()
        if not user:
             raise Exception("User not found")
        
        session_key = str(user.id)

    except Exception as e:
        print(f"WS Auth Error: {e}")
        await websocket.send_json({"type": "error", "msg": "Invalid token"})
        await websocket.close()
        return

    # Does user have an active session?
    if session_key not in active_autodrive_sessions:
        await websocket.send_json({"type": "error", "msg": "No active autodrive session"})
        await websocket.close()
        return

    session = active_autodrive_sessions[session_key]
    job_ids = session["job_ids"]
    cand_ids = session["candidate_ids"]

    # Optional: Cleanup session immediately or keep it? 
    # Let's keep it for now or delete if single-use.
    del active_autodrive_sessions[session_key]

    try:
        jobs = db.query(models.Job).filter(models.Job.id.in_(job_ids)).all()
        candidates = db.query(models.Candidate).filter(models.Candidate.id.in_(cand_ids)).all()

        # Precompute candidate embeddings
        cand_vecs = {}
        for c in candidates:
            try:
                cand_vecs[c.id] = services.get_embedding(c.resume_text)
            except Exception:
                cand_vecs[c.id] = []
        
        # STREAMING LOOP
        import asyncio
        for job in jobs:
            job_key = f"{job.title} (ID {job.id})"
            try:
                job_vec = services.get_embedding(f"{job.title}. {job.description}")
            except:
                job_vec = []

            for cand in candidates:
                await asyncio.sleep(0.15)  # smooth streaming intervals

                # Semantic Score
                semantic = services.cosine_similarity(job_vec, cand_vecs.get(cand.id, [])) or 0.0

                # Deep analysis
                ai = services.analyze_candidate(cand.resume_text, job.description)

                # Upsert DB application row
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

                # STREAM JSON PACKET TO UI
                await websocket.send_json({
                    "type": "result",
                    "job_key": job_key,
                    "candidate": {
                        "candidate_id": cand.id,
                        "candidate_name": cand.name,
                        "deep_score": ai.get("score", 0),
                        "semantic_score": round(float(semantic), 3),
                        "status": ai.get("status", "Reject"),
                        "experience_score": ai.get("experience_score", 0),
                        "skills_score": ai.get("skills_score", 0),
                        "role_alignment_score": ai.get("role_alignment_score", 0),
                        "skills_found": ai.get("skills_found", []),
                        "missing_skills": ai.get("missing_skills", []),
                        "reasoning": ai.get("reasoning", ""),
                    },
                })

        await websocket.send_json({"type": "done"})
        await websocket.close()

    except Exception as e:
        print("WS autodrive error:", e)
        try:
            await websocket.send_json({"type": "error", "msg": str(e)})
        except:
            pass
        await websocket.close()


# -----------------------------
# WebSocket Chat (unchanged)
# -----------------------------
@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            if data.get("type") != "chat":
                await websocket.send_json(
                    {"type": "error", "message": "Unsupported message type"}
                )
                continue

            question = data.get("message", "").strip()
            if not question:
                await websocket.send_json(
                    {
                        "type": "chat_response",
                        "payload": {
                            "reply": "Please type a question.",
                            "action": "NONE",
                        },
                    }
                )
                continue

            try:
                answer = chat_service.ask_copilot(question, db)
            except Exception as e:
                answer = {
                    "reply": "I’m having trouble answering that right now.",
                    "action": "NONE",
                    "error": str(e),
                }

            await websocket.send_json({"type": "chat_response", "payload": answer})

    except WebSocketDisconnect:
        print("Chat WebSocket disconnected")
    except Exception as e:
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Chat error: {str(e)}"}
            )
        except Exception:
            pass
        await websocket.close()
