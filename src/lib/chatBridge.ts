/* Agent-chat integration ladder (Nexus):
   Rung 1 — EMBED widget iframe: set `chat.embedUrl` in starter.config.json (the EMBED
     deployment's widget URL) → the ChatDock renders it. Fastest; fixed look.
   Rung 2 — restyled EMBED deployment (deployment-side settings; no app code).
   Rung 3 — API deployment + your own chat UI: the deployment exposes an API-key'd
     conversation surface; your backend proxies it (never expose the key client-side)
     and your UI renders messages. Recipe: the org doctrine's
     nexus-deployments/channels/{embed,api}.md ("Embedding the agent in your app").
   This module is the rung-3 seam: implement `send`/`history` against your backend
   proxy route when you climb to a custom UI. */

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export const chatBridge = {
  async send(_conversationId: string | null, _text: string): Promise<ChatMessage> {
    throw new Error("rung-3 chat bridge not wired — see nexus-deployments/channels/api.md");
  },
  async history(_conversationId: string): Promise<ChatMessage[]> {
    throw new Error("rung-3 chat bridge not wired — see nexus-deployments/channels/api.md");
  },
};
