import { useState, useEffect, useCallback } from 'react';
import { Form, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { toast } from 'sonner';
import { createId } from '@paralleldrive/cuid2';
import { List, CellMeasurer, CellMeasurerCache, AutoSizer } from 'react-virtualized';
import { useHydrated } from 'remix-utils/use-hydrated';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { sanitiseTagArray, sanitiseTagString } from '~/util/misc';

import { FileUploadPreview, ImageWithMetadata } from '~/components/file-upload-preview';
import { Button } from '~/components/button';
import { ImagePreview } from '~/components/image-preview';
import { Label } from '~/components/forms/label';
import { MultiComboBox } from '~/components/forms/multi-combo-box';

const MAX_IMAGES = 200;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
const ACCEPTED_TEXT_TYPES = ['text/plain'];

type FileWithId = File & { id: string };

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
    const { userId, images, training, thumbnailBucketUrl } = useLoaderData<typeof loader>();
    const [uploadedImages, setUploadedImages] = useState<ImageWithMetadata[]>(images as ImageWithMetadata[]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));
    const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [negateTag, setNegateTag] = useState(false);
    const isHydrated = useHydrated();

    // updated images are those that have been given tags by the upload of a text file
    // new images are those that have been uploaded brand new
    // tags are all the tags that exist cross all images, new or old
    const handleNewFile = async (files: File[]) => {
        // get the text files
        let textFiles = files.filter((file) => ACCEPTED_TEXT_TYPES.includes(file.type));

        // get the image files and add an
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
                ...uploadedImages,
                ...imageFiles.map((file) => ({
                    id: file.id,
                    name: file.name,
                    text: '',
                    url: URL.createObjectURL(file),
                    type: file.type,
                    filenameNoExtension: file.name.split('.').slice(0, -1).join('.'),
                    updatedAt: new Date(),
                })),
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

    const handleTagChange = async (tags: string[], imageId: string) => {
        const sanitisedTags = sanitiseTagArray(tags);

        const updateTextResponse = await fetch(`/api/trainingimage/${training.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                id: imageId,
                text: sanitisedTags.join(','),
            }),
        });

        if (updateTextResponse.ok) {
            // setUploadedImages([
            //     ...uploadedImages.filter((image) => image.id !== imageId),
            //     {
            //         ...uploadedImages.find((image) => image.id === imageId),
            //         text: sanitisedTags.join(','),
            //     } as ImageWithMetadata,
            // ]);
            setAllTags(sanitiseTagArray([...allTags, ...sanitisedTags]));
        }
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

    // Create a cache for cell measurements
    const cache = new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: 200,
        minHeight: 100,
    });

    // Reset cache when filtered images change
    useEffect(() => {
        cache.clearAll();
    }, [filteredImages]);

    // Memoized row renderer
    const rowRenderer = useCallback(
        ({ key, index, parent, style }: any) => {
            const image = filteredImages[index];

            return (
                <CellMeasurer cache={cache} columnIndex={0} key={key} parent={parent} rowIndex={index}>
                    {({ registerChild }: { registerChild: (node: HTMLElement) => void }) => (
                        <div ref={registerChild as any} style={style}>
                            <li className="mb-4 flex flex-row gap-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
                                <ImagePreview
                                    url={`${image.url?.startsWith('blob') ? image.url : `${thumbnailBucketUrl}${image.url}`}`}
                                    id={image.id}
                                    width={200}
                                />

                                <div className="ml-2 flex-1">
                                    <div>Tags</div>
                                    <MultiComboBox
                                        name={`${image.id}-tags`}
                                        defaultValue={image.text}
                                        options={allTags}
                                        onChange={(tags) => handleTagChange(tags, image.id)}
                                    />
                                </div>
                            </li>
                        </div>
                    )}
                </CellMeasurer>
            );
        },
        [filteredImages, thumbnailBucketUrl, allTags, handleTagChange, cache],
    );

    return (
        <Form key={training.id} id={training.id} method="post" encType="multipart/form-data" className="relative">
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-white">Training images</h2>

            <div className="flex flex-row gap-8">
                <div className="flex-1 basis-3/5">
                    <FileUploadPreview
                        key={`${training.id}-preview`}
                        acceptedImageTypes={ACCEPTED_IMAGE_TYPES}
                        acceptedTextTypes={ACCEPTED_TEXT_TYPES}
                        previousImages={uploadedImages}
                        maxImages={MAX_IMAGES}
                        onDropped={handleNewFile}
                        className="mb-4">
                        {uploadedImages.length > 0 && (
                            <div>
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
                                            Untagged images
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedTag}
                                            onChange={(e) => setSelectedTag(e.target.value)}
                                            className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200">
                                            <option value="">Filter by tag...</option>
                                            {allTags
                                                .sort()
                                                .filter((tag) => tag.length)
                                                .map((tag) => (
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

                                <div className="mt-4 h-[calc(100vh-350px)]">
                                    {isHydrated && (
                                        <AutoSizer>
                                            {({ width, height }) => (
                                                <List
                                                    width={width}
                                                    height={height}
                                                    deferredMeasurementCache={cache}
                                                    rowHeight={cache.rowHeight}
                                                    rowRenderer={rowRenderer}
                                                    rowCount={filteredImages.length}
                                                    overscanRowCount={3}
                                                />
                                            )}
                                        </AutoSizer>
                                    )}
                                </div>
                            </div>
                        )}
                    </FileUploadPreview>
                </div>

                <div className="flex-1 basis-2/5">
                    <h3 className="text-lg font-bold tracking-tight text-white">Tagging tips</h3>

                    <ul className="list-disc space-y-4 pl-4 text-sm leading-6 marker:text-accent1">
                        <li>
                            Tags should be <strong className="text-accent1">one or two words</strong>, not phrases and should usually only be things
                            that are <strong className="text-accent1">visible in the image</strong>, except where they identify overall qualities of
                            the image. Tagging things that can't be seen will confuse the model.
                        </li>
                        <li>
                            Tags teach the model what is presentTag things you{' '}
                            <strong className="text-accent1">would want to change when generating images from your Lora</strong>. Don't tag things you
                            want to be fixed. e.g If images are of yourself, and you have brown hair, tagging the hair as "brunette" or "brown" can
                            indicate this is a changeable property. If brown hair should never change, don't tag it.
                        </li>
                        <li>
                            Avoid <strong className="text-accent1">ambiguous or non-specific tags</strong>. e.g "person", "picture", "image", "light"
                            which could apply to many things
                        </li>
                        <li>
                            Avoid too many tags about <strong className="text-accent1">background/secondary details</strong>.
                        </li>
                        <li>
                            <strong className="text-accent1">Be consistent in the language you use</strong>. If you tag an object as "rusted" in one
                            image don't tag it as "corroded" in another
                        </li>
                        <li>
                            Try to ensure your tags describe <strong className="text-accent1">a few common details</strong>, such as:
                            <ul className="marker:text-grey-800 mt-4 list-disc space-y-4 pl-8">
                                <li>
                                    The <strong className="text-accent1">quality and type</strong> of the image e.g{' '}
                                    <code className="font-mono text-accent2">professional</code>,{' '}
                                    <code className="font-mono text-accent2">amateur</code>, etc
                                </li>
                                <li>
                                    Details <strong className="text-accent1">about the medium</strong> e.g{' '}
                                    <code className="font-mono text-accent2">canon</code>, <code className="font-mono text-accent2">f1.8</code>, or
                                    style of art <code className="font-mono text-accent2">cell-shading</code>,{' '}
                                    <code className="font-mono text-accent2">chiaroscuro</code>,
                                </li>
                                <li>
                                    <strong className="text-accent1">The setting or background of the image</strong> e.g{' '}
                                    <code className="font-mono text-accent2">sunset</code>, <code className="font-mono text-accent2">office</code>,{' '}
                                    <code className="font-mono text-accent2">beach</code>, <code className="font-mono text-accent2">city</code>
                                </li>
                                <li>
                                    Types of <strong className="text-accent1">clothing, or surface details</strong> e.g{' '}
                                    <code className="font-mono text-accent2">t-shirt</code>, <code className="font-mono text-accent2">hoodie</code>,{' '}
                                    <code className="font-mono text-accent2">tattoos</code>, <code className="font-mono text-accent2">rusted</code>,{' '}
                                    <code className="font-mono text-accent2">scratched</code>
                                </li>
                                <li>
                                    <strong className="text-accent1">Lighting styles</strong> e.g{' '}
                                    <code className="font-mono text-accent2">soft lighting</code>,{' '}
                                    <code className="font-mono text-accent2">hard lighting</code> (nb: "soft" or "hard" would be too ambiguous)
                                </li>
                                <li>
                                    Any <strong className="text-accent1">relevant actions</strong> e.g{' '}
                                    <code className="font-mono text-accent2">sitting</code>, <code className="font-mono text-accent2">painting</code>,{' '}
                                    <code className="font-mono text-accent2">driving</code>, <code className="font-mono text-accent2">waving</code>
                                </li>
                            </ul>
                        </li>
                        <li>
                            But remember: if these details are things you would <strong>not</strong> want to be optional or modified during image
                            generation, consider not tagging them.
                        </li>
                    </ul>
                </div>
            </div>
        </Form>
    );
}
