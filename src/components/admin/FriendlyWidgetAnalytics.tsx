import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";

type Row = {
  event_type: string;
  attention_effect: string;
  website_id: string | null;
  website_name: string | null;
  event_count: number;
};

// Small admin view over the friendly-widget analytics table. Read via the
// admin-only RPC so no raw event rows leak to the client.
export default function FriendlyWidgetAnalytics({ days = 30 }: { days?: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["friendly_widget_stats", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_friendly_widget_stats" as any, { p_days: days });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const total = (t: string) =>
    (data ?? []).filter(r => r.event_type === t).reduce((n, r) => n + Number(r.event_count || 0), 0);

  const perEffect = new Map<string, number>();
  (data ?? []).filter(r => r.event_type === "click").forEach(r => {
    perEffect.set(r.attention_effect, (perEffect.get(r.attention_effect) ?? 0) + Number(r.event_count || 0));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Widget Analytics (last {days}d)
        </CardTitle>
        <CardDescription>
          Manual opens, auto-opens, and clicks so you can tune attention effects safely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">Failed to load analytics.</p>
        )}
        {!isLoading && !error && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(["manual_open","auto_open","click","badge_shown"] as const).map((t) => (
                <div key={t} className="p-3 rounded-lg border bg-card">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.replace("_"," ")}</p>
                  <p className="text-2xl font-semibold">{total(t)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Clicks by attention effect</p>
              {perEffect.size === 0 ? (
                <p className="text-xs text-muted-foreground">No clicks recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {[...perEffect.entries()].sort((a,b) => b[1]-a[1]).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{k}</span>
                      <span className="tabular-nums text-muted-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Top clicked sites</p>
              {(data ?? []).filter(r => r.event_type === "click" && r.website_name).length === 0 ? (
                <p className="text-xs text-muted-foreground">No site clicks recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {(data ?? [])
                    .filter(r => r.event_type === "click" && r.website_name)
                    .sort((a,b) => Number(b.event_count) - Number(a.event_count))
                    .slice(0, 5)
                    .map((r) => (
                      <div key={`${r.website_id}-${r.attention_effect}`} className="flex items-center justify-between text-sm">
                        <span className="truncate">{r.website_name}</span>
                        <span className="tabular-nums text-muted-foreground">{r.event_count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}