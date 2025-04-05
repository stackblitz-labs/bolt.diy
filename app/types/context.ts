export type ContextAnnotation =
  | {
      type: 'codeContext';
      files: string[];
    }
  | {
      type: 'chatSummary';
      summary: string;
      chatId: string;
    }
  | {
      type: 'reasoning';
      value: string;
    }
  | {
      type: 'usage';
      value: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };

export type ProgressAnnotation = {
  type: 'progress';
  label: string;
  status: 'in-progress' | 'complete';
  order: number;
  message: string;
};
