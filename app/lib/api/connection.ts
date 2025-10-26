export interface ConnectionStatus {
  connected: boolean;
  latency: number;
  lastChecked: string;
}

export const checkConnection = async (): Promise<ConnectionStatus> => {
  try {
    // Check if we have network connectivity
    const online = navigator.onLine;

    if (!online) {
      return {
        connected: false,
        latency: 0,
        lastChecked: new Date().toISOString(),
      };
    }

    // Try multiple endpoints in case one fails
    const endpoints = [
      '/api/health',
      '/', // Fallback to root route
      '/favicon.ico', // Another common fallback
    ];

    let latency = 0;
    let connected = false;

    for (const endpoint of endpoints) {
      try {
        const start = performance.now();
        const response = await fetch(endpoint, {
          method: 'HEAD',
          cache: 'no-cache',
        });
        const end = performance.now();

        if (response.ok) {
          latency = Math.round(end - start);
          connected = true;
          break;
        }
      } catch (endpointError) {
        console.debug(`Failed to connect to ${endpoint}:`, endpointError);
        continue;
      }
    }

    return {
      connected,
      latency,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Connection check failed:', error);
    return {
      connected: false,
      latency: 0,
      lastChecked: new Date().toISOString(),
    };
  }
};
