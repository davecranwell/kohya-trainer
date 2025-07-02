import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { s3User } from './user';
import { maxresBucket, thumbnailsBucket, uploadBucket } from './storage';
import { maxSizeQueue, taskQueue } from './queues';

const config = new pulumi.Config();
const appName = config.require('appName');

// Create IAM role for Lambda
export const zipLambdaRole = new aws.iam.Role('zipLambdaRole', {
    assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Principal: {
                    Service: 'lambda.amazonaws.com',
                },
                Effect: 'Allow',
            },
        ],
    }),
});

// Add basic Lambda execution permissions (for CloudWatch Logs)
new aws.iam.RolePolicyAttachment('zipLambdaBasicExecution', {
    role: zipLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

export const thumbnailLambdaRole = new aws.iam.Role('thumbnailLambdaRole', {
    assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Principal: {
                    Service: 'lambda.amazonaws.com',
                },
                Effect: 'Allow',
            },
        ],
    }),
});

new aws.iam.RolePolicyAttachment('thumbnailLambdaBasicExecution', {
    role: thumbnailLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

export const maxSizeLambdaRole = new aws.iam.Role('maxSizeLambdaRole', {
    assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Principal: {
                    Service: 'lambda.amazonaws.com',
                },
                Effect: 'Allow',
            },
        ],
    }),
});

new aws.iam.RolePolicyAttachment('maxSizeLambdaBasicExecution', {
    role: maxSizeLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

// the maxsize lambda must be able to read messages from the max size queue
maxSizeQueue.arn.apply(
    (queueArn) =>
        new aws.iam.RolePolicy(`${appName}-maxsize-lambda-sqs-policy`, {
            role: maxSizeLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes', 'sqs:ChangeMessageVisibility'],
                        Resource: queueArn,
                    },
                ],
            }),
        }),
);

// the maxsize lambda must be able to send messages back on the task queue when it's done processing
taskQueue.arn.apply(
    (queueArn) =>
        new aws.iam.RolePolicy(`${appName}-maxsize-lambda-task-queue-sqs-policy`, {
            role: maxSizeLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['sqs:SendMessage'],
                        Resource: queueArn,
                    },
                ],
            }),
        }),
);

// Zip lambda must be able to access the maxres bucket becausae that's the source of its images to zip
maxresBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('maxResZipLambdaS3Policy', {
            role: zipLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            }),
        }),
);

// max size lambda must be able to write to the max res bucket because that's where it's writing the resized images
maxresBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('maxResMaxSizeLambdaS3Policy', {
            role: maxSizeLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            }),
        }),
);

// max size lambda must be able to read from the upload bucket because that's where it's reading the images from to resize
uploadBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('uploadMaxSizeLambdaS3Policy', {
            role: maxSizeLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            }),
        }),
);

// the thumbnail lambda must be able to read from the upload bucket because that's where it's reading the images from to create thumbnails
uploadBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('uploadThumbnailLambdaS3Policy', {
            role: thumbnailLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            }),
        }),
);

// the thumbnail lambda must be able to write to the thumbnails bucket because that's where it's writing the thumbnails to
thumbnailsBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('thumbnailsThumbnailLambdaS3Policy', {
            role: thumbnailLambdaRole.id,
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                        Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            }),
        }),
);

// Lambda for zipping all the max size files into a single zip file
export const zipLambda = new aws.lambda.Function('zipLambda', {
    runtime: 'nodejs22.x',
    code: new pulumi.asset.FileArchive('../lambdas/zip'),
    handler: 'index.handler',
    role: zipLambdaRole.arn,
    timeout: 60,
    memorySize: 128,
    ephemeralStorage: { size: 1024 }, // Ephemeral storage needs to be at least the size of the total number of files we permit the user to upload
    // TODO make the zip lambda take the max res bucket name as an argument rather than using the task to define it in the payload
});

// Lambda for resizing images to their max allowed resolution
export const maxSizeLambda = new aws.lambda.Function('maxSizeLambda', {
    runtime: 'nodejs22.x',
    code: new pulumi.asset.FileArchive('../lambdas/maxres'),
    handler: 'index.handler',
    role: maxSizeLambdaRole.arn,
    timeout: 15 * 60, // 15 mins
    memorySize: 256,
    ephemeralStorage: { size: 1024 },
    environment: {
        variables: {
            QUEUE_URL: maxSizeQueue.url,
            TASK_QUEUE_URL: taskQueue.url,
            SOURCE_BUCKET_NAME: uploadBucket.id,
            TARGET_BUCKET_NAME: maxresBucket.id,
        },
    },
});

// Lambda for creating thumbnails
export const thumbnailLambda = new aws.lambda.Function('thumbnailLambda', {
    runtime: 'nodejs22.x',
    code: new pulumi.asset.FileArchive('../lambdas/thumbnail'),
    handler: 'index.handler',
    role: thumbnailLambdaRole.arn,
    timeout: 15 * 60, // 15 mins
    memorySize: 256,
    ephemeralStorage: { size: 1024 },
    environment: {
        variables: {
            SOURCE_BUCKET_NAME: uploadBucket.id,
            TARGET_BUCKET_NAME: thumbnailsBucket.id,
        },
    },
});

// Add policy allowing S3user to invoke Lambda from task queue
const lambdaInvokePolicy = zipLambda.arn.apply(
    (lambdaArn) =>
        new aws.iam.Policy('lambdaInvokePolicy', {
            policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: 'lambda:InvokeFunction',
                        Resource: lambdaArn,
                    },
                ],
            }),
        }),
);

// Attach the Lambda invoke policy to the S3 user, it's this user that is active from/on the webserver remix server
new aws.iam.UserPolicyAttachment('lambdaInvokeUserPolicyAttachment', {
    user: s3User.name,
    policyArn: lambdaInvokePolicy.arn,
});

// the max size lambda is triggered by events from the max size queue
export const queueEventSource = new aws.lambda.EventSourceMapping('queueEventSource', {
    eventSourceArn: maxSizeQueue.arn,
    functionName: maxSizeLambda.arn,
    batchSize: 5,
});

// Add S3 bucket notification permissions to thumbnail Lambda role
const thumbnailPermission = new aws.lambda.Permission(`${appName}-thumbnail-lambda-invoke-permission`, {
    action: 'lambda:InvokeFunction',
    function: thumbnailLambda.name,
    principal: 's3.amazonaws.com',
    sourceArn: uploadBucket.arn,
});

// Configure S3 bucket to notify thumbnail Lambda on object creation
new aws.s3.BucketNotification(
    'uploadBucketNotification',
    {
        bucket: uploadBucket.id,
        lambdaFunctions: [
            {
                events: ['s3:ObjectCreated:*'],
                lambdaFunctionArn: thumbnailLambda.arn,
            },
        ],
    },
    { dependsOn: [thumbnailPermission] },
);
