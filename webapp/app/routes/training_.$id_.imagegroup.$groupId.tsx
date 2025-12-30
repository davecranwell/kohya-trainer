import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import type { ActionFunctionArgs, FetcherWithComponents, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';

import { CheckIcon, Cross1Icon, CropIcon, TrashIcon, DownloadIcon, UploadIcon, EraserIcon, CopyIcon, LayersIcon } from '@radix-ui/react-icons';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { abortTraining, beginTraining, checkIncompleteTrainingRun, getTrainingByUser } from '~/services/training.server';
import { addAllImageToGroup, addImageToGroup, removeAllImagesFromGroup, removeImageFromGroup, setImageCrop } from '~/services/imagesizes.server';

import { useTrainingStatus } from '~/util/trainingstatus.provider';
import { getThumbnailUrl } from '~/util/misc';
import { modelTypeMetadata } from '~/util/difussion-models';

import { ImagePreview, CroppedImagePreview } from '~/components/image-preview';
import { ImageCropper, CropPercentage, CropMiniMap } from '~/components/image-cropper';
import { Button } from '~/components/button';
import { Panel } from '~/components/panel';
import { MultiComboBox } from '~/components/forms/multi-combo-box';
import { Textarea } from '~/components/forms/textarea';
import { ImageTaggingList } from '~/components/image-tagging-list';
import { ImageWithMetadata } from '~/components/file-upload-dropzone';
import { ControlGroup } from '~/components/control-group';
import { StatusPill } from '~/components/status-pill';
import TrainingToggle from '~/components/training-toggle';

// Without this, opening the cropper, which immediately submits a form and causes the page to reload, causes the the cropper to close. Without the setcrop test, excluding an image from a set never refreshes the list
export const shouldRevalidate = ({ formData }: { formData: FormData }) => !formData || formData.get('setcrop') == undefined;

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');
    const training = await getTrainingByUser(params.id!, userId);

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const formData = await request.formData();
    const includeall = formData.get('includeall');
    const excludeall = formData.get('excludeall');
    const run = formData.get('run');
    const abort = formData.get('abort');
    const include = formData.get('include') as string;
    const exclude = formData.get('exclude') as string;
    const setCrop = formData.get('setcrop') as string;
    const imageId = formData.get('imageid') as string;

    if (run) {
        if (await checkIncompleteTrainingRun(training.id)) {
            return data({ error: 'Training already started' }, { status: 400 });
        }

        await beginTraining(training.id, params.groupId);
    }

    if (abort) {
        await abortTraining(training.id);
    }

    if (includeall) {
        await addAllImageToGroup(training.id, params.groupId as string);
    }

    if (excludeall) {
        await removeAllImagesFromGroup(params.groupId as string, userId, training.id);
    }

    if (include) {
        await addImageToGroup(params.groupId as string, include);
    }

    if (exclude) {
        await removeImageFromGroup(params.groupId as string, exclude, userId, training.id);
    }

    if (setCrop && imageId) {
        const crop = JSON.parse(setCrop);
        await setImageCrop(params.groupId as string, imageId, crop);
    }

    return {
        success: true,
    };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findUnique({
        where: { id: params.id, ownerId: userId },
    });

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const [images, group] = await Promise.all([
        prisma.trainingImage.findMany({
            select: {
                id: true,
                name: true,
                text: true,
                caption: true,
                url: true,
                type: true,
                width: true,
                height: true,
                createdAt: true,
            },
            where: { trainingId: params.id },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.imageGroup.findUnique({
            where: { id: params.groupId, trainingId: params.id },
            include: {
                images: {
                    select: {
                        imageId: true,
                        x: true,
                        y: true,
                        width: true,
                        height: true,
                        text: true,
                        caption: true,
                    },
                },
            },
        }),
    ]);

    if (!group) {
        throw data('Not found', { status: 404 });
    }

    const groupImageHashmap: Record<string, { x: number; y: number; width: number; height: number; text: string; caption: string }> =
        group.images.reduce(
            (acc, groupImage) => ({
                ...acc,
                [groupImage.imageId]: {
                    x: groupImage.x,
                    y: groupImage.y,
                    width: groupImage.width,
                    height: groupImage.height,
                    text: groupImage.text,
                    caption: groupImage.caption,
                },
            }),
            {},
        );

    return {
        // maxResolutionBucketUrl: `https://${process.env.AWS_S3_MAXRES_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        thumbnailBucketUrl: `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        uploadBucketUrl: `https://${process.env.AWS_S3_UPLOAD_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        userId,
        initialImages: images.map((image) => ({ ...image, isIncludedInGroup: !!groupImageHashmap[image.id] })),
        textMode: modelTypeMetadata[JSON.parse(training.baseModel as string)?.type as keyof typeof modelTypeMetadata]?.textMode || 'tags',
        training,
        group,
        groupImageHashmap,
    };
}

export default function ImageGroup() {
    const fetcher = useFetcher();
    const listRef = useRef<HTMLDivElement>(null);
    const { initialImages, training, thumbnailBucketUrl, uploadBucketUrl, group, groupImageHashmap, textMode } = useLoaderData<typeof loader>();
    const [windowWidth, setWindowWidth] = useState(0);
    const [cols, setCols] = useState(3);
    const [images, setImages] = useState<Partial<ImageWithMetadata>[]>(initialImages);
    const [groupImageStates, setGroupImageStates] =
        useState<Record<string, { x: number; y: number; width: number; height: number; text: string; caption: string | null }>>(groupImageHashmap);
    const { trainingStatuses } = useTrainingStatus();

    // We have to do this because we want state to be modifyable after load. For some reason without this the state never reloads.
    // And no, it's nothing to do with shouldRevalidate.
    useEffect(() => {
        setImages(initialImages);
    }, [initialImages]);

    useEffect(() => {
        const detectedWidth = listRef?.current?.clientWidth;

        if (detectedWidth) {
            setWindowWidth(detectedWidth || 0);
            setCols(Math.max(Math.floor(detectedWidth / 500), 1));
        }
    }, [images, initialImages]);

    const handleInclude = useCallback(
        (imageId: string) => {
            fetcher.submit({ include: imageId }, { action: fetcher.formAction, method: 'post' });

            const image = initialImages.find((image) => image.id === imageId);
            if (image) {
                image.isIncludedInGroup = true;
            }

            setImages([...images.map((image) => (image.id === imageId ? { ...image, isIncludedInGroup: true } : image))]);
        },
        [images],
    );

    const handleExclude = useCallback((imageId: string) => {
        fetcher.submit({ exclude: imageId }, { action: fetcher.formAction, method: 'post' });

        const image = images.find((image) => image.id === imageId);
        if (image) {
            image.isIncludedInGroup = false;
        }

        setImages([...images.map((image) => (image.id === imageId ? { ...image, isIncludedInGroup: false } : image))]);
    }, []);

    const handleCaptionUpdated = useCallback(async (imageId: string, caption: string | null) => {
        const updateCaptionResponse = await fetch(`/api/${group.id}/imagesize/${imageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ id: imageId, caption }),
        });

        setGroupImageStates({ ...groupImageStates, [imageId]: { ...groupImageStates[imageId!], caption } });

        return updateCaptionResponse.ok;
    }, []);

    const handleTagsUpdated = useCallback(async (imageId: string, sanitisedTags: string[]) => {
        const updateTextResponse = await fetch(`/api/${group.id}/imagesize/${imageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ id: imageId, text: sanitisedTags.join(',') }),
        });

        setImages([...images.map((image) => (image.id === imageId ? { ...image, tags: sanitisedTags.join(',') } : image))]);

        return updateTextResponse.ok;
    }, []);

    const handleCopyCaption = useCallback((imageId: string, caption: string) => {
        handleCaptionUpdated(imageId, caption);
        setGroupImageStates({ ...groupImageStates, [imageId]: { ...groupImageStates[imageId!], caption } });
        setImages([...images.map((image) => (image.id === imageId ? { ...image, lastUpdatedAt: new Date() } : image))]);
    }, []);

    const handleInheritCaption = useCallback((imageId: string) => {
        handleCaptionUpdated(imageId, null);
        setGroupImageStates({ ...groupImageStates, [imageId]: { ...groupImageStates[imageId], caption: null } });
        setImages([...images.map((image) => (image.id === imageId ? { ...image, lastUpdatedAt: new Date() } : image))]);
    }, []);

    const handleEmptyCaption = useCallback((imageId: string) => {
        handleCaptionUpdated(imageId, '');
        setGroupImageStates({ ...groupImageStates, [imageId]: { ...groupImageStates[imageId], caption: '' } });
        setImages([...images.map((image) => (image.id === imageId ? { ...image, lastUpdatedAt: new Date() } : image))]);
    }, []);

    return (
        <Panel
            heading={`${group.name} ${images.filter((image) => image.isIncludedInGroup).length > 0 ? `(${images.filter((image) => image.isIncludedInGroup).length})` : ''}`}
            headingRight={
                <div className="flex flex-row items-center gap-10">
                    <StatusPill status={trainingStatuses[training.id]?.runs.filter((run) => run.imageGroupId === group.id)?.[0]?.status} />
                    <TrainingToggle trainingId={training.id} imageGroupId={group.id} fetcher={fetcher} />
                </div>
            }
            classes="h-full"
            bodyClasses="">
            <div className="relative flex h-full grow flex-col content-stretch">
                <fetcher.Form action={`/training/${training.id}/imagegroup/${group.id}`} id={training.id} method="post">
                    <ControlGroup heading="Original images">
                        <Button type="submit" size="sm" display="ghost" name="includeall" value="true">
                            Include all
                        </Button>
                        <Button type="submit" size="sm" display="ghost" name="excludeall" value="true">
                            Exclude all
                        </Button>
                    </ControlGroup>
                </fetcher.Form>
                <div className="w-full flex-1 overflow-hidden" ref={listRef}>
                    {windowWidth > 0 && (
                        <ImageTaggingList
                            images={images}
                            windowWidth={windowWidth}
                            cols={cols}
                            textMode={textMode as 'tags' | 'caption'}
                            imageWidth={Math.min(Math.ceil(windowWidth / cols), 500)}
                            imageHeight={750}
                            onImageTagsUpdated={handleTagsUpdated}
                            ImageComponent={(props) => (
                                <Image
                                    {...props}
                                    groupImage={groupImageStates[props.image.id!]}
                                    fetcher={fetcher}
                                    isIncludedInGroup={props.image.isIncludedInGroup || false}
                                    onInclude={handleInclude}
                                    onExclude={handleExclude}
                                    onCopyCaption={handleCopyCaption}
                                    onInheritCaption={handleInheritCaption}
                                    onEmptyCaption={handleEmptyCaption}
                                    thumbnailBucketUrl={thumbnailBucketUrl}
                                    // maxResolutionBucketUrl={maxResolutionBucketUrl}
                                    onCaptionChange={handleCaptionUpdated}
                                    uploadBucketUrl={uploadBucketUrl}
                                />
                            )}
                        />
                    )}
                </div>
            </div>
        </Panel>
    );
}

