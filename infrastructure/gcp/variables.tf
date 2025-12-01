variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = ""
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-medium"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "recruitment-agent"
}

variable "app_repo_url" {
  description = "Git repo URL of the app"
  type        = string
}

variable "app_branch" {
  description = "Git branch"
  type        = string
  default     = "main"
}

variable "docker_compose_path" {
  description = "Relative path to docker-compose.yml inside repo"
  type        = string
  default     = "."
}

variable "app_env" {
  description = "Environment variables to write to .env"
  type        = map(string)
  default     = {}
}
