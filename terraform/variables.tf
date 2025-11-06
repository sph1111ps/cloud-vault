variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "filemanager"
}

variable "db_password" {
  description = "RDS master password (sensitive - set in terraform.tfvars)"
  type        = string
  sensitive   = true
}

variable "bucket_name" {
  description = "S3 bucket name (leave empty for auto-generated unique name)"
  type        = string
  default     = ""
}

variable "key_pair_name" {
  description = "EC2 key pair name"
  type        = string
  default     = "filemanager-key"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}


