import React from 'react';
import { X } from '~/components/ui/Icon';

interface FilePreviewProps {
  files: File[];
  imageDataList: string[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, imageDataList, onRemove }) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row overflow-x-auto -mt-2">
      {files.map((file, index) => (
        <div key={file.name + file.size} className="mr-2 relative">
          {imageDataList[index] && (
            <div className="relative pt-4 pr-4">
              <img src={imageDataList[index]} alt={file.name} className="max-h-20" />
              <button
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 z-10 bg-black rounded-full w-5 h-5 shadow-md hover:bg-gray-900 transition-colors flex items-center justify-center"
              >
                <X className="text-gray-200" size={12} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FilePreview;
