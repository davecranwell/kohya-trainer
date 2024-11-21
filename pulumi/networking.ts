import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';

const config = new pulumi.Config();

export const vpc = new awsx.ec2.Vpc('main', {
    cidrBlock: '10.0.0.0/16',
    enableDnsHostnames: true,
    enableDnsSupport: true,
});

const bastionSecurityGroup = new aws.ec2.SecurityGroup('bastion-security-group', {
    vpcId: vpc.vpc.id,
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
    subnetId: vpc.subnets[0].id,
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    keyName: bastionKeyPair.keyName,
    tags: {
        Name: 'Database Bastion Host',
    },
});

export const bastionSecurityGroupId = bastionSecurityGroup.id;
