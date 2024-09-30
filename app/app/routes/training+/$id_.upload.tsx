import { useState, useEffect, useRef } from 'react';
import { Form, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs, UploadHandler } from '@remix-run/node';
import {
    json,
    unstable_parseMultipartFormData,
    ActionFunctionArgs,
    unstable_createMemoryUploadHandler,
    unstable_composeUploadHandlers,
} from '@remix-run/node';
import { useEventSource } from 'remix-utils/sse/react';

import { FileUploadPreview, Preview } from '#app/components/ui/FileUploadPreview';
import { Progress, uploadStreamToS3 } from '#app/utils/s3-upload.server.js';
import { emitter } from '#app/utils/emitter.server';
import { Button } from '#app/components/ui/button.js';
import { requireUserId } from '#app/utils/auth.server.js';
import { prisma } from '#app/utils/db.server.ts';
import { requireUserWithPermission } from '#app/utils/permissions.server.js';
import { invariantResponse } from '@epic-web/invariant';
import { GeneralErrorBoundary } from '#app/components/error-boundary.js';
import { sanitiseTagArray } from '#app/utils/misc.js';

const MAX_IMAGES = 50;

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    const trainingId = params.id;

    // Get all the image we already have in the DB
    const trainingImages = await prisma.trainingImage.findMany({
        where: {
            trainingId: params.id!,
        },
    });

    const s3UploaderHandler: UploadHandler = async (field) => {
        const { name, data, filename, contentType } = field;
        if (name !== 'images' || !filename || !contentType.startsWith('image/')) {
            return undefined;
        }

        return await uploadStreamToS3(data, filename!, contentType, userId, trainingId, (progress) => {
            emitter.emit(userId, JSON.stringify(progress));
        });
    };

    const uploadHandler = unstable_composeUploadHandlers(s3UploaderHandler, unstable_createMemoryUploadHandler());

    const formData = await unstable_parseMultipartFormData(request, uploadHandler);

    // For some reason formData.getAll('images') returns an array with a single File object, when empty.
    // We have filter that out.
    if (typeof formData.getAll('images')[0] === 'string') {
        //limit the number of images to MAX_IMAGES, minus the number of images we already have in the DB
        const imagesToCreate = Math.min(MAX_IMAGES - trainingImages.length, formData.getAll('images').length);

        await prisma.trainingImage.createMany({
            data: formData
                .getAll('images')
                .slice(0, imagesToCreate)
                .map((filename) => ({
                    text: formData.get(`${filename}-tags`) as string | null,
                    url: filename as string,
                    name: filename as string,
                    trainingId: params.id!,
                    type: 'image/jpeg',
                })),
        });
    }

    // loop through each image and update the text
    for (const image of trainingImages) {
        const text = formData.get(`${image.id}-tags`) as string | null;
        await prisma.trainingImage.update({
            where: { id: image.id },
            data: { text },
        });
    }

    return json(null, { status: 201 });
};

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findFirst({
        select: {
            id: true,
        },
        where: {
            id: params.id,
            ownerId: userId,
        },
    });

    invariantResponse(training, 'Not found', { status: 404 });

    const images = await prisma.trainingImage.findMany({
        select: {
            id: true,
            name: true,
            text: true,
            url: true,
            type: true,
        },
        where: {
            trainingId: params.id,
        },
    });

    return json({ userId, images });
}

export default function ImageUpload() {
    const data = useLoaderData<typeof loader>();
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const progressMessage = useEventSource(`/sse/${data.userId}`, { event: data.userId });

    useEffect(() => {
        if (!progressMessage) return;

        const progressParsed = JSON.parse(progressMessage) as Progress;
        const key = progressParsed.Key.split('/').pop() || progressParsed.Key;
        const newProgress = {
            ...uploadProgress,
            [key]: (progressParsed.loaded / progressParsed.total) * 100,
        };

        setUploadProgress(newProgress);
    }, [progressMessage]);

    const tags = sanitiseTagArray(data.images.map((image) => (image.text || '').split(',')).flat());

    return (
        <Form ref={formRef} method="post" encType="multipart/form-data">
            <FileUploadPreview
                uploadProgress={uploadProgress}
                acceptedFileTypes={['image/png', 'image/jpeg', 'text/plain']}
                images={data.images.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') }))} // yuk hate this filenameNoExtension thing
                tags={tags}
                maxImages={MAX_IMAGES}
            />
            <Button type="submit" disabled={data.images.length >= MAX_IMAGES}>
                Upload
            </Button>
        </Form>
    );
}

export function ErrorBoundary() {
    return (
        <GeneralErrorBoundary
            statusHandlers={{
                404: ({ params }) => <p>No training with the id "{params.id}" exists</p>,
            }}
        />
    );
}
