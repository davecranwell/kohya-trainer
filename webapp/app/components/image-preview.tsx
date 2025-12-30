import React, { useEffect, useState, useRef, useCallback } from 'react';

export const CroppedImagePreview = ({
    crop,
    aspectRatio = 1,
    url,
    imageWidth,
    imageHeight,
    containerWidth,
    containerHeight,
}: {
    crop: { x: number; y: number; width: number; height: number };
    aspectRatio: number;
    url: string;
    imageWidth: number;
    imageHeight: number;
    containerWidth?: number;
    containerHeight?: number;
}) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [translateX, setTranslateX] = useState(0);
    const [translateY, setTranslateY] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [ready, setReady] = useState(false);

    // The crop percentages are relative to the original image (0-100)
    // Following react-easy-crop's getInitialCropFromCroppedAreaPercentages logic
    // We need to calculate zoom and pixel-based translate values

    const calculateTransform = useCallback(() => {
        if (!imageRef.current || !containerRef.current) return;

        const image = imageRef.current;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();

        // Get the rendered image size (after CSS sizing)
        const renderedWidth = image.offsetWidth;
        const renderedHeight = image.offsetHeight;

        if (renderedWidth === 0 || renderedHeight === 0) return;

        // Calculate crop size (the visible area, which matches container aspect ratio)
        const containerAspect = containerRect.width / containerRect.height;
        const imageAspectRatio = imageWidth / imageHeight;
        const cropAspectRatioInImage = (crop.width / crop.height) * imageAspectRatio;

        // Determine crop size based on container and aspect ratio
        let cropSize: { width: number; height: number };
        if (containerAspect >= cropAspectRatioInImage) {
            // Container is wider, crop height fills container height
            cropSize = {
                width: containerRect.height * containerAspect,
                height: containerRect.height,
            };
        } else {
            // Container is taller, crop width fills container width
            cropSize = {
                width: containerRect.width,
                height: containerRect.width / containerAspect,
            };
        }

        // Calculate zoom using react-easy-crop's formula:
        // zoom = cropSize.width / mediaBBoxSize.width * (100 / croppedAreaPercentages.width)
        const zoomValue = (cropSize.width / renderedWidth) * (100 / crop.width);
        setZoom(zoomValue);

        // Calculate translate using react-easy-crop's formula:
        // crop.x = zoom * mediaBBoxSize.width / 2 - cropSize.width / 2 - mediaBBoxSize.width * zoom * (croppedAreaPercentages.x / 100)
        const translateXValue = (zoomValue * renderedWidth) / 2 - cropSize.width / 2 - renderedWidth * zoomValue * (crop.x / 100);

        const translateYValue = (zoomValue * renderedHeight) / 2 - cropSize.height / 2 - renderedHeight * zoomValue * (crop.y / 100);

        setTranslateX(translateXValue);
        setTranslateY(translateYValue);
        setReady(true);
    }, [crop, aspectRatio, imageWidth, imageHeight]);

    useEffect(() => {
        calculateTransform();
    }, [calculateTransform]);

    const imageStyle: React.CSSProperties = {
        transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
    };

    // Use CSS classes to size the image (like react-easy-crop does with object-fit)
    const imageAspectRatio = imageWidth / imageHeight;
    const cropAspectRatioInImage = (crop.width / crop.height) * imageAspectRatio;
    const scaleByWidth = aspectRatio >= cropAspectRatioInImage;
    const imageClassName = scaleByWidth
        ? 'w-full h-auto' // Fill width, auto height (like reactEasyCrop_Cover_Horizontal)
        : 'w-auto h-full'; // Auto width, fill height (like reactEasyCrop_Cover_Vertical)

    return (
        <div
            ref={containerRef}
            className="relative flex h-full w-full items-center justify-center overflow-hidden data-[ready=false]:opacity-0 data-[ready=true]:opacity-100"
            data-ready={ready ? 'true' : 'false'}>
            <img ref={imageRef} src={`${url}`} alt="" className={imageClassName} style={imageStyle} onLoad={calculateTransform} />
        </div>
    );
};

interface ImagePreviewProps {
    id?: string;
    text?: string | null | undefined;
    url?: string;
    width?: number;
    className?: string;
}
export const ImagePreview: React.FC<ImagePreviewProps> = ({ id, url, width = 200 | 600, className, ...props }) => {
    // Track whether the image failed to load
    const [imageError, setImageError] = useState(false);

    return (
        // Can't use dynamic heights here
        <div
            className={`relative block flex overflow-hidden h-[${width}px] w-[${width}px] flex-none ${className} barberpole items-center justify-center`}>
            {url && (
                <>
                    <img
                        // Add key prop to force React to recreate the img element when error state changes
                        key={`${url}-${imageError}`}
                        src={`${url}`}
                        alt=""
                        className={`block max-h-full max-w-full object-contain text-center`}
                        style={{ imageOrientation: 'from-image' }}
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                    {imageError && (
                        <div className="absolute left-0 top-0 z-10 flex h-[200px] w-[200px] items-center justify-center">Processing...</div>
                    )}
                </>
            )}
        </div>
    );
};
