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
    updatedAt?: Date;
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

    const getImageFiles = (files: FileList) => {
        return Array.from(files).filter((file) => acceptedImageTypes.includes(file.type));
    };

    const getTextFiles = (files: FileList) => {
        return Array.from(files).filter((file) => acceptedTextTypes.includes(file.type));
    };

    const getSupportedFiles = (files: FileList) => {
        return Array.from(files).filter((file) => acceptedImageTypes.includes(file.type) || acceptedTextTypes.includes(file.type));
    };

    const handleFiles = async (newFiles: FileList) => {
        setIsDraggedOver(false);

        // filter out the filetypes that are unsupported
        const files = getSupportedFiles(newFiles);

        // filter out the files that are already in the previousImages array
        const filteredFiles = files.filter((file) => !previousImages.find((image) => image.name === file.name));

        onDropped(filteredFiles);
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        setIsDraggedOver(true);

        const imageFiles = getImageFiles(e.dataTransfer.files);
        if (imageFiles.length >= maxImages || imageCount + imageFiles.length >= maxImages) {
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

            const imageFiles = getImageFiles(e.dataTransfer.files);
            if (imageFiles.length >= maxImages || imageCount + imageFiles.length >= maxImages) return;

            await handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    // Only called when clicking
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (imageCount >= maxImages) return;

            if (e.target.files) {
                const imageFiles = getImageFiles(e.target.files);

                if (imageFiles.length >= maxImages || imageCount + imageFiles.length >= maxImages) return;

                await handleFiles(e.target.files);
            }
        },
        [handleFiles],
    );

    return (
        <div {...props}>
            <input
                ref={fileInputRef}
                type="file"
                name="images"
                id="file-upload-input"
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
                    `rounded border-2 border-dashed`,
                    isDraggedOver && isInvalidDrag && 'border-semantic-error',
                    isDraggedOver && !isInvalidDrag && 'border-semantic-success',
                    !isDraggedOver && 'border-gray-800',
                )}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                <label htmlFor="file-upload-input" className="block cursor-pointer p-4">
                    {dragMessage ||
                        `Drag and drop ${[...acceptedImageTypes, ...acceptedTextTypes].map((type) => `*.${type.split(',')}`).join(', ')} files here or click here to
                    select from your computer. Any *.txt files which match the filename of an image (minus the extension) will be used to tag that image.`}
                </label>

                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};

export default FileUploadPreview;
