import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import type { ActionFunctionArgs, FetcherWithComponents, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import Cropper from 'react-easy-crop';
import { CheckIcon, Cross1Icon } from '@radix-ui/react-icons';
import { useDebouncedCallback } from 'use-debounce';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { beginTraining, checkIncompleteTrainingRun, getTrainingByUser } from '~/services/training.server';
import { addAllImageToGroup, addImageToGroup, removeAllImagesFromGroup, removeImageFromGroup, setImageCrop } from '~/services/imagesizes.server';
import { getThumbnailUrl } from '~/util/misc';

import { Button } from '~/components/button';
import { Panel } from '~/components/panel';
import { MultiComboBox } from '~/components/forms/multi-combo-box';
import { ImageTaggingList } from '~/components/image-tagging-list';
import { ImageWithMetadata } from '~/components/file-upload-preview';
import { ControlGroup } from '~/components/control-group';

type CropPercentage = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export const shouldRevalidate = ({
    actionResult,
    currentParams,
    currentUrl,
    defaultShouldRevalidate,
    formAction,
    formData,
    formEncType,
    formMethod,
    nextParams,
    nextUrl,
}: {
    actionResult: any;
    currentParams: any;
    currentUrl: any;
    defaultShouldRevalidate: any;
}) => !formData || (formData.get('setcrop') == undefined && formData.get('include') == undefined && formData.get('exclude') == undefined);

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
    const include = formData.get('include') as string;
    const exclude = formData.get('exclude') as string;
    const setCrop = formData.get('setcrop') as string;
    const imageId = formData.get('imageid') as string;

    if (run) {
        if (await checkIncompleteTrainingRun(training.id)) {
            return data({ error: 'Training already started' }, { status: 400 });
        }

        await beginTraining(training, params.groupId);
    }

    if (includeall) {
        await addAllImageToGroup(training.id, params.groupId as string);
    }

    if (excludeall) {
        await removeAllImagesFromGroup(params.groupId as string);
    }

    if (include) {
        await addImageToGroup(params.groupId as string, include);
    }

    if (exclude) {
        await removeImageFromGroup(params.groupId as string, exclude);
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
                url: true,
                type: true,
                createdAt: true,
            },
            where: { trainingId: params.id },
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
                    },
                },
            },
        }),
    ]);

    if (!group) {
        throw data('Not found', { status: 404 });
    }

    const groupImageHashmap: Record<string, { x: number; y: number; width: number; height: number }> = group.images.reduce(
        (acc, groupImage) => ({
            ...acc,
            [groupImage.imageId]: { x: groupImage.x, y: groupImage.y, width: groupImage.width, height: groupImage.height, text: groupImage.text },
        }),
        {},
    );

    return {
        thumbnailBucketUrl: `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/`,
        userId,
        images: images.map((image) => ({ ...image, isIncludedInGroup: !!groupImageHashmap[image.id] })),
        training,
        group,
        groupImageHashmap,
    };
}

