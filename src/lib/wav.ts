/**
 * Lectura de la cabecera WAV (RIFF) sin decodificar las muestras.
 * Se usa en el navegador (validación inmediata al elegir un archivo) y en el servidor
 * (antes de reenviar el audio a la API de modelos). No depende de APIs de Node.
 *
 * Contrato de la API galena-live: WAV estéreo, 8000 Hz, PCM de 16 bits, no vacío y
 * de hasta 300 segundos. Canal 0 = interlocutor, canal 1 = agente.
 */

export const API_SAMPLE_RATE = 8000;
export const API_CHANNELS = 2;
export const MAX_DURATION_SEC = 300;

/**
 * Vercel rechaza peticiones de más de 4.5 MB a sus funciones (413 FUNCTION_PAYLOAD_TOO_LARGE).
 * Se deja margen para la cabecera multipart y el resto del JSON: ~2 min de WAV al subir el archivo
 * (32 KB/s) y ~1.5 min en Base64, que ocupa un tercio más.
 */
export const MAX_REQUEST_BYTES = 4_400_000;

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

export type WavInfo = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  /** Posición del primer byte de muestras dentro del archivo. */
  dataOffset: number;
  durationSec: number;
};

export type WavIssue =
  | { code: "invalid" }
  | { code: "format" }
  | { code: "sampleRate"; value: number }
  | { code: "channels"; value: number }
  | { code: "duration"; value: number }
  | { code: "empty" }
  | { code: "tooLarge"; value: number }
  | { code: "unsupported" };

/** Devuelve el formato y la duración del WAV, o null si la cabecera no es válida. */
export function parseWavHeader(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fourCC(view, 0) !== "RIFF" || fourCC(view, 8) !== "WAVE") return null;

  let format: Omit<WavInfo, "dataBytes" | "dataOffset" | "durationSec"> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      if (body + 16 > bytes.length) return null;
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!format) return null;
      const bytesPerFrame = (format.channels * format.bitsPerSample) / 8;
      const durationSec =
        bytesPerFrame > 0 && format.sampleRate > 0 ? size / bytesPerFrame / format.sampleRate : 0;
      return { ...format, dataBytes: size, dataOffset: body, durationSec };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/**
 * Diferencias entre el WAV y el contrato de la API (lista vacía = válido). Con `allowMono`, también
 * acepta el canal del cliente solo (ver clientChannelWav).
 */
export function apiWavIssues(info: WavInfo | null, allowMono = false): WavIssue[] {
  if (!info) return [{ code: "invalid" }];
  const issues: WavIssue[] = [];
  const pcm = info.audioFormat === WAVE_FORMAT_PCM || info.audioFormat === WAVE_FORMAT_EXTENSIBLE;
  if (!pcm || info.bitsPerSample !== 16) issues.push({ code: "format" });
  if (info.sampleRate !== API_SAMPLE_RATE)
    issues.push({ code: "sampleRate", value: info.sampleRate });
  if (info.channels !== API_CHANNELS && !(allowMono && info.channels === 1))
    issues.push({ code: "channels", value: info.channels });
  if (info.dataBytes === 0) issues.push({ code: "empty" });
  else if (info.durationSec > MAX_DURATION_SEC) {
    issues.push({ code: "duration", value: Math.round(info.durationSec) });
  }
  return issues;
}

/** Mensaje para las respuestas JSON de las rutas del sitio. */
export function describeWavIssue(issue: WavIssue): string {
  switch (issue.code) {
    case "invalid":
      return "El audio no es un WAV válido";
    case "format":
      return "Se esperaba WAV PCM de 16 bits";
    case "sampleRate":
      return `Se esperaba frecuencia de 8000 Hz, se recibió ${issue.value} Hz`;
    case "channels":
      return `Se esperaba audio estéreo de 2 canales, se recibió ${issue.value}`;
    case "duration":
      return `El WAV excede el límite de ${MAX_DURATION_SEC} segundos (${issue.value} s)`;
    case "empty":
      return "El archivo de audio está vacío";
    case "tooLarge":
      return `El archivo supera ${issue.value} MB`;
    case "unsupported":
      return "El navegador no pudo leer el archivo de audio";
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decodifica base64 estricto (sin espacios), igual que la API; null si es inválido. */
export function base64ToBytes(base64: string): Uint8Array | null {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * WAV mono con solo el canal 0 (cliente) de un WAV estéreo PCM de 16 bits, copiando las muestras
 * sin decodificarlas. Los detectores que no son stereo_only solo leen ese canal, así que dan el mismo
 * resultado con la mitad de bytes: importa en conexiones con subida lenta.
 */
export function clientChannelWav(bytes: Uint8Array, info: WavInfo): Uint8Array<ArrayBuffer> {
  const frames = Math.floor(
    Math.min(info.dataBytes, bytes.length - info.dataOffset) / (info.channels * 2),
  );
  const out = new Uint8Array(44 + frames * 2);
  const view = new DataView(out.buffer);
  writeFourCC(view, 0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  writeFourCC(view, 8, "WAVE");
  writeFourCC(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, WAVE_FORMAT_PCM, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, info.sampleRate, true);
  view.setUint32(28, info.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeFourCC(view, 36, "data");
  view.setUint32(40, frames * 2, true);
  const stride = info.channels * 2;
  for (let frame = 0; frame < frames; frame++) {
    const source = info.dataOffset + frame * stride;
    out[44 + frame * 2] = bytes[source] ?? 0;
    out[45 + frame * 2] = bytes[source + 1] ?? 0;
  }
  return out;
}

/**
 * Codifica muestras float (-1..1) como WAV PCM de 16 bits, con el mismo redondeo que el pipeline de
 * entrenamiento (round(x * 32767), recortado al rango de int16).
 */
export function encodePcm16Wav(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  const numChannels = channels.length;
  const frames = channels[0]?.length ?? 0;
  const blockAlign = numChannels * 2;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeFourCC(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeFourCC(view, 8, "WAVE");
  writeFourCC(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, WAVE_FORMAT_PCM, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeFourCC(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = channels[channel]?.[frame] ?? 0;
      view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

/** WAV estéreo de 8 kHz en silencio, en base64 (payload de ejemplo que la API acepta). */
export function silentWavBase64(durationSec = 0.02): string {
  const frames = Math.round(API_SAMPLE_RATE * durationSec);
  const blockAlign = API_CHANNELS * 2;
  const dataBytes = frames * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  writeFourCC(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeFourCC(view, 8, "WAVE");
  writeFourCC(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, WAVE_FORMAT_PCM, true);
  view.setUint16(22, API_CHANNELS, true);
  view.setUint32(24, API_SAMPLE_RATE, true);
  view.setUint32(28, API_SAMPLE_RATE * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeFourCC(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  return bytesToBase64(new Uint8Array(view.buffer));
}

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function writeFourCC(view: DataView, offset: number, value: string) {
  for (let i = 0; i < 4; i++) view.setUint8(offset + i, value.charCodeAt(i));
}
