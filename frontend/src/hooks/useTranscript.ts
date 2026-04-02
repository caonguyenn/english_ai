import { useCallback, useRef, useState } from 'react';
import type { Message, MessageRole } from '../types';

export function useTranscript() {
  const [messages, setMessages] = useState<Message[]>([]);
  const streamingIdRef = useRef<string | null>(null);

  const startNewMessage = useCallback((role: MessageRole) => {
    const id = crypto.randomUUID();
    streamingIdRef.current = id;
    setMessages((prev) => [
      ...prev,
      { id, role, content: '', isStreaming: true, timestamp: Date.now() },
    ]);
  }, []);

  const appendToCurrentMessage = useCallback((text: string) => {
    const id = streamingIdRef.current;
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    );
  }, []);

  const finalizeCurrentMessage = useCallback(() => {
    const id = streamingIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isStreaming: false } : m)));
    streamingIdRef.current = null;
  }, []);

  const clearTranscript = useCallback(() => {
    setMessages([]);
    streamingIdRef.current = null;
  }, []);

  return { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage, clearTranscript };
}
