resource "aws_db_subnet_group" "this" {
  name       = "filemanager-subnet-group"
  subnet_ids = [for s in aws_subnet.public : s.id]
  tags = { Name = "filemanager-subnet-group" }
}

resource "aws_db_instance" "this" {
  identifier              = "filemanager-db"
  allocated_storage       = var.db_allocated_storage
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t3.micro"
  db_name                 = "filemanager"
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = true
  storage_encrypted       = true
  skip_final_snapshot     = true
  tags = { Name = "filemanager-db" }
}
