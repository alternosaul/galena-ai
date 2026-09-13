/**
 * Lectura de la cabecera WAV (RIFF) sin decodificar las muestras.
 * Se usa en el navegador (validación inmediata al elegir un archivo) y en el servidor
 * (antes de reenviar el audio a la API de modelos). No depende de APIs de Node.
 *
 * Contrato de la API galena-live: WAV estéreo, 8000 Hz, PCM de 16 bits, no vacío y
 * de hasta 300 segundos. Canal 0 = interlocutor, canal 1 = agente.
 */

export const ALTUR_SAMPLE_RATE = 8000;
export const ALTUR_CHANNELS = 2;
export const MAX_DURATION_SEC = 300;

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

export type WavInfo = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSec: number;
};

export type WavIssue =
  | { code: "invalid" }
  | { code: "format" }
  | { code: "sampleRate"; value: number }
  | { code: "channels"; value: number }
  | { code: "duration"; value: number }
  | { code: "empty" };

/** Devuelve el formato y la duración del WAV, o null si la cabecera no es válida. */
export function parseWavHeader(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fourCC(view, 0) !== "RIFF" || fourCC(view, 8) !== "WAVE") return null;

  let format: Omit<WavInfo, "dataBytes" | "durationSec"> | null = null;
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
      return { ...format, dataBytes: size, durationSec };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** Diferencias entre el WAV y el contrato de la API (lista vacía = válido). */
export function alturWavIssues(info: WavInfo | null): WavIssue[] {
  if (!info) return [{ code: "invalid" }];
  const issues: WavIssue[] = [];
  const pcm = info.audioFormat === WAVE_FORMAT_PCM || info.audioFormat === WAVE_FORMAT_EXTENSIBLE;
  if (!pcm || info.bitsPerSample !== 16) issues.push({ code: "format" });
  if (info.sampleRate !== ALTUR_SAMPLE_RATE)
    issues.push({ code: "sampleRate", value: info.sampleRate });
  if (info.channels !== ALTUR_CHANNELS) issues.push({ code: "channels", value: info.channels });
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

/** WAV estéreo de 8 kHz en silencio, en base64 (payload de ejemplo que la API acepta). */
export function silentWavBase64(durationSec = 0.02): string {
  const frames = Math.round(ALTUR_SAMPLE_RATE * durationSec);
  const blockAlign = ALTUR_CHANNELS * 2;
  const dataBytes = frames * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  writeFourCC(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeFourCC(view, 8, "WAVE");
  writeFourCC(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, WAVE_FORMAT_PCM, true);
  view.setUint16(22, ALTUR_CHANNELS, true);
  view.setUint32(24, ALTUR_SAMPLE_RATE, true);
  view.setUint32(28, ALTUR_SAMPLE_RATE * blockAlign, true);
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
