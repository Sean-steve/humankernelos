import { z } from "zod";

export const EngineManifestSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/),
  name: z.string().min(1).max(128),
  version: z.string().min(1).max(32),
  purpose: z.string().min(1).max(500),
  owner: z.string().min(1).max(128),
  status: z.enum(["active", "inactive", "deprecated"]),
  capabilities: z.array(z.string().min(1).max(128)).default([]),
  dataOwned: z.array(z.string().min(1).max(128)).default([]),
  eventsPublished: z.array(z.string().min(1).max(128)).default([]),
  eventsConsumed: z.array(z.string().min(1).max(128)).default([]),
  publishedSignals: z.array(z.string().min(1).max(128)).default([]),
  requiredSignals: z.array(z.string().min(1).max(128)).default([]),
  dependencies: z.array(z.string().min(1).max(64)).default([]),
  permissions: z.object({
    dataRequested: z.array(z.string().min(1).max(128)).default([]),
    dataProvided: z.array(z.string().min(1).max(128)).default([]),
    dataProhibited: z.array(z.string().min(1).max(128)).default([]),
  }),
});

export type ValidatedEngineManifest = z.infer<typeof EngineManifestSchema>;

export function validateEngineManifest(input: unknown) {
  const manifest = EngineManifestSchema.parse(input);
  if (manifest.dependencies.includes(manifest.id)) {
    throw new Error("Engine manifest cannot depend on itself.");
  }
  return manifest;
}
