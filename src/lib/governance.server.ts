// Permission Manager + Audit helpers — Constitution Art. VI & XIV.
// Pure logic only. No server-function declarations live here.

import { REGISTERED_ENGINES } from "./engines/contract";

export type PermissionRow = {
  engine_id: string;
  scope: string;
  granted: boolean;
  reason: string | null;
  updated_at: string;
};

export type InstalledEnginePermissionMeta = {
  engine_id: string;
  name: string;
  purpose: string | null;
  permissions: unknown;
};

export type ScopeRequest = {
  engine_id: string;
  engine_name: string;
  scope: string;
  purpose: string;
  prohibited: string[];
};

function permissionObject(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as {
    dataRequested?: unknown;
    dataProhibited?: unknown;
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Built-in package-catalogue scopes. Runtime authority remains persisted consent. */
export function declaredScopes(): ScopeRequest[] {
  const out: ScopeRequest[] = [];
  for (const e of REGISTERED_ENGINES) {
    for (const scope of e.permissions.dataRequested) {
      out.push({
        engine_id: e.id,
        engine_name: e.name,
        scope,
        purpose: e.purpose,
        prohibited: e.permissions.dataProhibited,
      });
    }
  }
  return out;
}

/**
 * Merge catalogue declarations, persisted installed-engine declarations, and
 * explicit permission requests. This keeps dynamically requested scopes
 * visible to Governance without adding engine-specific core code.
 */
export function mergeConsent(
  rows: PermissionRow[],
  installed: InstalledEnginePermissionMeta[] = [],
) {
  const requests = new Map<string, ScopeRequest>();

  for (const request of declaredScopes()) {
    requests.set(`${request.engine_id}::${request.scope}`, request);
  }

  const engineMeta = new Map(installed.map((engine) => [engine.engine_id, engine]));

  for (const engine of installed) {
    const permissions = permissionObject(engine.permissions);
    const prohibited = stringArray(permissions?.dataProhibited);
    for (const scope of stringArray(permissions?.dataRequested)) {
      requests.set(`${engine.engine_id}::${scope}`, {
        engine_id: engine.engine_id,
        engine_name: engine.name,
        scope,
        purpose: engine.purpose ?? "Installed engine permission request",
        prohibited,
      });
    }
  }

  // Explicit runtime requests (including capability:<provider>.<capability>)
  // must be governable even when they were not part of the original manifest.
  for (const row of rows) {
    const key = `${row.engine_id}::${row.scope}`;
    if (requests.has(key)) continue;
    const engine = engineMeta.get(row.engine_id);
    const permissions = permissionObject(engine?.permissions);
    requests.set(key, {
      engine_id: row.engine_id,
      engine_name: engine?.name ?? row.engine_id,
      scope: row.scope,
      purpose: row.reason ?? engine?.purpose ?? "Runtime permission request",
      prohibited: stringArray(permissions?.dataProhibited),
    });
  }

  const byKey = new Map(rows.map((r) => [`${r.engine_id}::${r.scope}`, r]));
  return Array.from(requests.values()).map((request) => {
    const row = byKey.get(`${request.engine_id}::${request.scope}`);
    return {
      ...request,
      granted: row?.granted ?? false,
      decided: !!row,
      decidedAt: row?.updated_at ?? null,
    };
  });
}

/** Consent coverage as a 0..100 score, for the governance header. */
export function consentCoverage(
  rows: PermissionRow[],
  installed: InstalledEnginePermissionMeta[] = [],
) {
  const merged = mergeConsent(rows, installed);
  if (merged.length === 0) return 100;
  const decided = merged.filter((m) => m.decided).length;
  return Math.round((decided / merged.length) * 100);
}

// NOTE: consent resolution has exactly one authority — scopeAllowed/assertScope
// in permissions.server.ts. This module only prepares governance presentation.
