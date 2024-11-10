import { useState, useEffect } from 'react';
import { Form, Links, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs, UploadHandler } from '@remix-run/node';
import {
    json,
    unstable_parseMultipartFormData,
    ActionFunctionArgs,
    unstable_createMemoryUploadHandler,
    unstable_composeUploadHandlers,
} from '@remix-run/node';
import { useEventSource } from 'remix-utils/sse/react';
import { invariantResponse } from '@epic-web/invariant';
import { Resource } from 'sst';

import { FileUploadPreview, ImageWithMetadata } from '#app/components/ui/FileUploadPreview';
import { Progress, uploadStreamToS3 } from '#app/utils/s3-upload.server.js';
import { emitter } from '#app/utils/emitter.server';
import { Button } from '#app/components/ui/button.js';
import { requireUserId } from '#app/utils/auth.server.js';
import { prisma } from '#app/utils/db.server.ts';
import { requireUserWithPermission } from '#app/utils/permissions.server.js';
import { GeneralErrorBoundary } from '#app/components/error-boundary.js';
import { sanitiseTagArray } from '#app/utils/misc.js';
import { ImagePreview } from '#app/components/ui/ImagePreview.js';
import { Label } from '#app/components/ui/label.js';
import { MultiComboBox } from '#app/components/ui/multi-combo-box.js';
import { redirectWithToast } from '#app/utils/toast.server.js';

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

    invariantResponse(trainingId, 'Not found', { status: 404 });

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
            data: (formData.getAll('images') as string[]).slice(0, imagesToCreate).map((url) => {
                // S3 upload results in a URL being returned for each image, but we want to access the filename so we can store its name separate from its URL
                const fileName = url.split('/').pop();

                return {
                    text: formData.get(`${fileName}-tags`) as string,
                    url: url as string,
                    name: fileName as string,
                    trainingId: params.id!,
                    type: 'image/jpeg',
                };
            }),
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

    return redirectWithToast(`/training/${params.id}/upload`, {
        type: 'success',
        title: 'Success',
        description: 'Training images have been updated.',
    });
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

    return json({ userId, images, trainingId: params.id });
}

export default function ImageUpload() {
    const data = useLoaderData<typeof loader>();
    const [newImages, setNewImages] = useState<ImageWithMetadata[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const progressMessage = useEventSource(`/sse/${data.userId}`, { event: data.userId });
    const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(data.images.map((image) => (image.text || '').split(',')).flat()));

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

    const handleNewImageDropped = ({
        updatedImages, // todo: make this work when uploading a text file
        newImages,
        tags,
    }: {
        updatedImages: ImageWithMetadata[];
        newImages: ImageWithMetadata[];
        tags: string[];
    }) => {
        setNewImages((prev) => [...prev, ...newImages] as ImageWithMetadata[]);
        setAllTags(tags);
    };

    const handleTagChange = (tags: string[]) => {
        setAllTags(tags);
    };

    return (
        <Form key={data.trainingId} id={data.trainingId} method="post" encType="multipart/form-data" className="relative">
            <Button type="submit" disabled={data.images.length >= MAX_IMAGES} className="fixed top-0">
                Update
            </Button>

            {data.images.length < 1 && <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">Upload some training images</h2>}
            <FileUploadPreview
                key={`${data.trainingId}-preview`}
                acceptedFileTypes={['image/png', 'image/jpeg', 'text/plain']}
                previousImages={data.images.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') }))} // yuk hate this filenameNoExtension thing
                maxImages={MAX_IMAGES}
                onDropped={handleNewImageDropped}
                className="mb-4">
                {newImages.length > 0 && (
                    <>
                        <div className="mt-4 space-y-2">
                            <div className="flex flex-row flex-wrap">
                                {newImages
                                    .filter((image) => uploadProgress[image.name] !== 100)
                                    .map((image) => (
                                        <div key={image.url} className="mr-1 mt-1">
                                            <ImagePreview
                                                url={image.url}
                                                name={image.name}
                                                id={image.id}
                                                width={100}
                                                uploadProgress={uploadProgress[image.name]}
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                        <Button type="submit" disabled={data.images.length >= MAX_IMAGES} className="mt-4">
                            Upload
                        </Button>
                    </>
                )}
            </FileUploadPreview>

            {data.images.length > 0 && (
                <>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Your training images</h2>
                    <ul role="list" className="mt-4 space-y-2 divide-y divide-gray-300">
                        {data.images.map((image) => (
                            <li key={image.id} className="flex flex-row pt-2">
                                <ImagePreview
                                    url={image.url}
                                    name={image.name}
                                    id={image.id}
                                    uploadProgress={uploadProgress[image.name]}
                                    width={200}
                                />

                                <div className="ml-2 flex-1">
                                    <Label htmlFor={`${image.name}-text`}>Tags</Label>
                                    <MultiComboBox
                                        name={`${image.id || image.name}-tags`}
                                        defaultValue={image.text}
                                        options={allTags}
                                        onChange={handleTagChange}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Form>
    );
}
