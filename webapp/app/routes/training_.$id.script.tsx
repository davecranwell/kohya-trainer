import { data, type LoaderFunctionArgs } from 'react-router';
import fs from 'fs';
import path from 'path';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

function replaceSection(content: string, sectionName: string, newContent: string): string {
    const startMarker = `### BEGIN_${sectionName} ###`;
    const endMarker = `### END_${sectionName} ###`;

    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
        throw new Error(`Could not find section markers for ${sectionName}`);
    }

    return content.substring(0, startIndex) + startMarker + '\n' + newContent + '\n' + content.substring(endIndex);
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    // const userId = await requireUserWithPermission(request, 'create:training:own');
    const training = await prisma.training.findFirst({
        select: {
            id: true,
            name: true,
            triggerWord: true,
            baseModel: true,
        },
        where: {
            id: params.id,
        },
    });

    if (!training) {
        throw Response.json({ error: 'Not found' }, { status: 404 });
    }

    // const CHECKPOINT_MODELS = ['https://civitai.com/api/download/models/1094291?type=Model&format=SafeTensor&size=pruned&fp=fp16'];

    const scriptPath = path.join(process.cwd(), 'app', 'util', 'provisioning-script.sh');
    let scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');

    // Replace checkpoint models
    scriptContent = replaceSection(scriptContent, 'CHECKPOINT_MODELS', [training.baseModel].map((url) => `"${url}"`).join('\n'));

    return new Response(scriptContent, {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}
