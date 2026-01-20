---
name: webcontainer-runtime-actions
description: Use when working with the AI action execution pipeline - parsing model output into actions (message-parser), executing file writes and shell commands (action-runner), syncing to WebContainer filesystem, terminal behaviors, and preview updates. Triggers include "action-runner", "message-parser", "WebContainer", "boltAction", "boltArtifact", "file action", "shell action", "apply patch", "run command", "preview port", "action failed", "terminal output".
---

# WebContainer Runtime Actions Skill

## Goal

Understand and modify the AI-to-code execution pipeline: how LLM output becomes file changes and shell commands in the browser-based WebContainer environment.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   LLM Stream    │────▶│  message-parser  │────▶│  action-runner  │
│  (SSE from AI)  │     │  (extract tags)  │     │  (execute)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────┐
                        │                                 │                 │
                        ▼                                 ▼                 ▼
                ┌───────────────┐              ┌──────────────┐     ┌───────────┐
                │ WebContainer  │              │   Terminal   │     │  Preview  │
                │      FS       │              │   (xterm)    │     │  (iframe) │
                └───────────────┘              └──────────────┘     └───────────┘
                        │
                        ▼
                ┌───────────────┐
                │   Stores      │
                │ (nanostores)  │
                └───────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `app/lib/runtime/message-parser.ts` | Parse `<boltArtifact>` and `<boltAction>` tags from LLM stream |
| `app/lib/runtime/action-runner.ts` | Execute parsed actions (file, shell, build, start, edit, supabase) |
| `app/lib/runtime/edit-parser.ts` | Handle `edit` action type (partial file edits) |
| `app/lib/runtime/enhanced-message-parser.ts` | Extended parser with auto-file-creation |
| `app/lib/webcontainer/index.ts` | WebContainer singleton initialization |
| `app/types/actions.ts` | Action type definitions |
| `app/lib/stores/workbench.ts` | Workbench state (files, actions, alerts) |

## Action Types

### Defined in `app/types/actions.ts`

```typescript
type ActionType = 'file' | 'shell' | 'supabase' | 'start' | 'build' | 'edit';

interface FileAction {
  type: 'file';
  filePath: string;
  content: string;
}

interface ShellAction {
  type: 'shell';
  content: string;  // The command to execute
}

interface StartAction {
  type: 'start';
  content: string;  // Start command (e.g., "npm run dev")
}

interface BuildAction {
  type: 'build';
  content: string;  // Build command (e.g., "npm run build")
}

interface EditAction {
  type: 'edit';
  content: string;  // Edit instructions
}

interface SupabaseAction {
  type: 'supabase';
  operation: 'migration' | 'query';
  filePath?: string;
  content: string;
}
```

## LLM Output Format (Bolt Tags)

The LLM generates structured XML-like tags that the parser extracts:

### Artifact Container
```xml
<boltArtifact id="unique-id" title="Create React App" type="react">
  <!-- Actions go here -->
</boltArtifact>
```

### File Action
```xml
<boltAction type="file" filePath="src/App.tsx">
import React from 'react';

export default function App() {
  return <div>Hello World</div>;
}
</boltAction>
```

### Shell Action
```xml
<boltAction type="shell">
npm install react react-dom
</boltAction>
```

### Start Action (non-blocking)
```xml
<boltAction type="start">
npm run dev
</boltAction>
```

### Build Action
```xml
<boltAction type="build">
npm run build
</boltAction>
```

### Edit Action
```xml
<boltAction type="edit">
[Edit instructions for partial file modifications]
</boltAction>
```

## Message Parser (`StreamingMessageParser`)

### How It Works

1. **Streaming parse**: Processes LLM output character-by-character
2. **Tag detection**: Finds `<boltArtifact>` and `<boltAction>` tags
3. **Callbacks**: Emits events for artifact/action open/stream/close
4. **State tracking**: Maintains position and nesting state per message

### Key Callbacks

