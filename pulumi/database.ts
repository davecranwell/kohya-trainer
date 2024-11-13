import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { vpc, publicSubnet1, publicSubnet2, bastionSecurityGroupId } from './networking';

const config = new pulumi.Config();

/**
 * RDS Security Group Configuration
 */
const rdsSecurityGroup = new aws.ec2.SecurityGroup('rds-security-group', {
    vpcId: vpc.id,
    description: 'Security group for RDS PostgreSQL instance',
    ingress: [
        {
            protocol: 'tcp',
            fromPort: 5432,
            toPort: 5432,
            securityGroups: [bastionSecurityGroupId],
        },
    ],
    egress: [
        {
            protocol: '-1',
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ['0.0.0.0/0'],
        },
    ],
    tags: {
        Name: 'rds-sg',
    },
});

const rdsSubnetGroup = new aws.rds.SubnetGroup('rds-subnet-group', {
    subnetIds: [publicSubnet1.id, publicSubnet2.id],
    tags: {
        Name: 'RDS subnet group',
    },
});

const dbParameterGroup = new aws.rds.ParameterGroup('postgres-params', {
    family: 'postgres15',
    description: 'Custom parameter group for PostgreSQL with logging',
    parameters: [
        { name: 'log_statement', value: 'all' },
        { name: 'log_min_duration_statement', value: '1000' },
        { name: 'log_connections', value: '1' },
        { name: 'log_disconnections', value: '1' },
        { name: 'log_lock_waits', value: '1' },
        { name: 'log_temp_files', value: '0' },
    ],
});

export const rdsInstance = new aws.rds.Instance('postgres-instance', {
    engine: 'postgres',
    engineVersion: '15.5',
    instanceClass: 'db.t3.micro',
    allocatedStorage: 20,
    dbName: 'modeller',
    username: 'modeller',
    password: config.requireSecret('DB_PASSWORD'),
    skipFinalSnapshot: false,
    publiclyAccessible: false,
    vpcSecurityGroupIds: [rdsSecurityGroup.id],
    dbSubnetGroupName: rdsSubnetGroup.name,
    parameterGroupName: dbParameterGroup.name,
    performanceInsightsEnabled: true,
    performanceInsightsRetentionPeriod: 7,
});
