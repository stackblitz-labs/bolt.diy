// FIXME ping telemetry server directly instead of going through the backend.

let gDisableTelemetry = false;

// Timeouts for pinging telemetry if we don't get response messages fast enough.
const TelemetryTimeoutMs = 5000;

export function disableTelemetry() {
  gDisableTelemetry = true;
}

export async function pingTelemetry(_event: string, _data: any) {
  if (gDisableTelemetry) {
    return;
  }

  /*
  const requestBody: any = {
    event: 'NutChat.' + event,
    data,
  };

  fetch('/api/ping-telemetry', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  }).catch(() => {});
  */
}

// Manage telemetry events for a single chat message.

export class ChatMessageTelemetry {
  id: string;
  numMessages: number;

  private timeouts: NodeJS.Timeout[] = [];

  constructor(numMessages: number) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.numMessages = numMessages;
    this.ping('Start', { numMessages });
    this.startTimeout('Start');
  }

  private ping(event: string, data: any = {}) {
    pingTelemetry('Message.' + event, {
      ...data,
      messageId: this.id,
      numMessages: this.numMessages,
    });
  }

  private startTimeout(reason: string) {
    const timeout = setTimeout(() => {
      this.ping('Timeout', { reason });
    }, TelemetryTimeoutMs);
    this.timeouts.push(timeout);
  }

  private clearTimeouts() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.length = 0;
  }

  finish(lastNumMessages: number, normal: boolean) {
    this.clearTimeouts();
    this.ping(normal ? 'Finish' : 'Error');

    // Ping if we got no responses but also a normal finish.
    if (lastNumMessages == this.numMessages && normal) {
      this.ping('NoResponse');
    }
  }

  abort(reason: string) {
    this.clearTimeouts();
    this.ping('Abort', { reason });
  }

  onResponseMessage() {
    this.startTimeout('Response');
  }
}
