import * as pulumi from '@pulumi/pulumi';

import * as networking from './networking';
import { rdsInstance } from './database';
import { bucket, maxresBucket, thumbnailsBucket, uploadBucket } from './storage';
import { accessKeyId, secretAccessKey } from './user';
// import { cloudfrontDistribution } from './cdn';
// import { resizeLambda } from './lambda';
import * as app from './app';
import * as githubActions from './github-actions';

// Export all required values
export const bastionPublicIp = networking.bastionHost.publicIp;
export const bastionHostDBCommand = pulumi.interpolate`ssh -i ~/.ssh/aws-ec2 -L ${rdsInstance.port}:${rdsInstance.endpoint} ec2-user@${networking.bastionHost.publicIp}`;
export const rdsEndpoint = rdsInstance.endpoint;
export const rdsPort = rdsInstance.port;
export const rdsUsername = rdsInstance.username;
export const bucketUrn = bucket.arn;
export const bucketUrl = bucket.bucketDomainName;
export const maxresBucketUrn = maxresBucket.arn;
export const maxresBucketUrl = maxresBucket.bucketDomainName;
export const thumbnailsBucketUrn = thumbnailsBucket.arn;
export const thumbnailsBucketUrl = thumbnailsBucket.bucketDomainName;
export const uploadBucketUrn = uploadBucket.arn;
export const uploadBucketUrl = uploadBucket.bucketDomainName;
// export const cloudfrontUrl = cloudfrontDistribution.domainName;
export const repository = app.repository.url;
export const appUrl = app.url;
export const githubOidcRole = githubActions.githubOidcRole.arn;
export const s3AccessKeyId = accessKeyId;
export const s3SecretAccessKey = secretAccessKey;
export const taskQueueUrl = app.taskQueueUrl;
export const taskQueueArn = app.taskQueueArn;
export const thumbnailerQueueUrl = app.thumbnailerQueueUrl;
export const thumbnailerQueueArn = app.thumbnailerQueueArn;
