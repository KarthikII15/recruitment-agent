output "instance_name" {
  description = "Name of VM"
  value       = google_compute_instance.vm.name
}

output "instance_public_ip" {
  description = "Public IP address"
  value       = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}

output "app_url" {
  description = "Frontend HTTP URL"
  value       = "http://${google_compute_instance.vm.network_interface[0].access_config[0].nat_ip}"
}
