import * as aws from '@pulumi/aws';
import { bucket } from './storage';
import { resizeLambda } from './lambda'; // You'll need to create this file for Lambda configuration

export const cloudfrontDistribution = new aws.cloudfront.Distribution('imageResizerCDN', {
    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
            originId: bucket.id,
            s3OriginConfig: {
                originAccessIdentity: '',
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
});
