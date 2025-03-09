import { app } from 'electron';
import type { ViteDevServer } from 'vite';

let viteServer: ViteDevServer | undefined;

// Conditionally import Vite only in development
export async function initViteServer() {
  if (!(global.process.env.NODE_ENV === 'production' || app.isPackaged)) {
    const vite = await import('vite');
    viteServer = await vite.createServer({
      root: '.',
      envDir: process.cwd(), // load .env files from the root directory.
    });
  }
}

/*
 *
 * take care of vite-dev-server.
 *
 */
app.on('before-quit', async (_event) => {
  if (!viteServer) {
    return;
  }

  /*
   * ref: https://stackoverflow.com/questions/68750716/electron-app-throwing-quit-unexpectedly-error-message-on-mac-when-quitting-the-a
   * event.preventDefault();
   */
  try {
    console.log('will close vite-dev-server.');
    await viteServer.close();
    console.log('closed vite-dev-server.');

    // app.quit(); // Not working. causes recursively 'before-quit' events.
    app.exit(); // Not working expectedly SOMETIMES. Still throws exception and macOS shows dialog.
    // global.process.exit(0); // Not working well... I still see exceptional dialog.
  } catch (err) {
    console.log('failed to close Vite server:', err);
  }
});

export { viteServer };
