import {
  LayoutDashboard, Users, Globe, Mail, Settings, FileText, Palette, Newspaper,
  Link as LinkIcon, Cog, Paintbrush, Shield, Search, Languages, Megaphone,
  ShieldCheck, Key, Clock, Database, MailOpen, UserCog, BarChart3, Wand2,
  LayoutList, CreditCard, Crown, Ban, FileWarning, Activity, Bell, HardDrive,
  Heart, DollarSign, Wrench, Rocket, Server, Lock, Zap, type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

// Single source of truth for admin sidebar, breadcrumbs, and search.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard, keywords: ["home", "overview"] },
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3, keywords: ["stats", "metrics"] },
    ],
  },
  {
    id: "users-subs",
    label: "Users & Subscriptions",
    items: [
      { title: "Users", url: "/admin/users", icon: Users, keywords: ["accounts", "members"] },
      { title: "Admins", url: "/admin/admins", icon: Shield, keywords: ["staff", "roles"] },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: Crown, keywords: ["plans", "billing"] },
      { title: "Pricing", url: "/admin/pricing", icon: DollarSign, keywords: ["tiers", "cost"] },
      { title: "Role Approvals", url: "/admin/role-approvals", icon: ShieldCheck, keywords: ["requests"] },
      { title: "User & Guest", url: "/admin/user-settings", icon: UserCog, keywords: ["defaults"] },
    ],
  },
  {
    id: "emails-mail",
    label: "Emails & Mail Servers",
    items: [
      { title: "Emails", url: "/admin/emails", icon: Mail, keywords: ["inbox", "messages"] },
      { title: "Mailboxes", url: "/admin/mailboxes", icon: Mail, keywords: ["accounts"] },
      { title: "Mailbox Health", url: "/admin/mailbox-health", icon: Activity, keywords: ["capacity", "status"] },
      { title: "IMAP", url: "/admin/imap", icon: MailOpen, keywords: ["fetch", "receive"] },
      { title: "SMTP", url: "/admin/smtp", icon: Cog, keywords: ["send", "outgoing"] },
      { title: "Email Setup", url: "/admin/email-setup", icon: Wand2, keywords: ["wizard"] },
      { title: "Email Templates", url: "/admin/email-templates", icon: MailOpen, keywords: ["messages"] },
      { title: "Email Restrictions", url: "/admin/email-restrictions", icon: Ban, keywords: ["blocks"] },
      { title: "Email Blocking", url: "/admin/email-blocking", icon: Ban, keywords: ["deny"] },
      { title: "Email Logs", url: "/admin/email-logs", icon: FileWarning, keywords: ["history"] },
      { title: "Domains", url: "/admin/domains", icon: Globe, keywords: ["hosts"] },
      { title: "Custom Domains", url: "/admin/custom-domains", icon: LinkIcon, keywords: ["dns"] },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { title: "Homepage", url: "/admin/homepage", icon: LayoutDashboard, keywords: ["landing"] },
      { title: "Blogs", url: "/admin/blogs", icon: Newspaper, keywords: ["posts", "articles"] },
      { title: "Blog Settings", url: "/admin/blog-settings", icon: Newspaper, keywords: ["config"] },
      { title: "Pages", url: "/admin/pages", icon: FileText, keywords: ["static"] },
      { title: "Friendly Sites", url: "/admin/friendly-websites", icon: Heart, keywords: ["partners", "links"] },
      { title: "Banners", url: "/admin/banners", icon: Megaphone, keywords: ["promo"] },
      { title: "Ads", url: "/admin/ads", icon: Megaphone, keywords: ["advertising"] },
      { title: "Announcement", url: "/admin/announcement", icon: Megaphone, keywords: ["notice"] },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    items: [
      { title: "Payments", url: "/admin/payments", icon: CreditCard, keywords: ["gateway", "checkout"] },
      { title: "Webhooks", url: "/admin/webhooks", icon: Globe, keywords: ["callbacks"] },
    ],
  },
  {
    id: "appearance",
    label: "Appearance & UI",
    items: [
      { title: "Appearance", url: "/admin/appearance", icon: Paintbrush, keywords: ["style", "colors"] },
      { title: "Themes", url: "/admin/themes", icon: Palette, keywords: ["design"] },
      { title: "Languages", url: "/admin/languages", icon: Languages, keywords: ["i18n", "translation"] },
      { title: "SEO", url: "/admin/seo", icon: Search, keywords: ["metadata"] },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { title: "IP Blocking", url: "/admin/ip-blocking", icon: ShieldCheck, keywords: ["deny"] },
      { title: "Geo Blocking", url: "/admin/geo-blocking", icon: Globe, keywords: ["country"] },
      { title: "Registration IPs", url: "/admin/registration-ips", icon: Globe, keywords: ["signup"] },
      { title: "Registration", url: "/admin/registration", icon: Shield, keywords: ["signup"] },
      { title: "Captcha", url: "/admin/captcha", icon: ShieldCheck, keywords: ["recaptcha"] },
      { title: "Rate Limits", url: "/admin/rate-limits", icon: Clock, keywords: ["throttle"] },
      { title: "Audit Logs", url: "/admin/audit-logs", icon: Clock, keywords: ["history"] },
      { title: "Error Logs", url: "/admin/error-logs", icon: FileWarning, keywords: ["debug"] },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    items: [
      { title: "Cron Jobs", url: "/admin/cron", icon: Clock, keywords: ["schedule"] },
      { title: "Alerts", url: "/admin/alerts", icon: Bell, keywords: ["notify"] },
      { title: "Maintenance", url: "/admin/maintenance", icon: Wrench, keywords: ["service"] },
      { title: "Status Settings", url: "/admin/status-settings", icon: Activity, keywords: ["uptime"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { title: "Overview", url: "/admin/settings-overview", icon: LayoutList, keywords: ["settings"] },
      { title: "General", url: "/admin/general-settings", icon: Settings, keywords: ["config"] },
      { title: "Advanced", url: "/admin/advanced", icon: Cog, keywords: ["dev"] },
      { title: "API", url: "/admin/api", icon: Key, keywords: ["access"] },
      { title: "Cache", url: "/admin/cache", icon: Database, keywords: ["performance"] },
      { title: "Backup", url: "/admin/backup", icon: HardDrive, keywords: ["export"] },
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    items: [
      { title: "Deployment Health", url: "/admin/deployment-health", icon: Server, keywords: ["ops"] },
    ],
  },
];

export const ADMIN_NAV_FLAT: (AdminNavItem & { groupId: string; groupLabel: string })[] =
  ADMIN_NAV.flatMap((g) =>
    g.items.map((it) => ({ ...it, groupId: g.id, groupLabel: g.label })),
  );

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