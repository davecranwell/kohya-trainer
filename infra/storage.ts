import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { s3User, createS3PolicyForBucket } from './user';

const config = new pulumi.Config();
const appName = config.require('appName');

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
export const bucket = createStandardBucket('imageBucket', 'my-image-resize-bucket'); // TODO: deprecate
export const uploadBucket = createStandardBucket('modellerUploadBucket', 'modeller-upload-bucket'); // images are first uploaded here
export const maxresBucket = createStandardBucket('modellerMaxresBucket', 'modeller-maxres-bucket'); // resized to their max supported size here
export const thumbnailsBucket = createStandardBucket('modellerThumbnailsBucket', 'modeller-thumbnails-bucket'); // and created as thumbnails here
