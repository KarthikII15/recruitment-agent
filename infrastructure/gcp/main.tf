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

# ------------------------------
# NETWORK + FIREWALL
# ------------------------------

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

# ------------------------------
# STARTUP SCRIPT
# ------------------------------



# ------------------------------
# VM INSTANCE
# ------------------------------

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
    access_config {}
  }

  metadata_startup_script = <<EOF
#!/bin/bash
set -xe

apt-get update -y
apt-get install -y ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

mkdir -p /opt/app
cd /opt/app

git clone -b main https://github.com/KarthikII15/recruitment-agent.git src || (cd src && git pull)
cd src

sed -i 's/5173:80/80:80/g' docker-compose.yml

docker compose up -d --build
EOF

  tags = ["http-server", "ssh-server"]
}
