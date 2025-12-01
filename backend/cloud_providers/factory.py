from .aws_provider import AWSProvider
from .azure_provider import AzureProvider
from .gcp_provider import GCPProvider

from .base import CloudProvider


def get_provider(provider: str) -> CloudProvider:
    provider = provider.lower()
    if provider == "aws":
        return AWSProvider()
    elif provider == "azure":
        return AzureProvider()
    elif provider == "gcp":
        return GCPProvider()
    else:
        raise ValueError(f"Unsupported provider: {provider}")
