# ============================================
# DEPLOY ROUTES (FINAL PRODUCTION VERSION)
# ============================================

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from database import get_db
from models import Deployment
from terraform_runner import TerraformRunner
from pydantic import BaseModel

router = APIRouter(prefix="/deploy", tags=["Deployments"])

tf = TerraformRunner()


# --------------------------------------------
# Helper: Provision VM in background
# --------------------------------------------
def run_provisioning(deployment_id: int):
    from database import SessionLocal

    session = SessionLocal()
    dep: Deployment = session.query(Deployment).get(deployment_id)

    try:
        dep.status = "provisioning"
        session.commit()

        outputs = tf.apply_for_deployment(dep, session)

        dep.public_ip = outputs["public_ip"]
        dep.app_url = outputs["app_url"]
        dep.status = "running"
        session.commit()

    except Exception as e:
        dep.status = "error"
        dep.error_message = str(e)
        session.commit()

    finally:
        session.close()


class StartDeploymentRequest(BaseModel):
    provider: str
    region: Optional[str] = "us-central1"
    project_id: Optional[str] = None
    service_account_json: Optional[str] = None
    machine_type: Optional[str] = "e2-medium"
    app_branch: Optional[str] = "main"

class UndeployRequest(BaseModel):
    deployment_id: int

# --------------------------------------------
# 🚀 START DEPLOYMENT
# --------------------------------------------
@router.post("/start")
def start_deployment(
    req: StartDeploymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    provider = req.provider.lower()
    if provider != "gcp":
        raise HTTPException(status_code=400, detail="Only GCP is supported currently")

    # Create database record
    dep = Deployment(
        provider="gcp",
        region=req.region,
        status="pending",
        config=req.dict(),
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)

    # Background provisioning
    background_tasks.add_task(run_provisioning, dep.id)

    return {
        "id": dep.id,
        "provider": dep.provider,
        "status": dep.status,
        "app_url": dep.app_url,
        "public_ip": dep.public_ip,
        "error_message": dep.error_message,
    }


# --------------------------------------------
# 🔄 STATUS CHECK
# --------------------------------------------
@router.get("/{deployment_id}/status")
def check_status(deployment_id: int, db: Session = Depends(get_db)):
    dep = db.query(Deployment).get(deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {
        "id": dep.id,
        "status": dep.status,
        "app_url": dep.app_url,
        "public_ip": dep.public_ip,
        "error_message": dep.error_message,
    }


# --------------------------------------------
# ❌ UNDEPLOY / DESTROY VM
# --------------------------------------------
@router.post("/undeploy")
def undeploy(req: UndeployRequest, db: Session = Depends(get_db)):
    dep = db.query(Deployment).get(req.deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Run destroy synchronously for now, or move to background if preferred
    # The user request example showed it inline, but for long running tasks background is better.
    # However, the user provided code calls tf.destroy_for_deployment directly.
    
    # Let's wrap it in a try/except block as per the user's snippet
    
    try:
        ok = tf.destroy_for_deployment(dep)
        if not ok:
            dep.status = "error"
            dep.error_message = "Failed to destroy resources"
            db.commit()
            return {
                "success": False,
                "message": "Unable to destroy resources. Check logs.",
            }

        dep.status = "destroyed"
        db.commit()

        return {
            "success": True,
            "message": "Deployment destroyed successfully",
        }
    except Exception as e:
        dep.status = "error"
        dep.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
