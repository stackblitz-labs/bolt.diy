import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class OpenAIStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://status.openai.com/');
      const text = await statusPageResponse.text();

      // Check individual services
      const services = {
        api: {
          operational: text.includes('API ?  Operational'),
          degraded: text.includes('API ?  Degraded Performance'),
          outage: text.includes('API ?  Major Outage') || text.includes('API ?  Partial Outage'),
        },
        chat: {
          operational: text.includes('ChatGPT ?  Operational'),
          degraded: text.includes('ChatGPT ?  Degraded Performance'),
          outage: text.includes('ChatGPT ?  Major Outage') || text.includes('ChatGPT ?  Partial Outage'),
        },
      };

      // Extract recent incidents
      const incidents: string[] = [];
      const incidentMatches = text.match(/Past Incidents(.*?)(?=\w+ \d+, \d{4})/s);

      if (incidentMatches) {
        const recentIncidents = incidentMatches[1]
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && line.includes('202')); // Get only dated incidents

        incidents.push(...recentIncidents.slice(0, 5));
      }

      // Determine overall status
      let status: StatusCheckResult['status'] = 'operational';
      const messages: string[] = [];

      if (services.api.outage || services.chat.outage) {
        status = 'down';

        if (services.api.outage) {
          messages.push('API: Major Outage');
        }

        if (services.chat.outage) {
          messages.push('ChatGPT: Major Outage');
        }
      } else if (services.api.degraded || services.chat.degraded) {
        status = 'degraded';

        if (services.api.degraded) {
          messages.push('API: Degraded Performance');
        }

        if (services.chat.degraded) {
          messages.push('ChatGPT: Degraded Performance');
        }
      } else if (services.api.operational) {
        messages.push('API: Operational');
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://status.openai.com/');
        const apiEndpoint = 'https://api.openai.com/v1/models';
        const apiStatus = await this.checkEndpoint(apiEndpoint);

        return {
          status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
          message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
          incidents: ['Note: Limited status information due to CORS restrictions'],
        };
      }

      return {
        status,
        message: messages.join(', ') || 'Status unknown',
        incidents,
      };
    } catch (error) {
      console.error('Error checking OpenAI status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://status.openai.com/');
      const apiEndpoint = 'https://api.openai.com/v1/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
