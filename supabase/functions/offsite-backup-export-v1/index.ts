import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHUNK_SIZE = 30000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const step = 0x4000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { "Cache-Control": "no-store" } });
  const exportId = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(exportId)) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return new Response("Server configuration error", { status: 500, headers: { "Cache-Control": "no-store" } });

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client
    .from("system_backup_exports")
    .select("id,snapshot_id,payload_text,checksum_sha256,expires_at")
    .eq("id", exportId)
    .maybeSingle();

  if (error || !data) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const expiresAt = Date.parse(String(data.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await client.from("system_backup_exports").delete().eq("id", exportId);
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const payload = String(data.payload_text ?? "");
  if (!payload) return new Response("Empty export", { status: 500, headers: { "Cache-Control": "no-store" } });
  const encoded = bytesToBase64(new TextEncoder().encode(payload));
  const lines = ["chunk_no,base64"];
  for (let offset = 0, n = 1; offset < encoded.length; offset += CHUNK_SIZE, n += 1) {
    lines.push(`${n},${encoded.slice(offset, offset + CHUNK_SIZE)}`);
  }

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-YHCT-Snapshot-Id": String(data.snapshot_id),
      "X-YHCT-SHA256": String(data.checksum_sha256),
      "X-YHCT-Encoding": "base64-utf8",
      "X-YHCT-Chunk-Size": String(CHUNK_SIZE),
    },
  });
});
