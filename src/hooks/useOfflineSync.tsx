import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface OfflineState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  pendingSync: number;
}

export const useOfflineSync = () => {
  const { toast } = useToast();
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isServiceWorkerReady: false,
    pendingSync: 0,
  });

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      toast({
        title: "You're back online",
        description: "Syncing your data...",
      });
      
      // Trigger background sync
      if ("serviceWorker" in navigator && "sync" in window.SyncManager.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register("sync-emails");
        });
      }
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
      toast({
        title: "You're offline",
        description: "Some features may be limited.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  // Check service worker status
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setState((prev) => ({ ...prev, isServiceWorkerReady: true }));
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "SYNC_EMAILS") {
          // Trigger refetch in the app
          window.dispatchEvent(new CustomEvent("sync-emails"));
        }
        if (event.data.type === "SYNC_SAVED_EMAILS") {
          window.dispatchEvent(new CustomEvent("sync-saved-emails"));
        }
      });
    }
  }, []);

  // Cache emails for offline access
  const cacheEmailsForOffline = useCallback((emails: unknown[]) => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CACHE_EMAILS",
        emails,
      });
    }
  }, []);

  // Clear all caches
  const clearCache = useCallback(async () => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CLEAR_CACHE",
      });
    }
    
    // Also clear via Cache API directly
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    
    toast({
      title: "Cache cleared",
      description: "All cached data has been removed.",
    });
  }, [toast]);

  // Request background sync
  const requestSync = useCallback(async (tag: string) => {
    if ("serviceWorker" in navigator && "sync" in window.SyncManager.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(tag);
        setState((prev) => ({ ...prev, pendingSync: prev.pendingSync + 1 }));
      } catch (error) {
        console.error("Background sync registration failed:", error);
      }
    }
  }, []);

  // Skip waiting for new service worker
  const updateServiceWorker = useCallback(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SKIP_WAITING",
      });
      window.location.reload();
    }
  }, []);

  return {
    ...state,
    cacheEmailsForOffline,
    clearCache,
    requestSync,
    updateServiceWorker,
  };
};

// Extend Window interface for SyncManager
declare global {
  interface Window {
    SyncManager: {
      prototype: SyncManager;
    };
  }
  
  interface SyncManager {
    register(tag: string): Promise<void>;
  }
  
  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }
}
