import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsToken } from '../lib/api';
import type { WsMessage } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws');
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseRoomWebSocketOptions {
  roomId: number | null;
  onMessage: (message: WsMessage) => void;
  enabled?: boolean;
}

export function useRoomWebSocket({
  roomId,
  onMessage,
  enabled = true,
}: UseRoomWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Use refs for values read inside onclose to avoid stale closures
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!roomIdRef.current || !enabledRef.current) return;

    cleanup();
    setStatus('connecting');

    const currentRoomId = roomIdRef.current;

    try {
      const token = await getWsToken();

      // Check if still enabled after async token fetch
      if (!enabledRef.current || roomIdRef.current !== currentRoomId) return;

      const ws = new WebSocket(`${WS_URL}/ws/room/${currentRoomId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        // Start ping keepalive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          if (message.type === 'pong') return;
          onMessageRef.current(message);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        // Only auto-reconnect if still enabled and same room
        if (enabledRef.current && roomIdRef.current === currentRoomId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus('disconnected');
      // Retry on token fetch failure, but only if still enabled
      if (enabledRef.current && roomIdRef.current === currentRoomId) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    }
  }, [cleanup]);

  useEffect(() => {
    if (roomId && enabled) {
      connect();
    } else {
      cleanup();
      setStatus('disconnected');
    }
    return cleanup;
  }, [roomId, enabled, connect, cleanup]);

  return { status };
}