```typescript
interface ParserCallbacks {
  onArtifactOpen?: (data: ArtifactCallbackData) => void;
  onArtifactClose?: (data: ArtifactCallbackData) => void;
  onActionOpen?: (data: ActionCallbackData) => void;
  onActionStream?: (data: ActionCallbackData) => void;  // For file streaming
  onActionClose?: (data: ActionCallbackData) => void;
}
```

### Usage Example

```typescript
import { StreamingMessageParser } from '~/lib/runtime/message-parser';

const parser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      console.log('Artifact started:', data.title);
    },
    onActionOpen: (data) => {
      console.log('Action started:', data.action.type);
    },
    onActionClose: (data) => {
      // Action complete, ready to execute
      actionRunner.runAction(data);
    },
  },
});

// Parse streaming chunks
for await (const chunk of llmStream) {
  parser.parse(messageId, chunk);
}
```

## Action Runner

### How It Works

1. **Action queue**: Actions are added with `addAction()` and executed sequentially
2. **Status tracking**: Each action has status: `pending` → `running` → `complete`/`failed`/`aborted`
3. **Abort support**: Actions can be cancelled via `AbortController`
4. **Alert system**: Errors trigger `onAlert` callbacks for UI notifications

### Action Execution Flow

```typescript
class ActionRunner {
  // Add action to queue (called on action open)
  addAction(data: ActionCallbackData): void;
  
  // Execute action (called on action close)
  async runAction(data: ActionCallbackData, isStreaming?: boolean): Promise<void>;
  
  // Internal execution by type
  async #executeAction(actionId: string, isStreaming: boolean): Promise<void>;
}
```

### File Actions (`#runFileAction`)

```typescript
async #runFileAction(action: FileAction) {
  const webcontainer = await this.#webcontainer;
  const filePath = action.filePath;
  const content = action.content;
  
  // Ensure directory exists
  const dir = nodePath.dirname(filePath);
  await webcontainer.fs.mkdir(dir, { recursive: true });
  
  // Write file
  await webcontainer.fs.writeFile(filePath, content);
}
```

### Shell Actions (`#runShellAction`)

```typescript
async #runShellAction(action: ShellAction) {
  const shell = this.#shellTerminal();
  
  // Validate command (check for missing files, etc.)
  const validation = await this.#validateShellCommand(action.content);
  
  if (validation.shouldModify) {
    action.content = validation.modifiedCommand;
  }
  
  // Execute in terminal
  const { exitCode, output } = await shell.executeCommand(action.content);
  
  if (exitCode !== 0) {
    throw new ActionCommandError(action.content, output);
  }
}
```

### Start Actions (Non-blocking)

Start actions run asynchronously without blocking subsequent actions:

```typescript
case 'start': {
  // Non-blocking execution
  this.#runStartAction(action)
    .then(() => this.#updateAction(actionId, { status: 'complete' }))
    .catch((err) => {
      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: err.header,
        content: err.output,
      });
    });
  
  // Delay to avoid race conditions
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return;
}
```

## WebContainer Integration

### Initialization

WebContainer is initialized client-side only:

```typescript
// app/lib/webcontainer/index.ts
import { WebContainer } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (!webcontainerInstance) {
    webcontainerInstance = await WebContainer.boot();
  }
  return webcontainerInstance;
}
```

### File System Operations

```typescript
const webcontainer = await getWebContainer();

// Read file
const content = await webcontainer.fs.readFile('/src/App.tsx', 'utf-8');

// Write file
await webcontainer.fs.writeFile('/src/App.tsx', newContent);

// Create directory
await webcontainer.fs.mkdir('/src/components', { recursive: true });

// List directory
const entries = await webcontainer.fs.readdir('/src');

// Check if file exists
try {
  await webcontainer.fs.readFile(path);
  // File exists
} catch {
  // File doesn't exist
}
```

### Shell Execution

```typescript
const process = await webcontainer.spawn('npm', ['install']);

// Stream output
process.output.pipeTo(new WritableStream({
  write(chunk) {
    console.log(chunk);
  }
}));

// Wait for completion
const exitCode = await process.exit;
```

## Error Handling

### ActionCommandError

