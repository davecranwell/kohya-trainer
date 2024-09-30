import React, { useCallback, useState, useRef, useEffect } from 'react';

import { ImagePreview } from './ImagePreview';
import { commaSeparatedStringToArray, makeArrayUnique, sanitiseTagString } from '../../utils/misc';

export type Preview = {
    url: string;
    name: string;
    text: string;
};

interface FileUploadPreviewProps {
    uploadProgress: Record<string, number>;
    acceptedFileTypes?: string[];
    images: ImageWithMetadata[];
    tags: string[];
    maxImages: number;
}

type ImageWithMetadata = {
    id?: string;
    file?: File;
    filenameNoExtension: string;
    name: string;
    text?: string | null;
    type: string;
    url?: string;
};

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
    uploadProgress,
    acceptedFileTypes = ['image/png', 'image/jpeg'],
    tags,
    ...props
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDropRef = useRef<HTMLDivElement>(null);
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const [tagList, setTagList] = useState<string[]>(tags || []);
    const [images, setImages] = useState<ImageWithMetadata[]>(props.images || []);

    const handleFiles = async (newFiles: FileList) => {
        const currentFilesArr = images || [];
        const newFilesArr = Array.from(newFiles).filter(
            (file) => acceptedFileTypes.includes(file.type) && !currentFilesArr.find((currentFile) => currentFile.name === file.name),
        );

        if (!newFilesArr.length) return;

        // Get all files (existing and new) with their metadata so we can split them into text and image files and annotate existing or new images with tags
        const allFilesMeta: ImageWithMetadata[] = [
            ...currentFilesArr,
            ...newFilesArr.map((newFile) => ({
                file: newFile,
                filenameNoExtension: newFile.name.split('.').slice(0, -1).join('.'),
                name: newFile.name,
                text: '',
                type: newFile.type,
                url: URL.createObjectURL(newFile!),
            })),
        ];

        const textFiles = allFilesMeta.filter((fileMeta) => fileMeta.type === 'text/plain');
        const imageFiles = allFilesMeta.filter((fileMeta) => fileMeta.type !== 'text/plain');

        const newTextFiles = await Promise.all(
            textFiles.map(async (textFile) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = function (e: any) {
                        const matchingImage = imageFiles.find((imageFile) => imageFile.filenameNoExtension === textFile.filenameNoExtension);

                        if (matchingImage) {
                            const result = e.target?.result as string;
                            resolve({
                                filename: matchingImage.name,
                                text: sanitiseTagString(result),
                            });
                        }
                    };
                    reader.readAsText(textFile.file!);
                });
            }),
        );

        const newText = newTextFiles.reduce<{ [key: string]: string }>(
            (acc, { filename, text }) => ({
                ...acc,
                [filename]: text,
            }),
            {},
        );

        const updatedImageFiles = imageFiles.map((imageFile) => ({
            ...imageFile,
            text: newText[imageFile.name] || imageFile.text,
        }));

        setImages([...updatedImageFiles]);
        setTagList(makeArrayUnique(imageFiles.map((image) => commaSeparatedStringToArray(image.text || '')).flat()) || []);

        if (fileInputRef.current) {
            const dataTransfer = new DataTransfer();
            [...imageFiles.filter((file) => file.file).map((fileMeta) => fileMeta.file)].forEach((file) => dataTransfer.items.add(file!));

            if (dataTransfer.items.length) {
                fileInputRef.current.files = dataTransfer.files;
            }
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        setIsDraggedOver(true);
        e.preventDefault();
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDraggedOver(false);

            if (images.length >= props.maxImages) return;
            await handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    // Only called when clicking
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (images.length >= props.maxImages) return;

            if (e.target.files) await handleFiles(e.target.files);
        },
        [handleFiles],
    );

    return (
        <div>
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
                style={{
                    border: '2px dashed transparent',
                    padding: '20px',
                    borderColor: isDraggedOver ? (props.maxImages <= props.images.length ? 'red' : 'blue') : 'transparent',
                }}
                onClick={(e) => {
                    e.target === dragDropRef.current && fileInputRef.current?.click();
                }}>
                Drag and drop {acceptedFileTypes.map((type) => `*.${type.split(',')}`).join(', ')} files here or click to select image files. Any
                *.txt files which match the filename of an image (minus the extension) will be used to tag that image.
                {images.length > 0 && (
                    <>
                        <div className="mt-4 space-y-2">
                            {images.map((image, index) => (
                                <ImagePreview
                                    key={image.id || image.url}
                                    url={image.url}
                                    name={image.name}
                                    id={image.id}
                                    text={image.text}
                                    uploadProgress={uploadProgress[image.name]}
                                    tagList={tagList}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FileUploadPreview;
