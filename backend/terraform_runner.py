import json
import subprocess
import os
import shutil
from typing import Dict, Any

from sqlalchemy.orm import Session
from models import Deployment


class TerraformError(Exception):
    pass


class TerraformRunner:
    def __init__(self):
        # Move OUT of backend/ folder → go to project root
        project_root = os.path.abspath(os.path.join(os.getcwd(), ".."))
        self.base_dir = os.path.join(project_root, "infrastructure", "gcp")

    # ---------------------------------------------
    # Run shell command safely and capture output
    # ---------------------------------------------
    def _run_cmd(self, cmd: list, cwd: str):
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            return result.stdout
        except subprocess.CalledProcessError as e:
            raise TerraformError(
                f"Command {' '.join(cmd)} failed:\n{e.stdout}\n{e.stderr}"
            )

    # ---------------------------------------------
    # Prepare deployment-specific TF working folder
    # ---------------------------------------------
    def _prepare_workdir(self, deployment_id: int) -> str:
        workdir = os.path.join(self.base_dir, f"deploy_{deployment_id}")

        # Remove if exists
        if os.path.exists(workdir):
            shutil.rmtree(workdir)

        # Copy only .tf files, NOT the entire folder
        os.makedirs(workdir, exist_ok=True)

        for file in os.listdir(self.base_dir):
            fpath = os.path.join(self.base_dir, file)

            # Skip any deploy_X folders
            if os.path.isdir(fpath) and file.startswith("deploy_"):
                continue

            # Copy only Terraform files
            if file.endswith(".tf") or file.endswith(".tf.json"):
                shutil.copy2(fpath, workdir)

        return workdir

    # ---------------------------------------------
    # Apply Terraform
    # ---------------------------------------------
    def apply_for_deployment(self, dep: Deployment, db: Session) -> Dict[str, Any]:
        deployment_id = dep.id

        workdir = self._prepare_workdir(deployment_id)

        # ----- Prepare tfvars -----
        config = dep.config or {}

        tfvars = {
            "project_id": config.get("project_id"),
            "region": config.get("region", "us-central1"),
            "zone": config.get("zone") or f"{config.get('region', 'us-central1')}-a",
            "name_prefix": f"ra-{deployment_id}",
            "machine_type": config.get("machine_type", "e2-medium"),
            "app_repo_url": config.get(
                "app_repo_url",
                "https://github.com/KarthikII15/recruitment-agent.git",
            ),
            "app_branch": config.get("app_branch", "main"),
        }

        with open(os.path.join(workdir, "terraform.tfvars.json"), "w") as f:
            json.dump(tfvars, f, indent=2)

        # ----- Run Terraform -----
        self._run_cmd(["terraform", "init"], cwd=workdir)
        self._run_cmd(
            ["terraform", "apply", "-auto-approve", "-input=false"], cwd=workdir
        )

        # ----- Read Outputs -----
        output_raw = self._run_cmd(["terraform", "output", "-json"], cwd=workdir)
        outputs = json.loads(output_raw)

        instance_ip = outputs["instance_public_ip"]["value"]
        app_url = outputs["app_url"]["value"]

        return {
            "public_ip": instance_ip,
            "app_url": app_url,
            "raw_outputs": outputs,
        }

    # ---------------------------------------------
    # Destroy Deployment
    # ---------------------------------------------
    def destroy_for_deployment(self, dep: Deployment):
        deployment_id = dep.id
        workdir = os.path.join(self.base_dir, f"deploy_{deployment_id}")

        if not os.path.exists(workdir):
            return False

        try:
            self._run_cmd(["terraform", "destroy", "-auto-approve"], cwd=workdir)
            shutil.rmtree(workdir)
            return True
        except TerraformError as e:
            print("Destroy error:", str(e))
            return False
