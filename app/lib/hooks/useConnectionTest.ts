import { useState, useCallback } from 'react';
import type { ConnectionTestResult } from '~/components/@settings/shared/service-integration';

interface UseConnectionTestOptions {
  testEndpoint: string;
  serviceName: string;
  getUserIdentifier?: (data: any) => string;
}

export function useConnectionTest({ testEndpoint, serviceName, getUserIdentifier }: UseConnectionTestOptions) {
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const testConnection = useCallback(async () => {
    setTestResult({
      status: 'testing',
      message: 'Testing connection...',
    });

    try {
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userIdentifier = getUserIdentifier ? getUserIdentifier(data) : 'User';

        setTestResult({
          status: 'success',
          message: `Connected successfully to ${serviceName} as ${userIdentifier}`,
          timestamp: Date.now(),
        });
      } else {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        setTestResult({
          status: 'error',
          message: `Connection failed: ${errorData.error || `${response.status} ${response.statusText}`}`,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  }, [testEndpoint, serviceName, getUserIdentifier]);

  const clearTestResult = useCallback(() => {
    setTestResult(null);
  }, []);

  return {
    testResult,
    testConnection,
    clearTestResult,
    isTestingConnection: testResult?.status === 'testing',
  };
}
