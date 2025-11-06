output "vpc_id" {
  value = aws_vpc.this.id
}

output "subnets" {
  value = [for s in aws_subnet.public : s.id]
}

output "ec2_sg" {
  value = aws_security_group.ec2.id
}

output "rds_sg" {
  value = aws_security_group.rds.id
}

output "alb_dns" {
  value       = aws_lb.alb.dns_name
  description = "Load Balancer DNS - Access your app at http://<this-value>"
}

output "db_endpoint" {
  value = aws_db_instance.this.endpoint
}

output "s3_bucket" {
  value = aws_s3_bucket.this.bucket
}

output "ec2_public_ip" {
  value       = aws_instance.app.public_ip
  description = "EC2 Public IP for SSH access"
}

output "private_key" {
  value     = tls_private_key.key.private_key_pem
  sensitive = true
}
