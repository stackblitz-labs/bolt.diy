import logger from 'electron-log';
import type { MessageBoxOptions } from 'electron';
import { app, dialog } from 'electron';
import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import path from 'node:path';

// NOTE: workaround to use electron-updater.
import * as electronUpdater from 'electron-updater';
import { isDev } from './constants';

const autoUpdater: AppUpdater = (electronUpdater as any).default.autoUpdater;

export async function setupAutoUpdater() {
  // Configure logger
  logger.transports.file.level = 'debug';
  autoUpdater.logger = logger;

  // Configure custom update config file
  const resourcePath = isDev
    ? path.join(process.cwd(), 'electron-update.yml')
    : path.join(app.getAppPath(), 'electron-update.yml');
  logger.info('Update config path:', resourcePath);
  autoUpdater.updateConfigPath = resourcePath;

  // Disable auto download - we want to ask user first
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('checking-for-update...');
  });

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    logger.info('Update available.', info);

    const dialogOpts: MessageBoxOptions = {
      type: 'info' as const,
      buttons: ['Update', 'Later'],
      title: 'Application Update',
      message: `Version ${info.version} is available.`,
      detail: 'A new version is available. Would you like to update now?',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available.');
  });

  /*
   * Uncomment this before we have any published updates on github releases.
   * autoUpdater.on('error', (err) => {
   *   logger.error('Error in auto-updater:', err);
   *   dialog.showErrorBox('Error: ', err.message);
   * });
   */

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('Download progress:', progressObj);
  });

  autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
    logger.info('Update downloaded:', formatUpdateDownloadedEvent(event));

    const dialogOpts: MessageBoxOptions = {
      type: 'info' as const,
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: 'Update Downloaded',
      detail: 'A new version has been downloaded. Restart the application to apply the updates.',
    };

    const response = await dialog.showMessageBox(dialogOpts);

    if (response.response === 0) {
      autoUpdater.quitAndInstall(false);
    }
  });

  // Check for updates
  try {
    logger.info('Checking for updates. Current version:', app.getVersion());
    await autoUpdater.checkForUpdates();
  } catch (err) {
    logger.error('Failed to check for updates:', err);
  }

  // Set up periodic update checks (every 4 hours)
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Periodic update check failed:', err);
      });
    },
    4 * 60 * 60 * 1000,
  );
}

function formatUpdateDownloadedEvent(event: UpdateDownloadedEvent): string {
  return JSON.stringify({
    version: event.version,
    downloadedFile: event.downloadedFile,
    files: event.files.map((e) => ({ files: { url: e.url, size: e.size } })),
  });
}
