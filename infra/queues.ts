import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { s3User } from './user';

const config = new pulumi.Config();
const appName = config.require('appName');

// Queue for general task processing
export const taskQueue = new aws.sqs.Queue(`${appName}-task-queue`, {
    // AWS recommends setting a message retention period to prevent accidental loss of messages
    messageRetentionSeconds: 60 * 60, // 1 hour
    sqsManagedSseEnabled: true,
    //this should probably be a fifo queue
    //fifoQueue: true,
});

// Queue specifically for image maxsizing tasks
export const maxSizeQueue = new aws.sqs.Queue(`${appName}-maxsize-queue`, {
    // visibilityTimeoutSeconds Set to match Lambda timeout of 15 minutes. Without this amazon will throw an error during resource creation
    visibilityTimeoutSeconds: 5 * 60,
    messageRetentionSeconds: 60 * 60, // 1 hour
    sqsManagedSseEnabled: true,
});

// Policy for task queue access
export const taskQueuePolicy = new aws.iam.Policy(`${appName}-task-queue-policy`, {
    description: 'Policy to access task queue',
    policy: taskQueue.arn.apply((queueArn) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
                    Resource: queueArn,
                },
            ],
        }),
    ),
});

// Policy for maxsize queue access
export const maxSizeQueuePolicy = new aws.iam.Policy(`${appName}-maxsize-queue-policy`, {
    description: 'Policy to access maxsize queue',
    policy: maxSizeQueue.arn.apply((maxSizeQueueArn) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
                    Resource: maxSizeQueueArn,
                },
            ],
        }),
    ),
});

// Attach policies to S3 user
new aws.iam.UserPolicyAttachment('sqsTaskQueueUserPolicyAttachment', {
    user: s3User.name,
    policyArn: taskQueuePolicy.arn,
});

new aws.iam.UserPolicyAttachment('sqsMaxSizeQueueUserPolicyAttachment', {
    user: s3User.name,
    policyArn: maxSizeQueuePolicy.arn,
});
