import { PrismaClient } from '@prisma/client';

import { getOffers, provisionInstance } from '../vast.server';

const prisma = new PrismaClient();

// Function to create a new GPU instance using Vast API
async function createGpuInstance() {
    const offersResponse = await getOffers();
    const offers = offersResponse.data.offers;

    // pick an offer in the middle of the list (the cheapest are often stalled or unresponsive)
    const offer = offers[Math.floor(offers.length / 2)];
    const offerId = offer.ask_contract_id;

    // This query string is discoverable from network tab when creating an instance: https://cloud.vast.ai/create/
    // no return value as it's largely useless and ID of isntance is already in bundle.id
    const newGpuResponse = await provisionInstance(offerId, {
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
    });

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
