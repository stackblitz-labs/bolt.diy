import * as vscode from 'vscode';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('bolt.gitConfirm', () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder found.');
      return;
    }

    const cwd = folders[0].uri.fsPath;
    exec('git status --porcelain', { cwd }, (err, stdout) => {
      if (err) {
        vscode.window.showErrorMessage('Failed to run git.');
        return;
      }

      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) {
        vscode.window.showInformationMessage('No changes to confirm.');
        return;
      }

      const files = lines.map((l) => l.slice(3));
      vscode.window.showQuickPick(files, { placeHolder: 'Select a file to review' }).then((file: string | undefined) => {
        if (!file) {
          return;
        }

        exec(`git diff -- ${file}`, { cwd }, (diffErr, diff: string) => {
          if (diffErr) {
            vscode.window.showErrorMessage('Failed to get diff.');
            return;
          }

          vscode.workspace.openTextDocument({ content: diff, language: 'diff' }).then((doc: vscode.TextDocument) => {
            vscode.window.showTextDocument(doc, { preview: true }).then(() => {
              vscode.window.showInformationMessage(`Stage ${file}?`, 'Yes', 'No').then((answer: string | undefined) => {
                if (answer === 'Yes') {
                  exec(`git add ${file}`, { cwd }, () => {
                    vscode.window.showInformationMessage(`Staged ${file}`);
                  });
                }
              });
            });
          });
        });
      });
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
