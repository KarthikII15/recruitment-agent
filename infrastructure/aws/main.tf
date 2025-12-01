terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_security_group" "sg" {
  name        = "${var.name_prefix}-sg"
  description = "Security group for Recruitment Agent"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_ingress_cidr]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-sg"
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnet_ids" "default" {
  vpc_id = data.aws_vpc.default.id
}

locals {
  user_data = <<-EOF
    #!/bin/bash
    set -xe

    yum update -y
    yum install -y docker git

    systemctl enable docker
    systemctl start docker

    # Install docker-compose
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Clone your project
    mkdir -p /opt/app
    cd /opt/app

    git clone -b ${var.app_branch} ${var.app_repo_url} src || (cd src && git pull)

    # Move into the project root (where docker-compose.yml is)
    cd src

    # Write .env for backend
    cat << 'ENVEOF' > .env
    %{ for k, v in var.app_env ~}
    ${k}=${v}
    %{ endfor ~}
    ENVEOF

    # RUN via docker-compose ( ROOT LEVEL )
    /usr/local/bin/docker-compose up -d --build
  EOF
}

resource "aws_instance" "vm" {
  ami                         = data.aws_ami.amazon_linux_2.id
  instance_type               = var.instance_type
  subnet_id                   = element(data.aws_subnet_ids.default.ids, 0)
  vpc_security_group_ids      = [aws_security_group.sg.id]
  associate_public_ip_address = true
  user_data                   = local.user_data

  tags = {
    Name = "${var.name_prefix}-vm"
  }
}
