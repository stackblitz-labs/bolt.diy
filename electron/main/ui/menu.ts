import { BrowserWindow, Menu } from 'electron';

export function setupMenu(win: BrowserWindow): void {
  const app = Menu.getApplicationMenu();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(app ? app.items : []),
      {
        label: 'Go',
        submenu: [
          {
            label: 'Back',
            accelerator: 'CmdOrCtrl+[',
            click: () => {
              win?.webContents.navigationHistory.goBack();
            },
          },
          {
            label: 'Forward',
            accelerator: 'CmdOrCtrl+]',
            click: () => {
              win?.webContents.navigationHistory.goForward();
            },
          },
        ],
      },
    ]),
  );
}
