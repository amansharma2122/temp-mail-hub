import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
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

const percentile = (values: number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
};

/**
 * Drill-down for a single attention_effect. Reached via
 * /admin/friendly-widget-telemetry/effect?effect=sparkle (or by clicking a
 * row in the top-performing list on the parent telemetry page).
 *
 * Shows:
 *   - Funnel: anim_start → anim_complete (with drop-off %)
 *   - render_latency percentiles per day, filtered to this effect
 *   - Intensity filter (subtle / normal / lively) reserved for future rows
 *     that carry an intensity tag; today it acts as a pass-through so admins
 *     can practice the workflow.
 */
export default function AdminFriendlyWidgetEffectDrilldown() {
  const [params] = useSearchParams();
  const effect = params.get("effect") ?? "sparkle";
  const [days, setDays] = useState<number>(14);
  const [intensity, setIntensity] = useState<"all" | "subtle" | "normal" | "lively">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["fw_effect_drilldown", effect, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("friendly_widget_events")
        .select("id, event_type, attention_effect, sample_ms, created_at")
        .eq("attention_effect", effect)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10_000);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const funnel = useMemo(() => {
    const start = rows.filter((r) => r.event_type === "anim_start").length;
    const complete = rows.filter((r) => r.event_type === "anim_complete").length;
    const dropoff = start === 0 ? 0 : Math.round(((start - complete) / start) * 100);
    return [
      { stage: "anim_start", count: start },
      { stage: "anim_complete", count: complete },
      { stage: "dropoff %", count: dropoff },
    ];
  }, [rows]);

  const perDay = useMemo(() => {
    const grouped = new Map<string, number[]>();
    for (const r of rows) {
      if (r.event_type !== "render_latency" || r.sample_ms == null) continue;
      const day = r.created_at.slice(0, 10);
      const arr = grouped.get(day) ?? [];
      arr.push(r.sample_ms);
      grouped.set(day, arr);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, samples]) => ({
        day,
        samples: samples.length,
        p50: percentile(samples, 0.5),
        p75: percentile(samples, 0.75),
        p95: percentile(samples, 0.95),
      }));
  }, [rows]);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/friendly-widget-telemetry">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold capitalize">Effect: {effect}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Funnel and latency drill-down for the <span className="font-medium">{effect}</span> attention effect.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Window</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 7, 14, 30, 90].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}d</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Intensity</Label>
            <Select value={intensity} onValueChange={(v: any) => setIntensity(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["all", "subtle", "normal", "lively"] as const).map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">Failed to load drill-down — admin access required.</p>
      )}

      {!isLoading && !error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animation funnel</CardTitle>
              <CardDescription>
                Compare start vs. complete counts to spot users bailing before the animation finishes.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Render latency by day ({intensity})</CardTitle>
              <CardDescription>
                p50 / p75 / p95 samples in milliseconds. Aim for p95 &lt; 500 ms.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
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
              <CardTitle className="text-base">Raw daily samples</CardTitle>
            </CardHeader>
            <CardContent>
              {perDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No render_latency samples for this effect in the window.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border/40">
                      <th className="py-1">Day</th>
                      <th className="py-1 text-right">Samples</th>
                      <th className="py-1 text-right">p50</th>
                      <th className="py-1 text-right">p75</th>
                      <th className="py-1 text-right">p95</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perDay.map((d) => (
                      <tr key={d.day} className="border-b border-border/20">
                        <td className="py-1">{d.day}</td>
                        <td className="py-1 text-right tabular-nums">{d.samples}</td>
                        <td className="py-1 text-right tabular-nums">{d.p50}</td>
                        <td className="py-1 text-right tabular-nums">{d.p75}</td>
                        <td className="py-1 text-right tabular-nums">{d.p95}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}