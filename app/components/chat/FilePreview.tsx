import React from 'react';

interface FilePreviewProps {
  files: File[];
  imageDataList: string[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, imageDataList, onRemove }) => {
  if (!files || files.length === 0) {
    return null;
  }

  // Function to get the icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return 'i-ph:image';
    }

    const fileName = fileType.toLowerCase();

    if (fileName.includes('pdf') || fileName.endsWith('.pdf')) {
      return 'i-ph:file-pdf';
    }

    if (fileName.includes('docx') || fileName.endsWith('.docx')) {
      return 'i-ph:file-doc';
    }

    if (fileName.includes('text') || fileName.includes('txt') || fileName.endsWith('.txt')) {
      return 'i-ph:file-text';
    }

    if (fileName.endsWith('.md')) {
      return 'i-ph:file-text';
    }

    return 'i-ph:file-text';
  };

  return (
    <div className="flex flex-wrap overflow-x-auto -mt-2 gap-2">
      {files.map((file, index) => (
        <div key={file.name + file.size} className="relative">
          <div className="relative pt-4 pr-4">
            {imageDataList[index] === 'loading-image' ? (
              // Renders loading indicator for images in process
              <div className="flex flex-col items-center justify-center bg-bolt-elements-background-depth-3 rounded-md p-2 min-w-[100px] h-[80px]">
                <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                <div className="text-xs text-bolt-elements-textSecondary mt-1">Loading...</div>
              </div>
            ) : imageDataList[index] && imageDataList[index] !== 'non-image' ? (
              // Renders image for already loaded image types
              <img src={imageDataList[index]} alt={file.name} className="max-h-20" />
            ) : (
              // Renders icon for other file types
              <div className="flex flex-col items-center justify-center bg-bolt-elements-background-depth-3 rounded-md p-2 min-w-[100px] h-[80px]">
                <div className={`${getFileIcon(file.type)} w-6 h-6 text-bolt-elements-textSecondary`} />
                <div className="text-xs text-bolt-elements-textSecondary mt-1 max-w-[100px] truncate">{file.name}</div>
                <div className="text-xs text-bolt-elements-textTertiary">{(file.size / 1024).toFixed(0)} KB</div>
              </div>
            )}
            <button
              onClick={() => onRemove(index)}
              className="absolute top-1 right-1 z-10 bg-black rounded-full w-5 h-5 shadow-md hover:bg-gray-900 transition-colors flex items-center justify-center"
            >
              <div className="i-ph:x w-3 h-3 text-gray-200" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FilePreview;
