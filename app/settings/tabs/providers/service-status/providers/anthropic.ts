import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class AnthropicStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://status.anthropic.com/');
      const text = await statusPageResponse.text();

      // Check for specific Anthropic status indicators
      const isOperational = text.includes('All Systems Operational');
      const hasDegradedPerformance = text.includes('Degraded Performance');
      const hasPartialOutage = text.includes('Partial Outage');
      const hasMajorOutage = text.includes('Major Outage');

      // Extract incidents
      const incidents: string[] = [];
      const incidentSection = text.match(/Past Incidents(.*?)(?=\n\n)/s);

      if (incidentSection) {
        const incidentLines = incidentSection[1]
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && line.includes('202')); // Only get dated incidents

        incidents.push(...incidentLines.slice(0, 5));
      }

      let status: StatusCheckResult['status'] = 'operational';
      let message = 'All systems operational';

      if (hasMajorOutage) {
        status = 'down';
        message = 'Major service outage';
      } else if (hasPartialOutage) {
        status = 'down';
        message = 'Partial service outage';
      } else if (hasDegradedPerformance) {
        status = 'degraded';
        message = 'Service experiencing degraded performance';
      } else if (!isOperational) {
        status = 'degraded';
        message = 'Service status unknown';
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://status.anthropic.com/');
        const apiEndpoint = 'https://api.anthropic.com/v1/messages';
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
      console.error('Error checking Anthropic status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://status.anthropic.com/');
      const apiEndpoint = 'https://api.anthropic.com/v1/messages';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