const Image = ({
    image,
    thumbnailBucketUrl,
    uploadBucketUrl,
    fetcher,
    groupImage,
    isIncludedInGroup,
    onInclude,
    onExclude,
    handleTagChange,
    onCaptionChange,
    handleTagRemove,
    handleGetTagOptions,
    onCopyCaption,
    onInheritCaption,
    onEmptyCaption,
    textMode = 'tags',
}: {
    image: ImageWithMetadata;
    thumbnailBucketUrl: string;
    uploadBucketUrl: string;
    fetcher: FetcherWithComponents<any>;
    groupImage: { x: number; y: number; width: number; height: number; text: string; caption: string | null };
    isIncludedInGroup: boolean;
    onInclude: (imageId: string) => void;
    onExclude: (imageId: string) => void;
    handleTagChange: (tags: string[], imageId: string) => void;
    onCaptionChange: (imageId: string, caption: string) => void;
    handleTagRemove: (tags: string[], removedTag: string, imageId: string) => void;
    handleGetTagOptions: () => string[];
    onCopyCaption: (imageId: string, caption: string) => void;
    onInheritCaption: (imageId: string) => void;
    onEmptyCaption: (imageId: string) => void;
    textMode?: 'tags' | 'caption';
}) => {
    const [groupImageState, setGroupImageState] = useState(groupImage);
    const [isCropping, setIsCropping] = useState(false);

    if (!image.id) {
        return null;
    }

    const handleChange = (tags: string[]) => {
        handleTagChange(tags, image.id!);
    };

    const handleRemove = useCallback(
        (allTags: string[], removedTag: string) => {
            handleTagRemove(allTags, removedTag, image.id!);
        },
        [handleTagRemove, image.id],
    );

    const handleCropComplete = useCallback((crop: CropPercentage) => {
        setGroupImageState({ ...groupImage, ...crop });
    }, []);

    let pixelWidth = image.width!;
    let pixelHeight = image.height!;

    if (groupImage?.width && !groupImage?.height) {
        const widthFactor = (groupImage?.width || 100) / 100;
        const heightFactor = (groupImage?.height || 100) / 100;
        pixelWidth = Math.round(widthFactor * groupImage.width);
        pixelHeight = Math.round(heightFactor * groupImage.height);
    }

    const isTooSmall = isIncludedInGroup && (pixelWidth < 1024 || pixelHeight < 1024);

    return (
        <div className={`relative flex w-full flex-col justify-between gap-4 ${isTooSmall ? 'bg-red-500' : ''}`}>
            <div className="absolute -left-0 -top-1 z-10 flex w-full opacity-0 transition-opacity duration-150 group-hover/image:opacity-100">
                {!isCropping && (
                    <div className="absolute left-2 top-2 z-10">
                        {isIncludedInGroup ? (
                            <Button
                                name={`exclude`}
                                value={image.id}
                                display="ghost"
                                size="icon"
                                onClick={() => onExclude(image.id!)}
                                title="Remove from set">
                                <TrashIcon className="h-4 w-4 text-white" />
                            </Button>
                        ) : (
                            !isCropping && (
                                <Button
                                    name={`include`}
                                    value={image.id}
                                    display="ghost"
                                    size="icon"
                                    onClick={() => onInclude(image.id!)}
                                    title="Include in set">
                                    <CheckIcon className="h-4 w-4 text-white" />
                                </Button>
                            )
                        )}
                    </div>
                )}
                {isIncludedInGroup && (
                    <div className="absolute right-2 top-2 z-10">
                        {!isCropping ? (
                            <Button size="icon" display="ghost" onClick={() => setIsCropping(true)} title="Crop">
                                <CropIcon className="h-4 w-4 text-white" />
                            </Button>
                        ) : (
                            <Button size="icon" display="ghost" onClick={() => setIsCropping(false)} title="End cropping">
                                <CheckIcon className="h-4 w-4 text-white" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
            <div
                data-included={isIncludedInGroup ? 'true' : 'false'}
                className="flex-0 relative aspect-square w-full overflow-hidden data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                {!isCropping ? (
                    groupImage ? (
                        <CroppedImagePreview
                            url={getThumbnailUrl(thumbnailBucketUrl, image.url!, 600)}
                            imageWidth={image.width!}
                            imageHeight={image.height!}
                            containerWidth={466}
                            containerHeight={466}
                            aspectRatio={groupImageState.width / groupImageState.height}
                            crop={groupImageState}
                        />
                    ) : (
                        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                            <ImagePreview url={getThumbnailUrl(thumbnailBucketUrl, image.url!, 600)} id={image.id} className="z-5" />
                        </div>
                    )
                ) : (
                    <ImageCropper
                        fetcher={fetcher}
                        originalImage={image}
                        initialCrop={{
                            x: groupImage?.x || 0,
                            y: groupImage?.y || 0,
                            width: groupImage?.width || 100,
                            height: groupImage?.height || 100,
                        }}
                        isIncludedInGroup={isIncludedInGroup}
                        pixelWidth={pixelWidth}
                        pixelHeight={pixelHeight}
                        uploadBucketUrl={uploadBucketUrl}
                        onCropComplete={handleCropComplete}
                    />
                )}
                <CropMiniMap originalImage={image} completedCrop={groupImageState} className="absolute bottom-2 right-2 z-10" />
            </div>
            <div
                data-included={isIncludedInGroup ? 'true' : 'false'}
                className="flex h-full w-full flex-1 flex-col data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                {textMode === 'tags' && (
                    <MultiComboBox
                        name={`${image.id}-tags`}
                        defaultValue={groupImage?.text || image.text}
                        onGetOptions={handleGetTagOptions}
                        onChange={handleChange}
                        onRemove={handleRemove}
                    />
                )}
                {textMode === 'caption' && (
                    <div className="flex h-full flex-row gap-1">
                        <div className="flex flex-col gap-1">
                            <Button
                                size="icon"
                                display="ghost"
                                onClick={() => onCopyCaption(image.id!, image?.caption || '')}
                                title="Copy caption from original image (to customise it)">
                                <CopyIcon className="h-4 w-4 text-white" />
                            </Button>

                            <Button
                                size="icon"
                                display="ghost"
                                onClick={() => onInheritCaption(image.id!)}
                                title="Inherit from original image (remove custom caption)">
                                <LayersIcon className="h-4 w-4 text-white" />
                            </Button>

                            <Button size="icon" display="ghost" onClick={() => onEmptyCaption(image.id!)} title="Empty caption">
                                <TrashIcon className="h-4 w-4 text-white" />
                            </Button>
                        </div>
                        <Textarea
                            name={`${image.id}-caption`}
                            defaultValue={groupImage?.caption || ''}
                            onBlur={(e) => onCaptionChange(image.id!, e.target.value)}
                            rows={5}
                            className="flex h-full text-sm"
                            placeholder={groupImage?.caption === null ? image?.caption || 'Enter a caption for the image' : groupImage?.caption || ''}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
