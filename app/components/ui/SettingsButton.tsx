import { memo } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { Settings } from '~/components/ui/Icon';

interface SettingsButtonProps {
  onClick: () => void;
}

export const SettingsButton = memo(({ onClick }: SettingsButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      icon={<Settings size={30} />}
      size="xl"
      title="Settings"
      className="text-[#666] hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/10 transition-colors"
    />
  );
});
