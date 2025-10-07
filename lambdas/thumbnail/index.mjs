import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const handler = async (event, context) => {
    const s3 = new S3Client({ region: 'us-east-1' });

    // Get the bucket and key from the S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Load the image from S3
    const imageObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    // We need to await the stream and convert it to a buffer before passing to sharp
    const imageBuffer = await imageObject.Body.transformToByteArray();
    const image = sharp(imageBuffer);

    const sizes = [
        {
            size: 200,
            options: {
                fit: 'inside',
            },
        },
        {
            size: 600,
            options: {
                fit: 'inside',
            },
        },
    ];

    for (const size of sizes) {
        // https://sharp.pixelplumbing.com/api-resize#resize
        // rotation without options is essential to apply any exif orientation data
        const thumbnail = await image.rotate().resize(size.size, size.size, size.options).toBuffer();
        // get only the filename from the key
        const filename = key.split('/').pop();
        // get the rest of the path
        const path = key.split('/').slice(0, -1).join('/');

        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.TARGET_BUCKET_NAME,
                Key: `${path}/${size.size}/${filename}`,
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
