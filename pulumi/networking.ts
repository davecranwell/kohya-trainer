import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';

const config = new pulumi.Config();

/**
 * Core VPC and subnet configuration
 */
export const vpc = new aws.ec2.Vpc('main', {
    cidrBlock: '10.0.0.0/16',
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: 'main-vpc',
    },
});

/**
 * Subnet Configuration
 * Creating two subnets in different AZs is mandatory for RDS, as per AWS requirements:
 * "A DB subnet group must contain at least one subnet in at least two AZs in the Region"
 */
export const publicSubnet1 = new aws.ec2.Subnet('public-subnet-1', {
    vpcId: vpc.id,
    cidrBlock: '10.0.1.0/24',
    availabilityZone: 'us-east-1a',
    mapPublicIpOnLaunch: true,
    tags: {
        Name: 'public-subnet-1',
    },
});

export const publicSubnet2 = new aws.ec2.Subnet('public-subnet-2', {
    vpcId: vpc.id,
    cidrBlock: '10.0.2.0/24',
    availabilityZone: 'us-east-1b',
    mapPublicIpOnLaunch: true,
    tags: {
        Name: 'public-subnet-2',
    },
});

const internetGateway = new aws.ec2.InternetGateway('main', {
    vpcId: vpc.id,
    tags: {
        Name: 'main-igw',
    },
});

const publicRouteTable = new aws.ec2.RouteTable('public', {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: '0.0.0.0/0',
            gatewayId: internetGateway.id,
        },
    ],
    tags: {
        Name: 'public-rt',
    },
});

new aws.ec2.RouteTableAssociation('public-1', {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable.id,
});

new aws.ec2.RouteTableAssociation('public-2', {
    subnetId: publicSubnet2.id,
    routeTableId: publicRouteTable.id,
});

/**
 * Bastion Host Configuration
 */
const bastionSecurityGroup = new aws.ec2.SecurityGroup('bastion-security-group', {
    vpcId: vpc.id,
    description: 'Security group for Bastion Host',
    ingress: [
        {
            protocol: 'tcp',
            fromPort: 22,
            toPort: 22,
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow SSH access from anywhere - secured by SSH key authentication',
        },
    ],
    egress: [
        {
            protocol: '-1',
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ['0.0.0.0/0'],
        },
    ],
    tags: {
        Name: 'bastion-sg',
    },
});

/**
 * Get the latest Amazon Linux 2 AMI
 * Using a data source ensures we always get the latest patched AMI
 */
const amazonLinux2Ami = aws.ec2.getAmiOutput({
    mostRecent: true,
    owners: ['amazon'],
    filters: [
        {
            name: 'name',
            values: ['amzn2-ami-hvm-*-x86_64-gp2'],
        },
    ],
});

// Read the public key from a file
// Note: Use readFileSync since Pulumi needs synchronous operations
const publicKey = fs.readFileSync('./keys/aws-ec2.pub', 'utf-8').toString().trim();

const bastionKeyPair = new aws.ec2.KeyPair('bastionKey', {
    keyName: 'bastionKey',
    publicKey: publicKey,
});

export const bastionHost = new aws.ec2.Instance('bastion', {
    ami: amazonLinux2Ami.id,
    instanceType: 't2.micro',
    subnetId: publicSubnet1.id,
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    keyName: bastionKeyPair.keyName,
    tags: {
        Name: 'Database Bastion Host',
    },
});

export const bastionSecurityGroupId = bastionSecurityGroup.id;
