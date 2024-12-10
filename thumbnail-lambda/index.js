const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

exports.handler = async (event, context) => {
    console.log('event', event);
    // Get the bucket and key from the S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const region = event.Records[0].awsRegion;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Check if the key already contains '_thumbnail'
    if (key.includes('_thumbnail')) {
        console.log('Skipping file:', key);
        return;
    }

    // Load the image from S3
    const s3 = new S3Client({ region });
    const imageObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const image = sharp(imageObject.Body);

    // Create the thumbnail
    // https://sharp.pixelplumbing.com/api-resize#resize
    const thumbnail = await image
        .resize(200, 200, {
            fit: 'inside',
        })
        .toBuffer();

    // Create the thumbnail key by adding '_thumbnail' before the file extension
    const thumbnailKey = key.replace(/(\.[^.]+)$/, '_thumbnail$1');

    // Upload the thumbnail back to S3
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: thumbnailKey,
            ContentType: imageObject.ContentType,
            CacheControl: imageObject.CacheControl,
            Body: thumbnail,
        }),
    );

    return {
        statusCode: 200,
        body: 'Thumbnail created successfully',
    };
};
