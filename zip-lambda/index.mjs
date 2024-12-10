import fs from 'fs';
import path from 'path';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';

/**
 * A function which zips a folder in S3, adding the zip back to the same folder.
 * If the zip already exists, it will not be overwritten.
 */
export const handler = async (event, context) => {
    const s3 = new S3Client({ region: 'us-east-1' });

    // the bucket name and key are passed in from the event body as a JSON object when invoked
    // object expected: { bucket: my-bucket-name=without-domain, key: one-folder/two-folder-with-final-slash/ }
    const { bucket, key } = JSON.parse(event.body);

    const zipKey = `${key}zip/output.zip`;
    const tmpOutputPath = `/tmp/output.zip`;

    // if the zip already exists, overwrite it with a new zip
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: zipKey }));
        console.log(`Deleted existing ZIP file: ${zipKey}`);
    } catch (err) {
        if (err.name !== 'NoSuchKey') {
            console.warn(`No existing ZIP file to delete: ${zipKey}`);
        }
    }

    try {
        // List objects in the specified prefix
        const listedObjects = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: key }));

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return { message: 'No files found to zip.' };
        }

        // Download files to /tmp
        for (const obj of listedObjects.Contents) {
            const key = obj.Key;
            const localPath = `/tmp/${path.basename(key)}`;

            const fileData = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const streamToBuffer = async (stream) =>
                new Promise((resolve, reject) => {
                    const chunks = [];
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.on('error', reject);
                    stream.on('end', () => resolve(Buffer.concat(chunks)));
                });

            const fileBuffer = await streamToBuffer(fileData.Body);
            fs.writeFileSync(localPath, fileBuffer);
        }

        // Create ZIP archive
        const output = fs.createWriteStream(tmpOutputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);

        for (const obj of listedObjects.Contents) {
            const key = obj.Key;
            const localPath = `/tmp/${path.basename(key)}`;
            archive.file(localPath, { name: path.basename(key) });
        }

        await archive.finalize();

        // Upload ZIP back to S3
        const zipData = fs.readFileSync(tmpOutputPath);

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: zipKey,
                Body: zipData,
                ContentType: 'application/zip',
            }),
        );

        return { message: 'Files zipped and uploaded successfully!', zipKey };
    } catch (err) {
        console.error('Error zipping files:', err);
        throw err;
    }
};
