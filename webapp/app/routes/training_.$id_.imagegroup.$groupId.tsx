import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Form, useLoaderData, useFetcher } from 'react-router';
import type { ActionFunctionArgs, FetcherWithComponents, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { CellMeasurer, CellMeasurerCache, AutoSizer, createMasonryCellPositioner, Masonry } from 'react-virtualized';
import { useHydrated } from 'remix-utils/use-hydrated';
import Cropper, { Area } from 'react-easy-crop';
import { CheckIcon, Cross1Icon } from '@radix-ui/react-icons';
import { useDebounce, useDebouncedCallback } from 'use-debounce';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { beginTraining, checkIncompleteTrainingRun, getTrainingByUser } from '~/services/training.server';
import { addAllImageToGroup, addImageToGroup, removeAllImagesFromGroup, removeImageFromGroup, setImageCrop } from '~/services/imagesizes.server';
import { getThumbnailUrl } from '~/util/misc';

import { Button } from '~/components/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/tooltip';
import { Panel } from '~/components/panel';
import { ImageTaggingList } from '~/components/image-tagging-list';
import { ImagePreview } from '~/components/image-preview';
import { ImageWithMetadata } from '~/components/file-upload-preview';

type CropPercentage = {
    x: number;
    y: number;
    width: number;
    height: number;
};

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

export const shouldRevalidate = () => false;

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
                    },
                },
            },
        }),
    ]);

    if (!group) {
        throw data('Not found', { status: 404 });
    }

    const groupImageHashmap: Record<string, { x: number; y: number; width: number; height: number }> = group.images.reduce(
        (acc, image) => ({ ...acc, [image.imageId]: { x: image.x, y: image.y, width: image.width, height: image.height } }),
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

export default function ImageUpload() {
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
        <Panel heading={group.name} className="h-full" bodyClassName="h-full content-stretch grow">
            <fetcher.Form
                action={`/training/${training.id}/imagegroup/${group.id}`}
                key={`${training.id}-${group.id}`}
                id={training.id}
                method="post"
                className="relative flex h-full grow flex-col content-stretch">
                <div className="flex flex-row gap-4">
                    <Button type="submit" className="mb-4" name="includeall" value="true">
                        Include all original images in group
                    </Button>
                    <Button type="submit" className="mb-4" name="excludeall" value="true">
                        Exclude all original images from group
                    </Button>
                    <Button type="submit" className="mb-4" name="run" value="true">
                        Run training on this group
                    </Button>

                    <p>Use ⌘ + scroll (or ctrl + scroll), or two fingers, to zoom images</p>
                </div>
                <div className="w-full flex-1 overflow-hidden" ref={listRef}>
                    {windowWidth > 0 && (
                        <ImageTaggingList
                            ref={listRef}
                            images={images}
                            windowWidth={windowWidth}
                            cols={cols}
                            imageWidth={Math.min(Math.ceil(windowWidth / cols), 500)}
                            thumbnailBucketUrl={thumbnailBucketUrl}
                            onImageTagsUpdated={async (imageId, sanitisedTags) => {
                                return true;
                            }}
                            RenderImage={(props) => (
                                <TaggableImage
                                    {...props}
                                    groupImage={groupImageHashmap[props.image.id!]}
                                    fetcher={fetcher}
                                    thumbnailBucketUrl={thumbnailBucketUrl}
                                />
                            )}
                        />
                    )}
                </div>
            </fetcher.Form>
        </Panel>
    );
}

const TaggableImage = ({
    image,
    thumbnailBucketUrl,
    fetcher,
    groupImage,
}: {
    image: ImageWithMetadata;
    thumbnailBucketUrl: string;
    fetcher: FetcherWithComponents<any>;
    groupImage: { x: number; y: number; width: number; height: number };
}) => {
    const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState<number>(1);
    const [hasInteracted, setHasInteracted] = useState(false);

    const onWheelRequest = (e: any) => {
        if (e.ctrlKey || e.metaKey) {
            return true;
        }
        return false;
    };

    const onTouchRequest = (e: any) => {
        if (e.touches.length > 1) {
            return true;
        }
        return false;
    };

    const debouncedSetFinalCrop = useDebouncedCallback((cropPerc: CropPercentage, imageId: string) => {
        fetcher.submit({ setcrop: JSON.stringify(cropPerc), imageid: imageId }, { action: fetcher.formAction, method: 'post' });
    }, 500);

    if (!image.id) {
        return null;
    }

    const isIncludedInGroup = image.isIncludedInGroup;

    return (
        <div className="relative h-[200px] w-[500px]">
            <div className="absolute right-1 top-1 z-10">
                {isIncludedInGroup ? (
                    <Button name={`exclude`} value={image.id} variant="ghost" size="icon">
                        <Cross1Icon className="h-4 w-4 text-white" /> Remove from group
                    </Button>
                ) : (
                    <Button name={`include`} value={image.id} variant="ghost" size="icon">
                        <CheckIcon className="h-4 w-4 text-white" /> Include in group
                    </Button>
                )}
            </div>
            <div data-included={isIncludedInGroup ? 'true' : 'false'} className="data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                <Cropper
                    key={image.id}
                    image={getThumbnailUrl(thumbnailBucketUrl, image.url!, 600)}
                    showGrid={false}
                    zoomSpeed={0.1}
                    crop={crop}
                    objectFit="vertical-cover"
                    zoom={zoom}
                    style={{ cropAreaStyle: { color: 'rgba(0, 0, 0, 0.8)', borderRadius: '10px' } }}
                    aspect={1 / 1}
                    onInteractionStart={() => setHasInteracted(true)} // this is to prevent the initial crop from being set as the page loads and the image dimensions are 0.000000002 different!
                    initialCroppedAreaPercentages={
                        groupImage
                            ? {
                                  width: groupImage.width,
                                  height: groupImage.height,
                                  x: groupImage.x,
                                  y: groupImage.y,
                              }
                            : undefined
                    }
                    onCropComplete={(cropPerc) => {
                        if (!hasInteracted) return;
                        console.log('crop complete', cropPerc, groupImage);
                        isIncludedInGroup && debouncedSetFinalCrop(cropPerc, image.id!);
                    }}
                    onCropChange={(crop) => setCrop(crop)}
                    onZoomChange={(zoom) => setZoom(zoom)}
                    onWheelRequest={onWheelRequest}
                    onTouchRequest={onTouchRequest}
                />
            </div>
        </div>
    );
};
