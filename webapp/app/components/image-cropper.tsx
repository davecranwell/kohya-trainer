import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { FetcherWithComponents } from 'react-router';
import { useDebouncedCallback } from 'use-debounce';

import { ImageWithMetadata } from '~/components/file-upload-dropzone';

import { getImageWidthAndHeightAsPercentage, getOriginalUrl } from '~/util/misc';

export type CropPercentage = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export const CropMiniMap = ({
    originalImage,
    completedCrop,
    className,
}: {
    originalImage: ImageWithMetadata;
    completedCrop: CropPercentage;
    className: string;
}) => {
    const minmapSizeOriginal = getImageWidthAndHeightAsPercentage(originalImage.width!, originalImage.height!, 75);

    return (
        <>
            {originalImage.width && originalImage.height && (
                <div className={`${className} h-[80px] w-[80px] overflow-hidden rounded bg-black/50 p-2 text-center`}>
                    <div className="mx-auto h-[50px] w-[50px]">
                        <div
                            className="relative mx-auto h-[75px] w-[75px] overflow-hidden border border-white/30"
                            style={{ width: `${minmapSizeOriginal.width}%`, height: `${minmapSizeOriginal.height}%` }}>
                            <div
                                className={`absolute box-border border border-white`}
                                style={{
                                    width: `${completedCrop?.width}%`,
                                    height: `${completedCrop?.height}%`,
                                    top: `${completedCrop?.y}%`,
                                    left: `${completedCrop?.x}%`,
                                }}></div>
                        </div>
                    </div>
                    <div className="">
                        <p className="text-2xs text-white">
                            {Math.round(((completedCrop?.width || 100) / 100) * originalImage.width)}&times;
                            {Math.round(((completedCrop?.height || 100) / 100) * originalImage.height)}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export const ImageCropper = ({
    originalImage,
    initialCrop,
    isIncludedInGroup,
    uploadBucketUrl,
    fetcher,
    pixelWidth,
    pixelHeight,
    onCropComplete,
}: {
    originalImage: ImageWithMetadata;
    initialCrop: { x: number; y: number; width: number; height: number };
    isIncludedInGroup: boolean;
    uploadBucketUrl: string;
    fetcher: FetcherWithComponents<any>;
    pixelWidth: number;
    pixelHeight: number;
    onCropComplete: (crop: CropPercentage) => void;
}) => {
    const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState<number>(1);
    const [completedCrop, setCompletedCrop] = useState<{ x: number; y: number; width: number; height: number }>(initialCrop);

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

    const debouncedSetFinalCrop = useDebouncedCallback((cropPerc: CropPercentage, imageId: string) => {
        fetcher.submit({ setcrop: JSON.stringify(cropPerc), imageid: imageId }, { action: fetcher.formAction, method: 'post' });
        onCropComplete(cropPerc);
    }, 250);

    return (
        <Cropper
            key={originalImage.id}
            image={getOriginalUrl(uploadBucketUrl, originalImage.url!)}
            showGrid={false}
            zoomSpeed={0.1}
            crop={crop}
            objectFit={
                originalImage.width && originalImage.height
                    ? originalImage.width > originalImage.height
                        ? 'vertical-cover'
                        : 'horizontal-cover'
                    : 'cover'
            }
            zoom={zoom}
            maxZoom={10}
            minZoom={1}
            style={{ cropAreaStyle: { color: 'rgba(0, 0, 0, 0.9)', borderRadius: '10px' } }}
            aspect={1 / 1}
            initialCroppedAreaPercentages={initialCrop}
            onCropComplete={(cropPerc) => {
                setCompletedCrop(cropPerc);
                debouncedSetFinalCrop(cropPerc, originalImage.id!);
            }}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onWheelRequest={onWheelRequest}
            onTouchRequest={onTouchRequest}
        />
    );
};
