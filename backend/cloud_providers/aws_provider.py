import time
from typing import Dict, Any
import boto3

from .base import CloudProvider


class AWSProvider(CloudProvider):
    def create_vm_and_deploy(self, config: Dict[str, Any]) -> Dict[str, Any]:
        region = config["region"]
        instance_type = config.get("instance_type") or "t3.medium"
        access_key = config["access_key_id"]
        secret_key = config["secret_access_key"]

        ec2 = boto3.resource(
            "ec2",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

        # Very barebones: use Amazon Linux 2 AMI for example region.
        # In production, pick per-region AMI.
        ami_id = config.get("ami_id", "ami-0c2b8ca1dad447f8a")  # example for us-east-1

        user_data = f"""#!/bin/bash
yum update -y
yum install -y docker git
systemctl enable docker
systemctl start docker

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Fetch your repo (assuming it's public or credentials handled)
cd /opt
git clone {config.get("repo_url", "https://github.com/your-org/recruitment-agent-v2.git")} app
cd app

# create .env file from variables (you can template this better)
echo "DATABASE_URL={config.get("database_url", "")}" > .env

# Start stack via docker-compose
docker-compose up -d --build
"""

        instance = ec2.create_instances(
            ImageId=ami_id,
            MinCount=1,
            MaxCount=1,
            InstanceType=instance_type,
            UserData=user_data,
            TagSpecifications=[
                {
                    "ResourceType": "instance",
                    "Tags": [{"Key": "Name", "Value": "recruitment-agent"}],
                }
            ],
        )[0]

        instance.wait_until_running()
        instance.reload()
        public_ip = instance.public_ip_address

        app_url = f"http://{public_ip}:80"  # if you expose frontend via 80 or nginx

        return {
            "vm_id": instance.id,
            "public_ip": public_ip,
            "app_url": app_url,
        }

    def destroy(self, config: Dict[str, Any], state: Dict[str, Any]) -> None:
        region = config["region"]
        access_key = config["access_key_id"]
        secret_key = config["secret_access_key"]
        vm_id = state["vm_id"]

        ec2 = boto3.resource(
            "ec2",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

        instance = ec2.Instance(vm_id)
        instance.terminate()
        instance.wait_until_terminated()
