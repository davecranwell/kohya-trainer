import { PrismaClient, Training } from '@prisma/client';
import axios from 'axios';

import type { TaskBody } from '../taskDag.server';

const prisma = new PrismaClient();

// Function to create a new GPU instance using Vast API
async function createGpuInstance() {
    // find instances available:
    // This query string is discoverable from the Network tab here: https://cloud.vast.ai/create/
    const query = {
        disk_space: { gte: 30 },
        reliability2: { gte: 0.950212931632136 },
        duration: { gte: 37094.045571940405 },
        verified: { eq: true },
        rentable: { eq: true },
        num_gpus: { gte: 1, lte: 1 },
        inet_down: { gte: 500 },
        gpu_totalram: { gte: 23987.58004237308, lte: 51418.50343976141 },
        dlperf: { lte: 51.840222312450926 },
        sort_option: { 0: ['dph_total', 'asc'], 1: ['total_flops', 'asc'] },
        geolocation: {
            in: [
                'SE',
                'UA',
                'GB',
                'PL',
                'PT',
                'SI',
                'DE',
                'IT',
                'CH',
                'LT',
                'GR',
                'FI',
                'IS',
                'AT',
                'FR',
                'RO',
                'MD',
                'HU',
                'NO',
                'MK',
                'BG',
                'ES',
                'HR',
                'NL',
                'CZ',
                'EE',
            ],
        },
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

    //pick a bundle in the middle of the list
    const bundle = bundles[Math.floor(bundles.length / 2)];
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
                WEB_USER: 'admin', //process.env.VAST_WEB_USER,
                WEB_PASSWORD: 'admin', //process.env.VAST_WEB_PASSWORD,
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

    return newInstanceId.toString();
}

export async function assignGpuToTraining({ runId }: { runId: string }) {
    try {
        const trainingRun = await prisma.trainingRun.findUnique({
            where: { id: runId },
        });

        if (!trainingRun) {
            throw new Error('Training run not found');
        }

        const instanceId = await createGpuInstance();

        // Create a new GpuInstance in the database
        await prisma.trainingRun.update({
            where: { id: runId },
            data: {
                gpu: {
                    create: {
                        instanceId: instanceId,
                        status: 'running',
                    },
                },
            },
        });

        console.log(`Assigned GPU ${instanceId} to training run ${runId}`);

        return true;
    } catch (error) {
        console.error('Error assigning GPU to training:', error);
        return false;
    }
}
