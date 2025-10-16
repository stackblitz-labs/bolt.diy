import { getDetectedErrors } from '~/lib/replay/MessageHandler';
import { getCurrentIFrame } from '~/components/workbench/Preview/Preview';
import { waitForTime } from '~/utils/nut';
import { createScopedLogger } from '~/utils/logger';
import { pingTelemetry } from '~/lib/hooks/pingTelemetry';
import type { DetectedError } from '~/lib/replay/MessageHandlerInterface';

// Maximum time to wait for simulation data for the iframe.
const FlushDetectedErrorsTimeoutMs = 2000;

const logger = createScopedLogger('FlushDetectedErrors');

export async function flushDetectedErrors(): Promise<DetectedError[] | undefined> {
  logger.trace('Start');

  const iframe = getCurrentIFrame();

  if (!iframe) {
    return undefined;
  }

  const detectedErrors = await Promise.race([
    getDetectedErrors(iframe),
    (async () => {
      await waitForTime(FlushDetectedErrorsTimeoutMs);
      return undefined;
    })(),
  ]);

  if (!detectedErrors) {
    pingTelemetry('FlushDetectedErrors.Timeout', {});
    return undefined;
  }

  logger.trace('Done', detectedErrors);

  return detectedErrors;
}
