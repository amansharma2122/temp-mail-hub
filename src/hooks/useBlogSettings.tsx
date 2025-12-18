import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';

const BLOG_SETTINGS_KEY = 'trashmails_blog_settings';

export interface BlogSettings {
  enabled: boolean;
  postsPerPage: number;
  allowComments: boolean;
  moderateComments: boolean;
  showAuthor: boolean;
  showDate: boolean;
  showReadTime: boolean;
  enableRss: boolean;
  defaultCategory: string;
}

const defaultSettings: BlogSettings = {
  enabled: true,
  postsPerPage: 10,
  allowComments: true,
  moderateComments: true,
  showAuthor: true,
  showDate: true,
  showReadTime: true,
  enableRss: true,
  defaultCategory: 'General',
};

export const useBlogSettings = () => {
  const [settings, setSettings] = useState<BlogSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'blog')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as BlogSettings;
          const merged = { ...defaultSettings, ...dbSettings };
          setSettings(merged);
          storage.set(BLOG_SETTINGS_KEY, merged);
        } else {
          const localSettings = storage.get<BlogSettings>(BLOG_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading blog settings:', e);
        const localSettings = storage.get<BlogSettings>(BLOG_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  return { settings, isLoading };
};

export default useBlogSettings;
