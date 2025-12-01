import time
from typing import Dict, Any
from .base import CloudProvider

# You need to install:
# pip install azure-identity azure-mgmt-resource azure-mgmt-compute azure-mgmt-network

try:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.resource import ResourceManagementClient
    from azure.mgmt.compute import ComputeManagementClient
    from azure.mgmt.network import NetworkManagementClient
    from azure.mgmt.compute.models import (
        HardwareProfile, NetworkProfile, OSProfile, StorageProfile, 
        ImageReference, OSDisk, VirtualMachine, NetworkInterfaceReference
    )
    from azure.mgmt.network.models import (
        VirtualNetwork, AddressSpace, Subnet, NetworkInterface, 
        NetworkSecurityGroup, SecurityRule, IPConfiguration, PublicIPAddress
    )
except ImportError:
    print("Azure libraries not installed. AzureProvider will fail.")


class AzureProvider(CloudProvider):
    def create_vm_and_deploy(self, config: Dict[str, Any]) -> Dict[str, Any]:
        subscription_id = config["subscription_id"]
        client_id = config["client_id"]
        client_secret = config["client_secret"]
        tenant_id = config["tenant_id"]
        location = config["region"]
        
        rg_name = f"recruitment-agent-rg-{int(time.time())}"
        vm_name = "recruitment-vm"

        credential = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret
        )

        resource_client = ResourceManagementClient(credential, subscription_id)
        network_client = NetworkManagementClient(credential, subscription_id)
        compute_client = ComputeManagementClient(credential, subscription_id)

        # 1. Create Resource Group
        resource_client.resource_groups.create_or_update(
            rg_name,
            {"location": location}
        )

        # 2. Networking (VNet, Subnet, Public IP, NIC)
        # Simplified for brevity
        poller = network_client.virtual_networks.begin_create_or_update(
            rg_name,
            "vnet-1",
            {
                "location": location,
                "address_space": {"address_prefixes": ["10.0.0.0/16"]}
            }
        )
        vnet_result = poller.result()

        poller = network_client.subnets.begin_create_or_update(
            rg_name, 
            "vnet-1", 
            "subnet-1",
            {"address_prefix": "10.0.0.0/24"}
        )
        subnet_result = poller.result()

        poller = network_client.public_ip_addresses.begin_create_or_update(
            rg_name,
            "public-ip-1",
            {
                "location": location,
                "public_ip_allocation_method": "Static",
                "sku": {"name": "Standard"}
            }
        )
        public_ip_result = poller.result()

        poller = network_client.network_interfaces.begin_create_or_update(
            rg_name,
            "nic-1",
            {
                "location": location,
                "ip_configurations": [{
                    "name": "ipconfig1",
                    "subnet": {"id": subnet_result.id},
                    "public_ip_address": {"id": public_ip_result.id}
                }]
            }
        )
        nic_result = poller.result()

        # 3. Create VM
        # Cloud-init script
        user_data_script = f"""#!/bin/bash
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
        import base64
        b64_user_data = base64.b64encode(user_data_script.encode('utf-8')).decode('utf-8')

        vm_params = {
            "location": location,
            "hardware_profile": {"vm_size": config.get("instance_type", "Standard_B2s")},
            "storage_profile": {
                "image_reference": {
                    "publisher": "Canonical",
                    "offer": "UbuntuServer",
                    "sku": "18.04-LTS",
                    "version": "latest"
                },
                "os_disk": {
                    "create_option": "FromImage",
                    "managed_disk": {"storage_account_type": "Standard_LRS"}
                }
            },
            "os_profile": {
                "computer_name": vm_name,
                "admin_username": "azureuser",
                "admin_password": "ComplexPassword123!", # In real app, generate random or use SSH keys
                "custom_data": b64_user_data
            },
            "network_profile": {
                "network_interfaces": [{"id": nic_result.id}]
            }
        }

        poller = compute_client.virtual_machines.begin_create_or_update(
            rg_name,
            vm_name,
            vm_params
        )
        vm_result = poller.result()

        # Get IP
        ip_obj = network_client.public_ip_addresses.get(rg_name, "public-ip-1")
        
        return {
            "vm_id": vm_result.id,
            "public_ip": ip_obj.ip_address,
            "app_url": f"http://{ip_obj.ip_address}",
            "resource_group": rg_name
        }

    def destroy(self, config: Dict[str, Any], state: Dict[str, Any]) -> None:
        subscription_id = config["subscription_id"]
        client_id = config["client_id"]
        client_secret = config["client_secret"]
        tenant_id = config["tenant_id"]
        rg_name = state.get("resource_group")

        if not rg_name:
            return

        credential = ClientSecretCredential(tenant_id, client_id, client_secret)
        resource_client = ResourceManagementClient(credential, subscription_id)

        poller = resource_client.resource_groups.begin_delete(rg_name)
        poller.wait()
