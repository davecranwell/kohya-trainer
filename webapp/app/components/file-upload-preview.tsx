import React, { useCallback, useState, useRef, useEffect } from 'react';

import { commaSeparatedStringToArray, makeArrayUnique, sanitiseTagString } from '~/util/misc';
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
    onDropped: ({ updatedImages, newImages, tags }: { updatedImages: ImageWithMetadata[]; newImages: ImageWithMetadata[]; tags: string[] }) => void;
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

    const isAcceptedFileAndNotPreviousImage = (file: File) =>
        (acceptedImageTypes.includes(file.type) || acceptedTextTypes.includes(file.type)) &&
        !previousImages.find((currentFile) => currentFile.name === file.name);

    const handleFiles = async (newFiles: FileList) => {
        setIsDraggedOver(false);

        const previousImagesArr = previousImages || [];
        const newFilesArr = Array.from(newFiles)
            .filter(isAcceptedFileAndNotPreviousImage)
            .map((newFile) => ({
                file: newFile,
                filenameNoExtension: newFile.name.split('.').slice(0, -1).join('.'),
                name: newFile.name,
                text: '',
                type: newFile.type,
                url: URL.createObjectURL(newFile!),
            }));

        if (!newFilesArr.length) return;

        // get only the new images so we can return them to appear in the UI as un-uploaded images
        const newImages = newFilesArr.filter((file) => acceptedImageTypes.includes(file.type));

        // Get all files (existing and new) with their metadata so we can split them into text and image files and annotate existing or new images with tags
        const allFilesMeta: ImageWithMetadata[] = [...previousImagesArr, ...newFilesArr];
        const textFiles = allFilesMeta.filter((fileMeta) => fileMeta.type === 'text/plain');
        const imageFiles = allFilesMeta.filter((fileMeta) => fileMeta.type !== 'text/plain');

        const updatedImages = await Promise.all(
            textFiles.map(async (textFile) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = function (e: any) {
                        const matchingImage = imageFiles.find((imageFile) => imageFile.filenameNoExtension === textFile.filenameNoExtension);
                        if (matchingImage) {
                            matchingImage.text = e.target?.result as string;
                            resolve(matchingImage);
                        }
                    };
                    reader.readAsText(textFile.file!);
                });
            }),
        );

        if (fileInputRef.current) {
            const dataTransfer = new DataTransfer();
            [...imageFiles.filter((file) => file.file).map((fileMeta) => fileMeta.file)].forEach((file) => dataTransfer.items.add(file!));

            if (dataTransfer.items.length) {
                fileInputRef.current.files = dataTransfer.files;
            }
        }

        setImageCount(imageCount + newImages.length);

        onDropped({
            updatedImages: updatedImages as ImageWithMetadata[],
            newImages,
            tags: makeArrayUnique(imageFiles.map((image) => commaSeparatedStringToArray(image.text || '')).flat()) || [],
        });
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();

        setIsDraggedOver(true);
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();

            setIsDraggedOver(false);

            if (imageCount >= maxImages) return;
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
                onDragLeave={() => setIsDraggedOver(false)}
                onDragEnd={() => setIsDraggedOver(false)}
                className={clsx(
                    `rounded border-2 border-dashed p-4`,
                    isDraggedOver && maxImages < imageCount && 'border-semantic-error',
                    isDraggedOver && maxImages >= imageCount && 'border-semantic-success',
                    !isDraggedOver && 'border-accent2-dark',
                )}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                Drag and drop {[...acceptedImageTypes, ...acceptedTextTypes].map((type) => `*.${type.split(',')}`).join(', ')} files here or click to
                select from your computer. Any *.txt files which match the filename of an image (minus the extension) will be used to tag that image.
                {children}
            </div>
        </div>
    );
};

export default FileUploadPreview;
