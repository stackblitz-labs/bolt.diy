import React, { useState, useEffect } from 'react';
import { downloadAttachment } from '~/lib/replay/NutAPI';
import type { ChatMessageAttachment } from '~/lib/persistence/message';
import { Loader2, AlertTriangle } from '~/components/ui/Icon';

interface AttachmentDisplayProps {
  attachment: ChatMessageAttachment;
}

export function AttachmentDisplay({ attachment }: AttachmentDisplayProps) {
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttachment = async () => {
      try {
        setLoading(true);
        setError(null);

        const arrayBuffer = await downloadAttachment(attachment.attachmentId);

        // Convert ArrayBuffer to base64 data URL
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataURL = `data:${attachment.mimeType};base64,${base64}`;

        setDataURL(dataURL);
      } catch (err) {
        console.error('Failed to load attachment:', err);
        setError('Failed to load attachment');
      } finally {
        setLoading(false);
      }
    };

    loadAttachment();
  }, [attachment.attachmentId, attachment.mimeType]);

  const isImage = attachment.mimeType.startsWith('image/');

  // Only render image attachments
  if (!isImage) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
        <Loader2 className="animate-spin text-bolt-elements-textSecondary" size={16} />
        <span className="text-sm text-bolt-elements-textSecondary">Loading image...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="text-red-500" size={16} />
        <div className="text-sm text-red-700">
          <div className="font-medium">Failed to load image</div>
          <div className="text-xs">{attachment.fileName}</div>
        </div>
      </div>
    );
  }

  if (!dataURL) {
    return null;
  }

  return (
    <div className="mt-2">
      <div className="relative group">
        <img
          src={dataURL}
          className="max-w-full h-auto rounded-xl border border-bolt-elements-borderColor shadow-lg transition-all duration-200 group-hover:shadow-xl"
          style={{ maxHeight: '512px', objectFit: 'contain' }}
          alt={attachment.fileName}
        />
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </div>
    </div>
  );
}
