// Server runtime adapter bootstrap.
// External engines register executable adapters through generic registries.
// Importing an adapter here does not grant lifecycle or consent authority;
// persisted installation/permissions remain authoritative.

import "../external-engines/execution-os.server";

export const runtimeAdaptersBootstrapped = true;
