import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import { vpc } from './networking';
import { bucket } from './storage';

// Get Pulumi config to manage environment-specific values
const config = new pulumi.Config();
const appName = config.require('appName');
const containerPort = config.requireNumber('containerPort');

export const repository = new awsx.ecr.Repository(`${appName}-repo`, {
    forceDelete: true, // Allows cleanup during development - remove in production
});

const image = new awsx.ecr.Image(`${appName}-image`, {
    repositoryUrl: repository.url,
    imageName: `${appName}`,
    imageTag: 'latest',
    context: '../my-remix-app',
    platform: 'linux/amd64',
    dockerfile: '../my-remix-app/Dockerfile',
});

const cluster = new aws.ecs.Cluster(`${appName}-cluster`);

const albSecGroup = new aws.ec2.SecurityGroup(`${appName}-alb-sg`, {
    vpcId: vpc.vpcId,
    ingress: [
        {
            // Allow only http & https traffic
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['0.0.0.0/0'],
        },
        {
            protocol: 'tcp',
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ['0.0.0.0/0'],
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
});

const loadBalancer = new aws.lb.LoadBalancer(`${appName}-lb`, {
    internal: false,
    loadBalancerType: 'application',
    securityGroups: [albSecGroup.id],
    subnets: vpc.publicSubnetIds,
    enableDeletionProtection: false,
});

// Create target group separately
const targetGroup = new aws.lb.TargetGroup(`${appName}-tg`, {
    vpcId: vpc.vpcId,
    port: containerPort,
    protocol: 'HTTP',
    targetType: 'ip',
    healthCheck: {
        enabled: true,
        path: '/healthcheck',
        port: 'traffic-port',
        protocol: 'HTTP',
        healthyThreshold: 2,
        unhealthyThreshold: 2,
        timeout: 15,
        interval: 20,
        matcher: '200-405',
    },
});

// Create listener
const listener = new aws.lb.Listener(`${appName}-listener`, {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    protocol: 'HTTP',
    defaultActions: [
        {
            type: 'forward',
            targetGroupArn: targetGroup.arn,
        },
    ],
});

export const fargateSecGroup = new aws.ec2.SecurityGroup(`${appName}-fargate-sg`, {
    vpcId: vpc.vpcId,
    ingress: [
        {
            protocol: 'tcp',
            fromPort: 0,
            toPort: 65535, // TODO fix this
            cidrBlocks: ['0.0.0.0/0'], // turning this off means I can't see the tasks at their public IPs
            securityGroups: [albSecGroup.id],
        },
    ],
    egress: [
        // allow all outbound traffic
        {
            protocol: '-1',
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ['0.0.0.0/0'],
        },
    ],
});

export const fargateService = new awsx.ecs.FargateService(`${appName}-service`, {
    cluster: cluster.arn,
    desiredCount: 2,
    taskDefinitionArgs: {
        container: {
            name: appName,
            image: image.imageUri,
            cpu: 128,
            memory: 512,
            essential: true,
            portMappings: [
                {
                    containerPort: containerPort, // Container's exposed port
                    protocol: 'tcp',
                },
            ],
            environment: [
                { name: 'PORT', value: containerPort.toString() },
                { name: 'SESSION_SECRET', value: config.require('SESSION_SECRET') },
                { name: 'AWS_REGION', value: 'us-east-1' },
                { name: 'BUCKET_NAME', value: bucket.bucket },
                { name: 'ALLOW_INDEXING', value: 'false' },
                { name: 'USE_CRON', value: 'false' },
                { name: 'GOOGLE_CLIENT_ID', value: config.require('GOOGLE_CLIENT_ID') },
                { name: 'GOOGLE_CLIENT_SECRET', value: config.require('GOOGLE_CLIENT_SECRET') },
                { name: 'DATABASE_URL', value: config.require('DATABASE_URL') },
                { name: 'VAST_API_KEY', value: config.require('VAST_API_KEY') },
                { name: 'VAST_WEB_USER', value: 'admin' },
                { name: 'VAST_WEB_PASSWORD', value: config.require('VAST_WEB_PASSWORD') },
            ],
        },
    },
    networkConfiguration: {
        subnets: vpc.publicSubnetIds,
        securityGroups: [fargateSecGroup.id],
        assignPublicIp: true,
    },
    loadBalancers: [
        {
            targetGroupArn: targetGroup.arn,
            containerName: appName,
            containerPort: containerPort, // Link to the container's port
        },
    ],
});

export const url = pulumi.interpolate`http://${loadBalancer.dnsName}`;
export const loadBalancerVpcId = loadBalancer.vpcId;
export const securityGroupVpcId = albSecGroup.vpcId;
export const networkingVpcId = vpc.vpcId;

// Also log the subnets being used
export const loadBalancerSubnets = loadBalancer.subnets;
export const vpcPublicSubnets = vpc.publicSubnetIds;
