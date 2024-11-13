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

new aws.s3.BucketPublicAccessBlock('imageBucketPublicAccessBlock', {
    bucket: bucket.id,
    blockPublicAcls: false,
    blockPublicPolicy: false,
    ignorePublicAcls: false,
    restrictPublicBuckets: false,
});

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
