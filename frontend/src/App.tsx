import { useCallback, useEffect, useRef, useState } from 'react';
import { MicButton } from './components/MicButton';
import { StatusIndicator } from './components/StatusIndicator';
import { TranscriptPanel } from './components/TranscriptPanel';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useTranscript } from './hooks/useTranscript';
import { useWebSocket } from './hooks/useWebSocket';
import type { ServerMessage } from './types';

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const ws = useWebSocket();
  const capture = useAudioCapture();
  const playback = useAudioPlayback();
  const transcript = useTranscript();

  // Track current content role for transcript routing
  const currentContentRoleRef = useRef<'USER' | 'ASSISTANT' | null>(null);

  const handleJsonMessage = useCallback(
    (msg: ServerMessage) => {
      if (!('event' in msg)) return;
      const ev = msg.event;

      if ('connectionStatus' in ev) {
        // connected — nothing extra needed
      } else if ('audioOutput' in ev) {
        playback.enqueueBase64Audio(ev.audioOutput.content);
      } else if ('contentStart' in ev) {
        const { role, type, additionalModelFields } = ev.contentStart;
        let isSpeculative = false;
        if (additionalModelFields) {
          try { isSpeculative = JSON.parse(additionalModelFields)?.generationStage === 'SPECULATIVE'; } catch { /* ignore */ }
        }
        if (role === 'USER') {
          currentContentRoleRef.current = 'USER';
          transcript.startNewMessage('USER');
        } else if (role === 'ASSISTANT' && type === 'TEXT' && !isSpeculative) {
          currentContentRoleRef.current = 'ASSISTANT';
          transcript.startNewMessage('ASSISTANT');
        }
      } else if ('textOutput' in ev) {
        const { content, additionalModelFields } = ev.textOutput;
        // Handle barge-in
        if (additionalModelFields) {
          try {
            const fields = JSON.parse(additionalModelFields);
            if (fields?.interrupted) {
              playback.clearQueue();
            }
          } catch { /* ignore */ }
        }
        if (content) transcript.appendToCurrentMessage(content);
      } else if ('completionEnd' in ev) {
        transcript.finalizeCurrentMessage();
        currentContentRoleRef.current = null;
      }
    },
    [playback, transcript],
  );

  const handleBinaryMessage = useCallback(
    (buf: ArrayBuffer) => {
      playback.enqueueAudio(buf);
    },
    [playback],
  );

  // Register ws message handlers
  useEffect(() => {
    const unsubBin = ws.onBinaryMessage(handleBinaryMessage);
    const unsubJson = ws.onJsonMessage(handleJsonMessage);
    return () => { unsubBin(); unsubJson(); };
  }, [ws, handleBinaryMessage, handleJsonMessage]);

  const handleToggle = useCallback(async () => {
    if (!isActive) {
      setIsActive(true);
      ws.connect();
      try {
        await capture.startCapture(
          (buf) => ws.sendBinary(buf),
          () => ws.sendStop(),
        );
      } catch {
        setIsActive(false);
        ws.disconnect();
      }
    } else {
      setIsActive(false);
      capture.stopCapture();
      ws.disconnect();
    }
  }, [isActive, ws, capture]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold">
            AI
          </div>
          <span className="font-semibold text-gray-100">English AI</span>
          <span className="text-gray-600 text-sm">Voice Assistant</span>
        </div>
        <StatusIndicator status={ws.connectionStatus} />
      </header>

      {/* Transcript */}
      <TranscriptPanel messages={transcript.messages} />

      {/* Waveform + Controls */}
      <div className="px-6 pb-8 pt-4 flex flex-col items-center gap-6 border-t border-gray-800 bg-gray-950">
        <WaveformVisualizer
          amplitudeData={capture.amplitudeData}
          isActive={isActive}
          isSpeaking={capture.isSpeaking}
        />
        <div className="flex flex-col items-center gap-2">
          <MicButton
            isActive={isActive}
            isSpeaking={capture.isSpeaking}
            isConnecting={ws.connectionStatus === 'connecting'}
            onClick={handleToggle}
          />
          <span className="text-xs text-gray-500">
            {!isActive
              ? 'Click to start'
              : capture.isSpeaking
                ? 'Listening…'
                : 'Waiting for speech…'}
          </span>
        </div>
      </div>
    </div>
  );
}
