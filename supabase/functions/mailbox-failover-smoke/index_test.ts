// Smoke test: fills one mailbox to quota and verifies the failover routine
// promotes exactly one other active mailbox.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
// (Lovable Cloud sets these automatically inside the edge-function runtime).
// Local invocation:
//   deno test --allow-net --allow-env supabase/functions/mailbox-failover-smoke

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const runIt = SUPABASE_URL && SERVICE_KEY;

Deno.test({
  name: "mailbox failover: full primary demoted, exactly one active mailbox after promotion",
  ignore: !runIt,
  async fn() {
    const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tag = `smoke-${crypto.randomUUID().slice(0, 8)}`;
    const mkMailbox = (i: number, opts: Partial<Record<string, unknown>> = {}) => ({
      name: `${tag}-mb-${i}`,
      smtp_host: "smoke.invalid",
      smtp_user: `${tag}${i}@smoke.invalid`,
      smtp_from: `${tag}${i}@smoke.invalid`,
      smtp_port: 587,
      imap_host: "smoke.invalid",
      imap_user: `${tag}${i}@smoke.invalid`,
      imap_port: 993,
      is_active: true,
      priority: i,
      storage_bytes_limit: 10 * 1024 * 1024 * 1024, // 10GB
      storage_bytes_used: 0,
      is_full: false,
      is_primary: false,
      ...opts,
    });

    // 1. Seed two synthetic mailboxes; #1 is the current (soon-to-be-full) primary.
    const { data: inserted, error: insertErr } = await supabase
      .from("mailboxes")
      .insert([
        mkMailbox(1, { is_primary: false, storage_bytes_used: 0 }),
        mkMailbox(2),
      ])
      .select("id, name, priority");
    if (insertErr) throw insertErr;
    assert(inserted && inserted.length === 2, "seed mailboxes should insert");
    const [mb1, mb2] = inserted.sort((a, b) => a.priority - b.priority);

    const cleanup = async () => {
      await supabase.from("mailboxes").delete().like("name", `${tag}%`);
    };

    try {
      // 2. Promote mb1 as active baseline (uses the advisory-lock RPC).
      const promoteRes = await supabase.rpc("promote_mailbox_as_primary", {
        p_mailbox_id: mb1.id,
      });
      assertEquals(promoteRes.error, null, `promote failed: ${promoteRes.error?.message}`);

      // 3. Fill mb1 to quota and mark it full — simulates the 10GB cap being hit.
      const fillRes = await supabase
        .from("mailboxes")
        .update({
          storage_bytes_used: 10 * 1024 * 1024 * 1024,
          is_full: true,
        })
        .eq("id", mb1.id);
      assertEquals(fillRes.error, null, `fill update failed: ${fillRes.error?.message}`);

      // 4. Trigger the failover routine.
      const failoverRes = await supabase.rpc("enforce_single_active_mailbox");
      assertEquals(failoverRes.error, null, `failover rpc failed: ${failoverRes.error?.message}`);
      const payload = failoverRes.data as Record<string, unknown> | null;
      assert(payload && (payload as any).changed === true,
        `expected failover to promote a new primary, got: ${JSON.stringify(payload)}`);
      assertEquals((payload as any).new_primary, mb2.id,
        "mb2 should have been promoted since mb1 is full");

      // 5. Invariant: exactly one primary mailbox globally.
      const { data: primaries, error: pErr } = await supabase
        .from("mailboxes")
        .select("id, name, is_primary")
        .eq("is_primary", true);
      assertEquals(pErr, null);
      assertEquals(primaries?.length, 1, "there must be exactly one active mailbox");
      assertEquals(primaries?.[0].id, mb2.id, "the new primary must be mb2");

      // 6. Delivery-path proxy: select_available_mailbox() must return a non-full mailbox.
      //    (Uses SMTP side of the failover contract; IMAP polling uses the same is_primary flag.)
      const { data: avail, error: aErr } = await supabase.rpc("select_available_mailbox");
      assertEquals(aErr, null);
      if (Array.isArray(avail) && avail.length > 0) {
        // The synthetic hosts are not on any allow-list, so the real SMTP host
        // may not match ours — assert only that a non-full mailbox was returned.
        const returned = avail[0] as { mailbox_id: string };
        const { data: check } = await supabase
          .from("mailboxes")
          .select("is_full")
          .eq("id", returned.mailbox_id)
          .single();
        assertEquals(check?.is_full, false, "selected mailbox must not be full");
      }
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "mailbox failover: concurrent quota-fill + promote calls never split traffic across mailboxes",
  ignore: !runIt,
  async fn() {
    const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tag = `smoke-c-${crypto.randomUUID().slice(0, 8)}`;
    const mk = (i: number) => ({
      name: `${tag}-mb-${i}`,
      smtp_host: "smoke.invalid",
      smtp_user: `${tag}${i}@smoke.invalid`,
      smtp_from: `${tag}${i}@smoke.invalid`,
      smtp_port: 587,
      imap_host: "smoke.invalid",
      imap_user: `${tag}${i}@smoke.invalid`,
      imap_port: 993,
      is_active: true,
      priority: i,
      storage_bytes_limit: 10 * 1024 * 1024 * 1024,
      storage_bytes_used: 0,
      is_full: false,
      is_primary: false,
    });

    const seeded = await supabase.from("mailboxes")
      .insert([mk(1), mk(2), mk(3), mk(4)])
      .select("id, priority");
    if (seeded.error) throw seeded.error;
    const ids = (seeded.data ?? []).sort((a, b) => a.priority - b.priority);

    const cleanup = async () => {
      await supabase.from("mailboxes").delete().like("name", `${tag}%`);
    };

    try {
      // Establish an initial primary.
      await supabase.rpc("promote_mailbox_as_primary", { p_mailbox_id: ids[0].id });

      // Fill the current primary AND fire a burst of concurrent operations:
      //   - many enforce_single_active_mailbox() runs (auto-failover)
      //   - many promote_mailbox_as_primary() targeting different mailboxes
      //   - many select_available_mailbox() as the delivery path would
      // The DB advisory lock + partial unique index must ensure that at
      // every observation there is at most one primary and the delivery
      // selector never fans out to a full mailbox.
      await supabase.from("mailboxes")
        .update({ storage_bytes_used: 10 * 1024 * 1024 * 1024, is_full: true })
        .eq("id", ids[0].id);

      const ops: Promise<unknown>[] = [];
      for (let i = 0; i < 20; i++) {
        ops.push(supabase.rpc("enforce_single_active_mailbox"));
        ops.push(supabase.rpc("promote_mailbox_as_primary", {
          p_mailbox_id: ids[1 + (i % 3)].id,
        }));
        ops.push(supabase.rpc("select_available_mailbox"));
      }
      const results = await Promise.allSettled(ops);

      // No individual op should throw a unique-constraint violation — the
      // advisory lock serialises them behind the scenes.
      for (const r of results) {
        if (r.status === "rejected") {
          throw new Error(`concurrent op failed: ${(r.reason as Error)?.message}`);
        }
        const err = (r.value as { error: { message: string } | null } | undefined)?.error;
        if (err && /duplicate key|unique/i.test(err.message)) {
          throw new Error(`unique violation leaked to client: ${err.message}`);
        }
      }

      // Final invariant: exactly one primary, and it must be a non-full mailbox.
      const { data: primaries } = await supabase
        .from("mailboxes")
        .select("id, is_full")
        .eq("is_primary", true);
      assertEquals(primaries?.length, 1,
        `expected exactly one primary mailbox globally, got ${primaries?.length ?? 0}`);
      assertEquals(primaries?.[0].is_full, false,
        "the sole primary must not be a full mailbox");

      // Delivery selector must never point at the full mailbox.
      const { data: avail } = await supabase.rpc("select_available_mailbox");
      if (Array.isArray(avail) && avail.length > 0) {
        const returned = (avail[0] as { mailbox_id: string }).mailbox_id;
        assert(returned !== ids[0].id,
          "select_available_mailbox must not return the full mailbox");
      }
    } finally {
      await cleanup();
    }
  },
});