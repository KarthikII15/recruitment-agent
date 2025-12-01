from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    resume_text = Column(Text) # Extracted text from PDF
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    candidate_id = Column(Integer, ForeignKey("candidates.id"))

    # Overall score (0–100)
    match_score = Column(Integer, default=0)

    # Final status
    status = Column(String, default="Pending")   # Shortlist / Reject

    # AI explanation
    reasoning = Column(Text, nullable=True)

    # NEW — Gate scores
    experience_score = Column(Integer, default=0)
    skills_score = Column(Integer, default=0)
    role_alignment_score = Column(Integer, default=0)

    # NEW — Stability flag
    stability_flag = Column(String, default="OK")   # OK / RISK

    # NEW — store arrays as JSON
    missing_skills = Column(JSON, default=[])
    skills_found = Column(JSON, default=[])

    created_at = Column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    provider = Column(String, index=True)  # 'gcp', 'aws', 'azure'
    region = Column(String)
    instance_type = Column(String, nullable=True)

    vm_id = Column(String, nullable=True)
    public_ip = Column(String, nullable=True)
    app_url = Column(String, nullable=True)

    config = Column(JSON, default={})

    status = Column(String, default="pending")  # pending / provisioning / running / error / destroying / destroyed
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
