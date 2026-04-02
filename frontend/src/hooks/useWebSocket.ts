import { useCallback, useRef, useState } from 'react';
import type { ConnectionStatus, ServerMessage } from '../types';

type BinaryCallback = (buf: ArrayBuffer) => void;
type JsonCallback = (msg: ServerMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const binaryCallbacksRef = useRef<Set<BinaryCallback>>(new Set());
  const jsonCallbacksRef = useRef<Set<JsonCallback>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_HOST || location.hostname;
    const wsPort = import.meta.env.VITE_WS_PORT;
    const host = wsPort ? `${wsHost}:${wsPort}` : wsHost;
    const url = `${protocol}//${host}/ws`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => setConnectionStatus('connected');

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        binaryCallbacksRef.current.forEach((cb) => cb(event.data as ArrayBuffer));
      } else {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          jsonCallbacksRef.current.forEach((cb) => cb(msg));
        } catch {
          // ignore non-JSON text frames
        }
      }
    };

    ws.onerror = () => setConnectionStatus('error');

    ws.onclose = () => setConnectionStatus('disconnected');
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try { ws.send('stop'); } catch { /* ignore */ }
    try { ws.send('close'); } catch { /* ignore */ }
    ws.close();
    wsRef.current = null;
  }, []);

  const sendBinary = useCallback((buf: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buf);
    }
  }, []);

  const sendStop = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send('stop');
    }
  }, []);

  const onBinaryMessage = useCallback((cb: BinaryCallback) => {
    binaryCallbacksRef.current.add(cb);
    return () => binaryCallbacksRef.current.delete(cb);
  }, []);

  const onJsonMessage = useCallback((cb: JsonCallback) => {
    jsonCallbacksRef.current.add(cb);
    return () => jsonCallbacksRef.current.delete(cb);
  }, []);

  return { connect, disconnect, sendBinary, sendStop, connectionStatus, onBinaryMessage, onJsonMessage };
}
