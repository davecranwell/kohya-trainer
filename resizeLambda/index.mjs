import * as s3sdk from '@aws-sdk/client-s3';
import sharp from 'sharp'; // Install 'sharp' module in Lambda layer

/**
 * Requests made to cloudfront, and thus to the S3 bucket, are in the format:
 * https://<cloudfront-domain>/<image-name>.<maxdimension>.<extension>
 */
export const handler = async (event, context) => {
    const request = event.Records[0].cf.request;

    const BUCKET = 'my-image-resize-bucket';
    const S3 = new s3sdk.S3({ region: 'us-east-1' });

    const regex = /\/([^\/]+)\.(\d+)\.(\w+)$/;
    const match = request.uri.match(regex);

    // if filename not in the format <filename>.<dimension>.<extension> return the request
    if (!match) {
        return request;
    }

    const filename = match[1];
    const dimension = parseInt(match[2]);
    const extension = match[3];
    // NB the key is like the uri but without the leading /
    const key = filename + '.' + dimension.toString() + '.' + extension;

    try {
        // Check if the image already exists
        const response = await S3.headObject({ Bucket: BUCKET, Key: key });
        // Return early if image already found
        return request;
    } catch (error) {}

    // return early if no valid dimension (will 404)
    const allowedDimensions = [200, 400];
    if (!dimension || !allowedDimensions.includes(dimension)) {
        return request;
    }

    // get the original image without the dimension included
    const originalImage = await S3.getObject({ Bucket: BUCKET, Key: filename + '.' + extension });

    if (!originalImage.Body) {
        throw new Error('No image body returned from S3');
    }

    // special finageling for Sharp, which only respects 'jpeg'
    const requiredFormat = extension == 'jpg' ? 'jpeg' : extension;

    // perform the resize operation ensuring images fits within the dimension, maintaining aspect ratio
    const newImage = await sharp(await originalImage.Body.transformToByteArray())
        .resize(dimension, dimension, { fit: 'inside' })
        .toFormat(requiredFormat)
        .toBuffer();

    // save the resized object to S3 bucket with appropriate object key.
    await S3.putObject({
        Body: newImage,
        Bucket: BUCKET,
        ContentType: 'image/' + requiredFormat,
        CacheControl: 'max-age=31536000',
        Key: key,
        StorageClass: 'STANDARD',
    });

    return request;
};
