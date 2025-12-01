variable "region" {
  description = "AWS region"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "recruitment-agent"
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH"
  type        = string
  default     = "0.0.0.0/0"
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
  description = "Path to docker-compose.yml"
  type        = string
  default     = "."
}

variable "app_env" {
  description = "Environment variables to write to .env"
  type        = map(string)
  default     = {}
}
