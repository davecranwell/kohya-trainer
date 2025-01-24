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

import prisma from '../../prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { Progress, uploadStreamToS3 } from '~/services/s3-upload.server';

import { emitter } from '~/util/emitter.server';
import { sanitiseTagArray } from '~/util/misc';
import { redirectWithToast } from '~/services/toast.server';

import { FileUploadPreview, ImageWithMetadata } from '~/components/file-upload-preview';
import { Button } from '~/components/button';
import { ImagePreview } from '~/components/image-preview';
import { Label } from '~/components/forms/label';
import { MultiComboBox } from '~/components/forms/multi-combo-box';

const MAX_IMAGES = 50;

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');

    const trainingId = params.id;

    // Get all the image we already have in the DB
    const trainingImages = await prisma.trainingImage.findMany({
        where: {
            trainingId: params.id!,
        },
    });

    if (!trainingId) {
        throw json('Not found', { status: 404 });
    }

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

    // For some reason formgetAll('images') returns an array with a single File object, when empty.
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
        title: 'Training images have been updated',
    });
};

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findFirst({
        select: { id: true },
        where: { id: params.id, ownerId: userId },
    });

    if (!training) {
        throw json('Not found', { status: 404 });
    }

    const images = await prisma.trainingImage.findMany({
        select: {
            id: true,
            name: true,
            text: true,
            url: true,
            type: true,
        },
        where: { trainingId: params.id },
    });

    return json({ userId, images, trainingId: params.id });
}

export default function ImageUpload() {
    const { userId, images, trainingId } = useLoaderData<typeof loader>();
    const [uploadedImages, setUploadedImages] = useState<ImageWithMetadata[]>(images as ImageWithMetadata[]);
    const [newImages, setNewImages] = useState<ImageWithMetadata[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const progressMessage = useEventSource(`/sse/${userId}`, { event: userId });
    const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));

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

    // updated images are those that have been given tags by the upload of a text file
    // new images are those that have been uploaded brand new
    // tags are all the tags that exist cross all images, new or old
    const handleNewImageDropped = ({
        updatedImages, // todo: make this work when uploading a text file
        newImages,
        tags,
    }: {
        updatedImages: ImageWithMetadata[];
        newImages: ImageWithMetadata[];
        tags: string[];
    }) => {
        console.log('newImages', newImages);
        setNewImages((prev) => [...prev, ...newImages] as ImageWithMetadata[]);
        setUploadedImages(
            (prev) =>
                [
                    ...prev.filter((image) => !updatedImages.find((updatedImage) => updatedImage.id === image.id)),
                    ...updatedImages,
                ] as ImageWithMetadata[],
        );
        setAllTags(sanitiseTagArray([...allTags, ...tags]));
    };

    const handleTagChange = (tags: string[]) => {
        setAllTags(sanitiseTagArray([...allTags, ...tags]));
    };

    return (
        <Form key={trainingId} id={trainingId} method="post" encType="multipart/form-data" className="relative">
            {uploadedImages.length < 1 && <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">Upload some training images</h2>}

            <FileUploadPreview
                key={`${trainingId}-preview`}
                acceptedImageTypes={['image/png', 'image/jpeg']}
                acceptedTextTypes={['text/plain']}
                previousImages={uploadedImages.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') }))} // yuk hate this filenameNoExtension thing
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
                                        <div key={`new-${image.url}`} className="mr-1 mt-1">
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
                        <Button type="submit" disabled={newImages.length >= MAX_IMAGES} className="mt-4">
                            Upload
                        </Button>
                    </>
                )}
            </FileUploadPreview>

            <Button type="submit" disabled={newImages.length >= MAX_IMAGES}>
                Update
            </Button>

            {uploadedImages.length > 0 && (
                <>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Your training images</h2>
                    <h3 className="text-lg font-bold tracking-tight text-white">Tagging tips</h3>
                    <ol className="text-sm">
                        <li>Tags help the model identify what in the image it already knows, from the things it doesn't which should be learned.</li>
                        <li>
                            Tags should be <strong>one or two words</strong>, not phrases and should only be things that are visible in the image.
                            Tagging things that can't be seen will confuse the model.
                        </li>
                        <li>
                            <strong>Tag things you might want to change when using your Lora to generate images.</strong> Don't tag things you want to
                            be fixed. e.g If images are yourself, and you have brown hair, tagging the hair as "brunette" or "brown" can indicate this
                            is a changeable property. If brown hair should never change, don't tag it.
                        </li>
                        <li>Avoid overly general or vague tags. e.g "person", "picture", "skin", "light" are too vague.</li>
                        <li>
                            Do not tag things that are irrelevant to the subject you're trying to train. e.g If you are uploading images of a car,
                            don't use too many tags related to the background.
                        </li>
                        <li>Your tags will automatically include your chosen keywords. You don't need to include these.</li>
                        <li>Be consistent in the tags you use. If you tag hair as "brunette" in one image, don't tag it as "brown" in another.</li>
                        <li>
                            Try to ensure your tags describe a few common details, such as:
                            <ul>
                                <li>
                                    The <strong>quality or type</strong> of photo e.g <code>professional</code> or <code>amateur</code>,{' '}
                                    <code>selfie</code> etc
                                </li>
                                <li>
                                    <strong>Details about the camera</strong> used e.g <code>canon</code>, <code>nikon</code>, <code>50mm</code>,{' '}
                                    <code>f1.8</code>
                                </li>
                                <li>
                                    <strong>The setting of the photo</strong> e.g <code>sunset</code>, <code>night</code>
                                </li>
                                <li>
                                    Types of <strong>clothing, or surface details</strong> e.g <code>t-shirt</code>, <code>hoodie</code>,{' '}
                                    <code>tattoos</code>, <code>rusted</code>, <code>scratched</code>
                                </li>
                                <li>
                                    Lighting styles e.g <code>soft lighting</code>, <code>hard lighting</code> (nb: "soft" or "hard" would be too
                                    general)
                                </li>
                                <li>
                                    Background e.g <code>beach</code>, <code>city</code>
                                </li>
                                <li>
                                    Any name-able pose or action e.g <code>sitting</code>, <code>standing</code>, <code>lying down</code>,{' '}
                                    <code>waving</code>
                                </li>
                            </ul>
                        </li>
                    </ol>

                    <ul role="list" className="mt-4 space-y-4 divide-y divide-gray-800">
                        {uploadedImages.map((image, index) => (
                            <li key={`${image.id}-${index}`} className="flex flex-row pt-2">
                                <ImagePreview
                                    url={image.url}
                                    name={image.name}
                                    id={image.id}
                                    uploadProgress={uploadProgress[image.name]}
                                    width={200}
                                />

                                <div className="ml-2 flex-1">
                                    <Label htmlFor={`${image.id || image.name}-tags`}>Tags</Label>
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
