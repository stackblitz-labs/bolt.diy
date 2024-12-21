export type ActionType = 'file' | 'shell';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface StartAction extends BaseAction {
  type: 'start';
}

export type BoltAction = FileAction | ShellAction | StartAction;

export type BoltActionData = BoltAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
}
