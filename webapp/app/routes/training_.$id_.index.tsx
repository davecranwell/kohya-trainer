import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useLoaderData, data, useFetcher } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { toast } from 'sonner';
import { createId } from '@paralleldrive/cuid2';
import { Cross1Icon, InfoCircledIcon, MagicWandIcon } from '@radix-ui/react-icons';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { getThumbnailUrl, sanitiseTagString } from '~/util/misc';
import { modelTypeMetadata } from '~/util/difussion-models';

import { FileUploadDropzone, ImageWithMetadata } from '~/components/file-upload-dropzone';
import { Panel } from '~/components/panel';
import { Textarea } from '~/components/forms/textarea';
import { ImageTaggingList } from '~/components/image-tagging-list';
import { ImagePreview } from '~/components/image-preview';
import { MultiComboBox } from '~/components/forms/multi-combo-box';
import { Button } from '~/components/button';
import { useTrainingStatus } from '~/util/trainingstatus.provider';
import { StatusPill } from '~/components/status-pill';
import TrainingToggle from '~/components/training-toggle';
import { beginTraining, checkIncompleteTrainingRun, getTrainingByUser } from '~/services/training.server';

const MAX_IMAGES = 200;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
const ACCEPTED_TEXT_TYPES = ['text/plain'];

type FileWithId = File & { id: string };

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');
    const training = await getTrainingByUser(params.id!, userId);

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const formData = await request.formData();
    const run = formData.get('run');

    if (run) {
        if (await checkIncompleteTrainingRun(training.id)) {
            return data({ error: 'Training already started' }, { status: 400 });
        }

        await beginTraining(training.id, params.groupId);
    }
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
            caption: true,
            url: true,
            type: true,
            createdAt: true,
        },
        where: { trainingId: params.id },
        orderBy: { createdAt: 'desc' },
    });

    return {
        thumbnailBucketUrl: `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        userId,
        images: images.map((image) => ({ ...image, filenameNoExtension: image.name.split('.').slice(0, -1).join('.') })),
        training,
        textMode: modelTypeMetadata[JSON.parse(training.baseModel as string)?.type as keyof typeof modelTypeMetadata]?.textMode || 'tags',
    };
}

export default function ImageUpload() {
    const { images, training, thumbnailBucketUrl, textMode } = useLoaderData<typeof loader>();
    const [uploadedImages, setUploadedImages] = useState<ImageWithMetadata[]>(images as ImageWithMetadata[]);
    const listRef = useRef<HTMLDivElement>(null);
    const [windowWidth, setWindowWidth] = useState(0);
    const [cols, setCols] = useState(3);
    const { trainingStatuses } = useTrainingStatus();
    const fetcher = useFetcher();

    const imageWidth = Math.min(Math.ceil(windowWidth / cols), 500);

    useEffect(() => {
        const detectedWidth = listRef?.current?.clientWidth;

        if (detectedWidth) {
            setWindowWidth(detectedWidth || 0);
            setCols(Math.max(Math.floor(detectedWidth / 500), 1));
        }
    }, [listRef.current]);

    const handleDelete = useCallback(
        async (imageId: string) => {
            const deleteResponse = await fetch(`/api/trainingimage/${training.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ id: imageId }),
            });

            if (deleteResponse.ok) {
                setUploadedImages(uploadedImages.filter((image) => image.id !== imageId));
            }
        },
        [uploadedImages],
    );

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
                    caption: '',
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
                        const img = new Image();
                        img.src = URL.createObjectURL(file);

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
                                width: img.width,
                                height: img.height,
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
                            const matchingImage = allImages.find((image) => {
                                const txtWithoutExt = textFile.name.split('.').slice(0, -1);

                                // handle files like textfile.caption.txt which identify a text file containing a caption
                                if (txtWithoutExt[txtWithoutExt.length - 1].toLowerCase() === 'caption') {
                                    return image.filenameNoExtension === txtWithoutExt.slice(0, -1).join('.');
                                }

                                return image.filenameNoExtension === txtWithoutExt.join('.');
                            });

                            if (!matchingImage) {
                                reject();
                                return;
                            }

                            const reader = new FileReader();
                            reader.onload = async function (e: any) {
                                const textMode = textFile.name.split('.').slice(0, -1).pop()?.toLowerCase() === 'caption' ? 'caption' : 'tags';

                                if (textMode === 'caption') {
                                    matchingImage.caption = e.target?.result as string;
                                } else {
                                    matchingImage.text = sanitiseTagString(e.target?.result as string, [
                                        ...training.name.split(' '),
                                        ...training.triggerWord.split(' '),
                                    ]);
                                }

                                try {
                                    const updateTextResponse = await fetch(`/api/trainingimage/${training.id}`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({
                                            id: matchingImage?.id,
                                            ...(textMode === 'tags' ? { text: matchingImage?.text } : {}),
                                            ...(textMode === 'caption' ? { caption: matchingImage?.caption } : {}),
                                        }),
                                    });
                                    if (updateTextResponse.ok) {
                                        resolve(matchingImage);
                                    }
                                } catch (error) {
                                    reject(error);
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

    const handleCaptionUpdated = useCallback(async (imageId: string, caption: string) => {
        const updateCaptionResponse = await fetch(`/api/trainingimage/${training.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ id: imageId, caption }),
        });

        return updateCaptionResponse.ok;
    }, []);

    const handleTagsUpdated = useCallback(
        async (imageId: string, sanitisedTags: string[]) => {
            const updateTextResponse = await fetch(`/api/trainingimage/${training.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ id: imageId, text: sanitisedTags.join(',') }),
            });

            return updateTextResponse.ok;
        },
        [images],
    );

    return (
        <Panel
            heading={`Original images ${uploadedImages.length > 0 ? `(${uploadedImages.length})` : ''}`}
            scrollable={false}
            classes="h-full"
            bodyClasses="h-full content-stretch grow"
            headingRight={
                <div className="flex flex-row items-center gap-10">
                    <StatusPill status={trainingStatuses[training.id]?.runs.filter((run) => run.imageGroupId === null)?.[0]?.status} />

                    <TrainingToggle trainingId={training.id} fetcher={fetcher} />
                </div>
            }>
            <div className="flex h-full flex-col justify-stretch overflow-hidden" ref={listRef}>
                <FileUploadDropzone
                    key={`${training.id}-preview`}
                    acceptedImageTypes={ACCEPTED_IMAGE_TYPES}
                    acceptedTextTypes={ACCEPTED_TEXT_TYPES}
                    previousImages={uploadedImages}
                    maxImages={MAX_IMAGES}
                    onDropped={handleNewFile}>
                    {uploadedImages.length > 0 && (
                        <ImageTaggingList
                            textMode={textMode as 'tags' | 'caption'}
                            images={uploadedImages}
                            cols={cols}
                            imageWidth={imageWidth}
                            imageHeight={250}
                            windowWidth={windowWidth}
                            onImageTagsUpdated={handleTagsUpdated}
                            ImageComponent={memo(({ ...props }) => (
                                <UploadedImage
                                    {...props}
                                    onDelete={handleDelete}
                                    onCaptionChange={handleCaptionUpdated}
                                    thumbnailBucketUrl={thumbnailBucketUrl}
                                />
                            ))}
                        />
                    )}
                </FileUploadDropzone>
            </div>
        </Panel>
    );
}

