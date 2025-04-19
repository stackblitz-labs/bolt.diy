import React from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogRoot } from '~/components/ui/Dialog';
import { useStore } from '@nanostores/react';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import QRCode from 'react-qr-code';

interface ExpoQrModalProps {
  open: boolean;
  onClose: () => void;
}

export const ExpoQrModal: React.FC<ExpoQrModalProps> = ({ open, onClose }) => {
  const expoUrl = useStore(expoUrlAtom);

  return (
    <DialogRoot open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog
        className="text-center !flex-col !mx-auto !text-center !max-w-md"
        showCloseButton={true}
        onClose={onClose}
      >
        <div className="border !border-bolt-elements-borderColor flex flex-col gap-5 justify-center items-center p-6 bg-bolt-elements-background-depth-2 rounded-md">
          <div className="i-bolt:expo-brand h-10 w-full"></div>
          <DialogTitle className="text-white text-lg font-semibold leading-6">
            Preview on your own mobile device
          </DialogTitle>
          <DialogDescription className="bg-bolt-elements-background-depth-3 max-w-sm rounded-md p-1 border border-bolt-elements-borderColor">
            Scan this QR code with the Expo Go app on your mobile device to open your project.
          </DialogDescription>
          <div className="my-6 flex flex-col items-center">
            {expoUrl ? (
              <div className="bg-white p-1 flex flex-col rounded-md justify-center items-center ">
                <QRCode value={expoUrl} size={180} />
              </div>
            ) : (
              <div className="text-gray-500 text-center">No Expo URL detected.</div>
            )}
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
