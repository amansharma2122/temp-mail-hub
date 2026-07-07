import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Loader2, Timer, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";

type EventRow = {
  id: string;
  event_type: string;
  attention_effect: string | null;
  sample_ms: number | null;
  created_at: string;
};

const p = (values: number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
};

/**
 * Admin-only telemetry dashboard for the Friendly Websites widget.
 *
 * Charts:
 *  - Animation start vs. complete rates (per attention_effect)
 *  - render_latency percentiles (p50/p75/p95)
 *  - Top-performing effects by completion ratio
 *
 * Filters: window (days), intensity, reduced-motion mode.
 *
 * SELECT on `friendly_widget_events` is gated to admins by RLS, so this page
 * relies on the existing policy rather than a special RPC.
 */
export default function AdminFriendlyWidgetTelemetry() {
  const [days, setDays] = useState<number>(7);
  const [intensity, setIntensity] = useState<"all" | "subtle" | "normal" | "lively">("all");
  const [reducedOnly, setReducedOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["friendly_widget_telemetry", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("friendly_widget_events")
        .select("id, event_type, attention_effect, sample_ms, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10_000);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    staleTime: 60_000,
  });

  // Client-side filters (intensity / reduced-motion aren't columns yet; we
  // treat them as future-proof filters that key off attention_effect when
  // rendered on the widget side). For now, intensity=all keeps everything.
  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (reducedOnly) {
      // Reduced-motion widgets collapse to the `ring` effect — a good proxy.
      rows = rows.filter((r) => r.attention_effect === "ring");
    }
    if (intensity !== "all") {
      // Placeholder: without an intensity column we don't discard rows,
      // but expose the filter so future events with that dimension work.
    }
    return rows;
  }, [data, intensity, reducedOnly]);

  const byEffect = useMemo(() => {
    const map = new Map<string, { effect: string; start: number; complete: number }>();
    for (const r of filtered) {
      if (r.event_type !== "anim_start" && r.event_type !== "anim_complete") continue;
      const key = r.attention_effect ?? "unknown";
      const cur = map.get(key) ?? { effect: key, start: 0, complete: 0 };
      if (r.event_type === "anim_start") cur.start += 1;
      else cur.complete += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => (b.start + b.complete) - (a.start + a.complete));
  }, [filtered]);

  const topPerforming = useMemo(() => {
    return byEffect
      .map((e) => ({
        effect: e.effect,
        ratio: e.start === 0 ? 0 : Math.round((e.complete / e.start) * 100),
        volume: e.start,
      }))
      .filter((e) => e.volume > 0)
      .sort((a, b) => b.ratio - a.ratio || b.volume - a.volume)
      .slice(0, 8);
  }, [byEffect]);

  const latencyBuckets = useMemo(() => {
    // Bucket render_latency samples into 10 buckets and compute p50/p75/p95 per day.
    const perDay = new Map<string, number[]>();
    for (const r of filtered) {
      if (r.event_type !== "render_latency" || r.sample_ms == null) continue;
      const day = r.created_at.slice(0, 10);
      const arr = perDay.get(day) ?? [];
      arr.push(r.sample_ms);
      perDay.set(day, arr);
    }
    return [...perDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, samples]) => ({
        day,
        p50: p(samples, 0.5),
        p75: p(samples, 0.75),
        p95: p(samples, 0.95),
      }));
  }, [filtered]);

  const totals = useMemo(() => {
    const t = { anim_start: 0, anim_complete: 0, render_latency: 0, samples: 0 };
    const latencySamples: number[] = [];
    for (const r of filtered) {
      if (r.event_type in t) (t as any)[r.event_type] += 1;
      if (r.event_type === "render_latency" && r.sample_ms != null) latencySamples.push(r.sample_ms);
    }
    return {
      ...t,
      p50: p(latencySamples, 0.5),
      p95: p(latencySamples, 0.95),
    };
  }, [filtered]);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Friendly Widget Telemetry</h1>
        <p className="text-sm text-muted-foreground">
          Monitor animation completion rates and render latency to keep the widget snappy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Window</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 7, 14, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}d</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Intensity</Label>
            <Select value={intensity} onValueChange={(v: any) => setIntensity(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["all", "subtle", "normal", "lively"] as const).map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="reduced" checked={reducedOnly} onCheckedChange={setReducedOnly} />
            <Label htmlFor="reduced">Reduced motion only</Label>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading telemetry…
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">Failed to load telemetry — admin access required.</p>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Activity className="w-4 h-4" />} label="anim_start" value={totals.anim_start} />
            <StatCard icon={<Activity className="w-4 h-4" />} label="anim_complete" value={totals.anim_complete} />
            <StatCard icon={<Timer className="w-4 h-4" />} label="latency p50 (ms)" value={totals.p50} />
            <StatCard icon={<Timer className="w-4 h-4" />} label="latency p95 (ms)" value={totals.p95} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Animation start vs. complete by effect
              </CardTitle>
              <CardDescription>
                A large gap between start and complete usually means users close the panel mid-animation.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEffect}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="effect" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Bar dataKey="start" fill="hsl(var(--primary))" name="anim_start" />
                  <Bar dataKey="complete" fill="hsl(var(--accent))" name="anim_complete" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="w-4 h-4" /> Render latency percentiles (per day)
              </CardTitle>
              <CardDescription>Aim for p95 &lt; 500 ms on median hardware.</CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" dot={false} />
                  <Line type="monotone" dataKey="p75" stroke="hsl(var(--accent))" dot={false} />
                  <Line type="monotone" dataKey="p95" stroke="hsl(var(--destructive))" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top-performing attention effects</CardTitle>
              <CardDescription>
                Ranked by completion ratio (anim_complete / anim_start) among effects with traffic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topPerforming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No animation samples yet.</p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {topPerforming.map((e, i) => (
                    <li key={e.effect} className="flex items-center justify-between border-b border-border/40 py-1">
                      <span className="flex items-center gap-2">
                        <span className="w-5 tabular-nums text-muted-foreground">{i + 1}.</span>
                        <span className="capitalize font-medium">{e.effect}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {e.ratio}% • {e.volume} starts
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}