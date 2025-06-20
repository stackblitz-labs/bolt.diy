import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class GroqStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://groqstatus.com/');
      const text = await statusPageResponse.text();

      const isOperational = text.includes('All Systems Operational');
      const hasIncidents = text.includes('Active Incidents');
      const hasDegradation = text.includes('Degraded Performance');
      const hasOutage = text.includes('Service Outage');

      // Extract incidents
      const incidents: string[] = [];
      const incidentMatches = text.matchAll(/(\d{4}-\d{2}-\d{2})\s+(.*?)\s+Status:(.*?)(?=\n|$)/g);

      for (const match of incidentMatches) {
        const [, date, title, status] = match;
        incidents.push(`${date}: ${title.trim()} - ${status.trim()}`);
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
        const endpointStatus = await this.checkEndpoint('https://groqstatus.com/');
        const apiEndpoint = 'https://api.groq.com/v1/models';
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
        incidents: incidents.slice(0, 5),
      };
    } catch (error) {
      console.error('Error checking Groq status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://groqstatus.com/');
      const apiEndpoint = 'https://api.groq.com/v1/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
