output "instance_name" {
  value = google_compute_instance.vm.name
}

output "instance_public_ip" {
  value = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}

output "app_url" {
  value = "http://${google_compute_instance.vm.network_interface[0].access_config[0].nat_ip}"
}
