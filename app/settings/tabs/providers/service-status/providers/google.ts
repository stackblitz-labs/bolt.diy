import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class GoogleStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://status.cloud.google.com/');
      const text = await statusPageResponse.text();

      // Check for Vertex AI and general cloud status
      const hasVertexAIIssues =
        text.includes('Vertex AI') &&
        (text.includes('Incident') ||
          text.includes('Disruption') ||
          text.includes('Outage') ||
          text.includes('degraded'));

      const hasGeneralIssues = text.includes('Major Incidents') || text.includes('Service Disruption');

      // Extract incidents
      const incidents: string[] = [];
      const incidentMatches = text.matchAll(/(\d{4}-\d{2}-\d{2})\s+(.*?)\s+Impact:(.*?)(?=\n|$)/g);

      for (const match of incidentMatches) {
        const [, date, title, impact] = match;

        if (title.includes('Vertex AI') || title.includes('Cloud')) {
          incidents.push(`${date}: ${title.trim()} - Impact: ${impact.trim()}`);
        }
      }

      let status: StatusCheckResult['status'] = 'operational';
      let message = 'All services operational';

      if (hasVertexAIIssues) {
        status = 'degraded';
        message = 'Vertex AI service issues reported';
      } else if (hasGeneralIssues) {
        status = 'degraded';
        message = 'Google Cloud experiencing issues';
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://status.cloud.google.com/');
        const apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models';
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
      console.error('Error checking Google status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://status.cloud.google.com/');
      const apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
