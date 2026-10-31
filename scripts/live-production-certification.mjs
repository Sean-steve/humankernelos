import process from "node:process";

function requiredHttpsUrl(name) {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} is required.`);
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }
  return raw.replace(/\/+$/, "");
}

async function probe(name, url, validate) {
  const started = Date.now();
  let response;
  let body;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "HumanKernelOS-Phase-6.1-Certifier/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  } catch (error) {
    return {
      name,
      ok: false,
      status: null,
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let validation = { ok: response.ok, detail: response.ok ? "HTTP success." : "HTTP failure." };
  if (response.ok && validate) {
    try {
      validation = validate(body);
    } catch (error) {
      validation = {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    name,
    ok: response.ok && validation.ok,
    status: response.status,
    duration_ms: Date.now() - started,
    detail: validation.detail,
  };
}

function unwrap(body) {
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} response is not an object.`);
  }
  return value;
}

const hosBase = requiredHttpsUrl("HOS_PRODUCTION_URL");
const executionBase = requiredHttpsUrl("EXECUTION_OS_PRODUCTION_URL");

const checks = await Promise.all([
  probe("hos_liveness", `${hosBase}/api/v1/health`, (body) => {
    const data = expectObject(unwrap(body), "HOS health");
    return {
      ok: data.status === "ok" && data.service === "humankernelos",
      detail: `service=${String(data.service)} status=${String(data.status)}`,
    };
  }),
  probe("hos_readiness", `${hosBase}/api/v1/readiness`, (body) => {
    const data = expectObject(unwrap(body), "HOS readiness");
    return {
      ok: data.ready === true && data.status === "ready",
      detail: `status=${String(data.status)} database=${String(data.checks?.database)} configuration=${String(data.checks?.configuration)}`,
    };
  }),
  probe("execution_liveness", `${executionBase}/api/health`, (body) => {
    const data = expectObject(unwrap(body), "Execution OS health");
    return {
      ok: data.status === "ok",
      detail: `status=${String(data.status)} service=${String(data.service)}`,
    };
  }),
  probe("execution_manifest", `${executionBase}/api/v1/hos/manifest`, (body) => {
    const data = expectObject(unwrap(body), "Execution OS manifest");
    return {
      ok:
        data.engineId === "execution-os" &&
        data.identityAuthority === "HumanKernelOS" &&
        data.scheduleAuthority === "HumanKernelOS",
      detail: `engine=${String(data.engineId)} identityAuthority=${String(data.identityAuthority)} scheduleAuthority=${String(data.scheduleAuthority)}`,
    };
  }),
  probe("execution_hos_health", `${executionBase}/api/v1/hos/health`, (body) => {
    const data = expectObject(unwrap(body), "Execution OS HOS health");
    return {
      ok:
        data.status === "ok" &&
        data.identityAuthority === "HumanKernelOS" &&
        data.scheduleAuthority === "HumanKernelOS",
      detail: `status=${String(data.status)} eventMeshConfigured=${String(data.eventMeshConfigured)}`,
    };
  }),
  probe("execution_hos_readiness", `${executionBase}/api/v1/hos/readiness`, (body) => {
    const data = expectObject(unwrap(body), "Execution OS readiness");
    return {
      ok:
        data.status === "ready" &&
        data.identityAuthority === "HumanKernelOS" &&
        data.scheduleAuthority === "HumanKernelOS" &&
        data.checks?.productionConfig === true &&
        data.checks?.identityMode === true &&
        data.checks?.eventMeshTransport === true &&
        data.checks?.runtimeStorageIsolation === true &&
        data.checks?.durableStorageRoot === true &&
        data.checks?.backupEvidence === true &&
        data.checks?.restoreEvidence === true,
      detail: `status=${String(data.status)} config=${String(data.checks?.productionConfig)} identity=${String(data.checks?.identityMode)} eventMesh=${String(data.checks?.eventMeshTransport)} storageIsolation=${String(data.checks?.runtimeStorageIsolation)} durableStorage=${String(data.checks?.durableStorageRoot)} backupEvidence=${String(data.checks?.backupEvidence)} restoreEvidence=${String(data.checks?.restoreEvidence)}`,
    };
  }),
]);

const failed = checks.filter((check) => !check.ok);
const evidence = {
  phase: "6.1",
  certification: failed.length === 0 ? "read_only_live_gate_passed" : "blocked",
  generated_at: new Date().toISOString(),
  hos_url: hosBase,
  execution_os_url: executionBase,
  checks,
  write_smoke_test: {
    status: "not_run",
    reason:
      "Phase 6.1 certifier is intentionally read-only. A signed write/capability test requires a designated production test subject and explicit operator authorization.",
  },
};

console.log(JSON.stringify(evidence, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
