import { useState, useEffect } from 'react';
import { Form, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { toast } from 'sonner';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { sanitiseTagArray } from '~/util/misc';

import { FileUploadPreview, ImageWithMetadata } from '~/components/file-upload-preview';
import { Button } from '~/components/button';
import { ImagePreview } from '~/components/image-preview';
import { Label } from '~/components/forms/label';
import { MultiComboBox } from '~/components/forms/multi-combo-box';

const MAX_IMAGES = 52;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
const ACCEPTED_TEXT_TYPES = ['text/plain'];

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findFirst({
        select: { id: true },
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
        },
        where: { trainingId: params.id },
    });

    return {
        userId,
        images: images.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') })),
        trainingId: params.id,
    };
}

export default function ImageUpload() {
    const { userId, images, trainingId } = useLoaderData<typeof loader>();
    const [uploadedImages, setUploadedImages] = useState<ImageWithMetadata[]>(images as ImageWithMetadata[]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));
    const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [negateTag, setNegateTag] = useState(false);

    // updated images are those that have been given tags by the upload of a text file
    // new images are those that have been uploaded brand new
    // tags are all the tags that exist cross all images, new or old
    const handleNewFile = async (files: File[]) => {
        // get the text files
        let textFiles = files.filter((file) => ACCEPTED_TEXT_TYPES.includes(file.type));

        // get the image files
        let imageFiles = files.filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type));

        // clone existing image so we can update the array in place easily and replace it right at the end
        let newImages: ImageWithMetadata[] = [...uploadedImages];

        if (imageFiles.length > 0) {
            if (uploadedImages.length + imageFiles.length > MAX_IMAGES) {
                imageFiles = imageFiles.slice(0, MAX_IMAGES - uploadedImages.length);
                toast.error('You have reached the maximum number of images');
            }

            const response = await fetch(`/api/uploadurls/${trainingId}`, {
                method: 'POST',
                body: JSON.stringify(imageFiles.map((file) => ({ name: file.name, type: file.type }))),
            });
            const imageFilesWithUrls = await response.json();

            newImages = await Promise.all(
                imageFiles.map(async (file) => {
                    return new Promise(async (resolve, reject) => {
                        const uploadUrl = imageFilesWithUrls.find(
                            (fileWithUrl: { name: string; type: string; uploadUrl: string }) => fileWithUrl.name === file.name,
                        )?.uploadUrl;

                        const response = await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                        });
                        if (response.ok) {
                            const saveImageResponse = await fetch(`/api/trainingimage/${trainingId}`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    name: file.name,
                                    type: file.type,
                                }),
                            });
                            if (saveImageResponse.ok) {
                                const image = await saveImageResponse.json();
                                image.filenameNoExtension = image.name.split('.').slice(0, -1).join('.');
                                resolve(image);
                            }
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
                            const matchingImage = newImages.find(
                                (image) => image.filenameNoExtension === textFile.name.split('.').slice(0, -1).join('.'),
                            );

                            if (!matchingImage) {
                                reject();
                                return;
                            }

                            const reader = new FileReader();
                            reader.onload = async function (e: any) {
                                matchingImage.text = e.target?.result as string;
                                const updateTextResponse = await fetch(`/api/trainingimage/${trainingId}`, {
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
            }
        } catch (error) {
            console.error('Error updating text', error);
        }

        setUploadedImages(
            (prev) => [...newImages, ...prev.filter((image) => !newImages.find((newImage) => newImage.id === image.id))] as ImageWithMetadata[],
        );
    };

    // setAllTags(sanitiseTagArray([...allTags, ...tags]));

    const handleTagChange = (tags: string[]) => {
        setAllTags(sanitiseTagArray([...allTags, ...tags]));
    };

    const filteredImages = uploadedImages.filter((image) => {
        if (showUntaggedOnly) {
            return !image.text || image.text.trim() === '';
        }

        if (selectedTag) {
            const imageTags = (image.text || '').split(',').map((t) => t.trim());
            const hasTag = imageTags.includes(selectedTag);
            return negateTag ? !hasTag : hasTag;
        }

        return true;
    });

    return (
        <Form key={trainingId} id={trainingId} method="post" encType="multipart/form-data" className="relative">
            {uploadedImages.length < 1 && <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">Upload some training images</h2>}

            <FileUploadPreview
                key={`${trainingId}-preview`}
                acceptedImageTypes={ACCEPTED_IMAGE_TYPES}
                acceptedTextTypes={ACCEPTED_TEXT_TYPES}
                previousImages={uploadedImages.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') }))} // yuk hate this filenameNoExtension thing
                maxImages={MAX_IMAGES}
                onDropped={handleNewFile}
                className="mb-4"></FileUploadPreview>

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
                    <Button type="submit">Update</Button>

                    <div className="mt-4 flex items-center gap-4 border-b border-gray-800 pb-4">
                        <h2 className="text-2xl font-medium text-white">Filters</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="untagged-filter"
                                checked={showUntaggedOnly}
                                onChange={(e) => setShowUntaggedOnly(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600"
                            />
                            <label htmlFor="untagged-filter" className="text-sm text-gray-200">
                                Show only untagged images
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200">
                                <option value="">Filter by tag...</option>
                                {allTags.sort().map((tag) => (
                                    <option key={tag} value={tag}>
                                        {tag}
                                    </option>
                                ))}
                            </select>

                            {selectedTag && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="negate-tag"
                                        checked={negateTag}
                                        onChange={(e) => setNegateTag(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600"
                                    />
                                    <label htmlFor="negate-tag" className="text-sm text-gray-200">
                                        Exclude this tag
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    <ul role="list" className="mt-4 space-y-4 divide-y divide-gray-800">
                        {filteredImages.map((image, index) => (
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
