interface Env {
  PARTIFUL_REFRESH_TOKEN: string;
  PARTIFUL_FIREBASE_API_KEY: string;
  CONNECTOR_TOKEN: string;
}

type RpcRequest = { id?: string | number | null; method?: string; params?: Record<string, unknown> };

const tools = [{
  name: "get_event_candidates",
  description: "Get Partiful events to consider: discoverable, RSVPed, saved, and followed.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
}];

function jsonRpc(id: RpcRequest["id"], result?: unknown, error?: { code: number; message: string }) {
  return Response.json(error ? { jsonrpc: "2.0", id: id ?? null, error } : { jsonrpc: "2.0", id: id ?? null, result });
}

function userIdFromJwt(token: string) {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Partiful access token has no payload");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as { user_id?: string; sub?: string };
  if (!payload.user_id && !payload.sub) throw new Error("Partiful access token has no user id");
  return payload.user_id ?? payload.sub!;
}

async function getAccessToken(env: Env) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.PARTIFUL_REFRESH_TOKEN });
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${env.PARTIFUL_FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: "https://partiful.com/" },
    body,
  });
  const data = await response.json() as { id_token?: string; error?: { message?: string } };
  if (!response.ok || !data.id_token) throw new Error(`Partiful token refresh failed: ${data.error?.message ?? response.statusText}`);
  return data.id_token;
}

async function getCandidates(env: Env) {
  const token = await getAccessToken(env);
  const userId = userIdFromJwt(token);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", Origin: "https://partiful.com", Referer: "https://partiful.com/" };
  const post = async (endpoint: string) => {
    const response = await fetch(`https://api.partiful.com/${endpoint}`, { method: "POST", headers, body: JSON.stringify({ data: { params: {}, userId } }) });
    if (!response.ok) throw new Error(`Partiful API error: ${response.status} on /${endpoint}`);
    const body = await response.json() as { result?: { data?: unknown } };
    return body.result?.data;
  };
  const [discoverable, rsvps, saved, followed] = await Promise.all([
    post("getDiscoverableEvents"), post("getMyRsvps"), post("getMySavedEvents"), post("getMyFollowedEvents"),
  ]);
  const events = (value: unknown) => Array.isArray(value) ? value : (value as { events?: unknown[] } | null)?.events ?? [];
  return { discoverable: events(discoverable), rsvps: events(rsvps), saved: events(saved), followed: events(followed) }; 
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/mcp" || request.headers.get("X-Connector-Token") !== env.CONNECTOR_TOKEN) return new Response("Not found", { status: 404 });
    let rpc: RpcRequest;
    try { rpc = await request.json() as RpcRequest; } catch { return jsonRpc(null, undefined, { code: -32700, message: "Invalid JSON" }); }
    if (rpc.method === "initialize") return jsonRpc(rpc.id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "sfevents-partiful", version: "0.1.0" } });
    if (rpc.method === "tools/list") return jsonRpc(rpc.id, { tools });
    if (rpc.method !== "tools/call" || rpc.params?.name !== "get_event_candidates") return jsonRpc(rpc.id, undefined, { code: -32601, message: "Method not found" });
    try {
      const structuredContent = await getCandidates(env);
      return jsonRpc(rpc.id, { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent });
    } catch (error) {
      return jsonRpc(rpc.id, { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Partiful request failed" }] });
    }
  },
};
