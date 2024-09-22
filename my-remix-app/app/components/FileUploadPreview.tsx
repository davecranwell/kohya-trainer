import React, { useCallback, useRef } from 'react';

export type Preview = {
  url: string;
  name: string;
};

interface FileUploadPreviewProps {
  previews: Preview[];
  setPreviews: React.Dispatch<React.SetStateAction<Preview[]>>;
  uploadProgress: Record<string, number>;
  setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  previews,
  setPreviews,
  uploadProgress,
  setUploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    const newPreviews = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setPreviews(prev => [...prev, ...newPreviews]);
    
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      [...(fileInputRef.current.files || []), ...Array.from(files)].forEach(file => dataTransfer.items.add(file));
      fileInputRef.current.files = dataTransfer.files;
    }
  }, [setPreviews]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: '2px dashed gray',
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
      <div className="mt-4 space-y-4">
        {previews.map((preview, index) => (
          <div key={index} className="flex items-center space-x-4">
            <img
              src={preview.url}
              alt={`Preview ${index}`}
              style={{ width: '50px', height: '50px', objectFit: 'cover' }}
            />
            <div className="flex-grow">
              <p className="text-sm font-medium">{preview.name}</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${uploadProgress[preview.name] || 0}%` }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-500">{Math.round(uploadProgress[preview.name] || 0)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileUploadPreview;