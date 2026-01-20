# Action Execution Flow

## Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LLM RESPONSE                                    │
│  "I'll create a React component..."                                         │
│  <boltArtifact id="1" title="Create App">                                   │
│    <boltAction type="file" filePath="src/App.tsx">...</boltAction>          │
│    <boltAction type="shell">npm install</boltAction>                        │
│    <boltAction type="start">npm run dev</boltAction>                        │
│  </boltArtifact>                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         StreamingMessageParser                               │
│                                                                              │
│  1. Detect <boltArtifact> tag → onArtifactOpen()                            │
│  2. Detect <boltAction type="file"> → onActionOpen({ type: 'file' })        │
│  3. Stream file content → onActionStream({ content: '...' })                │
│  4. Detect </boltAction> → onActionClose()                                  │
│  5. Repeat for each action...                                               │
│  6. Detect </boltArtifact> → onArtifactClose()                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ FileAction  │ │ ShellAction │ │ StartAction │
            │ filePath:   │ │ content:    │ │ content:    │
            │ src/App.tsx │ │ npm install │ │ npm run dev │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ActionRunner                                     │
│                                                                              │
│  actions: Map<string, ActionState>                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ action-0: { type: 'file', status: 'complete', filePath: 'src/App.tsx' }│ │
│  │ action-1: { type: 'shell', status: 'running', content: 'npm install' } │ │
│  │ action-2: { type: 'start', status: 'pending', content: 'npm run dev' } │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Sequential execution: action-0 → action-1 → action-2                       │
│  (except 'start' which is non-blocking)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WebContainer                                       │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   File System   │  │     Shell       │  │   Dev Server    │             │
│  │                 │  │                 │  │                 │             │
│  │ /home/project/  │  │ $ npm install   │  │ localhost:3000  │             │
│  │ └── src/        │  │ added 150 deps  │  │ ┌─────────────┐ │             │
│  │     └── App.tsx │  │ ...             │  │ │  Preview    │ │             │
│  │                 │  │                 │  │ └─────────────┘ │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI Updates                                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  File Tree  │  │   Editor    │  │  Terminal   │  │   Preview   │        │
│  │  (updated)  │  │  (content)  │  │  (output)   │  │  (iframe)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Action Status Lifecycle

```
┌──────────┐     addAction()      ┌──────────┐
│          │ ──────────────────▶  │          │
│  (none)  │                      │ pending  │
│          │                      │          │
└──────────┘                      └──────────┘
                                       │
                                       │ runAction()
                                       ▼
                                  ┌──────────┐
                                  │          │
                                  │ running  │
                                  │          │
                                  └──────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
              ┌──────────┐      ┌──────────┐      ┌──────────┐
              │          │      │          │      │          │
              │ complete │      │  failed  │      │ aborted  │
              │          │      │          │      │          │
              └──────────┘      └──────────┘      └──────────┘
                                     │
                                     │ onAlert()
                                     ▼
                              ┌──────────────┐
                              │  Error Toast │
                              │  in UI       │
                              └──────────────┘
```

## File Action Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                        FileAction                                │
│  type: 'file'                                                   │
│  filePath: 'src/components/Button.tsx'                          │
│  content: 'import React from "react";\n...'                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    #runFileAction()                              │
│                                                                  │
│  1. Get WebContainer instance                                   │
│     const wc = await this.#webcontainer;                        │
│                                                                  │
│  2. Ensure directory exists                                     │
│     await wc.fs.mkdir('src/components', { recursive: true });   │
│                                                                  │
│  3. Write file content                                          │
│     await wc.fs.writeFile(                                      │
│       'src/components/Button.tsx',                              │
│       content                                                   │
│     );                                                          │
│                                                                  │
│  4. Update file store (via workbenchStore)                      │
│                                                                  │
│  5. Mark action complete                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Shell Action Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                       ShellAction                                │
│  type: 'shell'                                                  │
│  content: 'npm install lodash @types/lodash'                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   #runShellAction()                              │
│                                                                  │
│  1. Validate command                                            │
│     const validation = await this.#validateShellCommand(cmd);   │
│     - Check for missing files (rm, cp, mv)                      │
│     - Check for missing directories (cd)                        │
│     - Auto-fix common issues                                    │
│                                                                  │
│  2. Get shell terminal                                          │
│     const shell = this.#shellTerminal();                        │
│                                                                  │
│  3. Execute command                                             │
│     const { exitCode, output } = await shell.executeCommand();  │
│                                                                  │
│  4. Handle result                                               │
│     if (exitCode !== 0) {                                       │
│       throw new ActionCommandError(command, output);            │
│     }                                                           │
│                                                                  │
│  5. Update terminal UI (via xterm)                              │
└─────────────────────────────────────────────────────────────────┘
```

## Bolt Tags Reference

```xml
<!-- Artifact container -->
<boltArtifact id="unique-id" title="Human-readable title" type="optional-type">

  <!-- File creation/update -->
  <boltAction type="file" filePath="relative/path/to/file.ts">
  file content here
  </boltAction>

  <!-- Shell command execution -->
  <boltAction type="shell">
  npm install some-package
  </boltAction>

  <!-- Start dev server (non-blocking) -->
  <boltAction type="start">
  npm run dev
  </boltAction>

  <!-- Build project -->
  <boltAction type="build">
  npm run build
  </boltAction>

  <!-- Partial file edit -->
  <boltAction type="edit">
  [Edit instructions]
  </boltAction>

  <!-- Supabase operations -->
  <boltAction type="supabase" operation="migration" filePath="migrations/001.sql">
  CREATE TABLE users (...)
  </boltAction>

  <boltAction type="supabase" operation="query">
  SELECT * FROM users
  </boltAction>

</boltArtifact>
```

## Quick Actions (Inline Suggestions)

```xml
<bolt-quick-actions>
  <bolt-quick-action type="prompt" message="Add dark mode support">
    Add Dark Mode
  </bolt-quick-action>
  <bolt-quick-action type="file" path="src/App.tsx">
    Open App.tsx
  </bolt-quick-action>
  <bolt-quick-action type="link" href="https://docs.example.com">
    View Docs
  </bolt-quick-action>
</bolt-quick-actions>
```
