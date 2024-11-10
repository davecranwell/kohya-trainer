/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: 'TrainerApp',
            removal: input?.stage === 'production' ? 'retain' : 'remove',
            home: 'aws',
        };
    },
    async run() {
        let rds;
        let DATABASE_URL;

        const vpc = new sst.aws.Vpc('TrainerAppVpc', { bastion: true });
        const cluster = new sst.aws.Cluster('TrainerAppCluster', { vpc });
        const bucket = new sst.aws.Bucket('TrainerAppBucket', { access: 'public' });
        // const thumbnailer = new sst.aws.Function('TrainerAppBucketThumbnailer', {
        //     dev: false,
        //     handler: 'thumbnail-lambda/index.handler',
        //     runtime: 'nodejs20.x',
        //     vpc,
        //     nodejs: {
        //         install: ["sharp"]
        //       }
        // });
        bucket.subscribe(
            {
                handler: 'thumbnail-lambda/thumbnail.handler',
                bundle: 'thumbnail-lambda',
            },
            {
                events: ['s3:ObjectCreated:*'],
            },
        );
        //bucket.subscribe('arn:aws:lambda:us-east-1:416853679276:function:Thumbnailer');

        const isDev = process.env.SST_STAGE !== 'production';

        if (isDev) {
            rds = new sst.Linkable('TrainerAppPostgres', {
                properties: {
                    url: 'postgresql://postgres:postgres@localhost:5432/trainerapp',
                },
            });
            DATABASE_URL = rds.properties.url;
        } else {
            rds = new sst.aws.Postgres('TrainerAppPostgres', { vpc });
            DATABASE_URL = $interpolate`postgresql://${rds.username}:${rds.password}@${rds.host}:${rds.port}/${rds.database}`;
        }

        if (!rds) {
            throw new Error('No RDS instance found');
        }

        new sst.x.DevCommand('Prisma', {
            environment: { DATABASE_URL },
            dev: {
                autostart: false,
                command: 'npx prisma studio',
            },
        });

        cluster.addService('TrainerAppSite', {
            environment: { DATABASE_URL },
            scaling: {
                min: 1,
                max: 2,
                cpuUtilization: 50,
                memoryUtilization: 50,
            },
            public: {
                ports: [{ listen: '80/http', forward: '3000/http' }],
            },
            dev: {
                command: 'npm run dev',
            },
            link: [bucket, rds],
        });
    },
});
