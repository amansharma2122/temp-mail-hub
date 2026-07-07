import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Gauge, Loader2, Save } from "lucide-react";

// Admin control for the friendly_widget_events rate-limit quota. The DB
// trigger `enforce_friendly_widget_event_quota` reads
// app_settings.rate_limit_friendly_widget_events at INSERT time, so changes
// take effect immediately without redeploys.
export default function FriendlyWidgetRateLimitSettings() {
  const [maxRequests, setMaxRequests] = useState<number>(120);
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "rate_limit_friendly_widget_events")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as { max_requests?: number; window_minutes?: number };
        if (typeof v.max_requests === "number") setMaxRequests(v.max_requests);
        if (typeof v.window_minutes === "number") setWindowMinutes(v.window_minutes);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (maxRequests < 1 || maxRequests > 100_000) {
      toast({ title: "Invalid quota", description: "Max requests must be between 1 and 100,000.", variant: "destructive" });
      return;
    }
    if (windowMinutes < 1 || windowMinutes > 1440) {
      toast({ title: "Invalid window", description: "Window must be between 1 and 1440 minutes.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "rate_limit_friendly_widget_events",
        value: { max_requests: maxRequests, window_minutes: windowMinutes },
      } as any,
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rate limit updated", description: `Max ${maxRequests} events / ${windowMinutes}m per session.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Widget event rate limit
        </CardTitle>
        <CardDescription>
          Controls the per-session quota enforced by the database trigger on
          <code className="mx-1">friendly_widget_events</code>. Applies immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fw-max">Max events per window</Label>
              <Input
                id="fw-max"
                type="number"
                min={1}
                max={100000}
                value={maxRequests}
                onChange={(e) => setMaxRequests(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fw-win">Window (minutes)</Label>
              <Input
                id="fw-win"
                type="number"
                min={1}
                max={1440}
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
              />
            </div>
          </div>
        )}
        <Button onClick={save} disabled={saving || loading} size="sm">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save rate limit"}
        </Button>
      </CardContent>
    </Card>
  );
}