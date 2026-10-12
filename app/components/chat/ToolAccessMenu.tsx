import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useToolAccessStore, type ToolAccessMode } from '~/lib/stores/toolAccess';
import { classNames } from '~/utils/classNames';

const MODES: Array<{ id: ToolAccessMode; label: string; description: string }> = [
  { id: 'ask-for-all', label: 'Ask For All', description: 'Ask before running each tool' },
  { id: 'full-access', label: 'Full Access', description: 'Run tools without asking each time' },
];

export function ToolAccessMenu() {
  const mode = useToolAccessStore((state) => state.mode);
  const setMode = useToolAccessStore((state) => state.setMode);
  const selectedMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Choose tool access mode"
          aria-label={`Tool access: ${selectedMode.label}`}
          className={classNames(
            'inline-flex items-center gap-1 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 px-2 py-1 text-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus',
            mode === 'full-access'
              ? 'text-accent-500 hover:text-accent-500'
              : 'text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary',
          )}
        >
          <div className={mode === 'full-access' ? 'i-ph:shield-warning' : 'i-ph:hand'} />
          <span>{selectedMode.label}</span>
          <div className="i-ph:caret-down" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[1000] min-w-[245px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-1 shadow-lg"
        >
          {MODES.map((item) => {
            const selected = item.id === mode;

            return (
              <DropdownMenu.Item
                key={item.id}
                onSelect={() => setMode(item.id)}
                className={classNames(
                  'flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 outline-none transition-colors',
                  'hover:bg-bolt-elements-background-depth-3 data-[highlighted]:bg-bolt-elements-background-depth-3',
                  selected && item.id === 'full-access' && 'text-accent-500',
                  !selected && 'text-bolt-elements-textPrimary',
                )}
              >
                <div
                  className={classNames(
                    'mt-0.5 text-base',
                    item.id === 'full-access' ? 'i-ph:shield-warning' : 'i-ph:hand',
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-bolt-elements-textSecondary">{item.description}</span>
                </span>
                {selected && <div className="i-ph:check mt-1 text-sm" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
