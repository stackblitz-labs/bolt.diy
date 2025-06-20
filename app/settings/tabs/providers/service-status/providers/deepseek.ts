import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class DeepseekStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      /*
       * Check status page - Note: Deepseek doesn't have a public status page yet
       * so we'll check their API endpoint directly
       */
      const apiEndpoint = 'https://api.deepseek.com/v1/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      // Check their website as a secondary indicator
      const websiteStatus = await this.checkEndpoint('https://deepseek.com');

      let status: StatusCheckResult['status'] = 'operational';
      let message = 'All systems operational';

      if (apiStatus !== 'reachable' || websiteStatus !== 'reachable') {
        status = apiStatus !== 'reachable' ? 'down' : 'degraded';
        message = apiStatus !== 'reachable' ? 'API appears to be down' : 'Service may be experiencing issues';
      }

      return {
        status,
        message,
        incidents: [], // No public incident tracking available yet
      };
    } catch (error) {
      console.error('Error checking Deepseek status:', error);

      return {
        status: 'degraded',
        message: 'Unable to determine service status',
        incidents: ['Note: Limited status information available'],
      };
    }
  }
}
