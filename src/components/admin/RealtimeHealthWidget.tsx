import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  subscribeRealtimeHealth,
  type RealtimeChannelHealth,
} from "@/lib/realtimeHealth";

const statusMeta: Record<
  RealtimeChannelHealth["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  subscribing: { label: "Connecting", variant: "secondary", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  subscribed: { label: "Live", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  error: { label: "Error", variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
  timed_out: { label: "Timed out", variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
  closed: { label: "Closed", variant: "outline", icon: <AlertCircle className="w-3 h-3" /> },
};

const RealtimeHealthWidget = () => {
  const [items, setItems] = useState<RealtimeChannelHealth[]>([]);

  useEffect(() => subscribeRealtimeHealth(setItems), []);

  const healthy = items.filter((i) => i.status === "subscribed").length;
  const failing = items.filter((i) => i.status === "error" || i.status === "timed_out").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Realtime Subscriptions
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {healthy} live · {failing} failing · {items.length} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active realtime channels.</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {items.map((it) => {
              const meta = statusMeta[it.status];
              return (
                <li
                  key={it.key}
                  className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{it.key}</div>
                    <div className="text-xs text-muted-foreground truncate">{it.channelName}</div>
                    {it.lastError && (
                      <div className="text-xs text-destructive mt-1 break-words">{it.lastError}</div>
                    )}
                  </div>
                  <Badge variant={meta.variant} className="flex items-center gap-1 shrink-0">
                    {meta.icon}
                    {meta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeHealthWidget;