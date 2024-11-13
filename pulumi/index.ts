import * as pulumi from '@pulumi/pulumi';

import { vpc, publicSubnet1, publicSubnet2, bastionHost } from './networking';
import { rdsInstance } from './database';
import { bucket } from './storage';
import { cloudfrontDistribution } from './cdn';
import { resizeLambda } from './lambda';

// Export all required values
export const vpcId = vpc.id;
export const publicSubnet1Id = publicSubnet1.id;
export const publicSubnet2Id = publicSubnet2.id;
export const bastionPublicIp = bastionHost.publicIp;
export const rdsEndpoint = rdsInstance.endpoint;
export const rdsPort = rdsInstance.port;
export const rdsUsername = rdsInstance.username;
export const bastionHostDBCommand = pulumi.interpolate`ssh -i ~/.ssh/aws-ec2 -L 5432:${rdsInstance.endpoint}:5432 ec2-user@${bastionHost.publicIp}`;
export const bucketUrn = bucket.arn;
export const bucketUrl = bucket.bucketDomainName;
export const cloudfrontUrl = cloudfrontDistribution.domainName;
