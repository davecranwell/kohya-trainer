import * as s3sdk from '@aws-sdk/client-s3';
import sharp from 'sharp'; // Install 'sharp' module in Lambda layer

/**
 * Requests made to cloudfront, and thus to the S3 bucket, are in the format:
 * https://<cloudfront-domain>/<image-name>.<maxdimension>.<extension>
 */
export const handler = async (event, context, callback) => {
    const response = event.Records[0].cf.response;
    const request = event.Records[0].cf.request;

    // Return early if image already found.
    // Rest of this code assumes an image must be created
    if (response.status !== 404) {
        callback(null, response);
    }

    const regex = /\/([^\/]+)\.(\d+)\.(\w+)$/;
    const match = request.uri.match(regex);

    let filename, dimension, extension;

    if (match) {
        filename = match[1];
        dimension = match[2];
        extension = match[3];
    } else {
        callback(null, response);
    }

    // return early if no valid dimension
    const allowedDimensions = [200, 400];
    if (!dimension || !allowedDimensions.includes(dimension)) {
        callback(null, response);
    }

    const BUCKET = 'my-image-resize-bucket';

    const S3 = new s3sdk.S3({ region: 'us-east-1' });

    const originalImage = await S3.getObject({ Bucket: BUCKET, Key: filename + '.' + extension });

    if (!originalImage.Body) {
        throw new Error('No image body returned from S3');
    }

    const requiredFormat = extension == 'jpg' ? 'jpeg' : extension;

    // perform the resize operation
    const newImage = await sharp(data.Body).resize(dimension, dimension).toFormat(requiredFormat).toBuffer();

    // save the resized object to S3 bucket with appropriate object key.
    await S3.putObject({
        Body: newImage,
        Bucket: BUCKET,
        ContentType: 'image/' + requiredFormat,
        CacheControl: 'max-age=31536000',
        Key: filename + '.' + dimension + '.' + extension,
        StorageClass: 'STANDARD',
    });

    response.status = 200;
    response.body = newImage.toString('base64');
    response.bodyEncoding = 'base64';
    response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/' + requiredFormat }];
    callback(null, response);
};
