import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Mail, ArrowLeft, Search, X, Edit3, Check, ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebarIcons } from "@/hooks/useSidebarIcons";
import FontAwesomeIconPicker from "@/components/admin/FontAwesomeIconPicker";
import { toast } from "sonner";
import { usePrefetchAdmin } from "@/hooks/usePrefetchAdmin";
import { ADMIN_NAV, ADMIN_NAV_FLAT, SIDEBAR_GROUPS_STORAGE_KEY, findNavItem, type AdminNavItem } from "@/lib/adminNav";

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const { icons, setIcon, getIcon, isSaving } = useSidebarIcons();
  const { prefetchRoute } = usePrefetchAdmin();

  // Collapsible groups w/ localStorage persistence
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(ADMIN_NAV.map((g) => [g.id, true]));
  });
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(openGroups)); } catch {}
  }, [openGroups]);

  // Keep group containing active route open.
  useEffect(() => {
    const match = findNavItem(location.pathname);
    if (match && !openGroups[match.groupId]) {
      setOpenGroups((s) => ({ ...s, [match.groupId]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return ADMIN_NAV_FLAT.filter((item) => {
      const hay = [item.title, item.groupLabel, ...(item.keywords || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery]);

  useEffect(() => { setActiveIdx(0); }, [searchQuery]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const handleIconSelect = useCallback(async (url: string, iconClass: string) => {
    const success = await setIcon(url, iconClass);
    if (success) {
      toast.success("Icon updated");
    } else {
      toast.error("Failed to update icon");
    }
    setEditingUrl(null);
  }, [setIcon]);

  const renderIcon = (item: AdminNavItem) => {
    const customIcon = getIcon(item.url);
    
    if (customIcon) {
      return <i className={`${customIcon} w-4 h-4`} />;
    }
    
    return <item.icon className="w-4 h-4" />;
  };

  const renderMenuItems = (items: AdminNavItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild>
            {editMode ? (
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  editingUrl === item.url && "ring-2 ring-primary"
                )}
                onClick={() => setEditingUrl(item.url)}
              >
                <FontAwesomeIconPicker
                  value={getIcon(item.url) || ""}
                  onChange={(iconClass) => handleIconSelect(item.url, iconClass)}
                  trigger={
                    <div className="relative group">
                      {renderIcon(item)}
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-2 h-2 text-primary-foreground" />
                      </div>
                    </div>
                  }
                />
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </div>
            ) : (
              <NavLink
                to={item.url}
                end={item.url === "/admin"}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive(item.url)
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onMouseEnter={() => prefetchRoute(item.url)}
                onFocus={() => prefetchRoute(item.url)}
              >
                {renderIcon(item)}
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </NavLink>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const handleSearchSelect = (url: string) => {
    setSearchQuery("");
    navigate(url);
  };

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredItems || filteredItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[activeIdx];
      if (item) handleSearchSelect(item.url);
    } else if (e.key === "Escape") {
      setSearchQuery("");
    }
  };

  const toggleGroup = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <p className="font-semibold text-foreground">Nullsto</p>
                <p className="text-xs text-muted-foreground">{t('adminPanel')}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              variant={editMode ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditMode(!editMode)}
              title={editMode ? "Done editing" : "Edit icons"}
            >
              {editMode ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Edit Mode Banner */}
        {!collapsed && editMode && (
          <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs text-primary text-center">
              Click any icon to change it
            </p>
          </div>
        )}

        {/* Search Box */}
        {!collapsed && !editMode && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search menu... (↑/↓/Enter)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              className="pl-9 pr-8 h-9 bg-secondary/50 border-border/50 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {filteredItems && filteredItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                  {filteredItems.map((item, idx) => (
                    <button
                      key={item.url}
                      onClick={() => handleSearchSelect(item.url)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-secondary/80 transition-colors",
                        isActive(item.url) && "bg-primary/10",
                        idx === activeIdx && "bg-secondary/80"
                      )}
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.groupLabel}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
              {filteredItems && filteredItems.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 p-3 text-center"
                >
                  <p className="text-sm text-muted-foreground">No results found</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-180px)]">
          {ADMIN_NAV.map((group) => {
            const isOpen = openGroups[group.id] !== false;
            return (
              <SidebarGroup key={group.id}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground"
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                ) : (
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                )}
                {(isOpen || collapsed) && (
                  <SidebarGroupContent>
                    {renderMenuItems(group.items)}
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start" asChild>
          <NavLink to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {!collapsed && <span>{t('backToSite')}</span>}
          </NavLink>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;