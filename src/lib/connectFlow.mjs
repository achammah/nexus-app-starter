/* In-app vendor connect flow (APP-context variant — the platform-credential route:
   the app backend never holds vendor OAuth tokens).
   Server route → POST /tools/<toolId>/connect → open authorizationUrl in a popup →
   poll GET /tools/<toolId>/credentials until a credential NEWER than the handshake
   start appears → store credential id → execute actions via the platform. */

import { nexus } from "./nexusClient.mjs";

export async function startConnect(toolId) {
  const started = Date.now();
  const r = await nexus(`/tools/${toolId}/connect`, { method: "POST", body: {} });
  const authorizationUrl = r?.data?.authorizationUrl ?? r?.authorizationUrl;
  if (!authorizationUrl) throw new Error("no authorizationUrl in connect response");
  return { authorizationUrl, started };
}

export async function pollForCredential(toolId, startedMs, { timeoutMs = 180000, everyMs = 3000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await nexus(`/tools/${toolId}/credentials`);
    const creds = r?.data ?? r ?? [];
    const fresh = (Array.isArray(creds) ? creds : []).find(
      (c) => new Date(c.createdAt ?? c.created_at ?? 0).getTime() > startedMs,
    );
    if (fresh) return fresh;
    await new Promise((res) => setTimeout(res, everyMs));
  }
  throw new Error(`no new credential for ${toolId} within ${timeoutMs / 1000}s`);
}

export async function executeAction(toolId, action, input, credentialId) {
  const r = await nexus(`/tools/${toolId}/execute`, {
    method: "POST",
    body: { action, input, ...(credentialId ? { credentialId } : {}) },
  });
  // Envelope `success:true` can still carry per-op errors — inspect result.os[].
  const osErr = (r?.data?.result?.os ?? r?.result?.os ?? []).filter((o) => o?.k === "error");
  if (osErr.length) throw new Error(`tool op errors: ${JSON.stringify(osErr).slice(0, 300)}`);
  return r;
}
