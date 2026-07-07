# Plan

## 1. Admin sidebar reorg (aggressive, 6 groups)

Legacy routes stay working (redirects) so no bookmarks break. Every merged surface becomes a single page with tabs.

```
Overview
  └ Dashboard (adds: Deployment Health, Cache, Backup as tabs inside Dashboard)
Users & Access
  ├ Users (tabs: All Users, Admins, Role Approvals, Suspended, User & Guest Defaults)
  ├ Subscriptions (tabs: Subscriptions, Pricing, Payments, Webhooks)
  └ Security (tabs: IP Blocking, Geo Blocking, Registration IPs, Registration, Captcha, Rate Limits)
Mail
  ├ Emails (tabs: Emails, Email Logs)
  ├ Mail Servers (tabs: Mailboxes, Mailbox Health, IMAP, SMTP, Email Setup)
  ├ Email Rules (tabs: Templates, Restrictions, Blocking)
  └ Domains (tabs: Domains, Custom Domains)
Content & Promo
  ├ Content (tabs: Homepage, Pages, Blogs, Blog Settings, Friendly Sites)
  └ Promotions (tabs: Banners, Ads, Announcement)
System
  ├ Settings (tabs: General, Advanced, Overview, API)
  ├ Appearance (tabs: Appearance, Themes, SEO, Languages)
  ├ Automation (tabs: Cron Jobs, Alerts, Maintenance, Status Settings)
  └ Logs (tabs: Audit Logs, Error Logs)
```

Removed from sidebar (folded into Dashboard tabs): Deployment Health, Cache, Backup, Analytics (Analytics becomes a Dashboard tab).

Nothing is deleted from disk — pages remain reachable at their old URLs via redirects to the new tab.

## 2. Single-active-mailbox safeguard (auto-promote + manual)

- SQL trigger enforces exactly one `is_primary=true` per mailboxes table: setting one to true un-flags the rest.
- Cron function `enforce_single_active_mailbox()` runs every 5 min: if the current primary is `is_full=true` (or hasn't polled successfully in >2h), it demotes it and promotes the next-priority non-full active mailbox. Records the change in `admin_audit_logs`.
- Mail Servers page: red banner + "Set as primary" button when all non-full mailboxes are exhausted (manual override still works).

## 3. Expanded StatsHealthWidget

- Adds a per-counter table with columns: counter name, current value, `stat_date` (last IST reset), age of last update.
- Adds a mailbox quota mini-table with is_full badge and `last_quota_check_at` (this satisfies "Show a mailbox storage/quota status table" without a new page).
- Keeps the "Reconcile now" button already shipped (satisfies "admin button to run reconciliation").

## 4. BannerDisplay retry + fallback indicator

- Already falls back to 30s polling on realtime failure. Adds:
  - Silent auto-retry of realtime subscription every 60s (up to 3 tries) after a failure.
  - Small non-blocking chip visible only to admins (`is_admin`) at the corner of the banner region reading "Live updates paused — polling" when in fallback. Regular users see nothing new; banners keep rendering.

## Technical notes

- New file `src/pages/admin/AdminUsersHub.tsx` etc. — thin wrappers that render the existing page components inside `<Tabs>`. No duplication of business logic.
- `src/lib/adminNav.ts` rewritten to the 6-group tree; `ADMIN_NAV_FLAT` still includes hidden legacy items so `findNavItem` keeps working for breadcrumbs.
- `src/App.tsx` gets `<Route path="/admin/analytics" element={<Navigate to="/admin?tab=analytics" replace />} />`-style redirects for every merged old path.
- Migration adds `enforce_single_primary_mailbox()` trigger, `enforce_single_active_mailbox()` function, pg_cron 5-min schedule, updated `bump` on primary changes.
- `BannerDisplay.tsx` gets a `useAdminRole` check + retry counter in the existing `useEffect`.

## Out of scope

- Rewriting the underlying page components themselves.
- Changing any RLS or data model beyond the mailbox primary trigger.
- Touching non-admin routes.
