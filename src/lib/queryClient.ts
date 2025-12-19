import { QueryClient } from "@tanstack/react-query";

// Query keys factory for consistent cache key management
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  
  // Emails
  emails: {
    all: ['emails'] as const,
    list: (tempEmailId?: string) => [...queryKeys.emails.all, 'list', tempEmailId] as const,
    detail: (id: string) => [...queryKeys.emails.all, 'detail', id] as const,
    history: (userId?: string) => [...queryKeys.emails.all, 'history', userId] as const,
    saved: (userId?: string) => [...queryKeys.emails.all, 'saved', userId] as const,
  },
  
  // Temp Emails
  tempEmails: {
    all: ['tempEmails'] as const,
    current: () => [...queryKeys.tempEmails.all, 'current'] as const,
    list: (userId?: string) => [...queryKeys.tempEmails.all, 'list', userId] as const,
  },
  
  // Domains
  domains: {
    all: ['domains'] as const,
    list: () => [...queryKeys.domains.all, 'list'] as const,
    active: () => [...queryKeys.domains.all, 'active'] as const,
  },
  
  // Subscriptions
  subscriptions: {
    all: ['subscriptions'] as const,
    tiers: () => [...queryKeys.subscriptions.all, 'tiers'] as const,
    user: (userId?: string) => [...queryKeys.subscriptions.all, 'user', userId] as const,
    usage: (userId?: string) => [...queryKeys.subscriptions.all, 'usage', userId] as const,
  },
  
  // Admin
  admin: {
    all: ['admin'] as const,
    users: (page?: number, search?: string) => [...queryKeys.admin.all, 'users', page, search] as const,
    analytics: (range?: string) => [...queryKeys.admin.all, 'analytics', range] as const,
    settings: (key?: string) => [...queryKeys.admin.all, 'settings', key] as const,
    auditLogs: (page?: number) => [...queryKeys.admin.all, 'auditLogs', page] as const,
  },
  
  // Blogs
  blogs: {
    all: ['blogs'] as const,
    list: (published?: boolean) => [...queryKeys.blogs.all, 'list', published] as const,
    detail: (slug: string) => [...queryKeys.blogs.all, 'detail', slug] as const,
  },
  
  // Settings
  settings: {
    all: ['settings'] as const,
    general: () => [...queryKeys.settings.all, 'general'] as const,
    appearance: () => [...queryKeys.settings.all, 'appearance'] as const,
    seo: () => [...queryKeys.settings.all, 'seo'] as const,
  },
  
  // Profile
  profile: {
    all: ['profile'] as const,
    user: (userId?: string) => [...queryKeys.profile.all, userId] as const,
  },
  
  // 2FA
  twoFactor: {
    all: ['2fa'] as const,
    status: (userId?: string) => [...queryKeys.twoFactor.all, 'status', userId] as const,
  },
};

// Default stale times
const STALE_TIMES = {
  immediate: 0,
  short: 1000 * 30, // 30 seconds
  medium: 1000 * 60 * 5, // 5 minutes
  long: 1000 * 60 * 30, // 30 minutes
  forever: Infinity,
};

// Create QueryClient with optimized defaults
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time - data is considered fresh for 30 seconds
      staleTime: STALE_TIMES.short,
      
      // Cache time - data stays in cache for 5 minutes after becoming inactive
      gcTime: STALE_TIMES.medium,
      
      // Retry failed requests up to 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,
      
      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: 'always',
      
      // Keep previous data while fetching new data
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      
      // Log errors in development
      onError: (error) => {
        if (import.meta.env.DEV) {
          console.error('Mutation error:', error);
        }
      },
    },
  },
});

// Cache invalidation helpers
export const invalidateQueries = {
  emails: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all });
  },
  
  tempEmails: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tempEmails.all });
  },
  
  subscriptions: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
  },
  
  admin: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  },
  
  profile: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
  },
  
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries();
  },
};

// Optimistic update helpers
export const optimisticHelpers = {
  // Add item to list
  addToList: <T>(queryClient: QueryClient, queryKey: readonly unknown[], newItem: T) => {
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      if (!old) return [newItem];
      return [...old, newItem];
    });
  },
  
  // Remove item from list
  removeFromList: <T extends { id: string }>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    itemId: string
  ) => {
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      if (!old) return [];
      return old.filter((item) => item.id !== itemId);
    });
  },
  
  // Update item in list
  updateInList: <T extends { id: string }>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    itemId: string,
    updates: Partial<T>
  ) => {
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      if (!old) return [];
      return old.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
    });
  },
};
