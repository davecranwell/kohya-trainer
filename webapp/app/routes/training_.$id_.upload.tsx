import { useState } from 'react';
import { useLoaderData, data } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { toast } from 'sonner';
import { createId } from '@paralleldrive/cuid2';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { sanitiseTagString } from '~/util/misc';

import { FileUploadPreview, ImageWithMetadata } from '~/components/file-upload-preview';
import { Panel } from '~/components/panel';
import { ImageTaggingList } from '~/components/image-tagging-list';

const MAX_IMAGES = 200;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
const ACCEPTED_TEXT_TYPES = ['text/plain'];

type FileWithId = File & { id: string };

export async function action({ request, params }: ActionFunctionArgs) {
    return null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findUnique({
        where: { id: params.id, ownerId: userId },
    });

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const images = await prisma.trainingImage.findMany({
        select: {
            id: true,
            name: true,
            text: true,
            url: true,
            type: true,
            createdAt: true,
        },
        where: { trainingId: params.id },
    });

    return {
        thumbnailBucketUrl: `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        userId,
        images: images.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') })),
        training,
    };
}

export default function ImageUpload() {
    const { images, training, thumbnailBucketUrl } = useLoaderData<typeof loader>();
    const [uploadedImages, setUploadedImages] = useState<ImageWithMetadata[]>(images as ImageWithMetadata[]);

    // updated images are those that have been given tags by the upload of a text file
    // new images are those that have been uploaded brand new
    // tags are all the tags that exist cross all images, new or old
    const handleNewFile = async (files: File[]) => {
        // get the text files
        let textFiles = files.filter((file) => ACCEPTED_TEXT_TYPES.includes(file.type));

        // get the image files and add an ID
        let imageFiles = files
            .filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type))
            .map((file) => Object.assign(file, { id: createId() })) as FileWithId[];

        // clone existing image so we can update the array in place easily and replace it right at the end
        let allImages: ImageWithMetadata[] = [...uploadedImages];

        if (imageFiles.length > 0) {
            if (uploadedImages.length + imageFiles.length > MAX_IMAGES) {
                imageFiles = imageFiles.slice(0, MAX_IMAGES - uploadedImages.length);
                toast.error('You have reached the maximum number of images');
            }

            allImages = [
                ...imageFiles.map((file) => ({
                    id: file.id,
                    name: file.name,
                    text: '',
                    url: URL.createObjectURL(file),
                    type: file.type,
                    filenameNoExtension: file.name.split('.').slice(0, -1).join('.'),
                    updatedAt: new Date(),
                })),
                ...uploadedImages,
            ];

            setUploadedImages(allImages);

            const imagesWithUploadUrlsResponse = await fetch(`/api/uploadurls/${training.id}`, {
                method: 'POST',
                body: JSON.stringify(imageFiles.map((file) => ({ name: file.name, type: file.type }))),
            });
            const imagesWithUploadUrls = await imagesWithUploadUrlsResponse.json();

            await Promise.all(
                imageFiles.map(async (file) => {
                    return new Promise(async (resolve, reject) => {
                        const uploadUrl = imagesWithUploadUrls.find(
                            (fileWithUrl: { name: string; type: string; uploadUrl: string }) => fileWithUrl.name === file.name,
                        )?.uploadUrl;

                        const uploadResponse = await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                        });
                        if (!uploadResponse.ok) reject();

                        const addImageResponse = await fetch(`/api/trainingimage/${training.id}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: file.name,
                                type: file.type,
                                id: file.id,
                            }),
                        });
                        if (addImageResponse.ok) {
                            resolve(true);
                        }
                    });
                }),
            );
        }

        try {
            if (textFiles.length > 0) {
                await Promise.all(
                    textFiles.map(async (textFile) => {
                        return new Promise(async (resolve, reject) => {
                            const matchingImage = allImages.find(
                                (image) => image.filenameNoExtension === textFile.name.split('.').slice(0, -1).join('.'),
                            );

                            if (!matchingImage) {
                                reject();
                                return;
                            }

                            const reader = new FileReader();
                            reader.onload = async function (e: any) {
                                matchingImage.text = sanitiseTagString(e.target?.result as string, [
                                    ...training.name.split(' '),
                                    ...training.triggerWord.split(' '),
                                ]);
                                const updateTextResponse = await fetch(`/api/trainingimage/${training.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                        id: matchingImage?.id,
                                        text: matchingImage?.text,
                                    }),
                                });
                                if (updateTextResponse.ok) {
                                    resolve(matchingImage);
                                }
                            };
                            reader.readAsText(textFile);
                        });
                    }),
                );

                setUploadedImages([...allImages] as ImageWithMetadata[]);
            }
        } catch (error) {
            console.error('Error updating text', error);
        }
    };

    return (
        <Panel heading="Original images" scrollable={false} className="h-full" bodyClassName="h-full content-stretch grow">
            <FileUploadPreview
                key={`${training.id}-preview`}
                acceptedImageTypes={ACCEPTED_IMAGE_TYPES}
                acceptedTextTypes={ACCEPTED_TEXT_TYPES}
                previousImages={uploadedImages}
                maxImages={MAX_IMAGES}
                onDropped={handleNewFile}>
                <ImageTaggingList
                    images={uploadedImages}
                    training={training}
                    onImageTagsUpdated={setUploadedImages}
                    thumbnailBucketUrl={thumbnailBucketUrl}
                />
            </FileUploadPreview>
        </Panel>
    );
}
