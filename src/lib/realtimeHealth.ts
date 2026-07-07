// Lightweight in-memory pub-sub for Supabase realtime channel health.
// Any component that subscribes to a `postgres_changes` channel can report
// its status here; admin widgets can subscribe to display a live view.

export type RealtimeChannelStatus =
  | "subscribing"
  | "subscribed"
  | "error"
  | "closed"
  | "timed_out";

export interface RealtimeChannelHealth {
  key: string;           // stable identifier (component/topic)
  channelName: string;   // actual channel name (may include random suffix)
  status: RealtimeChannelStatus;
  lastError: string | null;
  updatedAt: number;
}

type Listener = (snapshot: RealtimeChannelHealth[]) => void;

const state = new Map<string, RealtimeChannelHealth>();
const listeners = new Set<Listener>();

function emit() {
  const snapshot = Array.from(state.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function reportRealtimeStatus(
  key: string,
  channelName: string,
  status: RealtimeChannelStatus,
  error?: unknown,
) {
  const lastError =
    error instanceof Error ? error.message : error ? String(error) : null;
  state.set(key, {
    key,
    channelName,
    status,
    lastError: status === "error" || status === "timed_out" ? lastError : null,
    updatedAt: Date.now(),
  });
  emit();
}

export function clearRealtimeStatus(key: string) {
  if (state.delete(key)) emit();
}

export function getRealtimeHealth(): RealtimeChannelHealth[] {
  return Array.from(state.values());
}

export function subscribeRealtimeHealth(listener: Listener): () => void {
  listeners.add(listener);
  listener(Array.from(state.values()));
  return () => {
    listeners.delete(listener);
  };
}