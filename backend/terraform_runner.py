import os
import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any

from models import Deployment


BASE_DIR = Path(__file__).resolve().parent.parent
INFRA_DIR = BASE_DIR / "infrastructure"


class TerraformError(Exception):
    pass


def _run(cmd, cwd: Path, env: Dict[str, str]) -> str:
    """Run a shell command and return stdout, raise on error."""
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if proc.returncode != 0:
        raise TerraformError(f"Command {' '.join(cmd)} failed:\n{proc.stdout}\n{proc.stderr}")
    return proc.stdout


def _prepare_workdir(deployment: Deployment) -> Path:
    """
    Copy the base infra for the provider into a per-deployment working directory.
    e.g. infrastructure/aws -> infrastructure/aws/deploy_1
    """
    provider_dir = INFRA_DIR / deployment.provider
    if not provider_dir.is_dir():
        raise TerraformError(f"Infrastructure folder not found for provider: {deployment.provider}")

    work_dir = provider_dir / f"deploy_{deployment.id}"

    # Copy template files
    if work_dir.exists():
        shutil.rmtree(work_dir)
    shutil.copytree(provider_dir, work_dir)

    return work_dir


def _write_tfvars(work_dir: Path, deployment: Deployment) -> None:
    """
    Write terraform.tfvars.json for this deployment based on deployment.config.
    """
    cfg = deployment.config or {}

    tfvars: Dict[str, Any] = {}

    if deployment.provider == "aws":
        tfvars["region"] = cfg.get("region", "us-east-1")
        tfvars["instance_type"] = cfg.get("instance_type", "t3.medium")
        tfvars["name_prefix"] = f"ra-{deployment.id}"

        # where is your repo?
        tfvars["app_repo_url"] = cfg.get(
            "app_repo_url",
            "https://github.com/KarthikII15/recruitment-agent.git",
        )
        tfvars["app_branch"] = cfg.get("app_branch", "main")
        tfvars["docker_compose_path"] = cfg.get("docker_compose_path", ".")

        # environment variables passed to .env
        tfvars["app_env"] = cfg.get("app_env", {})

    elif deployment.provider == "gcp":
        tfvars["project_id"] = cfg.get("project_id")
        # normalize region to lowercase
        region = cfg.get("region", "us-central1").lower()
        tfvars["region"] = region
        tfvars["zone"] = cfg.get("zone") or f"{region}-a"
        tfvars["machine_type"] = cfg.get("machine_type", "e2-medium")
        tfvars["name_prefix"] = f"ra-{deployment.id}"

        tfvars["app_repo_url"] = cfg.get(
            "app_repo_url",
            "https://github.com/KarthikII15/recruitment-agent.git",
        )
        tfvars["app_branch"] = cfg.get("app_branch", "main")
        tfvars["docker_compose_path"] = cfg.get("docker_compose_path", ".")
        tfvars["app_env"] = cfg.get("app_env", {})

    (work_dir / "terraform.tfvars.json").write_text(json.dumps(tfvars, indent=2))


def _env_for_deployment(deployment: Deployment) -> Dict[str, str]:
    """
    Prepare environment variables for terraform (credentials, etc).
    """
    env = os.environ.copy()
    cfg = deployment.config or {}

    if deployment.provider == "aws":
        # Provide AWS credentials via env vars
        if "access_key_id" in cfg and "secret_access_key" in cfg:
            env["AWS_ACCESS_KEY_ID"] = cfg["access_key_id"]
            env["AWS_SECRET_ACCESS_KEY"] = cfg["secret_access_key"]
        if "region" in cfg:
            env["AWS_DEFAULT_REGION"] = cfg["region"]

    elif deployment.provider == "gcp":
        # write the service account JSON into the workdir and point GOOGLE_APPLICATION_CREDENTIALS at it
        work_dir = INFRA_DIR / deployment.provider / f"deploy_{deployment.id}"
        sa_json = cfg.get("service_account_json")
        if sa_json:
            sa_path = work_dir / "gcp-sa.json"
            sa_path.write_text(sa_json)
            env["GOOGLE_APPLICATION_CREDENTIALS"] = str(sa_path)

    # Azure later...

    return env


def apply_for_deployment(deployment: Deployment) -> Dict[str, Any]:
    """
    Run 'terraform init' + 'terraform apply' for a deployment.
    Returns Terraform outputs as a dict.
    """
    work_dir = _prepare_workdir(deployment)
    _write_tfvars(work_dir, deployment)
    env = _env_for_deployment(deployment)

    # init
    _run(["terraform", "init", "-input=false"], cwd=work_dir, env=env)

    # apply
    _run(["terraform", "apply", "-auto-approve", "-input=false"], cwd=work_dir, env=env)

    # outputs
    out_json = _run(["terraform", "output", "-json"], cwd=work_dir, env=env)
    outputs = json.loads(out_json)
    return outputs


def destroy_for_deployment(deployment: Deployment) -> None:
    """
    Run 'terraform destroy' for a deployment.
    """
    provider_dir = INFRA_DIR / deployment.provider
    work_dir = provider_dir / f"deploy_{deployment.id}"
    if not work_dir.exists():
        # nothing to destroy
        return

    env = _env_for_deployment(deployment)
    _run(["terraform", "init", "-input=false"], cwd=work_dir, env=env)
    _run(["terraform", "destroy", "-auto-approve", "-input=false"], cwd=work_dir, env=env)

    # optional: cleanup
    shutil.rmtree(work_dir, ignore_errors=True)
