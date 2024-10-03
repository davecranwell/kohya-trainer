import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigation } from '@remix-run/react';

import { ImagePreview } from './ImagePreview';
import { cn, commaSeparatedStringToArray, makeArrayUnique, sanitiseTagString } from '../../utils/misc';
import clsx from 'clsx';

export type Preview = {
    url: string;
    name: string;
    text: string;
};

interface FileUploadPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
    acceptedFileTypes?: string[];
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
    acceptedFileTypes = ['image/png', 'image/jpeg'],
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

    // useEffect(() => {
    //     if (transition.state === "submitting" || transition.state === "loading") {
    //       if (shouldBlockNavigation) {
    //         alert("You have unsaved changes! Navigation is blocked.");
    //         // Here you could even redirect to a different path if needed
    //         // transition.abort(); // This is to abort, but Remix does not expose a direct abort API yet
    //       }
    //     }
    //   }, [navigation.state, images.]);

    const handleFiles = async (newFiles: FileList) => {
        setIsDraggedOver(false);

        const previousImagesArr = previousImages || [];
        const newImagesAr = Array.from(newFiles)
            .filter((file) => acceptedFileTypes.includes(file.type) && !previousImagesArr.find((currentFile) => currentFile.name === file.name))
            .map((newFile) => ({
                file: newFile,
                filenameNoExtension: newFile.name.split('.').slice(0, -1).join('.'),
                name: newFile.name,
                text: '',
                type: newFile.type,
                url: URL.createObjectURL(newFile!),
            }));

        if (!newImagesAr.length) return;

        // Get all files (existing and new) with their metadata so we can split them into text and image files and annotate existing or new images with tags
        const allFilesMeta: ImageWithMetadata[] = [...previousImagesArr, ...newImagesAr];
        const textFiles = allFilesMeta.filter((fileMeta) => fileMeta.type === 'text/plain');
        const imageFiles = allFilesMeta.filter((fileMeta) => fileMeta.type !== 'text/plain');

        await Promise.all(
            textFiles.map(async (textFile) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = function (e: any) {
                        const matchingImage = imageFiles.find((imageFile) => imageFile.filenameNoExtension === textFile.filenameNoExtension);
                        if (matchingImage) matchingImage.text = e.target?.result as string;
                    };
                    reader.readAsText(textFile.file!);
                });
            }),
        );

        const updatedImageFiles = imageFiles; // todo: make work

        if (fileInputRef.current) {
            const dataTransfer = new DataTransfer();
            [...imageFiles.filter((file) => file.file).map((fileMeta) => fileMeta.file)].forEach((file) => dataTransfer.items.add(file!));

            if (dataTransfer.items.length) {
                fileInputRef.current.files = dataTransfer.files;
            }
        }

        setImageCount(imageCount + updatedImageFiles.length);

        onDropped({
            updatedImages: updatedImageFiles,
            newImages: newImagesAr,
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
                style={{ display: 'none' }}
            />
            <div
                ref={dragDropRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={() => setIsDraggedOver(false)}
                onDragEnd={() => setIsDraggedOver(false)}
                className="rounded border-2 border-dashed border-gray-300 p-4"
                style={{
                    borderColor: isDraggedOver ? (maxImages <= imageCount ? 'red' : 'blue') : '',
                }}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                Drag and drop {acceptedFileTypes.map((type) => `*.${type.split(',')}`).join(', ')} files here or click to select image files. Any
                *.txt files which match the filename of an image (minus the extension) will be used to tag that image.
                {children}
            </div>
        </div>
    );
};

export default FileUploadPreview;
