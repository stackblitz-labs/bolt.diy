export const API_KEYS_UPDATED_EVENT = 'bolt:api-keys-updated';

export interface ApiKeysUpdatedDetail {
  apiKeys: Record<string, string>;
  providerName: string;
}
