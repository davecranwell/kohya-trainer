import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

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

/* Create a user for the app to use */
const s3User = new aws.iam.User('s3AppUser', {
    name: 's3-app-user',
    forceDestroy: true, // Deletes the user even if it has resources (e.g., access keys)
});

const s3UserAccessKey = new aws.iam.AccessKey('s3UserAccessKey', {
    user: s3User.name,
});

const s3Policy = bucket.id.apply((bucketName) => {
    return new aws.iam.Policy('s3Policy', {
        description: 'S3 access policy for the web app user',
        policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
                    Resource: `arn:aws:s3:::${bucketName}/*`,
                },
            ],
        }),
    });
});

// Attach the policy to the user
s3Policy.apply(
    (policy) =>
        new aws.iam.UserPolicyAttachment('s3UserPolicyAttachment', {
            user: s3User.name,
            policyArn: policy.arn,
        }),
);

// Export the access key and secret
export const accessKeyId = s3UserAccessKey.id;
export const secretAccessKey = s3UserAccessKey.secret;
