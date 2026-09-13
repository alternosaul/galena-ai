import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "./database.types";
import type { DetectionResult } from "./detection";

/**
 * Persistencia del historial en Supabase (tabla public.detections), solo en el servidor.
 *
 * Variables de entorno (en la VPS: /etc/galena-ai.env):
 *   SUPABASE_URL          https://<ref>.supabase.co
 *   SUPABASE_SECRET_KEY   secret key: ignora RLS, nunca sale del servidor.
 *
 * El dueño de cada fila sale del token de sesión (Authorization: Bearer) validado con
 * Supabase Auth; las peticiones sin sesión (API pública, juez) se guardan sin user_id.
 */

let admin: SupabaseClient<Database> | null | undefined;

function adminClient(): SupabaseClient<Database> | null {
  if (admin === undefined) {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SECRET_KEY"];
    admin =
      url && key
        ? createClient<Database>(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    if (!admin)
      console.warn("SUPABASE_URL/SUPABASE_SECRET_KEY no definidas: no se guarda historial");
  }
  return admin;
}

/** id del usuario autenticado, o null si la petición no trae una sesión válida. */
export async function userIdFromRequest(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const client = token ? adminClient() : null;
  if (!token || !client) return null;
  const { data, error } = await client.auth.getClaims(token);
  return error || !data ? null : (data.claims.sub ?? null);
}

type RecordInput = {
  result: DetectionResult;
  userId: string | null;
  inputType: "json" | "audio_upload";
  wavBytes: Uint8Array;
};

/** Inserta la detección; los errores se registran pero nunca rompen la respuesta. */
export async function recordDetection({ result, userId, inputType, wavBytes }: RecordInput) {
  const client = adminClient();
  if (!client) return;
  const { error } = await client.from("detections").insert({
    user_id: userId,
    detector_id: result.model,
    api_detection_id: result.detection_id ?? null,
    call_id: result.call_id,
    input_type: inputType,
    source: result.source ?? null,
    file_name: result.file_name ?? null,
    audio_sha256: createHash("sha256").update(wavBytes).digest("hex"),
    audio_bytes: wavBytes.byteLength,
    duration_sec: result.duration_sec ?? null,
    sample_rate: result.sample_rate ?? null,
    channels: result.channels ?? null,
    status: "completed",
    is_synthetic: result.is_synthetic,
    // La columna guarda P(sintético); la confianza en el veredicto se deriva al leer.
    confidence: result.p_synthetic ?? result.confidence,
    threshold: result.threshold ?? null,
    http_status: 200,
    latency_ms: result.latency_ms,
    request_metadata: { simulated: result.simulated ?? false } satisfies Json,
    response_json: result as unknown as Json,
  });
  if (error) console.error("No se pudo guardar la detección en Supabase:", error.message);
}

/**
 * Guarda el resultado según quién llama: con sesión se espera el insert (el historial ya lo
 * muestra al volver); sin sesión se guarda en segundo plano para no sumar latencia a la API.
 */
export async function saveDetection(request: Request, input: Omit<RecordInput, "userId">) {
  if (request.headers.get("x-galena-save") === "0") return;
  const userId = await userIdFromRequest(request);
  const pending = recordDetection({ ...input, userId });
  if (userId) await pending;
  else void pending;
}
