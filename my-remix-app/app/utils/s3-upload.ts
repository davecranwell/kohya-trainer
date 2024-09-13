import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

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

export async function uploadToS3(files: UploadedFile[]): Promise<string[]> {
  const uploadPromises = files.map(file => {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: file.key,
      Body: file.body,
      ContentType: file.contentType,
    });
    return s3Client.send(command);
  });

  try {
    await Promise.all(uploadPromises);
    return files.map(file => file.key);
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload files to S3");
  }
}