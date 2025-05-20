import { BaseProviderChecker } from '~/components/@settings/tabs/providers/service-status/base-provider';

import type { StatusCheckResult } from '~/components/@settings/tabs/providers/service-status/types';

export class PollinationsStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check the main pollinations website
      const endpointStatus = await this.checkEndpoint(this.config.statusUrl);

      // Check the API endpoint
      const apiStatus = await this.checkEndpoint(this.config.apiUrl);

      // Determine overall status based on both checks
      const status = endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded';

      return {
        status,
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    } catch (error) {
      console.error('Error checking Pollinations status:', error);
      return {
        status: 'degraded',
        message: 'Error checking service status',
        incidents: ['Error occurred while checking service status'],
      };
    }
  }
}
