const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization when identity is null (development build)
  if (!context.packager.config.mac || context.packager.config.mac.identity === null) {
    console.log('Skipping notarization: identity is null');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.config.appId;

  try {
    console.log(`Notarizing ${appBundleId} found at ${appOutDir}/${appName}.app`);
    await notarize({
      tool: 'notarytool',
      appPath: `${appOutDir}/${appName}.app`,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log(`Done notarizing ${appBundleId}`);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