const UploadedImage = ({
    image,
    thumbnailBucketUrl,
    handleTagChange,
    onCaptionChange,
    handleTagRemove,
    onDelete,
    handleGetTagOptions,
    textMode = 'tags',
}: {
    image: ImageWithMetadata;
    thumbnailBucketUrl: string;
    handleTagChange: (tags: string[], imageId: string) => void;
    onCaptionChange: (imageId: string, caption: string) => void;
    handleTagRemove: (tags: string[], removedTag: string, imageId: string) => void;
    onDelete: (imageId: string) => void;
    handleGetTagOptions: () => string[];
    textMode?: 'tags' | 'caption';
}) => {
    // Memoize the onChange and onRemove functions to prevent unnecessary re-renders
    const handleTagChangeCallback = (tags: string[]) => {
        handleTagChange(tags, image.id!);
    };

    const handleRemove = useCallback(
        (allTags: string[], removedTag: string) => {
            handleTagRemove(allTags, removedTag, image.id!);
        },
        [handleTagRemove, image.id],
    );

    return (
        <div className="relative flex flex-1">
            {image.url && (
                <ImagePreview
                    url={`${image.url?.startsWith('blob') ? image.url : getThumbnailUrl(thumbnailBucketUrl, image.url, 200)}`}
                    id={image.id}
                    width={200}
                />
            )}

            <div className="absolute left-0 top-0 z-50 opacity-0 duration-150 group-hover/image:opacity-100">
                <Button
                    name={`exclude`}
                    value={image.id}
                    display="ghost"
                    size="icon"
                    icon={Cross1Icon}
                    onClick={() => onDelete(image.id!)}
                    title="Delete from training data"
                />
            </div>

            <div className="ml-2 flex-1">
                {textMode === 'tags' && (
                    <MultiComboBox
                        name={`${image.id}-tags`}
                        defaultValue={image.text}
                        onGetOptions={handleGetTagOptions}
                        onChange={handleTagChangeCallback}
                        onRemove={handleRemove}
                    />
                )}
                {textMode === 'caption' && (
                    <Textarea
                        name={`${image.id}-caption`}
                        defaultValue={image?.caption || ''}
                        onBlur={(e) => onCaptionChange(image.id!, e.target.value)}
                        rows={5}
                        className="flex h-full text-sm"
                        placeholder={'Enter a caption for the image'}
                    />
                )}
            </div>
        </div>
    );
};
