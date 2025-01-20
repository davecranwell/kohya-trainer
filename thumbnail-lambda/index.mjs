import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const handler = async (event, context) => {
    const s3 = new S3Client({ region: 'us-east-1' });

    // Get the bucket and key from the S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Check if the key already contains '_thumbnail'
    if (key.includes('_thumbnail')) {
        console.log('Skipping file:', key);
        return;
    }

    // Load the image from S3
    const imageObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const image = sharp(imageObject.Body);

    const sizes = [
        {
            size: 200,
            options: {
                fit: 'inside',
            },
            key: (key) => key.replace(/(\.[^.]+)$/, '_thumbnail-200$1'),
        },
        {
            size: 2048,
            options: {
                fit: 'inside',
                withoutEnlargement: true,
            },
            key: (key) => key,
        },
    ];

    for (const size of sizes) {
        // https://sharp.pixelplumbing.com/api-resize#resize
        const thumbnail = await image.resize(size.size, size.size, size.options).toBuffer();

        const key = size.key(key);

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: thumbnail,
                ContentType: imageObject.ContentType,
                CacheControl: imageObject.CacheControl,
            }),
        );
    }

    return {
        statusCode: 200,
        body: 'Thumbnails created successfully',
    };
};
