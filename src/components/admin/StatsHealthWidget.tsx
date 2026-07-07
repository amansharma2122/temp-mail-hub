import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, HardDrive, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthRow {
  id: string;
  status: string;
  source: string;
  duration_ms: number | null;
  error_message: string | null;
  details: any;
  created_at: string;
}

interface MailboxRow {
  id: string;
  name: string;
  is_active: boolean;
  is_full: boolean;
  storage_bytes_used: number;
  storage_bytes_limit: number;
  is_primary: boolean;
  last_quota_check_at: string | null;
}

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const StatsHealthWidget = () => {
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const load = async () => {
    const [h, m] = await Promise.all([
      supabase
        .from("stats_health_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("mailboxes")
        .select("id,name,is_active,is_full,storage_bytes_used,storage_bytes_limit,is_primary,last_quota_check_at")
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true }),
    ]);
    setHealth((h.data as HealthRow[]) || []);
    setMailboxes((m.data as MailboxRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const reconcile = async () => {
    setReconciling(true);
    try {
      const [a, b] = await Promise.all([
        supabase.rpc("reconcile_email_stats"),
        supabase.rpc("reconcile_mailbox_storage"),
      ]);
      if (a.error || b.error) throw a.error || b.error;
      toast.success("Counters reconciled");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Reconciliation failed");
    } finally {
      setReconciling(false);
    }
  };

  const latest = health[0];
  const latestOk = latest?.status === "ok";

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Public stats & mailbox health
        </CardTitle>
        <Button size="sm" variant="outline" onClick={reconcile} disabled={reconciling}>
          <RefreshCw className={`w-3 h-3 mr-1 ${reconciling ? "animate-spin" : ""}`} />
          Reconcile now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">get-public-stats — last 10 runs</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : health.length === 0 ? (
            <div className="text-sm text-muted-foreground">No runs logged yet.</div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {latestOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="font-medium">Latest: {latest?.status}</span>
                <span className="text-xs text-muted-foreground">
                  {latest ? new Date(latest.created_at).toLocaleString() : ""}
                </span>
                {latest?.duration_ms != null && (
                  <Badge variant="outline" className="text-xs">{latest.duration_ms}ms</Badge>
                )}
              </div>
              {latest?.error_message && (
                <div className="text-xs text-destructive break-words">{latest.error_message}</div>
              )}
              <div className="flex gap-1 flex-wrap mt-2">
                {health.map((h) => (
                  <Badge
                    key={h.id}
                    variant={h.status === "ok" ? "default" : h.status === "partial" ? "secondary" : "destructive"}
                    className="text-[10px]"
                    title={`${new Date(h.created_at).toLocaleString()} — ${h.status}${h.error_message ? ": " + h.error_message : ""}`}
                  >
                    {h.status}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <HardDrive className="w-3 h-3" /> Mailbox storage (sequential failover kicks in when a mailbox is full)
          </div>
          {mailboxes.length === 0 ? (
            <div className="text-sm text-muted-foreground">No mailboxes configured.</div>
          ) : (
            <ul className="space-y-2">
              {mailboxes.map((m) => {
                const pct = m.storage_bytes_limit > 0
                  ? Math.min(100, (m.storage_bytes_used / m.storage_bytes_limit) * 100)
                  : 0;
                return (
                  <li key={m.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{m.name}</span>
                        {m.is_primary && <Badge variant="outline" className="text-[10px]">primary</Badge>}
                        {m.is_full && <Badge variant="destructive" className="text-[10px]">full</Badge>}
                        {!m.is_active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtBytes(m.storage_bytes_used)} / {fmtBytes(m.storage_bytes_limit)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsHealthWidget;