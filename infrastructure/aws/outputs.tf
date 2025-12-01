output "instance_id" {
  value = aws_instance.vm.id
}

output "instance_public_ip" {
  value = aws_instance.vm.public_ip
}

output "app_url" {
  value = "http://${aws_instance.vm.public_ip}"
}
