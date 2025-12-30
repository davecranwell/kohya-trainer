export const modelTypeMetadata = {
    'SD 1.5': {
        minResolution: 512,
        textMode: 'tags',
        trainingResolution: 1024,
    },
    'SDXL 1.0': {
        minResolution: 1024,
        textMode: 'tags',
        trainingResolution: 2048,
    },
    Flux: {
        minResolution: 1024,
        textMode: 'caption',
        trainingResolution: 2048,
    },
    ZImageTurbo: {
        minResolution: 1024,
        textMode: 'caption',
        trainingResolution: 2048,
    },
};

export const baseModels = [
    {
        id: '1',
        name: 'SD 1.5',
        url: 'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.ckpt',
        filename: 'v1-5-pruned.ckpt',
        type: 'SD 1.5',
    },
    {
        id: '2',
        name: 'SDXL',
        url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
        filename: 'sd_xl_base_1.0.safetensors',
        type: 'SDXL 1.0',
    },
    {
        id: '3',
        name: 'Flux',
        url: 'https://civitai.com/api/download/models/691639?type=Model&format=SafeTensor&size=full&fp=fp32',
        filename: 'flux_dev.safetensors',
        type: 'Flux',
    },
    {
        id: '4',
        name: 'Z-Image Turbo',
        url: 'https://civitai.com/api/download/models/691639?type=Model&format=SafeTensor&size=full&fp=fp32',
        filename: 'flux_dev.safetensors',
        type: 'ZImageTurbo',
    },
];
