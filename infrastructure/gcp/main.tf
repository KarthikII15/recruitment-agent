terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

locals {
  effective_zone = var.zone != "" ? var.zone : "${var.region}-a"
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = local.effective_zone
}

data "google_compute_image" "debian" {
  family  = "debian-12"
  project = "debian-cloud"
}

resource "google_compute_network" "default" {
  name                    = "${var.name_prefix}-network"
  auto_create_subnetworks = true
}

resource "google_compute_firewall" "allow-http-ssh" {
  name    = "${var.name_prefix}-fw"
  network = google_compute_network.default.name

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "8000"]
  }

  source_ranges = ["0.0.0.0/0"]
}

locals {
  startup_script = <<-EOF
    #!/bin/bash
    set -xe

    apt-get update -y
    apt-get install -y docker.io git

    systemctl enable docker
    systemctl start docker

    # Install docker-compose
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    mkdir -p /opt/app
    cd /opt/app

    # Clone your repo
    git clone -b ${var.app_branch} ${var.app_repo_url} src || (cd src && git pull)

    cd src

    # Write .env next to docker-compose.yml (root)
    cat << 'ENVEOF' > .env
    %{ for k, v in var.app_env ~}
    ${k}=${v}
    %{ endfor ~}
    ENVEOF

    # Run docker-compose from root
    /usr/local/bin/docker-compose up -d --build
  EOF
}

resource "google_compute_instance" "vm" {
  name         = "${var.name_prefix}-vm"
  machine_type = var.machine_type

  boot_disk {
    initialize_params {
      image = data.google_compute_image.debian.self_link
      size  = 30
    }
  }

  network_interface {
    network = google_compute_network.default.name

    access_config {
      // ephemeral public IP
    }
  }

  metadata = {
    startup-script = local.startup_script
  }

  tags = ["http-server", "ssh-server"]
}
