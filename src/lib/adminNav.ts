import {
  LayoutDashboard, Users, Mail, Settings, Server, Shield, Megaphone, Activity,
  FileWarning, Palette, CreditCard, Newspaper, type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
  hidden?: boolean; // shown in breadcrumbs but not sidebar
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

// Consolidated sidebar: 6 groups. Legacy per-feature pages remain reachable at
// their original URLs and are exposed as `hidden: true` entries so breadcrumbs
// and command-palette search still find them.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard,
        keywords: ["home", "analytics", "deployment", "cache", "backup", "health"] },
    ],
  },
  {
    id: "users-access",
    label: "Users & Access",
    items: [
      { title: "Users", url: "/admin/hub/users", icon: Users,
        keywords: ["accounts", "admins", "roles", "approvals", "guests"] },
      { title: "Subscriptions", url: "/admin/hub/subscriptions", icon: CreditCard,
        keywords: ["plans", "pricing", "payments", "webhooks", "billing"] },
      { title: "Security", url: "/admin/hub/security", icon: Shield,
        keywords: ["ip", "geo", "captcha", "rate limits", "registration"] },
    ],
  },
  {
    id: "mail",
    label: "Mail",
    items: [
      { title: "Emails", url: "/admin/hub/emails", icon: Mail,
        keywords: ["inbox", "messages", "logs"] },
      { title: "Mail Servers", url: "/admin/hub/mail-servers", icon: Server,
        keywords: ["mailboxes", "imap", "smtp", "capacity", "setup"] },
      { title: "Email Rules", url: "/admin/hub/email-rules", icon: FileWarning,
        keywords: ["templates", "restrictions", "blocking"] },
      { title: "Domains", url: "/admin/hub/domains", icon: Mail,
        keywords: ["dns", "custom"] },
    ],
  },
  {
    id: "content-promo",
    label: "Content & Promo",
    items: [
      { title: "Content", url: "/admin/hub/content", icon: Newspaper,
        keywords: ["homepage", "pages", "blogs", "friendly"] },
      { title: "Promotions", url: "/admin/hub/promotions", icon: Megaphone,
        keywords: ["banners", "ads", "announcement"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { title: "Settings", url: "/admin/hub/settings", icon: Settings,
        keywords: ["general", "advanced", "overview", "api"] },
      { title: "Appearance", url: "/admin/hub/appearance", icon: Palette,
        keywords: ["themes", "seo", "languages"] },
      { title: "Automation", url: "/admin/hub/automation", icon: Server,
        keywords: ["cron", "alerts", "maintenance", "status"] },
      { title: "Stats Verification", url: "/admin/stats-verification", icon: Activity,
        keywords: ["counters", "ist", "reset", "reconcile", "health"] },
      { title: "Friendly Widget Preview", url: "/admin/friendly-widget-preview", icon: Palette,
        keywords: ["widget", "preview", "friendly", "sites"] },
      { title: "Friendly Widget Telemetry", url: "/admin/friendly-widget-telemetry", icon: Activity,
        keywords: ["widget", "telemetry", "analytics", "latency", "friendly"] },
      { title: "Logs", url: "/admin/hub/logs", icon: FileWarning,
        keywords: ["audit", "errors"] },
    ],
  },
];

// Hidden legacy entries — kept so old bookmarks still show a breadcrumb.
const LEGACY_ITEMS: AdminNavItem[] = [
  { title: "Analytics", url: "/admin/analytics", icon: LayoutDashboard, hidden: true },
  { title: "Deployment Health", url: "/admin/deployment-health", icon: Server, hidden: true },
  { title: "Cache", url: "/admin/cache", icon: Server, hidden: true },
  { title: "Backup", url: "/admin/backup", icon: Server, hidden: true },
  { title: "Users (legacy)", url: "/admin/users", icon: Users, hidden: true },
  { title: "Admins", url: "/admin/admins", icon: Shield, hidden: true },
  { title: "Role Approvals", url: "/admin/role-approvals", icon: Shield, hidden: true },
  { title: "User & Guest", url: "/admin/user-settings", icon: Users, hidden: true },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard, hidden: true },
  { title: "Pricing", url: "/admin/pricing", icon: CreditCard, hidden: true },
  { title: "Payments", url: "/admin/payments", icon: CreditCard, hidden: true },
  { title: "Webhooks", url: "/admin/webhooks", icon: CreditCard, hidden: true },
  { title: "IP Blocking", url: "/admin/ip-blocking", icon: Shield, hidden: true },
  { title: "Geo Blocking", url: "/admin/geo-blocking", icon: Shield, hidden: true },
  { title: "Registration IPs", url: "/admin/registration-ips", icon: Shield, hidden: true },
  { title: "Registration", url: "/admin/registration", icon: Shield, hidden: true },
  { title: "Captcha", url: "/admin/captcha", icon: Shield, hidden: true },
  { title: "Rate Limits", url: "/admin/rate-limits", icon: Shield, hidden: true },
  { title: "Emails (legacy)", url: "/admin/emails", icon: Mail, hidden: true },
  { title: "Email Logs", url: "/admin/email-logs", icon: Mail, hidden: true },
  { title: "Mailboxes", url: "/admin/mailboxes", icon: Server, hidden: true },
  { title: "Mailbox Health", url: "/admin/mailbox-health", icon: Server, hidden: true },
  { title: "IMAP", url: "/admin/imap", icon: Mail, hidden: true },
  { title: "SMTP", url: "/admin/smtp", icon: Mail, hidden: true },
  { title: "Email Setup", url: "/admin/email-setup", icon: Mail, hidden: true },
  { title: "Email Templates", url: "/admin/email-templates", icon: Mail, hidden: true },
  { title: "Email Restrictions", url: "/admin/email-restrictions", icon: Mail, hidden: true },
  { title: "Email Blocking", url: "/admin/email-blocking", icon: Mail, hidden: true },
  { title: "Domains (legacy)", url: "/admin/domains", icon: Mail, hidden: true },
  { title: "Custom Domains", url: "/admin/custom-domains", icon: Mail, hidden: true },
  { title: "Homepage", url: "/admin/homepage", icon: Newspaper, hidden: true },
  { title: "Pages", url: "/admin/pages", icon: Newspaper, hidden: true },
  { title: "Blogs", url: "/admin/blogs", icon: Newspaper, hidden: true },
  { title: "Blog Settings", url: "/admin/blog-settings", icon: Newspaper, hidden: true },
  { title: "Friendly Sites", url: "/admin/friendly-websites", icon: Newspaper, hidden: true },
  { title: "Banners", url: "/admin/banners", icon: Megaphone, hidden: true },
  { title: "Ads", url: "/admin/ads", icon: Megaphone, hidden: true },
  { title: "Announcement", url: "/admin/announcement", icon: Megaphone, hidden: true },
  { title: "General Settings", url: "/admin/general-settings", icon: Settings, hidden: true },
  { title: "Advanced", url: "/admin/advanced", icon: Settings, hidden: true },
  { title: "Settings Overview", url: "/admin/settings-overview", icon: Settings, hidden: true },
  { title: "API", url: "/admin/api", icon: Settings, hidden: true },
  { title: "Appearance", url: "/admin/appearance", icon: Palette, hidden: true },
  { title: "Themes", url: "/admin/themes", icon: Palette, hidden: true },
  { title: "SEO", url: "/admin/seo", icon: Palette, hidden: true },
  { title: "Languages", url: "/admin/languages", icon: Palette, hidden: true },
  { title: "Cron Jobs", url: "/admin/cron", icon: Server, hidden: true },
  { title: "Alerts", url: "/admin/alerts", icon: Server, hidden: true },
  { title: "Maintenance", url: "/admin/maintenance", icon: Server, hidden: true },
  { title: "Status Settings", url: "/admin/status-settings", icon: Server, hidden: true },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: FileWarning, hidden: true },
  { title: "Error Logs", url: "/admin/error-logs", icon: FileWarning, hidden: true },
];

export const ADMIN_NAV_FLAT: (AdminNavItem & { groupId: string; groupLabel: string })[] = [
  ...ADMIN_NAV.flatMap((g) =>
    g.items.map((it) => ({ ...it, groupId: g.id, groupLabel: g.label })),
  ),
  ...LEGACY_ITEMS.map((it) => ({ ...it, groupId: "legacy", groupLabel: "Legacy" })),
];

export function findNavItem(pathname: string) {
  // Prefer exact match, then longest prefix match.
  const exact = ADMIN_NAV_FLAT.find((i) => i.url === pathname);
  if (exact) return exact;
  const prefixed = ADMIN_NAV_FLAT
    .filter((i) => i.url !== "/admin" && pathname.startsWith(i.url))
    .sort((a, b) => b.url.length - a.url.length)[0];
  return prefixed || null;
}

export const SIDEBAR_GROUPS_STORAGE_KEY = "santhoshi_admin_sidebar_groups";