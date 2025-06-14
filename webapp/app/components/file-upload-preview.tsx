import React, { useCallback, useState, useRef } from 'react';
import clsx from 'clsx';
import { ImageIcon } from '@radix-ui/react-icons';

export type Preview = {
    url: string;
    name: string;
    text: string;
};

interface FileUploadPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
    acceptedImageTypes?: string[];
    acceptedTextTypes?: string[];
    acceptedImageTypesHumanised?: string[];
    acceptedTextTypesHumanised?: string[];
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
    acceptedImageTypesHumanised = ['png', 'jpeg'],
    acceptedTextTypes = ['text/plain'],
    acceptedTextTypesHumanised = ['txt'],
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
        <div {...props} className="flex h-full flex-col justify-stretch overflow-hidden">
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
                    `flex flex-1 cursor-pointer flex-col rounded border-2 border-dashed p-8`,
                    isDraggedOver && isInvalidDrag && 'border-semantic-error',
                    isDraggedOver && !isInvalidDrag && 'border-semantic-success',
                    !isDraggedOver && 'border-gray-800',
                )}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                {children ? (
                    <label htmlFor="file-upload-input" className="block flex cursor-pointer items-center justify-center text-sm text-gray-600">
                        <ImageIcon className="mr-4 h-6 w-6 text-gray-700" />
                        {dragMessage ||
                            `Drag and drop ${[...acceptedImageTypesHumanised, ...acceptedTextTypesHumanised].map((type) => `*.${type.split(',')}`).join(', ')} files here, or click, to
                    select from your computer. Any *.txt files matching the filename of an image (minus the extension) will be used to tag that image.`}
                    </label>
                ) : (
                    <div className="pointer-events-none flex max-w-3xl flex-1 cursor-pointer flex-col items-center justify-center space-y-6 self-center text-center">
                        <h2 className="text-xl text-white">Upload images to train your Lora</h2>
                        <p>
                            Drag and drop
                            {[...acceptedImageTypesHumanised, ...acceptedTextTypesHumanised]
                                .map((type) => `*.${type.split(',')}`)

                                .join(', ')}
                            files here, or click, to select from your computer. Any *.txt files matching the filename of an image (minus the
                            extension) will be used to tag that image.
                        </p>
                        <ImageIcon className="h-[40px] w-[40px] text-gray-700" />
                    </div>
                )}
                {children && <div className="flex-1 pt-4">{children}</div>}
            </div>
        </div>
    );
};

export default FileUploadPreview;
