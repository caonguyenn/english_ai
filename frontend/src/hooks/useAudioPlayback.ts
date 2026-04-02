import { useCallback, useRef } from 'react';
import { OUTPUT_SAMPLE_RATE } from '../constants';
import { int16ToFloat32 } from '../utils/audio';
import { base64ToArrayBuffer } from '../utils/base64Audio';

export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayAtRef = useRef<number>(0);
  const pendingSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    return audioCtxRef.current;
  }, []);

  const enqueueAudio = useCallback((buf: ArrayBuffer) => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const int16 = new Int16Array(buf);
    const float32 = int16ToFloat32(int16);
    const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);

    const scheduleTime = Math.max(ctx.currentTime, nextPlayAtRef.current);
    src.start(scheduleTime);
    nextPlayAtRef.current = scheduleTime + audioBuffer.duration;

    pendingSourcesRef.current.push(src);
    src.onended = () => {
      pendingSourcesRef.current = pendingSourcesRef.current.filter((s) => s !== src);
    };
  }, [getCtx]);

  const enqueueBase64Audio = useCallback((b64: string) => {
    enqueueAudio(base64ToArrayBuffer(b64));
  }, [enqueueAudio]);

  const clearQueue = useCallback(() => {
    pendingSourcesRef.current.forEach((src) => {
      try { src.stop(); } catch { /* ignore */ }
    });
    pendingSourcesRef.current = [];
    nextPlayAtRef.current = 0;
  }, []);

  return { enqueueAudio, enqueueBase64Audio, clearQueue };
}
