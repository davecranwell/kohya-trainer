import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

const githubOidcProvider = new aws.iam.OpenIdConnectProvider('github-oidc', {
    clientIdLists: ['sts.amazonaws.com'],
    url: 'https://token.actions.githubusercontent.com',
    thumbprintLists: ['33e4e80807204c2b6182a3a14b591acd25b5f0db', '6938fd4d98bab03faadb97b34396831e3780aea1'], // GitHub OIDC's CA thumbprint
});

// Create the IAM role
export const githubOidcRole = pulumi.all([githubOidcProvider.arn]).apply(([arn]) => {
    return new aws.iam.Role('github-oidc-role', {
        assumeRolePolicy: {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: {
                        Federated: arn,
                    },
                    Action: 'sts:AssumeRoleWithWebIdentity',
                    Condition: {
                        StringLike: {
                            'token.actions.githubusercontent.com:sub': 'repo:davecranwell/kohya-trainer:ref:refs/heads/main',
                        },
                        StringEquals: {
                            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                        },
                    },
                },
            ],
        },
    });
});

// Attach policies to the role (e.g., ECR and ECS permissions)
const ecrPolicy = new aws.iam.RolePolicyAttachment('ecr-full-access', {
    role: githubOidcRole.name,
    policyArn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess',
});

const ecsPolicy = new aws.iam.RolePolicyAttachment('ecs-full-access', {
    role: githubOidcRole.name,
    policyArn: 'arn:aws:iam::aws:policy/AmazonECS_FullAccess',
});
