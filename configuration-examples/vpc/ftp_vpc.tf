resource "aws_vpc" "ftp" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  instance_tenancy     = "default"

  tags = "${merge(
    local.tags,
    map("Name", "ftpVPC"),
  )}"
}

# Private Subnet
resource "aws_subnet" "ftpPrivate" {
  vpc_id                  = "${aws_vpc.ftp.id}"
  cidr_block              = "10.0.10.0/24"
  availability_zone       = "eu-west-1a"
  map_public_ip_on_launch = false

  tags = "${merge(
    local.tags,
    map("Name", "ftpPrivateSubnet"),
  )}"
}

resource "aws_route_table" "ftpPrivateRouteTable" {
  vpc_id = "${aws_vpc.ftp.id}"

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = "${aws_nat_gateway.ftpNAT.id}"
  }

  tags = "${merge(
    local.tags,
    map("Name", "ftpPrivateRouteTable"),
  )}"
}

resource "aws_route_table_association" "ftpPrivateRouteTableAssociation" {
  route_table_id = "${aws_route_table.ftpPrivateRouteTable.id}"
  subnet_id      = "${aws_subnet.ftpPrivate.id}"
}

resource "aws_security_group" "ftpLambdaSecurityGroup" {
  name        = "ftpLambdaSecurityGroup"
  description = "FTP Lambda Execution Security Group"
  vpc_id      = "${aws_vpc.ftp.id}"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = "${merge(
    local.tags,
    map("Name", "ftpLambdaSecurityGroup"),
  )}"
}

# Public Subnet

resource "aws_subnet" "ftpPublic" {
  vpc_id                  = "${aws_vpc.ftp.id}"
  cidr_block              = "10.0.11.0/24"
  availability_zone       = "eu-west-1a"
  map_public_ip_on_launch = false

  tags = "${merge(
    local.tags,
    map("Name", "ftpPublicSubnet"),
  )}"
}

resource "aws_internet_gateway" "ftp" {
  vpc_id = "${aws_vpc.ftp.id}"

  tags = "${merge(
    local.tags,
    map("Name", "ftpIGW"),
  )}"
}

resource "aws_route_table" "ftpPublicRouteTable" {
  vpc_id = "${aws_vpc.ftp.id}"

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = "${aws_internet_gateway.ftp.id}"
  }

  tags = "${merge(
    local.tags,
    map("Name", "ftpPublicRouteTable"),
  )}"
}

resource "aws_route_table_association" "ftpPublicRouteTableAssociation" {
  route_table_id = "${aws_route_table.ftpPublicRouteTable.id}"
  subnet_id      = "${aws_subnet.ftpPublic.id}"
}

resource "aws_eip" "ftpEIP" {
  vpc = true

  tags = "${merge(
    local.tags,
    map("Name", "ftpEIP"),
  )}"
}

resource "aws_nat_gateway" "ftpNAT" {
  allocation_id = "${aws_eip.ftpEIP.id}"
  subnet_id     = "${aws_subnet.ftpPublic.id}"

  tags = "${merge(
    local.tags,
    map("Name", "ftpNAT"),
  )}"
}
