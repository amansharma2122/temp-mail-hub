// Map of `app_settings` keys → the admin route where they can be edited.
// Used by the cross-tab update toast to deep-link admins straight to the
// setting that another tab just changed.
export const APP_SETTINGS_KEY_ROUTES: Record<string, string> = {
  friendly_sites_widget: "/admin/friendly-websites",
  banner: "/admin/banners",
  announcement_settings: "/admin/announcement",
  blog: "/admin/blog-settings",
  registration_settings: "/admin/registration",
  pricing_content: "/admin/pricing",
  payment_settings: "/admin/payments",
  appearance: "/admin/appearance",
  languages: "/admin/languages",
  general: "/admin/general-settings",
  limit_modal_config: "/admin/user-settings",
  new_email_notification_style: "/admin/user-settings",
  new_email_sound_admin_enabled: "/admin/user-settings",
  cache_settings: "/admin/cache",
  seo: "/admin/seo",
  rate_limit_friendly_widget_events: "/admin/rate-limits",
  rate_limits_config: "/admin/rate-limits",
  status_overrides: "/admin/status-settings",
  email_forwarding_rules: "/admin/email-setup",
  user_settings: "/admin/user-settings",
  captcha_settings: "/admin/captcha",
  sidebar_icons: "/admin",
};

export function getAppSettingsRoute(key: string): string | null {
  return APP_SETTINGS_KEY_ROUTES[key] ?? null;
}