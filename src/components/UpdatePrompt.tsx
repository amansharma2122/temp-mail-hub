import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Listen for messages from service worker (version updates)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[UpdatePrompt] Service worker updated to version:', event.data.version);
        setUpdateVersion(event.data.version);
        // Auto-show toast for seamless updates
        toast.success('App updated!', {
          description: `Version ${event.data.version} installed`,
          duration: 3000,
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Listen for new service worker updates
    const handleControllerChange = () => {
      console.log('[UpdatePrompt] Service worker controller changed');
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates on mount
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
      
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              console.log('[UpdatePrompt] New version available');
              setShowPrompt(true);
            }
          });
        }
      });

      // Check immediately
      reg.update().catch(console.error);
    });

    // Periodic update checks (every 5 minutes)
    const interval = setInterval(() => {
      if (registration) {
        registration.update().catch(console.error);
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [registration]);

  const clearAllCaches = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log('[UpdatePrompt] All caches cleared');
        toast.success('Cache cleared successfully');
      }
    } catch (error) {
      console.error('[UpdatePrompt] Failed to clear caches:', error);
      toast.error('Failed to clear cache');
    }
  };

  const handleUpdate = async () => {
    // Clear all caches first
    await clearAllCaches();
    
    // Tell waiting service worker to skip waiting
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Also send message to any active service worker
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    
    // Hard reload to get fresh assets
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <div className="bg-card border border-primary/20 rounded-xl shadow-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20 shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">Update Available</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {updateVersion 
                    ? `Version ${updateVersion} is ready.` 
                    : 'A new version is ready.'
                  } Refresh to get the latest features.
                </p>
                
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" onClick={handleUpdate} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update Now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    Later
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdatePrompt;
