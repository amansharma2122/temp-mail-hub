import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLastObservedAppSettings, subscribeAllAppSettings } from "@/lib/appSettingsSync";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface AppSettingRow {
  key: string;
  version: number | null;
  updated_by: string | null;
  updated_at: string | null;
  value: unknown;
}

/**
 * Debug / audit view for admins. Shows the latest observed version,
 * updater and merge status for every `app_settings` key so admins can
 * quickly diagnose "did my change take effect?" issues.
 */
const AdminAppSettingsAudit = () => {
  const [rows, setRows] = useState<AppSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, force] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("key,value,updated_at,version,updated_by" as any)
      .order("updated_at", { ascending: false });
    setRows(((data as unknown) as AppSettingRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const off = subscribeAllAppSettings(() => {
      force((x) => x + 1);
      void load();
    });
    return off;
  }, []);

  const observed = new Map(getLastObservedAppSettings().map((c) => [c.key, c]));

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">App Settings Audit</h1>
          <p className="text-sm text-muted-foreground">
            Latest server version, updater, and last observed merge for every
            key — useful when a setting seems stuck or out of sync.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="divide-y">
        {rows.map((row) => {
          const obs = observed.get(row.key);
          return (
            <div key={row.key} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm truncate">{row.key}</div>
                <div className="text-xs text-muted-foreground truncate">
                  updated_by: {row.updated_by ?? "—"} · updated_at:{" "}
                  {row.updated_at ?? "—"}
                </div>
              </div>
              <Badge variant="secondary">v{row.version ?? "?"}</Badge>
              {obs?.merged != null && (
                <Badge variant={obs.merged ? "default" : "outline"}>
                  {obs.merged ? "merged" : "replaced"}
                </Badge>
              )}
              {obs?.emittedAt && (
                <Badge variant="outline" className="font-mono text-xs">
                  observed {new Date(obs.emittedAt).toLocaleTimeString()}
                </Badge>
              )}
            </div>
          );
        })}
        {!rows.length && !loading && (
          <div className="p-6 text-sm text-muted-foreground">No settings yet.</div>
        )}
      </Card>
    </div>
  );
};

export default AdminAppSettingsAudit;