import axios from 'axios';

export const getLiveInstanceIds = async (): Promise<string[]> => {
    const response = await axios.get('https://console.vast.ai/api/v0/instances', {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
    return response.data.instances.filter((instance: any) => instance.label === 'kohya_rest').map((instance: any) => instance.id.toString());
};

export const shutdownGpu = async (instanceId: string) => {
    await axios.delete(`https://console.vast.ai/api/v0/instances/${instanceId}/`, {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
};

export const getInstance = async (instanceId: string) => {
    return await axios.get(`https://console.vast.ai/api/v0/instances/${instanceId}/`, {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
};

export const getOffers = async () => {
    // find instances available:
    // This query string is discoverable from the Network tab here: https://cloud.vast.ai/create/
    const query = {
        disk_space: { gte: 30 },
        reliability2: { gte: 0.950212931632136 },
        duration: { gte: 37094.045571940405 },
        verified: { eq: true },
        rentable: { eq: true },
        num_gpus: { gte: 1, lte: 1 },
        inet_down: { gte: 1000 },
        gpu_totalram: { gte: 23987.58004237308, lte: 51418.50343976141 },
        sort_option: { 0: ['dph_total', 'asc'], 1: ['total_flops', 'asc'] },
        geolocation: {
            in: [
                'SE',
                'UA',
                // 'GB', We can't use GB because of the civitai geofence
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
        gpu_name: { in: ['RTX 4090'] }, //'RTX 3090 Ti', 'RTX 3090',  'RTX 4090D', 'RTX 4080S', 'RTX 4080'
        order: [
            ['dph_total', 'asc'],
            ['total_flops', 'asc'],
        ],
        allocated_storage: 30,
        cpu_arch: { in: ['amd64'] },
        has_avx: { eq: true },
        direct_port_count: { gte: 9 },
        limit: 64,
        extra_ids: [],
        type: 'ask',
    };

    return await axios.get('https://cloud.vast.ai/api/v0/bundles?q=' + encodeURIComponent(JSON.stringify(query)));
};

export const provisionInstance = async (offerId: string, config: any) => {
    return await axios.put(`https://console.vast.ai/api/v0/asks/${offerId}/`, JSON.stringify(config), {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
};
