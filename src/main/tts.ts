import { openaiVexr, openaiHuman, TTS_VOICES } from './config';

// ── TTS Generation ──────────────────────────────────────────────────
// Generates speech audio and sends base64 data to renderer for playback

let _sendToRenderer: (channel: string, data?: any) => void = () => {};

export function setTtsSendToRenderer(fn: (channel: string, data?: any) => void) {
  _sendToRenderer = fn;
}

export async function generateAndSendTTS(
  who: 'vexr' | 'trapped',
  text: string,
): Promise<void> {
  // Trim text for TTS — limit to ~500 chars for speed
  const ttsText = text.length > 500 ? text.slice(0, 497) + '...' : text;

  const client = who === 'vexr' ? openaiVexr : openaiHuman;
  const voice = TTS_VOICES[who];

  try {
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: ttsText,
      response_format: 'mp3',
    });

    // Get the audio as a buffer and convert to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    _sendToRenderer('tts-audio', {
      who,
      audio: base64,
      mimeType: 'audio/mpeg',
    });
  } catch (error: any) {
    console.error(`[VEXR TTS] Error generating speech for ${who}:`, error?.message ?? error);
  }
}