export default function ImageGroup() {
    const fetcher = useFetcher();
    const listRef = useRef<HTMLDivElement>(null);
    const { images, training, thumbnailBucketUrl, group, groupImageHashmap } = useLoaderData<typeof loader>();
    const [windowWidth, setWindowWidth] = useState(0);
    const [cols, setCols] = useState(3);

    useEffect(() => {
        const detectedWidth = listRef?.current?.clientWidth;

        if (detectedWidth) {
            setWindowWidth(detectedWidth || 0);
            setCols(Math.max(Math.floor(detectedWidth / 500), 1));
        }
    }, []);

    return (
        <Panel
            heading={
                <div className="flex flex-row items-center gap-2">
                    <span>{group.name}</span>
                    <Button variant="textonly" size="icon" icon={Cross1Icon} />
                </div>
            }
            classes="h-full"
            bodyClasses="">
            <div className="relative flex h-full grow flex-col content-stretch">
                <fetcher.Form action={`/training/${training.id}/imagegroup/${group.id}`} id={training.id} method="post">
                    <ControlGroup heading="Original images">
                        <Button type="submit" size="sm" variant="ghost" name="includeall" value="true">
                            Include all
                        </Button>
                        <Button type="submit" size="sm" variant="ghost" name="excludeall" value="true">
                            Exclude all
                        </Button>
                        <Button type="submit" size="sm" name="run" value="true">
                            Run training on this group
                        </Button>
                    </ControlGroup>
                </fetcher.Form>
                <div className="w-full flex-1 overflow-hidden" ref={listRef}>
                    {windowWidth > 0 && (
                        <ImageTaggingList
                            ref={listRef}
                            images={images}
                            windowWidth={windowWidth}
                            cols={cols}
                            imageWidth={Math.min(Math.ceil(windowWidth / cols), 500)}
                            imageHeight={700}
                            onImageTagsUpdated={async (imageId, sanitisedTags) => {
                                const updateTextResponse = await fetch(`/api/${group.id}/imagesize/${imageId}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ id: imageId, text: sanitisedTags.join(',') }),
                                });

                                if (updateTextResponse.ok) {
                                    const updatedImage = images.find((image) => image.id === imageId);
                                    if (updatedImage) {
                                        updatedImage.text = sanitisedTags.join(',');
                                    }
                                }

                                return updateTextResponse.ok;
                            }}
                            RenderImage={(props) => (
                                <Image
                                    {...props}
                                    isScrolling
                                    groupImage={groupImageHashmap[props.image.id!]}
                                    fetcher={fetcher}
                                    thumbnailBucketUrl={thumbnailBucketUrl}
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
    fetcher,
    groupImage,
    allTags,
    handleTagChange,
    handleTagRemove,
    isScrolling,
}: {
    image: ImageWithMetadata;
    thumbnailBucketUrl: string;
    fetcher: FetcherWithComponents<any>;
    groupImage: { x: number; y: number; width: number; height: number };
    allTags: string[];
    handleTagChange: (tags: string[], imageId: string) => void;
    handleTagRemove: (tags: string[], removedTag: string, imageId: string) => void;
    isScrolling: boolean;
}) => {
    const [crop, setCrop] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
    const [zoom, setZoom] = useState<number>(1);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isIncludedInGroup, setIsIncludedInGroup] = useState(image.isIncludedInGroup);

    const onWheelRequest = useCallback((e: any) => {
        if (e.ctrlKey || e.metaKey) {
            return true;
        }
        return false;
    }, []);

    const onTouchRequest = useCallback((e: any) => {
        if (e.touches.length > 1) {
            return true;
        }
        return false;
    }, []);

    const handleInclude = useCallback((imageId: string) => {
        fetcher.submit({ include: imageId }, { action: fetcher.formAction, method: 'post' });

        setIsIncludedInGroup(true);
    }, []);

    const handleExclude = useCallback((imageId: string) => {
        fetcher.submit({ exclude: imageId }, { action: fetcher.formAction, method: 'post' });

        setIsIncludedInGroup(false);
    }, []);

    const debouncedSetFinalCrop = useDebouncedCallback((cropPerc: CropPercentage, imageId: string) => {
        fetcher.submit({ setcrop: JSON.stringify(cropPerc), imageid: imageId }, { action: fetcher.formAction, method: 'post' });
    }, 500);

    if (!image.id) {
        return null;
    }

    const initialCroppedAreaPercentages =
        isIncludedInGroup && groupImage?.x != null && groupImage?.y != null && groupImage?.width != null && groupImage?.height != null
            ? {
                  width: groupImage.width,
                  height: groupImage.height,
                  x: groupImage.x,
                  y: groupImage.y,
              }
            : undefined;

    return (
        <div className="relative flex w-full flex-col">
            <div className="absolute left-1 top-1 z-10">
                {isIncludedInGroup ? (
                    <Button
                        name={`exclude`}
                        value={image.id}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleExclude(image.id!)}
                        title="Remove from set">
                        <Cross1Icon className="h-4 w-4 text-white" />
                    </Button>
                ) : (
                    <Button
                        name={`include`}
                        value={image.id}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleInclude(image.id!)}
                        title="Include in set">
                        <CheckIcon className="h-4 w-4 text-white" />
                    </Button>
                )}
            </div>
            <div
                data-included={isIncludedInGroup ? 'true' : 'false'}
                className="flex-0 relative h-[500px] w-full data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                <Cropper
                    key={image.id}
                    image={getThumbnailUrl(thumbnailBucketUrl, image.url!, 600)}
                    showGrid={false}
                    zoomSpeed={0.1}
                    crop={crop}
                    objectFit="vertical-cover" // causes all sorts of flickering image layout issues
                    zoom={zoom}
                    maxZoom={10}
                    minZoom={1}
                    style={{ cropAreaStyle: { color: 'rgba(0, 0, 0, 0.9)', borderRadius: '10px' } }}
                    aspect={1 / 1}
                    onInteractionStart={() => setHasInteracted(true)} // this is to prevent the initial crop from being set as the page loads and the image dimensions are 0.000000002 different!
                    initialCroppedAreaPercentages={initialCroppedAreaPercentages}
                    onCropComplete={(cropPerc) => {
                        if (!hasInteracted) return;
                        isIncludedInGroup && debouncedSetFinalCrop(cropPerc, image.id!);
                    }}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onWheelRequest={onWheelRequest}
                    onTouchRequest={onTouchRequest}
                />
            </div>
            <div
                data-included={isIncludedInGroup ? 'true' : 'false'}
                className="flex-0 mt-4 h-[130px] w-full data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                <MultiComboBox
                    name={`${image.id}-tags`}
                    defaultValue={groupImage?.text || image.text}
                    options={allTags}
                    onChange={(tags) => {
                        handleTagChange(tags, image.id!);
                    }}
                    onRemove={(allTags, removedTag) => {
                        handleTagRemove(allTags, removedTag, image.id!);
                    }}
                />
            </div>
        </div>
    );
};
