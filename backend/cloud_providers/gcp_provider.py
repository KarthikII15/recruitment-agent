import time
import json
from typing import Dict, Any
from .base import CloudProvider

# You need to install:
# pip install google-cloud-compute

try:
    from google.cloud import compute_v1
    from google.oauth2 import service_account
except ImportError:
    print("GCP libraries not installed. GCPProvider will fail.")


class GCPProvider(CloudProvider):
    def create_vm_and_deploy(self, config: Dict[str, Any]) -> Dict[str, Any]:
        project_id = config["project_id"] # or extract from JSON
        zone = config["region"]  # e.g. us-central1-a
        instance_name = f"recruitment-vm-{int(time.time())}"
        
        # Parse service account JSON
        sa_info = json.loads(config["service_account_json"])
        credentials = service_account.Credentials.from_service_account_info(sa_info)

        instance_client = compute_v1.InstancesClient(credentials=credentials)
        operation_client = compute_v1.ZoneOperationsClient(credentials=credentials)

        # Startup script
        startup_script = f"""#!/bin/bash
apt-get update
apt-get install -y docker.io git
systemctl start docker
systemctl enable docker

curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

cd /opt
git clone {config.get("repo_url", "https://github.com/your-org/recruitment-agent-v2.git")} app
cd app
echo "DATABASE_URL={config.get("database_url", "")}" > .env
docker-compose up -d --build
"""

        instance_body = {
            "name": instance_name,
            "machine_type": f"zones/{zone}/machineTypes/{config.get('instance_type', 'e2-medium')}",
            "disks": [
                {
                    "boot": True,
                    "auto_delete": True,
                    "initialize_params": {
                        "source_image": "projects/debian-cloud/global/images/family/debian-11"
                    }
                }
            ],
            "network_interfaces": [
                {
                    "access_configs": [
                        {"name": "External NAT", "type_": "ONE_TO_ONE_NAT"}
                    ]
                }
            ],
            "metadata": {
                "items": [
                    {"key": "startup-script", "value": startup_script}
                ]
            }
        }

        operation = instance_client.insert(
            project=project_id,
            zone=zone,
            instance_resource=instance_body
        )

        # Wait for operation
        self._wait_for_operation(operation_client, operation.name, project_id, zone)

        # Get instance to find IP
        instance = instance_client.get(project=project_id, zone=zone, instance=instance_name)
        public_ip = instance.network_interfaces[0].access_configs[0].nat_i_p

        return {
            "vm_id": instance_name,
            "public_ip": public_ip,
            "app_url": f"http://{public_ip}",
            "zone": zone,
            "project_id": project_id
        }

    def destroy(self, config: Dict[str, Any], state: Dict[str, Any]) -> None:
        sa_info = json.loads(config["service_account_json"])
        credentials = service_account.Credentials.from_service_account_info(sa_info)
        
        instance_client = compute_v1.InstancesClient(credentials=credentials)
        operation_client = compute_v1.ZoneOperationsClient(credentials=credentials)

        project_id = state["project_id"]
        zone = state["zone"]
        instance_name = state["vm_id"]

        operation = instance_client.delete(
            project=project_id,
            zone=zone,
            instance=instance_name
        )
        self._wait_for_operation(operation_client, operation.name, project_id, zone)

    def _wait_for_operation(self, operation_client, operation_name, project, zone):
        while True:
            result = operation_client.get(project=project, zone=zone, operation=operation_name)
            if result.status == compute_v1.Operation.Status.DONE:
                if result.error:
                    raise Exception(f"Error during operation: {result.error}")
                return result
            time.sleep(1)
