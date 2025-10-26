import React from 'react';
import { Card, CardContent } from '~/components/ui/Card';
import { Progress } from '~/components/ui/Progress';
import { RotateCw, Trash2, Code, Database, Package, Loader2 } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import type { OllamaModel } from './types';

// Model Card Component
interface ModelCardProps {
  model: OllamaModel;
  onUpdate: () => void;
  onDelete: () => void;
}

function ModelCard({ model, onUpdate, onDelete }: ModelCardProps) {
  return (
    <Card className="bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 transition-all duration-200 shadow-sm hover:shadow-md border border-bolt-elements-borderColor hover:border-purple-500/20">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary font-mono">{model.name}</h4>
              {model.status && model.status !== 'idle' && (
                <span
                  className={classNames('px-2 py-0.5 rounded-full text-xs font-medium', {
                    'bg-yellow-500/10 text-yellow-500': model.status === 'updating',
                    'bg-green-500/10 text-green-500': model.status === 'updated',
                    'bg-red-500/10 text-red-500': model.status === 'error',
                  })}
                >
                  {model.status === 'updating' && 'Updating'}
                  {model.status === 'updated' && 'Updated'}
                  {model.status === 'error' && 'Error'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
              <div className="flex items-center gap-1">
                <Code className="w-3 h-3" />
                <span>{model.digest.substring(0, 8)}</span>
              </div>
              {model.details && (
                <>
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>{model.details.parameter_size}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>{model.details.quantization_level}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              disabled={model.status === 'updating'}
              className={classNames(
                'flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-200',
                'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 hover:shadow-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-500/10',
              )}
            >
              {model.status === 'updating' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating
                </>
              ) : (
                <>
                  <RotateCw className="w-3 h-3" />
                  Update
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={model.status === 'updating'}
              className={classNames(
                'flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-200',
                'bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:shadow-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500/10',
              )}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
        {model.progress && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-bolt-elements-textSecondary">
              <span>{model.progress.status}</span>
              <span>{Math.round((model.progress.current / model.progress.total) * 100)}%</span>
            </div>
            <Progress value={Math.round((model.progress.current / model.progress.total) * 100)} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ModelCard;
