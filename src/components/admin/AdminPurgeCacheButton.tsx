import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const AdminPurgeCacheButton = () => {
  const [busy, setBusy] = useState(false);

  const purge = async () => {
    setBusy(true);
    try {
      // Preserve auth session keys so the admin isn't logged out.
      const preserve: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-") || k.includes("auth-token")) {
          preserve[k] = localStorage.getItem(k) || "";
        }
      }
      localStorage.clear();
      Object.entries(preserve).forEach(([k, v]) => localStorage.setItem(k, v));
      sessionStorage.clear();

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      toast.success("Cache purged. Reloading...");
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      console.error("[purge-cache]", e);
      toast.error("Failed to purge cache");
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          <span className="hidden sm:inline">Purge cache</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Purge browser cache?</AlertDialogTitle>
          <AlertDialogDescription>
            Clears localStorage (auth preserved), sessionStorage, cache storage,
            and unregisters the service worker, then hard-reloads the page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={purge}>Purge & reload</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminPurgeCacheButton;