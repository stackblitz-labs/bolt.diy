'use client';

import * as React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Check, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';

export interface MultiSelectOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  onValueChange: (value: string[]) => void;
  defaultValue?: string[];
  placeholder?: string;
  maxCount?: number;
  className?: string;
  disabled?: boolean;
  /** Called when hovering over an option in the dropdown */
  onOptionHover?: (option: MultiSelectOption) => void;
  /** Called when mouse leaves the dropdown or an option */
  onOptionHoverEnd?: () => void;
  /** Called when the dropdown opens */
  onOpen?: () => void;
  /** Called when the dropdown closes */
  onClose?: () => void;
  /** Hide the select all option */
  hideSelectAll?: boolean;
  /** Enable search functionality */
  searchable?: boolean;
  /** Custom empty state message */
  emptyIndicator?: React.ReactNode;
  /** Maximum number of badges to show before "+X more" */
  maxBadgeCount?: number;
}

interface SortableBadgeProps {
  id: string;
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}

const SortableBadge = ({ id, label, onRemove, disabled }: SortableBadgeProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Badge
      ref={setNodeRef}
      style={style}
      variant="secondary"
      className={cn('flex items-center gap-1 pr-1', isDragging && 'opacity-50 z-50')}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="truncate max-w-[100px]">{label}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          className="ml-1 rounded-full hover:bg-bolt-elements-background-depth-4 p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
};

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      onValueChange,
      defaultValue = [],
      placeholder = 'Select options...',
      maxCount = 10,
      className,
      disabled,
      onOptionHover,
      onOptionHoverEnd,
      onOpen,
      onClose,
      hideSelectAll = false,
      searchable = true,
      emptyIndicator,
      maxBadgeCount = 3,
    },
    ref,
  ) => {
    const normalizedDefault = Array.isArray(defaultValue) ? defaultValue : [];
    const [selectedValues, setSelectedValues] = React.useState<string[]>(normalizedDefault);
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 5,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      }),
    );

    React.useEffect(() => {
      const normalized = Array.isArray(defaultValue) ? defaultValue : [];
      setSelectedValues(normalized);
    }, [defaultValue]);

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setSearchQuery('');
        onOpen?.();
      } else {
        onOptionHoverEnd?.();
        onClose?.();
      }
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = selectedValues.indexOf(active.id as string);
        const newIndex = selectedValues.indexOf(over.id as string);
        const newValues = [...selectedValues];
        newValues.splice(oldIndex, 1);
        newValues.splice(newIndex, 0, active.id as string);
        setSelectedValues(newValues);
        onValueChange(newValues);
      }
    };

    const toggleOption = (value: string) => {
      const option = options.find((o) => o.value === value);
      if (option?.disabled) {
        return;
      }

      let newValues: string[];
      if (selectedValues.includes(value)) {
        newValues = selectedValues.filter((v) => v !== value);
      } else if (selectedValues.length < maxCount) {
        // Insert at the beginning of the list
        newValues = [value, ...selectedValues];
      } else {
        return;
      }
      setSelectedValues(newValues);
      onValueChange(newValues);
    };

    const handleRemove = (value: string) => {
      const newValues = selectedValues.filter((v) => v !== value);
      setSelectedValues(newValues);
      onValueChange(newValues);
    };

    const handleClear = () => {
      setSelectedValues([]);
      onValueChange([]);
    };

    const toggleAll = () => {
      const enabledOptions = options.filter((o) => !o.disabled);
      if (selectedValues.length === enabledOptions.length) {
        handleClear();
      } else {
        const allValues = enabledOptions.map((o) => o.value).slice(0, maxCount);
        setSelectedValues(allValues);
        onValueChange(allValues);
      }
    };

    const filteredOptions = options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.value.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const getLabel = (value: string) => {
      const option = options.find((o) => o.value === value);
      return option?.label || value;
    };

    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              'flex min-h-[40px] w-full items-center justify-between rounded-lg border px-3 py-2',
              'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
              'hover:border-bolt-elements-borderColorActive',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
              disabled && 'opacity-50 cursor-not-allowed',
              className,
            )}
          >
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {selectedValues.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selectedValues} strategy={horizontalListSortingStrategy}>
                    {selectedValues.slice(0, maxBadgeCount).map((value) => (
                      <SortableBadge
                        key={value}
                        id={value}
                        label={getLabel(value)}
                        onRemove={() => handleRemove(value)}
                        disabled={disabled}
                      />
                    ))}
                    {selectedValues.length > maxBadgeCount && (
                      <Badge variant="secondary" className="px-2">
                        +{selectedValues.length - maxBadgeCount} more
                      </Badge>
                    )}
                  </SortableContext>
                </DndContext>
              ) : (
                <span className="text-sm text-bolt-elements-textSecondary">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedValues.length > 0 && !disabled && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Separator orientation="vertical" className="h-4" />
                </>
              )}
              <ChevronDown
                className={cn('h-4 w-4 text-bolt-elements-textSecondary transition-transform', isOpen && 'rotate-180')}
              />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onMouseLeave={() => onOptionHoverEnd?.()}
        >
          <Command>
            {searchable && <CommandInput placeholder="Search..." value={searchQuery} onValueChange={setSearchQuery} />}
            <CommandList>
              <CommandEmpty>{emptyIndicator || 'No options found.'}</CommandEmpty>
              {!hideSelectAll && !searchQuery && (
                <CommandGroup>
                  <CommandItem onSelect={toggleAll} className="cursor-pointer">
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-bolt-elements-borderColor',
                        selectedValues.length === options.filter((o) => !o.disabled).length
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'opacity-50',
                      )}
                    >
                      {selectedValues.length === options.filter((o) => !o.disabled).length && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <span>Select All</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {!hideSelectAll && !searchQuery && <CommandSeparator />}
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleOption(option.value)}
                      onMouseEnter={() => onOptionHover?.(option)}
                      disabled={option.disabled}
                      className={cn('cursor-pointer', option.disabled && 'opacity-50 cursor-not-allowed')}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-bolt-elements-borderColor',
                          isSelected ? 'bg-blue-500 text-white border-blue-500' : 'opacity-50',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {option.icon && <option.icon className="mr-2 h-4 w-4 text-bolt-elements-textSecondary" />}
                      <span style={{ fontFamily: option.value }}>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selectedValues.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <div className="flex items-center justify-between">
                      <CommandItem onSelect={handleClear} className="flex-1 justify-center cursor-pointer">
                        Clear
                      </CommandItem>
                      <Separator orientation="vertical" className="h-6" />
                      <CommandItem onSelect={() => setIsOpen(false)} className="flex-1 justify-center cursor-pointer">
                        Close
                      </CommandItem>
                    </div>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

MultiSelect.displayName = 'MultiSelect';
