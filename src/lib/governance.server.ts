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

export type ScopeRequest = {
  engine_id: string;
  engine_name: string;
  scope: string;
  purpose: string;
  prohibited: string[];
};

/** Every data scope declared by every registered engine. */
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

/** Merge declared scopes with persisted consent decisions. */
export function mergeConsent(rows: PermissionRow[]) {
  const byKey = new Map(rows.map((r) => [`${r.engine_id}::${r.scope}`, r]));
  return declaredScopes().map((s) => {
    const row = byKey.get(`${s.engine_id}::${s.scope}`);
    return {
      ...s,
      granted: row?.granted ?? false,
      decided: !!row,
      decidedAt: row?.updated_at ?? null,
    };
  });
}

/** Consent coverage as a 0..100 score, for the governance header. */
export function consentCoverage(rows: PermissionRow[]) {
  const merged = mergeConsent(rows);
  if (merged.length === 0) return 100;
  const decided = merged.filter((m) => m.decided).length;
  return Math.round((decided / merged.length) * 100);
}

/** True when an engine may read a scope, given persisted consent. */
export function isAllowed(rows: PermissionRow[], engineId: string, scope: string) {
  return rows.some((r) => r.engine_id === engineId && r.scope === scope && r.granted);
}
