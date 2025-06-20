import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class AmazonBedrockStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check AWS health status page
      const statusPageResponse = await fetch('https://health.aws.amazon.com/health/status');
      const text = await statusPageResponse.text();

      // Check for Bedrock and general AWS status
      const hasBedrockIssues =
        text.includes('Amazon Bedrock') &&
        (text.includes('Service is experiencing elevated error rates') ||
          text.includes('Service disruption') ||
          text.includes('Degraded Service'));

      const hasGeneralIssues = text.includes('Service disruption') || text.includes('Multiple services affected');

      // Extract incidents
      const incidents: string[] = [];
      const incidentMatches = text.matchAll(/(\d{4}-\d{2}-\d{2})\s+(.*?)\s+Impact:(.*?)(?=\n|$)/g);

      for (const match of incidentMatches) {
        const [, date, title, impact] = match;

        if (title.includes('Bedrock') || title.includes('AWS')) {
          incidents.push(`${date}: ${title.trim()} - Impact: ${impact.trim()}`);
        }
      }

      let status: StatusCheckResult['status'] = 'operational';
      let message = 'All services operational';

      if (hasBedrockIssues) {
        status = 'degraded';
        message = 'Amazon Bedrock service issues reported';
      } else if (hasGeneralIssues) {
        status = 'degraded';
        message = 'AWS experiencing general issues';
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://health.aws.amazon.com/health/status');
        const apiEndpoint = 'https://bedrock.us-east-1.amazonaws.com/models';
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
      console.error('Error checking Amazon Bedrock status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://health.aws.amazon.com/health/status');
      const apiEndpoint = 'https://bedrock.us-east-1.amazonaws.com/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
