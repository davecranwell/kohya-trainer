import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { bucket, maxresBucket, thumbnailsBucket, uploadBucket } from './storage';

/**
 * IAM Role for Lambda@Edge
 * Lambda@Edge requires specific permissions and must be deployed in us-east-1
 */
const lambdaEdgeRole = new aws.iam.Role('lambdaEdgeRole', {
    assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: {
                    Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
                },
                Action: 'sts:AssumeRole',
            },
        ],
    }),
});

// Attach basic Lambda execution policy
new aws.iam.RolePolicyAttachment('lambdaBasicExecution', {
    role: lambdaEdgeRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

// Create S3 access policy for Lambda
const lambdaS3Policy = new aws.iam.Policy('lambdaS3Policy', {
    policy: bucket.arn.apply((bucketArn) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['s3:GetObject', 's3:PutObject', 's3:HeadObject'],
                    Resource: [`${bucketArn}/*`],
                },
                {
                    Effect: 'Allow',
                    Action: ['s3:ListBucket'],
                    Resource: [bucketArn],
                },
            ],
        }),
    ),
});

// Create logging policy for Lambda@Edge
const lambdaEdgeLoggingPolicy = new aws.iam.Policy('lambdaEdgeLoggingPolicy', {
    policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                Resource: ['arn:aws:logs:us-east-1:*:log-group:/aws/lambda/*', 'arn:aws:logs:*:*:log-group:/aws/lambda/us-east-1.*'],
            },
        ],
    }),
});

// Attach policies to Lambda role
new aws.iam.RolePolicyAttachment('lambdaEdgeLoggingAccess', {
    role: lambdaEdgeRole.name,
    policyArn: lambdaEdgeLoggingPolicy.arn,
});

new aws.iam.RolePolicyAttachment('lambdaS3Access', {
    role: lambdaEdgeRole.name,
    policyArn: lambdaS3Policy.arn,
});

/**
 * Lambda@Edge Function
 * Must be deployed in us-east-1 region to work with CloudFront
 */
export const resizeLambda = new aws.lambda.Function('resizeLambda', {
    code: new pulumi.asset.AssetArchive({
        '.': new pulumi.asset.FileArchive('../resizeLambda'),
    }),
    handler: 'index.handler',
    runtime: 'nodejs18.x',
    role: lambdaEdgeRole.arn,
    timeout: 5,
    memorySize: 128,
    publish: true, // Required for Lambda@Edge
});
