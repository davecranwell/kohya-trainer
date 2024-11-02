/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: 'myloraapp',
            removal: input?.stage === 'production' ? 'retain' : 'remove',
            home: 'aws',
        };
    },
    async run() {
        const vpc = new sst.aws.Vpc('MyVpc', { bastion: true });
        const cluster = new sst.aws.Cluster('MyCluster', { vpc });
        const bucket = new sst.aws.Bucket('myloraappbucket');

        cluster.addService('MyService', {
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
            link: [bucket],
        });
    },
});
