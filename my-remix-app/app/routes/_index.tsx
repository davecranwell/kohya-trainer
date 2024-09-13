import { useState, useRef, useCallback } from 'react';
import { Form, useSubmit } from '@remix-run/react';
import { json, unstable_parseMultipartFormData, ActionFunctionArgs } from '@remix-run/node';
import { uploadToS3 } from '~/utils/s3-upload';
import type { UploadHandler } from '@remix-run/node';
import type { UploadedFile } from '~/utils/s3-upload';

type Preview = {
  url: string;
  name: string;
};

function isUploadedFile(value: any): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    'body' in value &&
    'contentType' in value &&
    value.body instanceof Buffer
  );
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const uploadHandler: UploadHandler = async ({ name, contentType, data }) => {
    const key = `uploads/${Date.now()}-${name}`;
    
    // Store the file info for later use
    (request as any).uploadedFiles = (request as any).uploadedFiles || [];
    (request as any).uploadedFiles.push({ key, name, contentType, data });
    
    return key;
  };
  
  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  // ensures uploadedFiles is at least an array if it doesn't exist, so we can validate it either way
  const uploadedFiles = (request as any).uploadedFiles
  
  if (uploadedFiles.length === 0) {
    throw new Error('No files were uploaded');
  }

  const validFiles: UploadedFile[] = [];

  for (const file of uploadedFiles) {
    if (isUploadedFile(file)) {
      validFiles.push(file);
    } else {
      console.error('Invalid file data received:', file);
    }
  }

  if (validFiles.length === 0) {
    throw new Error('No valid files were uploaded');
  }

  const s3UploadedFiles = await uploadToS3(validFiles);

  return json({ uploadedFiles: s3UploadedFiles });
};

export default function ImageUpload() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();

  const handleFiles = useCallback((files: FileList) => {
    const newPreviews = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setPreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      [...(fileInputRef.current.files || []), ...Array.from(files)].forEach(file => dataTransfer.items.add(file));
      fileInputRef.current.files = dataTransfer.files;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formRef.current) {
      submit(formRef.current);
    }
  };

  return (
    <Form ref={formRef} method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? 'blue' : 'gray'}`,
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        Drag and drop images here or click to select files
      </div>
      <input
        ref={fileInputRef}
        type="file"
        name="images"
        multiple
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <button type="submit">Upload</button>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {previews.map((preview, index) => (
          <div key={index}>
            <img
              src={preview.url}
              alt={`Preview ${index}`}
              style={{ width: '100px', height: '100px', objectFit: 'cover' }}
            />
            <p>{preview.name}</p>
          </div>
        ))}
      </div>
    </Form>
  );
}