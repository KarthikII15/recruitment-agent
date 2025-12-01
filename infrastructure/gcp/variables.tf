variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region, e.g., us-central1"
  type        = string
}

variable "zone" {
  description = "GCP zone, e.g., us-central1-a"
  type        = string
  default     = ""
}

variable "name_prefix" {
  description = "Prefix for VM, network etc."
  type        = string
  default     = "ra"
}

variable "machine_type" {
  description = "VM machine type"
  type        = string
  default     = "e2-medium"
}

variable "app_repo_url" {
  description = "Git repo URL"
  type        = string
  default     = "https://github.com/KarthikII15/recruitment-agent.git"
}

variable "app_branch" {
  description = "Branch to clone"
  type        = string
  default     = "main"
}
