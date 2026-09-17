/**
 * POST con progreso de subida y límites de espera. fetch no reporta el progreso de subida, y sin
 * límites una conexión lenta dejaba el detector en "Analizando" para siempre.
 */

/** Sin avance en la subida durante este tiempo, se cancela (conexión caída o atascada). */
const UPLOAD_STALL_MS = 60_000;
/** Espera por la respuesta una vez subido el audio: la función de Vercel se corta a los 300 s. */
const RESPONSE_TIMEOUT_MS = 300_000;

export class UploadError extends Error {
  constructor(readonly reason: "network" | "stalled" | "timeout") {
    super(reason);
  }
}

export type UploadPhase = { phase: "uploading"; percent: number } | { phase: "waiting" };

export function postWithProgress(
  url: string,
  body: XMLHttpRequestBodyInit,
  options: { headers?: Record<string, string>; onProgress?: (phase: UploadPhase) => void } = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failure: UploadError | null = null;

    const arm = (ms: number, reason: UploadError["reason"]) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        failure = new UploadError(reason);
        xhr.abort();
      }, ms);
    };

    xhr.open("POST", url);
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      arm(UPLOAD_STALL_MS, "stalled");
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        options.onProgress?.({ phase: "uploading", percent });
      }
    };
    xhr.upload.onload = () => {
      arm(RESPONSE_TIMEOUT_MS, "timeout");
      options.onProgress?.({ phase: "waiting" });
    };
    xhr.onload = () => {
      clearTimeout(timer);
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          headers: { "Content-Type": xhr.getResponseHeader("Content-Type") ?? "application/json" },
        }),
      );
    };
    xhr.onerror = () => {
      clearTimeout(timer);
      reject(new UploadError("network"));
    };
    xhr.onabort = () => {
      clearTimeout(timer);
      reject(failure ?? new UploadError("network"));
    };

    options.onProgress?.({ phase: "uploading", percent: 0 });
    arm(UPLOAD_STALL_MS, "stalled");
    xhr.send(body);
  });
}
