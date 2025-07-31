export const modelTypeMetadata = {
    'SD 1.5': {
        minResolution: 512,
    },
    'SDXL 1.0': {
        minResolution: 1024,
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
];