Custom error for shell failures with structured output:

```typescript
class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;
  
  constructor(message: string, output: string) {
    super(`Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`);
    this._header = message;
    this._output = output;
  }
}
```

### Alert System

Errors trigger UI alerts via callbacks:

```typescript
this.onAlert?.({
  type: 'error',
  title: 'Dev Server Failed',
  description: error.header,
  content: error.output,
});
```

### Command Validation

The runner validates commands before execution:

```typescript
// Auto-add -f to rm if files don't exist
if (command.startsWith('rm ') && !command.includes('-f')) {
  // Check if files exist, modify command if needed
}

// Auto-create directories for cd
if (command.startsWith('cd ')) {
  // Check if directory exists, create if needed
}
```

## Action Status Tracking

Actions are tracked in a nanostore:

```typescript
type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

interface ActionState {
  status: ActionStatus;
  executed: boolean;
  abort: () => void;
  abortSignal: AbortSignal;
  // ... action-specific fields
}

// Usage in components
import { useStore } from '@nanostores/react';
import { actionRunner } from '~/lib/runtime/action-runner';

function ActionList() {
  const actions = useStore(actionRunner.actions);
  
  return (
    <ul>
      {Object.entries(actions).map(([id, action]) => (
        <li key={id}>
          {action.type}: {action.status}
        </li>
      ))}
    </ul>
  );
}
```

## WebContainer Constraints

| Constraint | Details |
|------------|---------|
| **Memory** | ~1 GB limit |
| **Boot** | Async initialization - wait before operations |
| **SSR** | Client-side only (`!import.meta.env.SSR`) |
| **Network** | Preview on random port, proxied through iframe |
| **Processes** | Single Node.js process, limited spawn |
| **COOP/COEP** | Required headers for SharedArrayBuffer |

## Common Patterns

### Adding a New Action Type

1. **Define type** in `app/types/actions.ts`:
```typescript
export interface MyAction extends BaseAction {
  type: 'myaction';
  myField: string;
}

export type BoltAction = FileAction | ShellAction | ... | MyAction;
```

2. **Parse in message-parser.ts** (`#parseActionTag`):
```typescript
} else if (actionType === 'myaction') {
  const myField = this.#extractAttribute(actionTag, 'myField');
  (actionAttributes as MyAction).myField = myField;
}
```

3. **Execute in action-runner.ts** (`#executeAction`):
```typescript
case 'myaction': {
  await this.#runMyAction(action as MyAction);
  break;
}
```

4. **Implement runner method**:
```typescript
async #runMyAction(action: MyAction) {
  // Implementation
}
```

### Streaming File Content

File actions stream content as it arrives:

```typescript
onActionStream: (data) => {
  if (data.action.type === 'file') {
    // Update UI with partial content
    updateFilePreview(data.action.filePath, data.action.content);
  }
}
```

## Debugging Tips

1. **Enable logging**: Check `createScopedLogger('ActionRunner')` output
2. **Check action state**: Inspect `actionRunner.actions.get()`
3. **WebContainer boot**: Ensure boot completes before operations
4. **Command validation**: Check `#validateShellCommand` logs
5. **Parse state**: Use `parser.reset()` between messages if needed

## Checklist

- [ ] Understand action flow: LLM → parser → runner → WebContainer
- [ ] New action types added to `types/actions.ts`
- [ ] Parser extracts new action attributes correctly
- [ ] Runner handles new action type execution
- [ ] Errors trigger appropriate alerts
- [ ] Actions update status in nanostore
- [ ] WebContainer operations await boot completion
- [ ] Tests cover parsing and execution

## References

- `app/lib/runtime/message-parser.ts` - Streaming parser
- `app/lib/runtime/action-runner.ts` - Action execution
- `app/lib/runtime/edit-parser.ts` - Edit action handling
- `app/types/actions.ts` - Action type definitions
- `app/lib/webcontainer/index.ts` - WebContainer setup
- `app/lib/stores/workbench.ts` - Workbench state
- `references/action-flow.md` - Visual flow diagram
