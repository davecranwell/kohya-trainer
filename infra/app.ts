import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';

import { vpc } from './networking';
import { bucket, maxresBucket, thumbnailsBucket, uploadBucket } from './storage';
import { s3User } from './user';
import { taskQueue, maxSizeQueue, taskQueuePolicy, maxSizeQueuePolicy } from './queues';

// Get Pulumi config to manage environment-specific values
const config = new pulumi.Config();
const appName = config.require('appName');
const containerPort = config.requireNumber('containerPort');

export const repository = new awsx.ecr.Repository(`${appName}-repo`, {
    forceDelete: true, // Allows cleanup during development - remove in production
});

// const image = new awsx.ecr.Image(`${appName}-image`, {
//     repositoryUrl: repository.url,
//     imageName: `${appName}`,
//     imageTag: 'latest',
//     context: '../my-remix-app',
//     platform: 'linux/amd64',
//     dockerfile: '../my-remix-app/Dockerfile',
// });

const image = {
    /*
     * We'll reference a pre-built image instead of building it via Pulumi
     * This avoids the NAT Gateway requirement for image building
     * You'll need to build and push the image manually or via CI/CD
     */
    imageUri: pulumi.interpolate`${repository.url}:latest`,
};

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

export const fargateSecGroup = new aws.ec2.SecurityGroup(`${appName}-fargate-sg`, {
    vpcId: vpc.vpcId,
    ingress: [
        {
            protocol: 'tcp',
            fromPort: containerPort, // was0
            toPort: containerPort, // was 65535, // TODO fix this
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

const loadBalancer = new aws.lb.LoadBalancer(
    `${appName}-lb`,
    {
        internal: false,
        loadBalancerType: 'application',
        securityGroups: [albSecGroup.id],
        subnets: vpc.publicSubnetIds,
        enableDeletionProtection: false,
    },
    { dependsOn: [albSecGroup] },
);

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
const listener = new aws.lb.Listener(
    `${appName}-listener`,
    {
        loadBalancerArn: loadBalancer.arn,
        port: 80,
        protocol: 'HTTP',
        defaultActions: [
            {
                type: 'forward',
                targetGroupArn: targetGroup.arn,
            },
        ],
    },
    { dependsOn: [targetGroup, loadBalancer] },
);

// Add this after the queue definition and before the fargateService
const taskRole = new aws.iam.Role(`${appName}-task-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'ecs-tasks.amazonaws.com',
                },
            },
        ],
    }),
});

// Attach the SQS policy to the task role
new aws.iam.RolePolicyAttachment(`${appName}-task-role-policy`, {
    role: taskRole.name,
    policyArn: taskQueuePolicy.arn,
});

new aws.iam.RolePolicyAttachment(
    `${appName}-maxsize-role-policy`,
    {
        role: taskRole.name,
        policyArn: maxSizeQueuePolicy.arn,
    },
    { dependsOn: [maxSizeQueuePolicy] },
);

export const fargateService = new awsx.ecs.FargateService(
    `${appName}-service`,
    {
        cluster: cluster.arn,
        desiredCount: 1,
        taskDefinitionArgs: {
            taskRole: {
                roleArn: taskRole.arn,
            },
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
                    { name: 'LOG_LEVEL', value: 'info' },
                    { name: 'AWS_REGION', value: 'us-east-1' },
                    { name: 'AWS_SQS_TASK_QUEUE_URL', value: taskQueue.url },
                    { name: 'AWS_SQS_MAXSIZE_QUEUE_URL', value: maxSizeQueue.url },
                    { name: 'ALLOW_INDEXING', value: 'false' },
                    { name: 'USE_CRON', value: 'true' },
                    { name: 'USE_QUEUE', value: 'true' },
                    { name: 'AWS_S3_BUCKET_NAME', value: bucket.bucket },
                    { name: 'AWS_S3_UPLOAD_BUCKET_NAME', value: uploadBucket.bucket },
                    { name: 'AWS_S3_MAXRES_BUCKET_NAME', value: maxresBucket.bucket },
                    { name: 'AWS_S3_THUMBNAILS_BUCKET_NAME', value: thumbnailsBucket.bucket },
                    { name: 'VAST_WEB_USER', value: 'admin' },
                    { name: 'CIVITAI_KEY', value: config.require('CIVITAI_KEY') },
                    { name: 'SESSION_SECRET', value: config.require('SESSION_SECRET') },
                    { name: 'AWS_ACCESS_KEY_ID', value: config.require('AWS_ACCESS_KEY_ID') },
                    { name: 'AWS_SECRET_ACCESS_KEY', value: config.require('AWS_SECRET_ACCESS_KEY') },
                    { name: 'ZIP_IMAGES_LAMBDA_NAME', value: config.require('ZIP_IMAGES_LAMBDA_NAME') },
                    { name: 'GOOGLE_CLIENT_ID', value: config.require('GOOGLE_CLIENT_ID') },
                    { name: 'GOOGLE_CLIENT_SECRET', value: config.require('GOOGLE_CLIENT_SECRET') },
                    { name: 'DATABASE_URL', value: config.require('DATABASE_URL') },
                    { name: 'VAST_API_KEY', value: config.require('VAST_API_KEY') },
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
    },
    { dependsOn: [targetGroup, loadBalancer, fargateSecGroup] },
);

export const url = pulumi.interpolate`http://${loadBalancer.dnsName}`;
export const loadBalancerVpcId = loadBalancer.vpcId;
export const securityGroupVpcId = albSecGroup.vpcId;
export const networkingVpcId = vpc.vpcId;

// Also log the subnets being used
export const loadBalancerSubnets = loadBalancer.subnets;
export const vpcPublicSubnets = vpc.publicSubnetIds;

export const taskQueueUrl = taskQueue.url;
export const taskQueueArn = taskQueue.arn;
