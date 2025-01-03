import { PrismaClient, Training } from '@prisma/client';
import axios from 'axios';

import type { TaskBody } from '../task.server';

const prisma = new PrismaClient();

// Function to create a new GPU instance using Vast API
async function createGpuInstance(training: Training, zipKey: string) {
    // find instances available:
    // This query string is discoverable from the Network tab here: https://cloud.vast.ai/create/
    const query = {
        disk_space: { gte: 30 },
        reliability2: { gte: 0.950212931632136 },
        duration: { gte: 37094.045571940405 },
        verified: { eq: true },
        rentable: { eq: true },
        num_gpus: { gte: 1, lte: 1 },
        gpu_totalram: { gte: 23987.58004237308, lte: 51418.50343976141 },
        dlperf: { lte: 51.840222312450926 },
        sort_option: { 0: ['dph_total', 'asc'], 1: ['total_flops', 'asc'] },
        gpu_name: { in: ['RTX 3090 Ti', 'RTX 3090', 'RTX 4090', 'RTX 4090D', 'RTX 4080S', 'RTX 4080'] },
        order: [
            ['dph_total', 'asc'],
            ['total_flops', 'asc'],
        ],
        allocated_storage: 33.82457729796413,
        cpu_arch: { in: ['amd64'] },
        has_avx: { eq: true },
        direct_port_count: { gte: 9 },
        limit: 64,
        extra_ids: [],
        type: 'ask',
    };
    // run the query on the bundles endpoint
    const bundlesResponse = await axios.get('https://cloud.vast.ai/api/v0/bundles?q=' + encodeURIComponent(JSON.stringify(query)));
    const bundles = bundlesResponse.data.offers;

    // get the first bundle (cheapest based on the `order` above)
    const bundle = bundles[0];

    const bundleId = bundle.ask_contract_id;

    // This query string is discoverable from network tab when creating an instance: https://cloud.vast.ai/create/
    // no return value as it's largely useless and ID of isntance is already in bundle.id
    const newGpuResponse = await axios.put(
        `https://console.vast.ai/api/v0/asks/${bundleId}/`,
        JSON.stringify({
            // templates are unnecesasry here as the code that JSON config which follows is all a template truly is
            // template_id: 165993,
            // template_hash_id: 'a69eb447f9fa3ab0937f8142a858bc96',
            client_id: 'me',
            image: 'xcession2k/kohya_rest:latest',
            env: {
                HF_TOKEN: '',
                //CIVITAI_TOKEN: training.civitaiToken,
                WEB_ENABLE_AUTH: 'true',
                WEB_ENABLE_HTTPS: 'true',
                //WEB_USER: process.env.VAST_WEB_USER,
                //WEB_PASSWORD: process.env.VAST_WEB_PASSWORD,
                //WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
                //WEBHOOK_URL: process.env.WEBHOOK_URL,
                //TRAINING_ID: training.id,
                ZIP_URL: `${process.env.AWS_S3_BUCKET_NAME}/${zipKey}`,
                KOHYA_ARGS: '',
                TENSORBOARD_ARGS: '--logdir /opt/kohya_ss/logs',
                AUTO_UPDATE: 'false',
                //PROVISIONING_SCRIPT: `${process.env.ROOT_URL}/training/${training.id}/script`, //'https://raw.githubusercontent.com/davecranwell/kohya_ss/main/config/provisioning/default.sh',
                DATA_DIRECTORY: '/workspace/',
                WORKSPACE: '/workspace/',
                WORKSPACE_MOUNTED: 'force',
                SYNCTHING_TRANSPORT_PORT_HOST: '72299',
                JUPYTER_DIR: '/',
                '-p 22:22': '1',
                '-p 1111:1111': '1',
                '-p 6006:6006': '1',
                '-p 7860:7860': '1',
                '-p 8384:8384': '1',
                '-p 8888:8888': '1',
                '-p 72299:72299': '1',
                OPEN_BUTTON_TOKEN: '1',
                OPEN_BUTTON_PORT: '1111',
            },
            args_str: '',
            onstart: 'env >> /etc/environment\n/opt/ai-dock/bin/init.sh',
            runtype: 'jupyter_direc ssh_direc ssh_proxy',
            image_login: null,
            use_jupyter_lab: false,
            jupyter_dir: null,
            python_utf8: false,
            lang_utf8: false,
            disk: 30,
        }),
        {
            headers: {
                Authorization: `Bearer ${process.env.VAST_API_KEY}`,
            },
        },
    );

    const newInstanceId = newGpuResponse.data.new_contract;

    console.log(`Created new GPU instance with Vast ID: ${newInstanceId}`);
    // Create a new GpuInstance in the database
    return await prisma.gpu.create({
        data: {
            instanceId: newInstanceId.toString(),
            status: 'running',
            trainingId: training.id,
        },
    });
}

export async function assignGpuToTraining({ trainingId, zipKey }: TaskBody) {
    try {
        const training = await prisma.training.findFirst({
            where: { id: trainingId, status: 'allocateGpu' },
        });

        if (!training) {
            return false;
        }

        const gpuRecord = await createGpuInstance(training, zipKey);

        await prisma.training.update({
            where: { id: trainingId },
            data: {
                status: 'pendingImages',
                gpuId: gpuRecord.id,
                updatedAt: new Date(),
            },
        });

        console.log(`Assigned GPU ${gpuRecord.id} to training ${trainingId}`);

        return true;
    } catch (error) {
        console.error('Error assigning GPU to training:', error);
    }
}
