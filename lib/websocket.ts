import { useEffect, useRef, useCallback } from 'react';

type WebSocketEventType = 
  | 'router_status_update'
  | 'device_connected'
  | 'device_disconnected'
  | 'bandwidth_update'
  | 'network_event';

type WebSocketEventHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map();
  private url: string;

  constructor(url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws') {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('auth_token');
    const wsUrl = token ? `${this.url}?token=${token}` : this.url;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: { type: WebSocketEventType; data: unknown }) {
    const handlers = this.listeners.get(message.type);
    handlers?.forEach((handler) => handler(message.data));
  }

  subscribe(type: WebSocketEventType, handler: WebSocketEventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(handler);

    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type: WebSocketEventType, handler: WebSocketEventHandler) {
    this.listeners.get(type)?.delete(handler);
  }

  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const wsClient = new WebSocketClient();

// React hook for WebSocket events
export function useWebSocket(
  type: WebSocketEventType,
  handler: WebSocketEventHandler
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback((data: unknown) => {
    handlerRef.current(data);
  }, []);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe(type, stableHandler);
    return () => unsubscribe();
  }, [type, stableHandler]);

  useEffect(() => {
    wsClient.connect();
    return () => {
      // Don't disconnect on unmount to allow multiple components to use WebSocket
    };
  }, []);
}
