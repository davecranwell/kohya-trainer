import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { s3User, createS3PolicyForBucket } from './user';

export const bucket = new aws.s3.BucketV2('imageBucket', {
    bucket: 'my-image-resize-bucket',
    forceDestroy: true,
});

new aws.s3.BucketOwnershipControls('imageBucketOwnershipControls', {
    bucket: bucket.id,
    rule: {
        objectOwnership: 'BucketOwnerEnforced',
    },
});

/* This is a public policy, attached to no specific user, but applying to all users */
/* We will need a user-attached policy to allow the app to upload */
new aws.s3.BucketPolicy('imageBucketPolicy', {
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
});

new aws.s3.BucketPublicAccessBlock('imageBucketPublicAccessBlock', {
    bucket: bucket.id,
    blockPublicAcls: false,
    blockPublicPolicy: false,
    ignorePublicAcls: false,
    restrictPublicBuckets: false,
});

// Attach S3 policy to the user
const s3Policy = bucket.id.apply(createS3PolicyForBucket);

// Attach the policy to the user
s3Policy.apply(
    (policy) =>
        new aws.iam.UserPolicyAttachment('s3UserPolicyAttachment', {
            user: s3User.name,
            policyArn: policy.arn,
        }),
);

// Export the user for use in other files
export { s3User } from './user';

// Create IAM role for Lambda
const lambdaRole = new aws.iam.Role('zipLambdaRole', {
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
    role: lambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

// Create S3 access policy for Lambda
const lambdaS3Policy = bucket.id.apply(
    (bucketName) =>
        new aws.iam.RolePolicy('zipLambdaS3Policy', {
            role: lambdaRole.id,
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

// Create Lambda function
const lambda = new aws.lambda.Function('zipLambda', {
    runtime: 'nodejs18.x',
    // Lambda code is one directory up in the zip-lambda folder
    code: new pulumi.asset.FileArchive('../zip-lambda'),
    handler: 'index.handler',
    role: lambdaRole.arn,
    timeout: 30,
    memorySize: 128,
    ephemeralStorage: { size: 1024 }, // Ephemeral storage needs to be at least the size of the total number of files we permit the user to upload
    environment: {
        variables: {
            // Pass the bucket name to the Lambda function
            BUCKET_NAME: bucket.id,
        },
    },
});

// Export the Lambda ARN for reference
export const lambdaArn = lambda.arn;
