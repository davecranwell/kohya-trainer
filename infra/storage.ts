import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { s3User, createS3PolicyForBucket } from './user';
import { thumbnailerQueue } from './app';

const config = new pulumi.Config();

// Helper function to create a bucket with all standard configurations
function createStandardBucket(name: string, bucketName: string) {
    // Create the main bucket
    const bucket = new aws.s3.BucketV2(name, {
        bucket: bucketName,
        forceDestroy: true,
    });

    // Set ownership controls
    const ownershipControls = new aws.s3.BucketOwnershipControls(`${name}OwnershipControls`, {
        bucket: bucket.id,
        rule: {
            objectOwnership: 'BucketOwnerEnforced',
        },
    });

    // Configure public access block - MOVED UP and made dependent
    const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
        `${name}PublicAccessBlock`,
        {
            bucket: bucket.id,
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
        },
        { dependsOn: ownershipControls },
    ); // Add dependency

    // Set public access policy - Add dependencies
    const bucketPolicy = new aws.s3.BucketPolicy(
        `${name}Policy`,
        {
            bucket: bucket.id,
            policy: bucket.arn.apply((bucketArn) =>
                JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Sid: 'PublicReadGetObject',
                            Effect: 'Allow',
                            Principal: '*',
                            Action: 's3:GetObject',
                            Resource: [`${bucketArn}/*`],
                        },
                    ],
                }),
            ),
        },
        { dependsOn: [publicAccessBlock] },
    ); // Add dependency

    // Set CORS configuration
    new aws.s3.BucketCorsConfigurationV2(
        `${name}CorsConfiguration`,
        {
            bucket: bucket.id,
            corsRules: [
                {
                    allowedHeaders: ['*'],
                    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
                    allowedOrigins: ['*'],
                    maxAgeSeconds: 3000,
                },
            ],
        },
        { dependsOn: bucketPolicy },
    ); // Add dependency

    // Create and attach S3 policy to the user
    const s3Policy = bucket.id.apply(createS3PolicyForBucket);
    s3Policy.apply(
        (policy) =>
            new aws.iam.UserPolicyAttachment(`${name}UserPolicyAttachment`, {
                user: s3User.name,
                policyArn: policy.arn,
            }),
    );

    return bucket;
}

// Create your buckets using the helper function
export const bucket = createStandardBucket('imageBucket', 'my-image-resize-bucket');
export const uploadBucket = createStandardBucket('modellerUploadBucket', 'modeller-upload-bucket');
export const maxresBucket = createStandardBucket('modellerMaxresBucket', 'modeller-maxres-bucket');
export const thumbnailsBucket = createStandardBucket('modellerThumbnailsBucket', 'modeller-thumbnails-bucket');

// Create IAM role for Lambda
const zipLambdaRole = new aws.iam.Role('zipLambdaRole', {
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

const maxSizeLambdaRole = new aws.iam.Role('maxSizeLambdaRole', {
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

new aws.iam.RolePolicyAttachment('maxSizeLambdaBasicExecution', {
    role: maxSizeLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

maxresBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('maxSizeLambdaS3Policy', {
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

uploadBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('zipLambdaS3Policy', {
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

maxresBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('maxSizeLambdaS3Policy', {
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

uploadBucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('zipLambdaS3Policy', {
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

// Lambda for zipping all the bucket files into a single zip file
const zipLambda = new aws.lambda.Function('zipLambda', {
    runtime: 'nodejs18.x',
    // Lambda code is one directory up in the zip-lambda folder
    code: new pulumi.asset.FileArchive('../lambdas/zip'),
    handler: 'index.handler',
    role: zipLambdaRole.arn,
    timeout: 30,
    memorySize: 128,
    ephemeralStorage: { size: 1024 }, // Ephemeral storage needs to be at least the size of the total number of files we permit the user to upload
    environment: {
        variables: {
            // Pass the bucket name to the Lambda function
            BUCKET_NAME: maxresBucket.id,
        },
    },
});

// Lambda for resizing all the bucket files to their max allowed resolution and uploading them to the maxres bucket
const maxSizeLambda = new aws.lambda.Function(
    'maxSizeLambda',
    {
        runtime: 'nodejs18.x',
        // Lambda code is one directory up in the zip-lambda folder
        code: new pulumi.asset.FileArchive('../lambdas/maxres'),
        handler: 'index.handler',
        role: maxSizeLambdaRole.arn,
        timeout: 15 * 60, // 15 mins
        memorySize: 256,
        ephemeralStorage: { size: 1024 }, // Ephemeral storage needs to be at least the size of the total number of files we permit the user to upload
        environment: {
            variables: {
                QUEUE_URL: thumbnailerQueue.url,
                SOURCE_BUCKET_NAME: uploadBucket.id,
                TARGET_BUCKET_NAME: maxresBucket.id,
                DB_URL: config.require('DATABASE_URL'),
            },
        },
    },
    { dependsOn: [thumbnailerQueue] },
);

// Add policy allowing S3user to invoke Lambda
// This is needed because our application architecture requires the backend to trigger
// the zip Lambda function directly using AWS SDK credentials
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

// Attach the Lambda invoke policy to the S3 user
new aws.iam.UserPolicyAttachment('lambdaInvokeUserPolicyAttachment', {
    user: s3User.name,
    policyArn: lambdaInvokePolicy.arn,
});

const queueEventSource = new aws.lambda.EventSourceMapping('queueEventSource', {
    eventSourceArn: thumbnailerQueue.arn,
    functionName: maxSizeLambda.arn,
    batchSize: 5,
});

// Export the Lambda ARN for reference
export const zipLambdaArn = zipLambda.arn;
export const maxSizeLambdaArn = maxSizeLambda.arn;
