import { openaiVexr, openaiHuman, TTS_VOICES } from './config';

let _sendToRenderer: (channel: string, data?: any) => void = () => {};
let _isMuted = false;

export function setTtsSendToRenderer(fn: (channel: string, data?: any) => void) {
  _sendToRenderer = fn;
}

export function setTtsMuted(muted: boolean) {
  _isMuted = muted;
}

export async function generateAndSendTTS(
  who: 'vexr' | 'trapped',
  text: string,
): Promise<void> {
  // Skip API call entirely when muted — zero cost
  if (_isMuted) return;

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

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    _sendToRenderer('tts-audio', {
      who,
      audio: base64,
      mimeType: 'audio/mpeg',
    });
  } catch (error: any) {
    console.error(`[VEXR TTS] Error for ${who}:`, error?.message ?? error);
  }
}
