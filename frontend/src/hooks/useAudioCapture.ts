import { useCallback, useRef, useState } from 'react';
import { FRAME_SIZE, INPUT_SAMPLE_RATE, SILENCE_MS, VAD_THRESHOLD } from '../constants';
import { floatTo16BitPCM, resampleLinear } from '../utils/audio';

export function useAudioCapture() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitudeData, setAmplitudeData] = useState<Float32Array>(new Float32Array(64));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scriptProcessorRef = useRef<any>(null);
  const onChunkRef = useRef<((buf: ArrayBuffer) => void) | null>(null);
  const onStopRef = useRef<(() => void) | null>(null);
  const speakingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const handleFrame = useCallback((rms: number, pcm: Float32Array) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (rms > VAD_THRESHOLD) {
      clearSilenceTimer();
      if (!speakingRef.current) {
        speakingRef.current = true;
        setIsSpeaking(true);
      }
    } else if (speakingRef.current) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          speakingRef.current = false;
          setIsSpeaking(false);
          silenceTimerRef.current = null;
          onStopRef.current?.();
        }, SILENCE_MS);
      }
    }

    const resampled = resampleLinear(pcm, ctx.sampleRate, INPUT_SAMPLE_RATE);
    const int16 = floatTo16BitPCM(resampled);
    onChunkRef.current?.(int16.buffer as ArrayBuffer);
  }, []);

  const drawAmplitude = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);
    setAmplitudeData(data);
    animFrameRef.current = requestAnimationFrame(drawAmplitude);
  }, []);

  const startCapture = useCallback(
    async (onChunk: (buf: ArrayBuffer) => void, onStop: () => void) => {
      onChunkRef.current = onChunk;
      onStopRef.current = onStop;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // Analyser for visualizer
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(drawAmplitude);

      // Try AudioWorklet, fallback to ScriptProcessor
      try {
        await ctx.audioWorklet.addModule('/worklets/audio-capture.worklet.js');
        const workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor');
        workletNode.port.onmessage = (e: MessageEvent<{ rms: number; pcm: Float32Array }>) => {
          handleFrame(e.data.rms, e.data.pcm);
        };
        source.connect(workletNode);
        workletNodeRef.current = workletNode;
      } catch {
        // Fallback: ScriptProcessor (deprecated but universal)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processor = (ctx as any).createScriptProcessor(FRAME_SIZE, 1, 1);
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const pcm = e.inputBuffer.getChannelData(0).slice();
          let sum = 0;
          for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
          const rms = Math.sqrt(sum / pcm.length);
          handleFrame(rms, pcm);
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        scriptProcessorRef.current = processor;
      }
    },
    [handleFrame, drawAmplitude],
  );

  const stopCapture = useCallback(() => {
    clearSilenceTimer();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    speakingRef.current = false;
    setIsSpeaking(false);
    setAmplitudeData(new Float32Array(64));
  }, []);

  return { startCapture, stopCapture, isSpeaking, amplitudeData };
}
