import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuotaRow {
  id: string;
  name: string;
  is_primary: boolean;
  is_full: boolean;
  storage_bytes_used: number;
  storage_bytes_limit: number;
  percent_used: number;
  recommended_action: string;
  suggested_rotate_at: string | null;
}

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const MailboxQuotaAlerts = () => {
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_mailboxes_nearing_quota", {
      p_threshold_pct: 90,
    });
    if (!error) setRows((data as QuotaRow[]) || []);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  const promote = async (id: string) => {
    setPromoting(id);
    try {
      const { error } = await supabase.rpc("promote_mailbox_as_primary", { p_mailbox_id: id });
      if (error) throw error;
      toast.success("Mailbox promoted to active");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Promotion failed");
    } finally {
      setPromoting(null);
    }
  };

  if (rows.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/10 text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        {rows.length} mailbox{rows.length > 1 ? "es" : ""} approaching 10&nbsp;GB quota
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{r.name}</span>
                  {r.is_primary && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                      <Star className="w-2.5 h-2.5 mr-0.5" /> active
                    </Badge>
                  )}
                  {r.is_full && <Badge variant="destructive" className="text-[10px]">full</Badge>}
                  <Badge variant="outline" className="text-[10px]">
                    {r.percent_used.toFixed(1)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {fmtBytes(r.storage_bytes_used)} / {fmtBytes(r.storage_bytes_limit)} ·{" "}
                  <span className="text-foreground">{r.recommended_action}</span>
                  {r.suggested_rotate_at && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Clock className="w-3 h-3" />
                      rotate by {new Date(r.suggested_rotate_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              {!r.is_primary && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={promoting === r.id || r.is_full}
                  onClick={() => promote(r.id)}
                >
                  Promote as active
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

export default MailboxQuotaAlerts;