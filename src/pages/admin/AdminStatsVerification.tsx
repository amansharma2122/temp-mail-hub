import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CounterRow {
  stat_key: string;
  stat_value: number;
  stat_date: string | null;
  updated_at: string | null;
}

interface HealthRow {
  id: string;
  status: string;
  source: string;
  duration_ms: number | null;
  error_message: string | null;
  details: any;
  created_at: string;
}

const COUNTERS: { key: string; label: string; resets: boolean }[] = [
  { key: "emails_today_ist", label: "Emails today (IST)", resets: true },
  { key: "total_emails_received", label: "Total emails received", resets: false },
  { key: "total_inboxes_created", label: "Total inboxes created", resets: false },
  { key: "total_emails_generated", label: "Total emails generated", resets: false },
];

const istMidnightIso = () => {
  const now = new Date();
  // IST = UTC+5:30
  const istMs = now.getTime() + (5 * 60 + 30) * 60_000;
  const ist = new Date(istMs);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - (5 * 60 + 30) * 60_000);
};

const AdminStatsVerification = () => {
  const [counters, setCounters] = useState<CounterRow[]>([]);
  const [runs, setRuns] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const load = async () => {
    const [c, h] = await Promise.all([
      supabase
        .from("email_stats")
        .select("stat_key, stat_value, stat_date, updated_at")
        .in("stat_key", COUNTERS.map((x) => x.key)),
      supabase
        .from("stats_health_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    setCounters((c.data as CounterRow[]) || []);
    setRuns((h.data as HealthRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reconcile = async () => {
    setReconciling(true);
    try {
      const [a, b] = await Promise.all([
        supabase.rpc("reconcile_email_stats"),
        supabase.rpc("reconcile_mailbox_storage"),
      ]);
      if (a.error || b.error) throw a.error || b.error;
      toast.success("Reconciliation triggered");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Reconciliation failed");
    } finally {
      setReconciling(false);
    }
  };

  const lastIstMidnight = istMidnightIso();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Public stats verification</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last IST midnight was <span className="font-mono">{lastIstMidnight.toLocaleString()}</span>.
            Daily counters reset at that moment; monotonic counters never reset.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={reconcile} disabled={reconciling}>
          <RefreshCw className={`w-3 h-3 mr-1 ${reconciling ? "animate-spin" : ""}`} />
          Run reconciliation now
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Counters</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-4">Counter</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Last reset / update</th>
                    <th className="py-2 pr-4">Reset OK?</th>
                  </tr>
                </thead>
                <tbody>
                  {COUNTERS.map(({ key, label, resets }) => {
                    const c = counters.find((x) => x.stat_key === key);
                    const updated = c?.updated_at ? new Date(c.updated_at) : null;
                    let resetOk: boolean | null = null;
                    if (resets) {
                      // For daily counter: stat_date should equal today IST
                      const todayIst = new Date(Date.now() + (5 * 60 + 30) * 60_000)
                        .toISOString()
                        .slice(0, 10);
                      resetOk = c?.stat_date === todayIst;
                    }
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{label}</td>
                        <td className="py-2 pr-4 tabular-nums">{(c?.stat_value ?? 0).toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={resets ? "secondary" : "outline"} className="text-[10px]">
                            {resets ? "daily (IST)" : "monotonic"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {resets && c?.stat_date ? `date: ${c.stat_date} · ` : ""}
                          {updated ? updated.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {resetOk === null ? (
                            <span className="text-xs text-muted-foreground">n/a</span>
                          ) : resetOk ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                              <CheckCircle2 className="w-3 h-3" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="w-3 h-3" /> Stale
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent reconciliation runs</CardTitle>
          <Link to="/admin/audit-logs" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Full audit log <ExternalLink className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No runs logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-4 text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-xs font-mono">{r.source}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={r.status === "ok" ? "default" : r.status === "partial" ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-xs">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-lg">
                        {r.error_message ? (
                          <span className="text-destructive break-words">{r.error_message}</span>
                        ) : r.details ? (
                          <code className="text-[10px] break-all">{JSON.stringify(r.details)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatsVerification;