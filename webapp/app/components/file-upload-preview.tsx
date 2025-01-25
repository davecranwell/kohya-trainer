import React, { useCallback, useState, useRef } from 'react';
import clsx from 'clsx';

export type Preview = {
    url: string;
    name: string;
    text: string;
};

interface FileUploadPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
    acceptedImageTypes?: string[];
    acceptedTextTypes?: string[];
    previousImages: ImageWithMetadata[];
    maxImages: number;
    onDropped: (files: File[]) => void;
    children?: React.ReactNode;
}

export type ImageWithMetadata = {
    id?: string;
    file?: File;
    filenameNoExtension: string;
    name: string;
    text?: string | null;
    type: string;
    url?: string;
};

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
    acceptedImageTypes = ['image/png', 'image/jpeg'],
    acceptedTextTypes = ['text/plain'],
    children,
    previousImages,
    onDropped,
    maxImages,
    ...props
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDropRef = useRef<HTMLDivElement>(null);
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const [imageCount, setImageCount] = useState(previousImages.length);
    const [isInvalidDrag, setIsInvalidDrag] = useState(false);
    const [dragMessage, setDragMessage] = useState('');

    const handleFiles = async (newFiles: FileList) => {
        setIsDraggedOver(false);

        // filter out the filetypes that are unsupported
        const files = Array.from(newFiles).filter((file) => acceptedImageTypes.includes(file.type) || acceptedTextTypes.includes(file.type));

        onDropped(files);
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        setIsDraggedOver(true);
        if (imageCount + e.dataTransfer.files.length >= maxImages) {
            setIsInvalidDrag(true);
            setDragMessage(
                `You've uploaded The maximum number of images allowed. ${maxImages - imageCount > 0 ? `You can only upload ${maxImages - imageCount} more images.` : ''}`,
            );
        }
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();

            setIsDraggedOver(false);
            setIsInvalidDrag(false);
            setDragMessage('');

            if (imageCount + e.dataTransfer.files.length >= maxImages) return;
            await handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    // Only called when clicking
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (imageCount >= maxImages) return;

            if (e.target.files) await handleFiles(e.target.files);
        },
        [handleFiles],
    );

    return (
        <div {...props}>
            <input
                ref={fileInputRef}
                type="file"
                name="images"
                multiple
                onChange={handleFileChange}
                accept="image/png, image/jpeg"
                className="hidden"
            />
            <div
                ref={dragDropRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={() => {
                    setIsDraggedOver(false);
                    setIsInvalidDrag(false);
                    setDragMessage('');
                }}
                onDragEnd={() => {
                    setIsDraggedOver(false);
                    setIsInvalidDrag(false);
                    setDragMessage('');
                }}
                className={clsx(
                    `rounded border-2 border-dashed p-4`,
                    isDraggedOver && isInvalidDrag && 'border-semantic-error',
                    isDraggedOver && !isInvalidDrag && 'border-semantic-success',
                    !isDraggedOver && 'border-accent2-dark',
                )}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                {dragMessage ||
                    `Drag and drop ${[...acceptedImageTypes, ...acceptedTextTypes].map((type) => `*.${type.split(',')}`).join(', ')} files here or click to
                select from your computer. Any *.txt files which match the filename of an image (minus the extension) will be used to tag that image.`}
                {children}
            </div>
        </div>
    );
};

export default FileUploadPreview;
