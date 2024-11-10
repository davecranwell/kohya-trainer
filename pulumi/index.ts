import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';
import * as mime from 'mime';

// Create an S3 bucket for image storage
const bucket = new aws.s3.BucketV2('imageBucket', {
    bucket: 'my-image-resize-bucket',
    acl: aws.s3.CannedAcl.PublicRead,
    forceDestroy: true,
});

// // Add a sample image (optional)
// new aws.s3.BucketObject("sampleImage", {
//   bucket: bucket,
//   source: new pulumi.asset.FileAsset("path/to/sample.jpg"),
//   contentType: mime.getType("jpg") || undefined,
// });

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

// Define the Lambda@Edge function
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

// Attach policies to Lambda role
new aws.iam.RolePolicyAttachment('lambdaS3Access', {
    role: lambdaEdgeRole.name,
    policyArn: aws.iam.ManagedPolicies.AmazonS3ReadOnlyAccess,
});

// Create the CloudFront distribution
const cloudfrontDistribution = new aws.cloudfront.Distribution('imageResizerCDN', {
    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
            originId: bucket.id,
        },
    ],
    defaultCacheBehavior: {
        targetOriginId: bucket.id,
        viewerProtocolPolicy: 'redirect-to-https',
        lambdaFunctionAssociations: [
            {
                eventType: 'origin-response',
                lambdaArn: resizeLambda.qualifiedArn,
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
export const bucketUrl = bucket.bucketDomainName;
export const cloudfrontUrl = cloudfrontDistribution.domainName;
export const resizeLambdaArn = resizeLambda.role;
