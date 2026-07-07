import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "banner_cache_ttl_minutes";
const DEFAULT_TTL = 24 * 60; // 24h

const BannerCacheSettings = () => {
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      const v = (data?.value as { minutes?: number } | null)?.minutes;
      if (typeof v === "number" && v > 0) setTtl(v);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const value = { minutes: Math.max(1, Math.floor(ttl)) };
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: KEY, value }, { onConflict: "key" });
      if (error) throw error;
      toast.success("Banner cache TTL saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banner cache</CardTitle>
        <CardDescription>
          How long visitors' browsers should keep the last known banners when both realtime and
          polling are failing. Applied on the next page load.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="banner-ttl">Cache TTL (minutes)</Label>
          <Input
            id="banner-ttl"
            type="number"
            min={1}
            value={loading ? "" : ttl}
            onChange={(e) => setTtl(Number(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">Default is 1440 (24 hours).</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || loading || ttl <= 0}>
          <Save className="w-3 h-3 mr-1" /> Save
        </Button>
      </CardContent>
    </Card>
  );
};

export default BannerCacheSettings;