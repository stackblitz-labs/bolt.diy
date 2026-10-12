import { z } from 'zod';

const semanticVersion = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);

const safePath = z
  .string()
  .regex(/^plugins\/[a-z0-9][a-z0-9-]{0,48}\/[a-z0-9][a-z0-9-]{0,48}\/[0-9A-Za-z.-]+\/[a-zA-Z0-9._/-]+$/)
  .refine(
    (value) =>
      value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..') &&
      !value.includes('\\'),
  );

export const pluginCategorySchema = z.enum([
  'AI',
  'Developer Tools',
  'Productivity',
  'Data',
  'Media',
  'Communication',
  'Other',
]);

export const pluginManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    pluginApiVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}\.[a-z0-9][a-z0-9-]{0,48}$/),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(400),
    publisher: z.string().trim().min(1).max(80),
    license: z.string().trim().min(1).max(40),
    category: pluginCategorySchema,
    version: semanticVersion,
    minAppVersion: semanticVersion.optional(),
    icon: z
      .string()
      .regex(/^assets\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/)
      .optional(),
    contribution: z
      .object({
        type: z.literal('host-tool'),
        adapter: z.enum(['text-utils']),
      })
      .strict(),
    capabilities: z.array(z.never()).max(0),
    tools: z
      .array(z.enum(['count', 'transform']))
      .min(1)
      .max(2)
      .refine((tools) => new Set(tools).size === tools.length, 'Duplicate tool declaration'),
    settings: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,31}$/),
            label: z.string().trim().min(1).max(64),
            type: z.enum(['text', 'toggle', 'number']),
            description: z.string().max(160).optional(),
            default: z.union([z.string().max(500), z.boolean(), z.number().finite()]).optional(),
          })
          .strict(),
      )
      .max(12)
      .refine(
        (settings) => new Set(settings.map((setting) => setting.key)).size === settings.length,
        'Duplicate setting key',
      )
      .default([]),
  })
  .strict();

export const pluginCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string().datetime(),
    plugins: z
      .array(
        z
          .object({
            id: pluginManifestSchema.shape.id,
            versions: z
              .array(
                z
                  .object({
                    version: semanticVersion,
                    manifestPath: safePath,
                    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/i),
                    packagePath: safePath,
                    packageSha256: z.string().regex(/^[a-f0-9]{64}$/i),
                    changelogPath: safePath.optional(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
  .superRefine((catalog, context) => {
    const pluginIds = new Set<string>();

    for (const [pluginIndex, plugin] of catalog.plugins.entries()) {
      if (pluginIds.has(plugin.id)) {
        context.addIssue({ code: 'custom', path: ['plugins', pluginIndex, 'id'], message: 'Duplicate plugin ID' });
      }

      pluginIds.add(plugin.id);

      const versions = new Set<string>();

      for (const [versionIndex, version] of plugin.versions.entries()) {
        if (versions.has(version.version)) {
          context.addIssue({
            code: 'custom',
            path: ['plugins', pluginIndex, 'versions', versionIndex, 'version'],
            message: 'Duplicate plugin version',
          });
        }

        versions.add(version.version);

        if (version.manifestPath === version.packagePath) {
          context.addIssue({
            code: 'custom',
            path: ['plugins', pluginIndex, 'versions', versionIndex],
            message: 'Manifest and package paths must differ',
          });
        }

        const expectedVersionPath = `plugins/${plugin.id.replace('.', '/')}/${version.version}/`;

        if (
          !version.manifestPath.startsWith(expectedVersionPath) ||
          !version.packagePath.startsWith(expectedVersionPath) ||
          (version.changelogPath && !version.changelogPath.startsWith(expectedVersionPath))
        ) {
          context.addIssue({
            code: 'custom',
            path: ['plugins', pluginIndex, 'versions', versionIndex],
            message: 'Version files must live under the plugin ID and version directory',
          });
        }
      }
    }
  });

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginCatalog = z.infer<typeof pluginCatalogSchema>;
export type CatalogVersion = PluginCatalog['plugins'][number]['versions'][number];

export function compareVersions(left: string, right: string): number {
  const [leftCore, leftPreRelease = ''] = left.split('-', 2);
  const [rightCore, rightPreRelease = ''] = right.split('-', 2);
  const leftParts = leftCore.split('.').map(Number);
  const rightParts = rightCore.split('.').map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  if (!leftPreRelease && !rightPreRelease) {
    return 0;
  }

  if (!leftPreRelease) {
    return 1;
  }

  if (!rightPreRelease) {
    return -1;
  }

  const leftIdentifiers = leftPreRelease.split('.');
  const rightIdentifiers = rightPreRelease.split('.');

  for (let index = 0; index < Math.max(leftIdentifiers.length, rightIdentifiers.length); index += 1) {
    if (leftIdentifiers[index] === undefined) {
      return -1;
    }

    if (rightIdentifiers[index] === undefined) {
      return 1;
    }

    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);

    if (leftNumeric && rightNumeric) {
      const difference = Number(leftIdentifier) - Number(rightIdentifier);

      if (difference !== 0) {
        return difference;
      }
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else if (leftIdentifier !== rightIdentifier) {
      return leftIdentifier.localeCompare(rightIdentifier);
    }
  }

  return 0;
}
