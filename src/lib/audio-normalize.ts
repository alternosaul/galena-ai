import { API_CHANNELS, API_SAMPLE_RATE, apiWavIssues, encodePcm16Wav, parseWavHeader } from "./wav";

/**
 * Conversión en el navegador al formato de la API de modelos: WAV estéreo, 8000 Hz, PCM de 16 bits.
 *
 * Imita el pipeline de entrenamiento (galena-live, src/backend/audio/external.py), que llevaba los
 * clips externos a 8 kHz, los redondeaba a 16 bits y los trataba como canal del cliente:
 * - Estéreo: el canal 0 (cliente) y el 1 (agente) se conservan, remuestreados a 8 kHz.
 * - Mono: va en el canal del cliente y el del agente queda en silencio. Los detectores client-only y
 *   acústicos solo leen el canal 0; Galena Full (turnos) no tiene sentido con un clip mono.
 *
 * El remuestreo lo hace el navegador (decodeAudioData a 8 kHz), no soxr_hq como en el entrenamiento,
 * así que las features pueden variar ligeramente respecto a las de un audio convertido en Python.
 */

export type AudioSource = {
  /** Frecuencia original si el archivo era WAV; los formatos comprimidos no la exponen. */
  sampleRate: number | null;
  channels: number;
  /** Extensión del archivo original, en mayúsculas (p. ej. "MP3"). */
  format: string;
};

export type NormalizedAudio = {
  file: File;
  /** Formato original cuando hubo conversión; null si el WAV ya cumplía el contrato. */
  source: AudioSource | null;
};

export class AudioDecodeError extends Error {}

const FORMAT_ISSUES = new Set(["invalid", "format", "sampleRate", "channels"]);

/** Devuelve el archivo tal cual si ya es WAV estéreo de 8 kHz y 16 bits; si no, lo convierte. */
export async function normalizeAudio(file: File): Promise<NormalizedAudio> {
  // La cabecera WAV está al inicio; basta con leer el primer MB.
  const head = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
  const info = parseWavHeader(head);
  // Duración o archivo vacío no se arreglan convirtiendo: la validación del formulario los reporta.
  if (info && !apiWavIssues(info).some((issue) => FORMAT_ISSUES.has(issue.code))) {
    return { file, source: null };
  }

  const buffer = await decodeAt8k(await file.arrayBuffer());
  const client = buffer.getChannelData(0);
  const agent =
    buffer.numberOfChannels >= API_CHANNELS
      ? buffer.getChannelData(1)
      : new Float32Array(client.length);
  const wav = encodePcm16Wav([client, agent], API_SAMPLE_RATE);

  const base = file.name.replace(/\.[^.]+$/, "") || "audio";
  const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toUpperCase() ?? "AUDIO";
  return {
    file: new File([wav], `${base}_8k.wav`, { type: "audio/wav" }),
    source: {
      sampleRate: info?.sampleRate ?? null,
      channels: buffer.numberOfChannels,
      format: extension,
    },
  };
}

/** Decodifica cualquier formato que soporte el navegador y lo entrega a 8000 Hz. */
async function decodeAt8k(data: ArrayBuffer): Promise<AudioBuffer> {
  let context: OfflineAudioContext;
  try {
    // decodeAudioData remuestrea a la frecuencia del contexto que decodifica.
    context = new OfflineAudioContext(1, 1, API_SAMPLE_RATE);
  } catch {
    return resampleAudioBuffer(await decode(new OfflineAudioContext(1, 1, 48_000), data));
  }
  return decode(context, data);
}

async function decode(context: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await context.decodeAudioData(data);
  } catch (error) {
    throw new AudioDecodeError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Respaldo para navegadores que no crean contextos de 8 kHz: filtro de media móvil (antialiasing)
 * e interpolación lineal. Es más tosco que el remuestreador nativo, pero solo se usa si ese falla.
 */
function resampleAudioBuffer(input: AudioBuffer): AudioBuffer {
  const ratio = input.sampleRate / API_SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const window = Math.max(1, Math.round(ratio));
  const output = new AudioBuffer({
    length,
    numberOfChannels: input.numberOfChannels,
    sampleRate: API_SAMPLE_RATE,
  });
  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    const source = input.getChannelData(channel);
    const smoothed = new Float32Array(source.length);
    let sum = 0;
    for (let i = 0; i < source.length; i++) {
      sum += source[i] ?? 0;
      if (i >= window) sum -= source[i - window] ?? 0;
      smoothed[i] = sum / Math.min(i + 1, window);
    }
    const target = output.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;
      const a = smoothed[index] ?? 0;
      const b = smoothed[index + 1] ?? a;
      target[i] = a + (b - a) * fraction;
    }
  }
  return output;
}
