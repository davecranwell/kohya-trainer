import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";

export type UploadedFile = {
  key: string;
  body: Buffer;
  contentType: string;
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

const uploadStream = async ({ Key, ContentType, data, progressCallback }: Pick<AWS.S3.Types.PutObjectRequest, "Key" | "ContentType"> & { progressCallback: (progress: any) => void, data: AsyncIterable<Uint8Array> }) => {
  const pass = new PassThrough();

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key,
      Body: await convertToBuffer(data),
      ContentType,
    },
    leavePartsOnError: false,
  });
  
  upload.on("httpUploadProgress", (progress) => {
    progressCallback(progress);
  });

  return {
    writeStream: pass,
    promise: upload,
  };
};

export async function uploadStreamToS3(data: any, filename: string, ContentType: string, progressCallback: (progress: any) => void) {
  const stream = await uploadStream({
    Key: filename,
    ContentType,
    data,
    progressCallback,
  });

  const file = await stream.promise.done();
  return file.Location;
}
