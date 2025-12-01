from abc import ABC, abstractmethod
from typing import Dict, Any


class CloudProvider(ABC):
    @abstractmethod
    def create_vm_and_deploy(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Should:
        - create VM
        - install Docker
        - pull & run your app (from Docker Hub or Git repo)
        Returns dict like:
        {
            "vm_id": "...",
            "public_ip": "...",
            "app_url": "http://...",
        }
        """
        raise NotImplementedError

    @abstractmethod
    def destroy(self, config: Dict[str, Any], state: Dict[str, Any]) -> None:
        """
        Destroy VM and attached infra (security groups, disks, etc).
        """
        raise NotImplementedError
