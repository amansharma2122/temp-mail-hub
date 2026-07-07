import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, HardDrive, RefreshCw, ExternalLink, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

interface CounterRow {
  stat_key: string;
  stat_value: number;
  stat_date: string | null;
  updated_at: string | null;
}

const COUNTER_LABELS: Record<string, string> = {
  emails_today_ist: "Emails today (IST)",
  total_emails_received: "Total emails received",
  total_inboxes_created: "Total inboxes created",
  total_emails_generated: "Total emails generated",
};

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const StatsHealthWidget = () => {
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [counters, setCounters] = useState<CounterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = async () => {
    const [h, m, c] = await Promise.all([
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
      supabase
        .from("email_stats")
        .select("stat_key, stat_value, stat_date, updated_at")
        .in("stat_key", Object.keys(COUNTER_LABELS)),
    ]);
    setHealth((h.data as HealthRow[]) || []);
    setMailboxes((m.data as MailboxRow[]) || []);
    setCounters((c.data as CounterRow[]) || []);
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

  const promote = async (id: string) => {
    setPromoting(id);
    try {
      const { error } = await supabase.rpc("promote_mailbox_as_primary", { p_mailbox_id: id });
      if (error) throw error;
      toast.success("Mailbox promoted to primary");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Promotion failed");
    } finally {
      setPromoting(null);
    }
  };

  const activePrimary = mailboxes.find((m) => m.is_primary);

  const latest = health[0];
  const latestOk = latest?.status === "ok";

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Public stats & mailbox health
        </CardTitle>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/stats-verification"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Verification page <ExternalLink className="w-3 h-3" />
          </Link>
          <Button size="sm" variant="outline" onClick={reconcile} disabled={reconciling}>
            <RefreshCw className={`w-3 h-3 mr-1 ${reconciling ? "animate-spin" : ""}`} />
            Reconcile now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs bg-muted/50 rounded px-3 py-2 flex items-center gap-2">
          <Star className="w-3 h-3 text-primary" />
          <span>
            Active polling mailbox:{" "}
            <span className="font-semibold">{activePrimary?.name || "— none —"}</span>
            {activePrimary?.is_full && (
              <Badge variant="destructive" className="ml-2 text-[10px]">full — failover pending</Badge>
            )}
          </span>
        </div>
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
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Counters &middot; last IST reset / update
          </div>
          {counters.length === 0 ? (
            <div className="text-sm text-muted-foreground">No counter data yet.</div>
          ) : (
            <ul className="text-sm divide-y divide-border/50">
              {Object.keys(COUNTER_LABELS).map((key) => {
                const c = counters.find((x) => x.stat_key === key);
                return (
                  <li key={key} className="flex items-center justify-between py-1.5 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{COUNTER_LABELS[key]}</div>
                      <div className="text-xs text-muted-foreground">
                        {key === "emails_today_ist"
                          ? `Resets daily at IST midnight${c?.stat_date ? ` · date: ${c.stat_date}` : ""}`
                          : "Monotonic (never resets)"}
                        {c?.updated_at && ` · updated ${new Date(c.updated_at).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="tabular-nums font-semibold">
                      {(c?.stat_value ?? 0).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
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
                        {m.is_primary && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                            active
                          </Badge>
                        )}
                        {m.is_full && <Badge variant="destructive" className="text-[10px]">full</Badge>}
                        {!m.is_active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {fmtBytes(m.storage_bytes_used)} / {fmtBytes(m.storage_bytes_limit)}
                        </span>
                        {!m.is_primary && m.is_active && !m.is_full && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            disabled={promoting === m.id}
                            onClick={() => promote(m.id)}
                          >
                            Set active
                          </Button>
                        )}
                      </div>
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