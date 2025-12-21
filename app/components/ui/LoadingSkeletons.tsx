/**
 * Loading Skeleton Components
 *
 * Provides animated skeleton components for various UI elements during loading states.
 * Includes enhanced skeletons with better animations and visual feedback.
 *
 * Phase 8, Task T052 - Loading skeletons with pulse animation
 */

import React from 'react';
import { classNames } from '~/utils/classNames';

/**
 * Base skeleton component with pulse animation
 */
export function Skeleton({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames('animate-pulse rounded-md bg-bolt-elements-borderColor', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Project card skeleton component (enhanced version)
 */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg p-6">
      {/* Header section */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          {/* Project title */}
          <Skeleton className="h-6 w-3/4 mb-2" />
          {/* Project description */}
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        {/* Status badge */}
        <Skeleton className="h-6 w-16 ml-4" />
      </div>

      {/* Stats section */}
      <div className="flex items-center space-x-6 mb-4">
        {/* Messages count */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-12" />
        </div>
        {/* Last updated */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Actions section */}
      <div className="flex items-center justify-between pt-4 border-t border-bolt-elements-borderColor">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full ml-2" />
        </div>
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  );
}

/**
 * Chat message skeleton component
 */
export function ChatMessageSkeleton() {
  return (
    <div className="flex space-x-4 p-4">
      {/* Avatar */}
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />

      {/* Message content */}
      <div className="flex-1 space-y-2">
        {/* Header */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>

        {/* Message lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />

        {/* Actions */}
        <div className="flex items-center space-x-2 pt-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Chat history skeleton component
 */
export function ChatHistorySkeleton({ messageCount = 3 }: { messageCount?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: messageCount }).map((_, index) => (
        <ChatMessageSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * File tree skeleton component
 */
export function FileTreeSkeleton({ fileCount = 5 }: { fileCount?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: fileCount }).map((_, index) => (
        <div key={index} className="flex items-center space-x-2 py-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className={classNames('h-4', index % 3 === 0 ? 'w-32' : index % 3 === 1 ? 'w-24' : 'w-40')} />
        </div>
      ))}
    </div>
  );
}

/**
 * Workbench skeleton component
 */
export function WorkbenchSkeleton() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-bolt-elements-borderColor p-4">
        <Skeleton className="h-6 w-20 mb-4" />
        <FileTreeSkeleton fileCount={8} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-bolt-elements-borderColor">
          <Skeleton className="h-10 w-32 border-r border-bolt-elements-borderColor" />
          <Skeleton className="h-10 w-24 border-r border-bolt-elements-borderColor" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Editor */}
        <div className="flex-1 p-4">
          <div className="space-y-2">
            {Array.from({ length: 15 }).map((_, index) => (
              <Skeleton
                key={index}
                className={classNames(
                  'h-4',
                  index % 4 === 0 ? 'w-full' : index % 4 === 1 ? 'w-11/12' : index % 4 === 2 ? 'w-10/12' : 'w-9/12',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Preview panel */}
      <div className="w-80 border-l border-bolt-elements-borderColor p-4">
        <Skeleton className="h-6 w-16 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-6 w-24 mb-2" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading overlay component
 */
export function LoadingOverlay({
  isLoading,
  children,
  message = 'Loading...',
}: {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
}) {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-bolt-elements-background-depth-1 bg-opacity-80 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-center">
          {/* Loading spinner */}
          <div className="inline-flex items-center justify-center w-8 h-8 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-bolt-elements-item-backgroundAccent"></div>
          </div>

          {/* Loading message */}
          <p className="text-bolt-elements-textSecondary text-sm">{message}</p>

          {/* Progress indicator */}
          <div className="mt-4 w-48 bg-bolt-elements-borderColor rounded-full h-1">
            <div className="bg-bolt-elements-item-backgroundAccent h-1 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>

      {/* Content underneath (dimmed) */}
      <div className="opacity-50">{children}</div>
    </div>
  );
}

/**
 * Button skeleton component
 */
export function ButtonSkeleton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // Filter out button-specific props that aren't valid on div elements
  const { disabled, type, value, ...divProps } = props;
  return (
    <Skeleton
      className={classNames('h-10 px-4 py-2 inline-flex items-center', className)}
      {...(divProps as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

/**
 * Input skeleton component
 */
export function InputSkeleton({ className, ...props }: React.HTMLAttributes<HTMLInputElement>) {
  // Filter out input-specific props that aren't valid on div elements
  const {
    type: _type,
    value: _value,
    placeholder: _placeholder,
    disabled: _disabled,
    readOnly: _readOnly,
    required: _required,
    maxLength: _maxLength,
    minLength: _minLength,
    pattern: _pattern,
    min: _min,
    max: _max,
    step: _step,
    ...divProps
  } = props as any;
  return (
    <Skeleton
      className={classNames('h-10 px-3 py-2 border border-bolt-elements-borderColor rounded-md', className)}
      {...divProps}
    />
  );
}

/**
 * Card skeleton component
 */
export function CardSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        'bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg p-6',
        className,
      )}
      {...props}
    >
      <Skeleton className="h-6 w-3/4 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/**
 * List skeleton component
 */
export function ListSkeleton({
  itemCount = 3,
  itemHeight = 'h-12',
  showAvatars = false,
}: {
  itemCount?: number;
  itemHeight?: string;
  showAvatars?: boolean;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className={classNames('flex items-center space-x-3 p-2', itemHeight)}>
          {showAvatars && <Skeleton className="h-8 w-8 rounded-full" />}
          <Skeleton className={classNames(showAvatars ? 'flex-1' : 'w-full')} />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard skeleton component (combination of multiple skeletons)
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1">
      {/* Header */}
      <div className="border-b border-bolt-elements-borderColor bg-white dark:bg-gray-950 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <ButtonSkeleton className="w-32" />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* User summary */}
        <div className="mb-8 p-4 bg-white dark:bg-gray-950 border border-bolt-elements-borderColor rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="text-right">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Projects list */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">
            <Skeleton className="h-6 w-32" />
          </h2>
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      </div>
    </div>
  );
}
