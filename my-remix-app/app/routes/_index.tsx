import { useState, useEffect, useRef, useCallback } from 'react';
import { Form, useSubmit, useActionData, useParams } from '@remix-run/react';
import type { UploadHandler } from '@remix-run/node';
import { json, unstable_parseMultipartFormData, ActionFunctionArgs, LoaderFunction } from '@remix-run/node';
import { FileUploadPreview, Preview } from '~/components/FileUploadPreview'; // Import the new component
import { uploadStreamToS3 } from '~/utils/s3-upload';
import { eventStream } from "remix-utils/sse/server";
import { useEventSource } from "remix-utils/sse/react";
import { defer } from "@remix-run/node"; // or cloudflare/deno
import { useRevalidator } from "@remix-run/react";
import { EventEmitter } from "node:events";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import { Readable } from 'stream';
import { emitter } from "~/utils/emitter.server"; // Import your event emitter


export const action = async ({ request }: ActionFunctionArgs) => {
  const s3UploaderHandler: UploadHandler = async ({  name, filename, data, contentType }) => {
    if (name !== "images") {
      return undefined;
    }
    
    await uploadStreamToS3(data, filename!, contentType, (progress) => {
      // console.log('this is the filename', filename, contentType);
      // console.log('this is the progress', progress);
      emitter.emit("message", 'woo'); // Emit the message to the SSE route
    })
  }

  const formData = await unstable_parseMultipartFormData(request, s3UploaderHandler);

  return json(null, { status: 201 });

  // return eventStream(request.signal, function setup(send) {
  //   function handle(message: Message) {
  //     send({ event: "new-message", data: message.id });
  //     console.log('this is the message', message);
  //   }

  //   emitter.on("message", handle);

  //   return function clear() {
  //     emitter.off("message", handle);
  //   };
  // });
};

export const loader: LoaderFunction = async ({ request }) => {
  return null
};

export default function ImageUpload() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useSubmit();
  const revalidator = useRevalidator();
  const actionData = useActionData()
  const messages = useEventSource("/sse",  { event: "new-message" }) ?? 'hello';

  // useEffect(() => {
  //   const eventSource = new EventSource("/sse");

  //   eventSource.onmessage = (event) => {
  //     //const data = JSON.parse(event.data);
  //     console.log("New message:", 'hello');
  //     // Update your UI with the new message
  //   };

  //   return () => {
  //     eventSource.close(); // Clean up on unmount
  //   };
  // }, []);

  return (
    <Form ref={formRef} method="post" encType="multipart/form-data">
      {messages}
      <input type="hidden" name="identifier" value={'abc123'} /> {/* Hidden field for identifier */}
      <FileUploadPreview
        previews={previews}
        setPreviews={setPreviews}
        uploadProgress={uploadProgress}
        setUploadProgress={setUploadProgress}
      />
      <button type="submit">Upload</button>
    </Form>
  );
}