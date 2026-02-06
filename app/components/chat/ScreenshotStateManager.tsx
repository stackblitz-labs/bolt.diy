import { useEffect } from 'react';

interface ScreenshotStateManagerProps {
  setUploadedFiles?: (files: File[]) => void;
  setImageDataList?: (dataList: string[]) => void;
  setAttachmentTextList?: (dataList: string[]) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  attachmentTextList: string[];
}

export const ScreenshotStateManager = ({
  setUploadedFiles,
  setImageDataList,
  setAttachmentTextList,
  uploadedFiles,
  imageDataList,
  attachmentTextList,
}: ScreenshotStateManagerProps) => {
  useEffect(() => {
    if (setUploadedFiles && setImageDataList && setAttachmentTextList) {
      (window as any).__BOLT_SET_UPLOADED_FILES__ = setUploadedFiles;
      (window as any).__BOLT_SET_IMAGE_DATA_LIST__ = setImageDataList;
      (window as any).__BOLT_SET_ATTACHMENT_TEXT_LIST__ = setAttachmentTextList;
      (window as any).__BOLT_UPLOADED_FILES__ = uploadedFiles;
      (window as any).__BOLT_IMAGE_DATA_LIST__ = imageDataList;
      (window as any).__BOLT_ATTACHMENT_TEXT_LIST__ = attachmentTextList;
    }

    return () => {
      delete (window as any).__BOLT_SET_UPLOADED_FILES__;
      delete (window as any).__BOLT_SET_IMAGE_DATA_LIST__;
      delete (window as any).__BOLT_SET_ATTACHMENT_TEXT_LIST__;
      delete (window as any).__BOLT_UPLOADED_FILES__;
      delete (window as any).__BOLT_IMAGE_DATA_LIST__;
      delete (window as any).__BOLT_ATTACHMENT_TEXT_LIST__;
    };
  }, [setUploadedFiles, setImageDataList, setAttachmentTextList, uploadedFiles, imageDataList, attachmentTextList]);

  return null;
};
