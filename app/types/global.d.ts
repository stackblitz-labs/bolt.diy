interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  webkitSpeechRecognition: typeof SpeechRecognition;
  SpeechRecognition: typeof SpeechRecognition;
  analytics?: {
    tags: Record<string, unknown>;
    track: (event: string, properties?: Record<string, any>) => void;
    identify: (userId: string, traits?: Record<string, any>) => void;
  };
  LogRocket?: {
    init: (appId: string) => void;
    identify: (userId: string, traits?: Record<string, any>) => void;
  };
  Intercom?: {
    (command: string, ...args: any[]): void;
  };
}

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

// Add browser property to Process interface
declare namespace NodeJS {
  interface Process {
    browser?: boolean;
  }
}
