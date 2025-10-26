import React from 'react';
import { classNames } from '~/utils/classNames';

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  height?: string;
}

export function LoadingSkeleton({ className, lines = 1, height = 'h-4' }: LoadingSkeletonProps) {
  return (
    <div className={classNames('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={classNames('bg-bolt-elements-background-depth-3 rounded', height, 'animate-pulse')}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

interface ModelCardSkeletonProps {
  className?: string;
}

export function ModelCardSkeleton({ className }: ModelCardSkeletonProps) {
  return (
    <div
      className={classNames(
        'border rounded-lg p-4',
        'bg-bolt-elements-background-depth-2',
        'border-bolt-elements-borderColor',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-3 h-3 rounded-full bg-bolt-elements-textTertiary animate-pulse" />
          <div className="space-y-2 flex-1">
            <LoadingSkeleton height="h-5" lines={1} className="w-3/4" />
            <LoadingSkeleton height="h-3" lines={1} className="w-1/2" />
          </div>
        </div>
        <div className="w-4 h-4 bg-bolt-elements-textTertiary rounded animate-pulse" />
      </div>
    </div>
  );
}

interface ProviderCardSkeletonProps {
  className?: string;
}

export function ProviderCardSkeleton({ className }: ProviderCardSkeletonProps) {
  return (
    <div className={classNames('bg-bolt-elements-background-depth-2 rounded-xl p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-xl bg-bolt-elements-background-depth-3 animate-pulse" />
          <div className="space-y-3 flex-1">
            <div className="space-y-2">
              <LoadingSkeleton height="h-5" lines={1} className="w-1/3" />
              <LoadingSkeleton height="h-4" lines={1} className="w-2/3" />
            </div>
            <div className="space-y-2">
              <LoadingSkeleton height="h-3" lines={1} className="w-1/4" />
              <LoadingSkeleton height="h-8" lines={1} className="w-full" />
            </div>
          </div>
        </div>
        <div className="w-10 h-6 bg-bolt-elements-background-depth-3 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

interface ModelManagerSkeletonProps {
  className?: string;
  cardCount?: number;
}

export function ModelManagerSkeleton({ className, cardCount = 3 }: ModelManagerSkeletonProps) {
  return (
    <div className={classNames('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <LoadingSkeleton height="h-6" lines={1} className="w-48" />
          <LoadingSkeleton height="h-4" lines={1} className="w-64" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-8 bg-bolt-elements-background-depth-3 rounded-lg animate-pulse" />
          <div className="w-16 h-8 bg-bolt-elements-background-depth-3 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Model Cards */}
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <ModelCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
