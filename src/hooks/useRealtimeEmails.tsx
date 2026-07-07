import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { NewEmailToast } from "@/components/NewEmailToast";
import {
  getNewEmailNotificationStyle,
  getNewEmailNotificationStyleSync,
  getNewEmailSoundAdminEnabled,
  getNewEmailSoundAdminEnabledSync,
} from "@/lib/newEmailNotificationStyle";
import { reportRealtimeLatency, type RumSurface } from "@/lib/realtimeEmailRum";

// ---------------------------------------------------------------------------
// Module-level subscription registry.
// Guarantees ONE realtime channel per tempEmailId across the whole app —
// even if multiple components mount `useRealtimeEmails` for the same mailbox
// or React StrictMode double-invokes the effect in development.
// ---------------------------------------------------------------------------
type Listener = (payload: any) => void;
interface Entry {
  channel: ReturnType<typeof api.realtime.channel>;
  listeners: Set<Listener>;
  refCount: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}
const registry = new Map<string, Entry>();

function subscribe(tempEmailId: string, listener: Listener): () => void {
  let entry = registry.get(tempEmailId);
  if (!entry) {
    console.log('[useRealtimeEmails] Opening shared channel for', tempEmailId);
    const listeners = new Set<Listener>();
    const channel = api.realtime
      .channel(`received-emails-${tempEmailId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT' as const,
          schema: 'public',
          table: 'received_emails',
          filter: `temp_email_id=eq.${tempEmailId}`,
        },
        (payload) => {
          listeners.forEach((fn) => {
            try { fn(payload); }
            catch (e) { console.warn('[useRealtimeEmails] listener error', e); }
          });
        },
      );
    channel.subscribe((status, err) => {
      console.log('[useRealtimeEmails] Subscription status:', status, err ?? '');
    });
    entry = { channel, listeners, refCount: 0, disposeTimer: null };
    registry.set(tempEmailId, entry);
  }
  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }
  entry.listeners.add(listener);
  entry.refCount += 1;

  return () => {
    const current = registry.get(tempEmailId);
    if (!current) return;
    current.listeners.delete(listener);
    current.refCount -= 1;
    if (current.refCount <= 0) {
      // Defer teardown briefly so StrictMode remounts don't churn the channel.
      current.disposeTimer = setTimeout(() => {
        console.log('[useRealtimeEmails] Removing shared channel for', tempEmailId);
        api.realtime.removeChannel(current.channel);
        registry.delete(tempEmailId);
      }, 250);
    }
  };
}

interface ReceivedEmail {
  id: string;
  from_address: string;
  subject: string | null;
  body: string | null;
  is_read: boolean;
  received_at: string;
  temp_email_id: string;
}

interface UseRealtimeEmailsOptions {
  tempEmailId?: string;
  onNewEmail?: (email: ReceivedEmail) => void;
  showToast?: boolean;
  playSoundCallback?: () => void; // Accept sound callback from parent
  enablePushNotifications?: boolean;
  /** RUM surface tag — defaults to "inbox". Admin dashboards pass "admin". */
  rumSurface?: RumSurface;
}

export const useRealtimeEmails = (options: UseRealtimeEmailsOptions = {}) => {
  const {
    tempEmailId,
    onNewEmail,
    showToast = true,
    playSoundCallback,
    enablePushNotifications = true,
    rumSurface = "inbox",
  } = options;
  const [newEmailCount, setNewEmailCount] = useState(0);
  const [lastEmail, setLastEmail] = useState<ReceivedEmail | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // Keep the latest callback references in refs so the subscription effect
  // depends only on `tempEmailId`. Prevents the "subscribe/unsubscribe on
  // every parent render" bug that produces duplicate handlers and log spam.
  const onNewEmailRef = useRef(onNewEmail);
  const playSoundRef = useRef(playSoundCallback);
  const showToastRef = useRef(showToast);
  const enablePushRef = useRef(enablePushNotifications);
  const pushPermissionRef = useRef(pushPermission);
  useEffect(() => { onNewEmailRef.current = onNewEmail; }, [onNewEmail]);
  useEffect(() => { playSoundRef.current = playSoundCallback; }, [playSoundCallback]);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);
  useEffect(() => { enablePushRef.current = enablePushNotifications; }, [enablePushNotifications]);
  useEffect(() => { pushPermissionRef.current = pushPermission; }, [pushPermission]);
  const rumSurfaceRef = useRef<RumSurface>(rumSurface);
  useEffect(() => { rumSurfaceRef.current = rumSurface; }, [rumSurface]);

  // Check push notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const isInIframe = useCallback(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    // Browsers commonly block permission prompts inside embedded previews/iframes.
    if (isInIframe()) {
      toast.error('Push notifications can\'t be enabled in the embedded preview. Open the app in a new tab to enable.');
      return false;
    }

    if (Notification.permission === 'denied') {
      setPushPermission('denied');
      toast.error('Notification permission is blocked in your browser settings for this site.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        toast.success('Push notifications enabled!');
        return true;
      }

      if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable it in your browser settings.');
        return false;
      }

      toast.info('Notification permission dismissed');
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [isInIframe]);

  const showPushNotification = useCallback((email: ReceivedEmail) => {
    if (!enablePushRef.current || pushPermissionRef.current !== "granted") return;

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("New Email Received!", {
            body: `From: ${email.from_address}\n${email.subject || "(No Subject)"}`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: `email-${email.id}`,
            requireInteraction: false,
            data: { emailId: email.id },
          });
        });
      } else {
        new Notification("New Email Received!", {
          body: `From: ${email.from_address}\n${email.subject || "(No Subject)"}`,
          icon: "/favicon.ico",
          tag: `email-${email.id}`,
        });
      }
    } catch (error) {
      console.log("Could not show push notification:", error);
    }
  }, []);

  useEffect(() => {
    if (!tempEmailId) {
      console.log('[useRealtimeEmails] No tempEmailId, skipping subscription');
      return;
    }
    const unsubscribe = subscribe(tempEmailId, (payload) => {
      const newEmail = payload.new as ReceivedEmail;
      // RUM: end-to-end realtime latency from server received_at to client.
      reportRealtimeLatency(rumSurfaceRef.current, tempEmailId, newEmail.received_at);
      setNewEmailCount((prev) => prev + 1);
      setLastEmail(newEmail);

      if (onNewEmailRef.current) {
        requestAnimationFrame(() => onNewEmailRef.current?.(newEmail));
      }

      if (showToastRef.current) {
        const style = getNewEmailNotificationStyleSync();
        toast.custom(
          (t) => (
            <NewEmailToast
              from={newEmail.from_address}
              subject={newEmail.subject || ""}
              style={style}
              onClose={() => toast.dismiss(t)}
            />
          ),
          { duration: 5000 },
        );
        void getNewEmailNotificationStyle();
      }

      if (playSoundRef.current && getNewEmailSoundAdminEnabledSync()) {
        playSoundRef.current();
      }
      void getNewEmailSoundAdminEnabled();

      if (document.hidden) {
        showPushNotification(newEmail);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempEmailId]);

  const resetCount = useCallback(() => {
    setNewEmailCount(0);
  }, []);

  return {
    newEmailCount,
    lastEmail,
    resetCount,
    pushPermission,
    requestPushPermission,
  };
};

export default useRealtimeEmails;
