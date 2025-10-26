import { useEffect } from 'react';

interface ScreenshotStateManagerProps {
  setUploadedFiles?: (files: File[]) => void;
  setImageDataList?: (dataList: string[]) => void;
  uploadedFiles: File[];
  imageDataList: string[];
}

export const ScreenshotStateManager = ({
  setUploadedFiles,
  setImageDataList,
  uploadedFiles,
  imageDataList,
}: ScreenshotStateManagerProps) => {
  useEffect(() => {
    if (setUploadedFiles && setImageDataList) {
      (window as any).__BOLT_SET_UPLOADED_FILES__ = setUploadedFiles;
      (window as any).__BOLT_SET_IMAGE_DATA_LIST__ = setImageDataList;
      (window as any).__BOLT_UPLOADED_FILES__ = uploadedFiles;
      (window as any).__BOLT_IMAGE_DATA_LIST__ = imageDataList;
    }

    return () => {
      delete (window as any).__BOLT_SET_UPLOADED_FILES__;
      delete (window as any).__BOLT_SET_IMAGE_DATA_LIST__;
      delete (window as any).__BOLT_UPLOADED_FILES__;
      delete (window as any).__BOLT_IMAGE_DATA_LIST__;
    };
  }, [setUploadedFiles, setImageDataList, uploadedFiles, imageDataList]);

  return null;
};
