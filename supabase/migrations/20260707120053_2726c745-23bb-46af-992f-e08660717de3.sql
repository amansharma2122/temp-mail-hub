REVOKE EXECUTE ON FUNCTION public.get_mailbox_smtp_password(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_mailbox_imap_password(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_mailbox_smtp_password(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_mailbox_imap_password(uuid, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.select_available_mailbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_available_mailbox() TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_mailbox_error(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mailbox_error(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_mailbox_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_mailbox_usage(uuid) TO service_role;