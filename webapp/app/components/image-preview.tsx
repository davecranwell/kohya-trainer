import { clsx } from 'clsx';
import React, { useEffect, useState } from 'react';

interface ImagePreviewProps {
    id?: string;
    text?: string | null | undefined;
    url?: string;
    width?: number;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ id, url, width = 200 }) => {
    // Track whether the image failed to load
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        // If the image failed to load and we have a URL, set up retry logic
        if (imageError && url) {
            timeoutId = setTimeout(() => {
                setImageError(false); // Reset error state to trigger a new load attempt
            }, 10000);
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [imageError, url]);

    return (
        // Can't use dynamic heights here
        <div className={`relative block flex h-[200px] w-[200px] flex-none`}>
            {url && (
                <>
                    <img
                        // Add key prop to force React to recreate the img element when error state changes
                        key={`${url}-${imageError}`}
                        src={`https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.amazonaws.com/${url}`}
                        width={width}
                        height="auto"
                        alt=""
                        className={`m-auto block max-h-[200px] max-w-[200px] rounded object-contain text-center`}
                        onError={() => setImageError(true)}
                    />
                    {imageError && <div>Processing...</div>}
                </>
            )}
        </div>
    );
};
