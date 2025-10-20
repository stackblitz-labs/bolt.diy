import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { Mic, MicOff } from '~/components/ui/Icon';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}) => {
  return (
    <IconButton
      disabled={disabled}
      className={classNames('transition-all', {
        'text-bolt-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
    </IconButton>
  );
};
