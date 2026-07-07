import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveAppSetting } from "@/lib/appSettingsSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Gauge, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PerEffect = Record<string, { max_requests: number; window_minutes: number }>;

const ATTENTION_EFFECTS = [
  'pulse','glow','wiggle','bounce','ring','sparkle',
  'confetti','ripple','rainbow','magnet',
];

// Admin control for the friendly_widget_events rate-limit quota. The DB
// trigger `enforce_friendly_widget_event_quota` reads
// app_settings.rate_limit_friendly_widget_events at INSERT time, so changes
// take effect immediately without redeploys.
export default function FriendlyWidgetRateLimitSettings() {
  const [maxRequests, setMaxRequests] = useState<number>(120);
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [perEffect, setPerEffect] = useState<PerEffect>({});
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
        const v = data.value as {
          max_requests?: number;
          window_minutes?: number;
          per_effect?: PerEffect;
        };
        if (typeof v.max_requests === "number") setMaxRequests(v.max_requests);
        if (typeof v.window_minutes === "number") setWindowMinutes(v.window_minutes);
        if (v.per_effect && typeof v.per_effect === "object") setPerEffect(v.per_effect);
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
        value: {
          max_requests: maxRequests,
          window_minutes: windowMinutes,
          per_effect: perEffect,
        },
      } as any,
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    const overrides = Object.keys(perEffect).length;
    toast({
      title: "Rate limit updated",
      description: `Default: ${maxRequests}/${windowMinutes}m • ${overrides} per-effect override${overrides === 1 ? '' : 's'}.`,
    });
  };

  const addOverride = () => {
    const unused = ATTENTION_EFFECTS.find((e) => !(e in perEffect));
    if (!unused) return;
    setPerEffect({
      ...perEffect,
      [unused]: { max_requests: 60, window_minutes: 60 },
    });
  };
  const removeOverride = (effect: string) => {
    const next = { ...perEffect };
    delete next[effect];
    setPerEffect(next);
  };
  const renameOverride = (from: string, to: string) => {
    if (from === to || to in perEffect) return;
    const next = { ...perEffect };
    next[to] = next[from];
    delete next[from];
    setPerEffect(next);
  };
  const updateOverride = (
    effect: string,
    field: 'max_requests' | 'window_minutes',
    value: number,
  ) => {
    setPerEffect({
      ...perEffect,
      [effect]: { ...perEffect[effect], [field]: value },
    });
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

        {/* Per-attention_effect overrides */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Per-effect overrides</Label>
              <p className="text-xs text-muted-foreground">
                Cap noisy effects independently. Absent effects fall back to the default above.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOverride}
              disabled={Object.keys(perEffect).length >= ATTENTION_EFFECTS.length}
            >
              <Plus className="w-4 h-4 mr-1" /> Add override
            </Button>
          </div>
          {Object.entries(perEffect).length === 0 && (
            <p className="text-xs text-muted-foreground italic">No per-effect overrides configured.</p>
          )}
          {Object.entries(perEffect).map(([effect, cfg]) => (
            <div key={effect} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
              <div className="space-y-1">
                <Label className="text-xs">Effect</Label>
                <Select value={effect} onValueChange={(v) => renameOverride(effect, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATTENTION_EFFECTS.map((e) => (
                      <SelectItem key={e} value={e} disabled={e !== effect && e in perEffect}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max events</Label>
                <Input
                  type="number" min={1} max={100000}
                  value={cfg.max_requests}
                  onChange={(e) => updateOverride(effect, 'max_requests', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Window (min)</Label>
                <Input
                  type="number" min={1} max={1440}
                  value={cfg.window_minutes}
                  onChange={(e) => updateOverride(effect, 'window_minutes', Number(e.target.value))}
                />
              </div>
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => removeOverride(effect)}
                aria-label={`Remove ${effect} override`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}