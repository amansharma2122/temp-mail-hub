// Map of `app_settings` keys → the admin route where they can be edited.
// Used by the cross-tab update toast to deep-link admins straight to the
// setting that another tab just changed.
export const APP_SETTINGS_KEY_ROUTES: Record<string, string> = {
  friendly_sites_widget: "/admin/friendly-websites#app-setting-friendly_sites_widget",
  banner: "/admin/banners#app-setting-banner",
  announcement_settings: "/admin/announcement#app-setting-announcement_settings",
  blog: "/admin/blog-settings#app-setting-blog",
  registration_settings: "/admin/registration#app-setting-registration_settings",
  pricing_content: "/admin/pricing#app-setting-pricing_content",
  payment_settings: "/admin/payments#app-setting-payment_settings",
  appearance: "/admin/appearance#app-setting-appearance",
  languages: "/admin/languages#app-setting-languages",
  general: "/admin/general-settings#app-setting-general",
  limit_modal_config: "/admin/user-settings#app-setting-limit_modal_config",
  new_email_notification_style: "/admin/user-settings#app-setting-new_email_notification_style",
  new_email_sound_admin_enabled: "/admin/user-settings#app-setting-new_email_sound_admin_enabled",
  cache_settings: "/admin/cache#app-setting-cache_settings",
  seo: "/admin/seo#app-setting-seo",
  rate_limit_friendly_widget_events: "/admin/rate-limits#app-setting-rate_limit_friendly_widget_events",
  rate_limits_config: "/admin/rate-limits#app-setting-rate_limits_config",
  status_overrides: "/admin/status-settings#app-setting-status_overrides",
  email_forwarding_rules: "/admin/email-setup#app-setting-email_forwarding_rules",
  user_settings: "/admin/user-settings#app-setting-user_settings",
  captcha_settings: "/admin/captcha#app-setting-captcha_settings",
  sidebar_icons: "/admin#app-setting-sidebar_icons",
};

export const APP_SETTINGS_KEY_LABELS: Record<string, string> = {
  friendly_sites_widget: "Friendly sites widget",
  banner: "Banners",
  announcement_settings: "Announcement settings",
  blog: "Blog settings",
  registration_settings: "Registration settings",
  pricing_content: "Pricing content",
  payment_settings: "Payment settings",
  appearance: "Appearance",
  languages: "Languages",
  general: "General settings",
  limit_modal_config: "Limit modal",
  new_email_notification_style: "New email notification style",
  new_email_sound_admin_enabled: "New email sound",
  cache_settings: "Cache settings",
  seo: "SEO settings",
  rate_limit_friendly_widget_events: "Friendly widget rate limit",
  rate_limits_config: "Rate limit settings",
  status_overrides: "Status overrides",
  email_forwarding_rules: "Email forwarding rules",
  user_settings: "User settings",
  captcha_settings: "Captcha settings",
  sidebar_icons: "Sidebar icons",
};

export function getAppSettingsRoute(key: string): string | null {
  return APP_SETTINGS_KEY_ROUTES[key] ?? null;
}

export function getAppSettingsKeyLabel(key: string): string {
  return APP_SETTINGS_KEY_LABELS[key] ?? key;
}

export function getAppSettingsRowId(key: string): string {
  return `app-setting-${key}`;
}