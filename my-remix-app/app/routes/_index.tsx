import { useState, useEffect, useRef } from 'react';
import { Form } from '@remix-run/react';
import type { UploadHandler } from '@remix-run/node';
import { json, unstable_parseMultipartFormData, ActionFunctionArgs, LoaderFunction } from '@remix-run/node';
import { useEventSource } from "remix-utils/sse/react";

import { FileUploadPreview, Preview } from '~/components/FileUploadPreview';
import { uploadStreamToS3 } from '~/utils/s3-upload';
import { emitter } from "~/utils/emitter.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const s3UploaderHandler: UploadHandler = async ({  name, filename, data, contentType }) => {
    if (name !== "images") {
      return undefined;
    }
    
    await uploadStreamToS3(data, filename!, contentType, (progress) => {
      emitter.emit("progress", JSON.stringify(progress)); // Emit the message to the SSE route
    })
  }

  await unstable_parseMultipartFormData(request, s3UploaderHandler);

  return json(null, { status: 201 });
};

export default function ImageUpload() {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const progressMessage = useEventSource("/sse",  { event: "progress" });

  useEffect(() => {
    if (progressMessage) {
      const progressParsed = JSON.parse(progressMessage);
      const newProgress = { 
        ...uploadProgress,
        [progressParsed.Key]: progressParsed.loaded / progressParsed.total * 100
      };
      console.log('newProgress', newProgress)
      setUploadProgress(newProgress);
    }
  }, [progressMessage])

  return (
    <Form ref={formRef} method="post" encType="multipart/form-data">
      <input type="hidden" name="identifier" value={'abc123'} /> {/* Hidden field for identifier */}
      <FileUploadPreview uploadProgress={uploadProgress} />
      <button type="submit">Upload</button>
    </Form>
  );
}