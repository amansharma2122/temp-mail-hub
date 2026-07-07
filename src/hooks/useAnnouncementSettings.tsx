import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { saveAppSetting } from "@/lib/appSettingsSync";
export interface AnnouncementSettings {
  isEnabled: boolean;
  badgeText: string;
  mainMessage: string;
  ctaText: string;
  ctaLink: string;
  showTelegramButton: boolean;
  telegramText: string;
  telegramLink: string;
}

const defaultSettings: AnnouncementSettings = {
  isEnabled: true,
  badgeText: 'New',
  mainMessage: 'Guest can create 5 free Emails in a day',
  ctaText: 'Premium Plan is live!',
  ctaLink: '',
  showTelegramButton: true,
  telegramText: 'Contact on Telegram',
  telegramLink: 'https://t.me/nullstoemail',
};

export const useAnnouncementSettings = () => {
  const [settings, setSettings] = useState<AnnouncementSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'announcement_settings')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.value) {
        const dbSettings = data.value as unknown as AnnouncementSettings;
        setSettings({ ...defaultSettings, ...dbSettings });
      }
    } catch (e) {
      console.error('Error loading announcement settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = supabase
      .channel(`announcement-admin-settings-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.announcement_settings'
        },
        (payload) => {
          console.log('Announcement settings updated (admin hook):', payload);
          if (payload.new && (payload.new as any).value) {
            const newSettings = (payload.new as any).value as AnnouncementSettings;
            setSettings({ ...defaultSettings, ...newSettings });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = async (newSettings: Partial<AnnouncementSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const settingsJson = JSON.parse(JSON.stringify(updatedSettings));
      await saveAppSetting('announcement_settings', settingsJson);
      setSettings(updatedSettings);
      return { success: true };
    } catch (e) {
      console.error('Error saving announcement settings:', e);
      return { success: false, error: e };
    }
  };

  return { settings, isLoading, updateSettings, refetch: fetchSettings };
};

export default useAnnouncementSettings;
