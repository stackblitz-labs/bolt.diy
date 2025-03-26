import { BaseProviderChecker } from '~/components/@settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/components/@settings/tabs/providers/service-status/types';

/**
 * Status checker for Pollinations AI service
 * Monitors the availability of Pollinations API endpoints
 */
export class PollinationsStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check API endpoint
      const apiEndpoint = 'https://text.pollinations.ai/openai/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `API: ${apiStatus === 'reachable' ? 'Operational' : 'Service may be experiencing issues'}`,
        incidents: [],
      };
    } catch (error) {
      console.error('Error checking Pollinations status:', error);
      return {
        status: 'degraded',
        message: 'Unable to determine service status',
        incidents: ['Note: Service status information unavailable'],
      };
    }
  }
} 