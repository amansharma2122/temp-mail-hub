import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mocks must be declared before importing the component under test.
vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({ isAdmin: false, loading: false }),
}));

const fetchMock = vi.fn();
let bannersOverride: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain = () => {
    const q: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => {
        fetchMock();
        return Promise.resolve({ data: bannersOverride, error: null });
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    return q;
  };
  return {
    supabase: {
      from: vi.fn(() => chain()),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
    },
  };
});

import BannerDisplay from "@/components/BannerDisplay";

const CACHE_KEY = "nullsto:banner-cache:header";
const TTL_KEY = "nullsto:banner-cache-ttl-min";

const staleBanner = {
  id: "stale-1",
  name: "Stale Banner",
  position: "header",
  type: "text" as const,
  content: "STALE CONTENT",
  image_url: null,
  link_url: null,
  is_active: true,
  priority: 1,
  start_date: null,
  end_date: null,
};

const freshBanner = {
  id: "fresh-1",
  name: "Fresh Banner",
  position: "header",
  type: "text" as const,
  content: "FRESH CONTENT",
  image_url: null,
  link_url: null,
  is_active: true,
  priority: 1,
  start_date: null,
  end_date: null,
};

describe("BannerDisplay cache TTL expiry", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockClear();
    bannersOverride = [freshBanner];
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("uses cached banners when cache is fresh", () => {
    // 5-minute-old cache with 60-minute TTL — should be considered fresh.
    localStorage.setItem(TTL_KEY, "60");
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now() - 5 * 60_000, data: [staleBanner] }),
    );

    render(<BannerDisplay position="header" />);
    // The cached banner hydrates synchronously from localStorage.
    expect(screen.getByText("STALE CONTENT")).toBeInTheDocument();
  });

  it("discards expired cache and refetches fresh banners", async () => {
    // 2-hour-old cache with 60-minute TTL — must be discarded.
    localStorage.setItem(TTL_KEY, "60");
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now() - 2 * 60 * 60_000, data: [staleBanner] }),
    );

    render(<BannerDisplay position="header" />);

    // Stale content must NOT be rendered on mount — TTL expired.
    expect(screen.queryByText("STALE CONTENT")).not.toBeInTheDocument();

    // The component must refetch and render the fresh banner instead.
    await waitFor(() => {
      expect(screen.getByText("FRESH CONTENT")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalled();

    // The refreshed cache entry must overwrite the stale one.
    const raw = localStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.data[0].id).toBe("fresh-1");
    expect(Date.now() - parsed.at).toBeLessThan(5_000);
  });
});