import React from 'react';

import { cn, getThumbnailKey } from '#app/utils/misc.js';

interface ImagePreviewProps {
    id?: string;
    name: string;
    text?: string | null | undefined;
    url?: string;
    uploadProgress: number | undefined;
    width?: number;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ id, name, url, uploadProgress, width = 200 }) => {
    return (
        <div className={cn(`relative flex w-[${width}px] h-[${width}px] flex-none`)}>
            {url && (
                <img
                    src={getThumbnailKey(url)}
                    width={width}
                    height={width}
                    alt={`Preview ${name}`}
                    className={`m-auto block w-[${width}px] rounded border border-gray-300 object-contain text-center`}
                />
            )}
            {!id && (
                <div className="absolute inset-x-0 bottom-0 left-0 right-0 top-0 m-auto h-2.5 w-9/12 rounded-full border border-white bg-gray-300 ring-2 ring-white">
                    <div className="h-2.5 w-[0px] rounded-full bg-blue-600 text-sm text-gray-500" style={{ width: `${uploadProgress}%` }}></div>
                </div>
            )}
        </div>
    );
};
