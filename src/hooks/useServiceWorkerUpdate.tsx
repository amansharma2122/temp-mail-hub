import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ServiceWorkerUpdate {
  version: string;
  message: string;
}

export const useServiceWorkerUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ServiceWorkerUpdate | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[App] Service worker updated to version:', event.data.version);
        setUpdateAvailable(true);
        setUpdateInfo({
          version: event.data.version,
          message: event.data.message,
        });
        
        // Show toast notification
        toast.success('App updated!', {
          description: 'A new version has been installed.',
          duration: 3000,
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for updates on page load
    navigator.serviceWorker.ready.then((registration) => {
      // Check for updates every 5 minutes
      const checkInterval = setInterval(() => {
        registration.update().catch(console.error);
      }, 5 * 60 * 1000);

      return () => clearInterval(checkInterval);
    });

    // Listen for new service worker installation
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is installed and waiting
            console.log('[App] New service worker installed, waiting to activate');
            setUpdateAvailable(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const clearAllCaches = async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[App] All caches cleared');
    }
  };

  const forceRefresh = async () => {
    await clearAllCaches();
    
    // Tell service worker to skip waiting if there's a new one
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    
    // Hard reload the page
    window.location.reload();
  };

  return {
    updateAvailable,
    updateInfo,
    clearAllCaches,
    forceRefresh,
  };
};
