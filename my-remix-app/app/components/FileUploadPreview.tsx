import React, { useCallback, useState, useRef } from 'react';

export type Preview = {
  url: string;
  name: string;
};

interface FileUploadPreviewProps {
  uploadProgress: Record<string, number>;
  acceptedFileTypes?: string[];
}

export const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  uploadProgress,
  acceptedFileTypes = ['image/png', 'image/jpeg']
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  const handleFiles = useCallback((files: FileList) => {
    const filteredFiles = Array.from(files).filter(file => acceptedFileTypes.includes(file.type));

    const newPreviews = filteredFiles.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setPreviews(prev => [...prev, ...newPreviews]);
    
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      [...(fileInputRef.current.files || []), ...filteredFiles].forEach(file => dataTransfer.items.add(file));
      fileInputRef.current.files = dataTransfer.files;
      console.log('fileInputRef.current.files', fileInputRef.current.files)
    }
  }, [setPreviews]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setIsDraggedOver(true);
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggedOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        name="images"
        multiple
        onChange={handleFileChange}
        accept="image/png, image/jpeg"
        style={{ display: 'none' }}
      />
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={() => setIsDraggedOver(false)}
        style={{
          border: '2px dashed gray',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          borderColor: isDraggedOver ? 'blue' : 'gray',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        Drag and drop {acceptedFileTypes.map(type => `*.${type.split('/')[1]}`).join('/')} images here or click to select image files
    
        {previews.length > 0 && <div className="mt-4 space-y-4">
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
        </div>}
      </div>
    </div>
  );
};

export default FileUploadPreview;