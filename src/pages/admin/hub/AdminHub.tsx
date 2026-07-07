import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface HubTab {
  value: string;
  label: string;
  element: React.ReactNode;
}

interface AdminHubProps {
  title: string;
  description?: string;
  tabs: HubTab[];
  defaultTab?: string;
}

/**
 * Generic tabbed shell for consolidating multiple legacy admin pages
 * under a single sidebar entry. The active tab is persisted in the URL
 * query string (?tab=...) so deep-links keep working.
 */
const AdminHub = ({ title, description, tabs, defaultTab }: AdminHubProps) => {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(
    () => params.get("tab") || defaultTab || tabs[0]?.value,
    [params, defaultTab, tabs],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <Tabs
        value={initial}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            {t.element}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminHub;