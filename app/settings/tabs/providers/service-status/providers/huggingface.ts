import { BaseProviderChecker } from '~/settings/tabs/providers/service-status/base-provider';
import type { StatusCheckResult } from '~/settings/tabs/providers/service-status/types';

export class HuggingFaceStatusChecker extends BaseProviderChecker {
  async checkStatus(): Promise<StatusCheckResult> {
    try {
      // Check status page
      const statusPageResponse = await fetch('https://status.huggingface.co/');
      const text = await statusPageResponse.text();

      // Check for "All services are online" message
      const allServicesOnline = text.includes('All services are online');

      // Get last update time
      const lastUpdateMatch = text.match(/Last updated on (.*?)(EST|PST|GMT)/);
      const lastUpdate = lastUpdateMatch ? `${lastUpdateMatch[1]}${lastUpdateMatch[2]}` : '';

      // Check individual services and their uptime percentages
      const services = {
        'Huggingface Hub': {
          operational: text.includes('Huggingface Hub') && text.includes('Operational'),
          uptime: text.match(/Huggingface Hub[\s\S]*?(\d+\.\d+)%\s*uptime/)?.[1],
        },
        'Git Hosting and Serving': {
          operational: text.includes('Git Hosting and Serving') && text.includes('Operational'),
          uptime: text.match(/Git Hosting and Serving[\s\S]*?(\d+\.\d+)%\s*uptime/)?.[1],
        },
        'Inference API': {
          operational: text.includes('Inference API') && text.includes('Operational'),
          uptime: text.match(/Inference API[\s\S]*?(\d+\.\d+)%\s*uptime/)?.[1],
        },
        'HF Endpoints': {
          operational: text.includes('HF Endpoints') && text.includes('Operational'),
          uptime: text.match(/HF Endpoints[\s\S]*?(\d+\.\d+)%\s*uptime/)?.[1],
        },
        Spaces: {
          operational: text.includes('Spaces') && text.includes('Operational'),
          uptime: text.match(/Spaces[\s\S]*?(\d+\.\d+)%\s*uptime/)?.[1],
        },
      };

      // Create service status messages with uptime
      const serviceMessages = Object.entries(services).map(([name, info]) => {
        if (info.uptime) {
          return `${name}: ${info.uptime}% uptime`;
        }

        return `${name}: ${info.operational ? 'Operational' : 'Issues detected'}`;
      });

      // Determine overall status
      let status: StatusCheckResult['status'] = 'operational';
      let message = allServicesOnline
        ? `All services are online (Last updated on ${lastUpdate})`
        : 'Checking individual services';

      // Only mark as degraded if we explicitly detect issues
      const hasIssues = Object.values(services).some((service) => !service.operational);

      if (hasIssues) {
        status = 'degraded';
        message = `Service issues detected (Last updated on ${lastUpdate})`;
      }

      // If status page check fails, fallback to endpoint check
      if (!statusPageResponse.ok) {
        const endpointStatus = await this.checkEndpoint('https://status.huggingface.co/');
        const apiEndpoint = 'https://api-inference.huggingface.co/models';
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
        incidents: serviceMessages,
      };
    } catch (error) {
      console.error('Error checking HuggingFace status:', error);

      // Fallback to basic endpoint check
      const endpointStatus = await this.checkEndpoint('https://status.huggingface.co/');
      const apiEndpoint = 'https://api-inference.huggingface.co/models';
      const apiStatus = await this.checkEndpoint(apiEndpoint);

      return {
        status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
        message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
        incidents: ['Note: Limited status information due to CORS restrictions'],
      };
    }
  }
}
