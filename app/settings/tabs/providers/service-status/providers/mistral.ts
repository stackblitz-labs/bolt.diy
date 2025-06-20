import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class MistralStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://status.mistral.ai/');
      const text = await statusPageResponse.text();

      const isOperational = text.includes('All Systems Operational');
      const hasIncidents = text.includes('Active Incidents');
      const hasDegradation = text.includes('Degraded Performance');
      const hasOutage = text.includes('Service Outage');

      // Extract incidents
      const incidents: string[] = [];
      const incidentSection = text.match(/Recent Events(.*?)(?=\n\n)/s);

      if (incidentSection) {
        const incidentLines = incidentSection[1]
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.includes('No incidents'));

        incidents.push(...incidentLines.slice(0, 5));
      }

      let status: StatusCheckResult['status'] = 'operational';
      let message = 'All systems operational';

      if (hasOutage) {
        status = 'down';
        message = 'Service outage detected';
      } else if (hasDegradation || hasIncidents) {
        status = 'degraded';
        message = 'Service experiencing issues';
      } else if (!isOperational) {
        status = 'degraded';
        message = 'Service status unknown';
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://status.mistral.ai/');
        const apiEndpoint = 'https://api.mistral.ai/v1/models';
        const apiStatus = await this.checkEndpoint(apiEndpoint);

        return {
          status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
          message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
          incidents: ['Note: Limited status information due to CORS restrictions'],
        };
      }

      return {
        status,
        message,
        incidents,
      };
    } catch (error) {
      console.error('Error checking Mistral status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://status.mistral.ai/');
      const apiEndpoint = 'https://api.mistral.ai/v1/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
