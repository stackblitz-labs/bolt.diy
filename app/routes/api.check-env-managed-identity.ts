import type { LoaderFunction } from '@remix-run/cloudflare';
import { providerManagedIdentityEnvKeys } from '~/utils/constants';

export const loader: LoaderFunction = async ({ context, request }) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  if (
    !provider ||
    !providerManagedIdentityEnvKeys[provider].clientIdKey ||
    !providerManagedIdentityEnvKeys[provider].tenantIdKey
  ) {
    return Response.json({ isSet: false });
  }

  const clientIdEnvVarName = providerManagedIdentityEnvKeys[provider].clientIdKey;
  const tenantIdEnvVarName = providerManagedIdentityEnvKeys[provider].tenantIdKey;
  const isSet = !!(
    process.env[clientIdEnvVarName] ||
    (context?.cloudflare?.env as Record<string, any>)?.[clientIdEnvVarName] ||
    process.env[tenantIdEnvVarName] ||
    (context?.cloudflare?.env as Record<string, any>)?.[tenantIdEnvVarName]
  );

  return Response.json({ isSet });
};
