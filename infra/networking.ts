import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';

const config = new pulumi.Config();

const vpcMain = new aws.ec2.Vpc('main', {
    cidrBlock: '10.0.0.0/16',
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: 'main',
    },
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway('main', {
    vpcId: vpcMain.id,
    tags: {
        Name: 'main',
    },
});

// Create public subnets in different AZs
const publicSubnet1 = new aws.ec2.Subnet('public-1', {
    vpcId: vpcMain.id,
    cidrBlock: '10.0.1.0/24',
    availabilityZone: 'us-east-1a', // Adjust for your region
    mapPublicIpOnLaunch: true, // Auto-assign public IPs
    tags: {
        Name: 'public-1',
    },
});

const publicSubnet2 = new aws.ec2.Subnet('public-2', {
    vpcId: vpcMain.id,
    cidrBlock: '10.0.2.0/24',
    availabilityZone: 'us-east-1b', // Adjust for your region
    mapPublicIpOnLaunch: true, // Auto-assign public IPs
    tags: {
        Name: 'public-2',
    },
});

// Create a route table for public subnets
const publicRouteTable = new aws.ec2.RouteTable('public', {
    vpcId: vpcMain.id,
    routes: [
        {
            cidrBlock: '0.0.0.0/0',
            gatewayId: internetGateway.id,
        },
    ],
    tags: {
        Name: 'public',
    },
});

// Associate the route table with public subnets
const publicRtAssoc1 = new aws.ec2.RouteTableAssociation('public-1', {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable.id,
});

const publicRtAssoc2 = new aws.ec2.RouteTableAssociation('public-2', {
    subnetId: publicSubnet2.id,
    routeTableId: publicRouteTable.id,
});

const bastionSecurityGroup = new aws.ec2.SecurityGroup('bastion-security-group', {
    vpcId: vpcMain.id,
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
// const amazonLinux2Ami = aws.ec2.getAmiOutput({
//     mostRecent: true,
//     owners: ['amazon'],
//     filters: [
//         {
//             name: 'name',
//             values: ['amzn2-ami-hvm-*-x86_64-gp2'],
//         },
//     ],
// });

const bastionAmiId = 'ami-032ae1bccc5be78ca';

// Read the public key from a file
// Note: Use readFileSync since Pulumi needs synchronous operations
const publicKey = fs.readFileSync('./keys/aws-ec2.pub', 'utf-8').toString().trim();

const bastionKeyPair = new aws.ec2.KeyPair('bastionKey', {
    keyName: 'bastionKey',
    publicKey: publicKey,
});

export const bastionHost = new aws.ec2.Instance('bastion', {
    ami: bastionAmiId,
    instanceType: 't2.nano',
    subnetId: publicSubnet1.id,
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    keyName: bastionKeyPair.keyName,
    tags: {
        Name: 'Database Bastion Host',
    },
});

export const bastionSecurityGroupId = bastionSecurityGroup.id;

export const vpc = {
    vpcId: vpcMain.id,
    publicSubnetIds: [publicSubnet1.id, publicSubnet2.id],
    vpc: vpcMain,
    subnets: [publicSubnet1], // For backward compatibility with bastionHost
};
