import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const bucket = new aws.s3.BucketV2('imageBucket', {
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

// Add bucket policy for public read access
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

// Add a sample image (optional)
new aws.s3.BucketObject('sampleImage', {
    bucket: bucket.id,
    source: new pulumi.asset.FileAsset('assets/sample.jpg'),
    contentType: 'image/jpeg',
});

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

new aws.iam.RolePolicyAttachment('lambdaBasicExecution', {
    role: lambdaEdgeRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

// Define the Lambda@Edge function using the provider correctly
const resizeLambda = new aws.lambda.Function('resizeLambda', {
    code: new pulumi.asset.AssetArchive({
        '.': new pulumi.asset.FileArchive('../resizeLambda'),
    }),
    handler: 'index.handler',
    runtime: 'nodejs18.x',
    role: lambdaEdgeRole.arn,
    timeout: 5,
    memorySize: 128,
    publish: true,
});

const lambdaS3Policy = new aws.iam.Policy('lambdaS3Policy', {
    policy: bucket.arn.apply((bucketArn) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: [
                        's3:GetObject',
                        's3:PutObject',
                        's3:HeadObject', //used for existence checks
                    ],
                    Resource: [`${bucketArn}/*`],
                },
                {
                    Effect: 'Allow',
                    Action: ['s3:ListBucket'],
                    Resource: [`${bucketArn}`],
                },
            ],
        }),
    ),
});

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

new aws.iam.RolePolicyAttachment('lambdaEdgeLoggingAccess', {
    role: lambdaEdgeRole.name,
    policyArn: lambdaEdgeLoggingPolicy.arn,
});

// Attach policies to Lambda role
new aws.iam.RolePolicyAttachment('lambdaS3Access', {
    role: lambdaEdgeRole.name,
    policyArn: lambdaS3Policy.arn,
});

// Create the CloudFront distribution
const cloudfrontDistribution = new aws.cloudfront.Distribution('imageResizerCDN', {
    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
            originId: bucket.id,
            s3OriginConfig: {
                // Add this configuration
                originAccessIdentity: '', // Leave empty for public bucket
            },
        },
    ],
    defaultCacheBehavior: {
        targetOriginId: bucket.id,
        viewerProtocolPolicy: 'redirect-to-https',
        lambdaFunctionAssociations: [
            {
                eventType: 'origin-request',
                lambdaArn: resizeLambda.qualifiedArn,
                includeBody: false,
            },
        ],
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        forwardedValues: {
            queryString: true,
            cookies: {
                forward: 'none',
            },
        },
        compress: true,
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    enabled: true,
    restrictions: {
        geoRestriction: {
            restrictionType: 'none',
            locations: [],
        },
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
    // isIpv6Enabled: true,
    // defaultRootObject: "",
});

// Export bucket and CloudFront URLs
export const bucketUrn = bucket.arn;
export const bucketUrl = bucket.bucketDomainName;
export const cloudfrontUrl = cloudfrontDistribution.domainName;
export const resizeLambdaArn = resizeLambda.role;
