import { PassThrough } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Add this import
import { PutObjectRequest } from '@aws-sdk/client-s3';

export type UploadedFile = {
    key: string;
    body: Buffer;
    contentType: string;
};

export type Progress = {
    Key: string;
    loaded: number;
    total: number;
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

async function convertToBuffer(a: AsyncIterable<Uint8Array>) {
    const result = [];
    for await (const chunk of a) {
        result.push(chunk);
    }
    return Buffer.concat(result);
}

const uploadStream = async ({
    Key,
    ContentType,
    data,
    userId,
    trainingId,
    progressCallback,
}: Pick<PutObjectRequest, 'Key' | 'ContentType'> & {
    userId: string;
    trainingId: string;
    progressCallback: (progress: Progress) => void;
    data: AsyncIterable<Uint8Array>;
}) => {
    const pass = new PassThrough();

    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `${userId}/${trainingId}/${Key}`,
            Body: await convertToBuffer(data),
            ContentType,
        },
        leavePartsOnError: false,
    });

    upload.on('httpUploadProgress', (progress) => {
        progressCallback(progress as Progress);
    });

    return {
        writeStream: pass,
        upload,
    };
};

export async function uploadStreamToS3(
    data: any,
    filename: string,
    ContentType: string,
    userId: string,
    trainingId: string,
    progressCallback: (progress: Progress) => void,
) {
    const { upload } = await uploadStream({
        Key: filename,
        ContentType,
        data,
        userId,
        trainingId,
        progressCallback,
    });

    const file = await upload.done();
    return file.Location;
}
