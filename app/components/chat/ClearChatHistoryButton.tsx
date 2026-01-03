import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

interface ClearChatHistoryButtonProps {
  clearChatHistory?: () => Promise<void>;
  disabled?: boolean;
}

export const ClearChatHistoryButton = ({ clearChatHistory, disabled = false }: ClearChatHistoryButtonProps) => {
  const handleClear = async () => {
    if (!clearChatHistory) {
      return;
    }

    try {
      await clearChatHistory();
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  return (
    <Button
      onClick={handleClear}
      disabled={disabled || !clearChatHistory}
      className={classNames(
        'text-xs px-3 py-1.5 rounded-md',
        'bg-red-500 text-white hover:bg-red-600',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-200',
      )}
    >
      Clear Chat History
    </Button>
  );
};
