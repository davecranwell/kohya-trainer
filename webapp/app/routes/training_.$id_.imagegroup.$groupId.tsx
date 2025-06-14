import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Form, useLoaderData, useFetcher } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
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

const cellSize = 400;

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

const cache = new CellMeasurerCache({
    defaultHeight: cellSize,
    defaultWidth: cellSize,
    fixedWidth: true,
    fixedHeight: true,
});

const cellPositioner = createMasonryCellPositioner({
    cellMeasurerCache: cache,
    columnCount: 2,
    columnWidth: cellSize,
    spacer: 10,
});

export default function ImageUpload() {
    const fetcher = useFetcher();
    const { images, training, thumbnailBucketUrl, group, groupImageHashmap } = useLoaderData<typeof loader>();
    const isHydrated = useHydrated();
    const [crop, setCrop] = useState<Record<string, { x: number; y: number }>>(
        images.reduce((acc, image) => ({ ...acc, [image.id]: { x: 0, y: 0 } }), {}),
    );
    const [zoom, setZoom] = useState<Record<string, number>>(images.reduce((acc, image) => ({ ...acc, [image.id]: 1 }), {}));
    const [finalCrops, setFinalCrops] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(
        images.reduce((acc, image) => ({ ...acc, [image.id]: { x: 0, y: 0, width: 0, height: 0 } }), {}),
    );

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
        fetcher.submit({ setcrop: JSON.stringify(cropPerc), imageid: imageId }, { action: '', method: 'post' });
    }, 500);

    const cellRenderer = useCallback(
        ({ index, key, parent, style }: any) => {
            const image = images[index];
            const isIncludedInGroup = image.isIncludedInGroup;

            const groupImage = groupImageHashmap[image.id] || {};

            return (
                //className="relative mb-4 h-[400px] w-[400px] overflow-hidden rounded-xl border border-gray-800 bg-gray-900"
                <CellMeasurer cache={cache} index={index} key={key} parent={parent}>
                    <div style={style} className="relative h-[400px] w-[400px] overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
                        <div className="absolute right-1 top-1 z-10">
                            {isIncludedInGroup ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button name={`exclude`} value={image.id} variant="ghost" size="icon">
                                            <Cross1Icon className="h-4 w-4 text-white" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" data-size="small">
                                        Remove from group
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button name={`include`} value={image.id} variant="ghost" size="icon">
                                            <CheckIcon className="h-4 w-4 text-white" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" data-size="small">
                                        Include in group
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        <div
                            data-included={isIncludedInGroup ? 'true' : 'false'}
                            className="data-[included=false]:opacity-10 data-[included=true]:opacity-100">
                            <Cropper
                                key={image.id}
                                image={getThumbnailUrl(thumbnailBucketUrl, image.url, 600)}
                                showGrid={false}
                                zoomSpeed={0.1}
                                crop={crop[image.id]}
                                objectFit="vertical-cover"
                                zoom={zoom[image.id]}
                                style={{ cropAreaStyle: { color: 'rgba(0, 0, 0, 0.8)', borderRadius: '10px' } }}
                                aspect={1 / 1}
                                initialCroppedAreaPercentages={
                                    groupImage.width
                                        ? { width: groupImage.width, height: groupImage.height, x: groupImage.x, y: groupImage.y }
                                        : undefined
                                }
                                onCropComplete={(cropPerc) => isIncludedInGroup && debouncedSetFinalCrop(cropPerc, image.id)}
                                onCropChange={(crop) => setCrop((prev) => ({ ...prev, [image.id]: crop }))}
                                onZoomChange={(zoom) => setZoom((prev) => ({ ...prev, [image.id]: zoom }))}
                                onWheelRequest={onWheelRequest}
                                onTouchRequest={onTouchRequest}
                            />
                        </div>
                    </div>
                </CellMeasurer>
            );
        },
        [images, crop, zoom, isHydrated],
    );

    return (
        <Panel heading={group.name}>
            <fetcher.Form key={`${training.id}-${group.id}`} id={training.id} method="post" className="relative">
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
                <div className="flex flex-row gap-8">
                    <div className="flex-1 basis-3/5">
                        <div className="mt-4 h-[calc(100vh-250px)]">
                            {isHydrated && (
                                <AutoSizer>
                                    {({ width, height }) => (
                                        <Masonry
                                            cellMeasurerCache={cache}
                                            cellPositioner={cellPositioner}
                                            cellRenderer={cellRenderer}
                                            cellCount={images.length}
                                            width={width + 100}
                                            height={height}
                                            autoHeight={false}
                                        />
                                    )}
                                </AutoSizer>
                            )}
                        </div>
                    </div>
                </div>
            </fetcher.Form>
        </Panel>
    );
}
