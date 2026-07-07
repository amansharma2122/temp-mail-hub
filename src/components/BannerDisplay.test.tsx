import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import BannerDisplay from "./BannerDisplay";

// Simulate the exact production bug: `.on('postgres_changes', ...)` throws
// when invoked after `.subscribe()` because the underlying channel has been
// reused. BannerDisplay must catch this and still render.
vi.mock("@/integrations/supabase/client", () => {
  const from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "1",
                  name: "Test banner",
                  position: "header",
                  type: "text",
                  content: "hi",
                  image_url: null,
                  link_url: null,
                  is_active: true,
                  priority: 1,
                  start_date: null,
                  end_date: null,
                  click_count: 0,
                  view_count: 0,
                },
              ],
              error: null,
            }),
        }),
      }),
      single: () => Promise.resolve({ data: { click_count: 0, view_count: 0 }, error: null }),
    }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  });

  const channelFactory = () => {
    let subscribed = false;
    const ch: any = {
      on: (..._args: unknown[]) => {
        if (subscribed) {
          throw new Error(
            "cannot add `postgres_changes` callbacks for realtime:test after `subscribe()`",
          );
        }
        return ch;
      },
      subscribe: (cb?: (status: string) => void) => {
        subscribed = true;
        cb?.("CHANNEL_ERROR");
        return ch;
      },
    };
    return ch;
  };

  return {
    supabase: {
      from,
      channel: () => channelFactory(),
      removeChannel: () => {},
    },
  };
});

describe("BannerDisplay", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders banners even when realtime subscription fails", async () => {
    // Force the failure path by re-mocking .on to throw synchronously.
    const { supabase } = await import("@/integrations/supabase/client");
    const originalChannel = supabase.channel;
    (supabase as any).channel = () => {
      const ch: any = {
        on: () => {
          throw new Error(
            "cannot add `postgres_changes` callbacks for realtime:test after `subscribe()`",
          );
        },
        subscribe: () => ch,
      };
      return ch;
    };

    let rendered: ReturnType<typeof render> | null = null;
    expect(() => {
      rendered = render(<BannerDisplay position="header" />);
    }).not.toThrow();

    await waitFor(() => {
      expect(rendered!.getByText("hi")).toBeInTheDocument();
    });

    (supabase as any).channel = originalChannel;
  });
});