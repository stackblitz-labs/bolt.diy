import { createAzure } from '@ai-sdk/azure';
import { CognitiveServicesManagementClient, type Deployment } from '@azure/arm-cognitiveservices';
import { DefaultAzureCredential, type AccessToken } from '@azure/identity';
import type { LanguageModelV1 } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export interface ManagedIdentityOptions {
  clientId: string;
  tenantId: string;
}

export interface AzureEndpointOptions extends ManagedIdentityOptions {
  resourceName: string;
  subscriptionId: string;
  resourceGroup: string;
  apiVersion: string;
}

export default class AzureOpenAIProvider extends BaseProvider {
  name = 'AzureOpenAI';
  getApiKeyLink = 'https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#authentication';
  supportsManagedIdentity = true;
  azureEndpointOptions: AzureEndpointOptions | undefined;
  private _azureToken: AccessToken | undefined;

  config = {
    apiTokenKey: 'AZURE_OPENAI_API_KEY',
    managedIdentityClientIdKey: 'AZURE_OPENAI_USE_MI',
    managedIdentityTenantIdKey: 'AZURE_TENANT_ID',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    this.serverEnv = serverEnv as any;

    const { subscriptionId, resourceGroup, resourceName, clientId, tenantId } = this._useAzureEndpointOptions(
      serverEnv as any,
    );

    if (!subscriptionId || !resourceGroup || !resourceName || !clientId || !tenantId) {
      return this.staticModels;
    }

    const client = new CognitiveServicesManagementClient(this._getAzureCredentials(serverEnv as any), subscriptionId);

    const models: ModelInfo[] = [];

    const buildModelLabel = (deployment: Deployment): string | undefined => {
      const model = deployment.properties?.model;

      if (model) {
        const label = `${model.format} ${model.name}`;

        if (model.version) {
          return `${label} (${model.version})`;
        }

        return label;
      }

      return undefined;
    };

    for await (const deployment of client.deployments.list(resourceGroup, resourceName)) {
      if (deployment.name) {
        models.push({
          name: deployment.name,
          label: buildModelLabel(deployment) || deployment.name,
          provider: this.name,
          maxTokenAllowed: deployment.properties?.capabilities?.maxOutputToken
            ? Number.parseInt(deployment.properties.capabilities.maxOutputToken)
            : 16384,
        });
      }
    }

    return models;
  }

  getToken = async () => {
    if (!this._azureToken || this._azureToken.expiresOnTimestamp - 60000 < Date.now()) {
      console.log('Renewing Managed Identity Token...');
      this._azureToken = await this._getAzureCredentials(this.serverEnv).getToken(
        'https://cognitiveservices.azure.com/.default',
      );
      console.log(`Token will expire in ${(this._azureToken.expiresOnTimestamp - Date.now()) / 1000 / 60} minutes`);
    }

    return this._azureToken.token;
  };

  private _getAzureCredentials = (serverEnv?: Env) => {
    const { clientId, tenantId } = this._useAzureEndpointOptions(serverEnv);

    return new DefaultAzureCredential({
      tenantId,
      managedIdentityClientId: clientId,
    });
  };

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    this.serverEnv = serverEnv as any;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'AZURE_OPENAI_API_KEY',
    });
    const { clientId, resourceName, apiVersion } = this._useAzureEndpointOptions(serverEnv);

    if (!apiKey && !clientId) {
      throw new Error(`For ${this.name} provider: missing Api Key or Managed Identity configuration`);
    }

    const azureOpenai = createAzure({
      apiKey: apiKey || (clientId ? '' : undefined),
      resourceName,
      apiVersion,
      fetch: this.getInterceptor(),
    });

    return azureOpenai(model);
  }

  serverEnv: Env | undefined;

  private _useAzureEndpointOptions(serverEnv?: Env) {
    if (!this.azureEndpointOptions) {
      const manager = LLMManager.getInstance();
      this.azureEndpointOptions = {
        clientId:
          serverEnv?.AZURE_OPENAI_USE_MI || process?.env?.AZURE_OPENAI_USE_MI || manager.env?.AZURE_OPENAI_USE_MI,
        tenantId: serverEnv?.AZURE_TENANT_ID || process?.env?.AZURE_TENANT_ID || manager.env?.AZURE_TENANT_ID,
        apiVersion:
          serverEnv?.AZURE_OPENAI_VERSION || process?.env?.AZURE_OPENAI_VERSION || manager.env?.AZURE_OPENAI_VERSION,
        resourceName:
          serverEnv?.AZURE_OPENAI_ENDPOINT_NAME ||
          process?.env?.AZURE_OPENAI_ENDPOINT_NAME ||
          manager.env?.AZURE_OPENAI_ENDPOINT_NAME,
        subscriptionId:
          serverEnv?.AZURE_SUBSCRIPTION_ID || process?.env?.AZURE_SUBSCRIPTION_ID || manager.env?.AZURE_SUBSCRIPTION_ID,
        resourceGroup:
          serverEnv?.AZURE_RESOURCE_GROUP_NAME ||
          process?.env?.AZURE_RESOURCE_GROUP_NAME ||
          manager.env?.AZURE_RESOURCE_GROUP_NAME,
      };
    }

    return this.azureEndpointOptions;
  }
}
