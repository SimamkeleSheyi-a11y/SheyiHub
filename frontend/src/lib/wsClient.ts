import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/authStore";

type Handler = (data: Record<string, unknown>) => void;

function wsBaseUrl() {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (explicit) return explicit;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  async connect() {
    this.shouldReconnect = true;
    if (this.socket?.readyState === WebSocket.OPEN) return;

    try {
      const { ticket } = await authApi.wsTicket();
      const socket = new WebSocket(`${wsBaseUrl()}/ws/connect/?ticket=${ticket}`);

      socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.handlers.get("__connected")?.forEach((handler) => handler({ type: "__connected" }));
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handlers.get(data.type)?.forEach((h) => h(data));
      };
      socket.onclose = () => {
        if (this.shouldReconnect) this.scheduleReconnect();
      };
      socket.onerror = () => socket.close();

      this.socket = socket;
    } catch {
      if (this.shouldReconnect) this.scheduleReconnect();
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  send(data: Record<string, unknown>): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async waitUntilConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.isConnected()) return true;
    await this.connect();
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.isConnected()) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return false;
  }

  /** Returns an unsubscribe function, matching the rest of the codebase's cleanup pattern. */
  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);

    return () => {
      const handlers = this.handlers.get(type);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) this.handlers.delete(type);
    };
  }

  private scheduleReconnect() {
    // Exponential backoff capped at 10s (Phase 1 NFR: reconnect within ~5s typically).
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 10_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

export const wsClient = new WsClient();

// Disconnect automatically on logout so a stale socket doesn't linger under the next user.
useAuthStore.subscribe((state, prevState) => {
  if (prevState.user && !state.user) wsClient.disconnect();
});
