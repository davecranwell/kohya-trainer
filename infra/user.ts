import * as aws from '@pulumi/aws';

/* Create a user for the app to use. It will need to access S3, execute lambdas and subscribe to sqs
It's badly named as it's not only a user of S3. */
export const s3User = new aws.iam.User('s3AppUser', {
    name: 's3-app-user',
    forceDestroy: true, // Deletes the user even if it has resources (e.g., access keys)
});

const s3UserAccessKey = new aws.iam.AccessKey('s3UserAccessKey', {
    user: s3User.name,
});

export const createS3PolicyForBucket = (bucketName: string) => {
    return new aws.iam.Policy(`${bucketName}s3UserAccessPolicy`, {
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
};

// Export the access key and secret
export const accessKeyId = s3UserAccessKey.id;
export const secretAccessKey = s3UserAccessKey.secret;
