import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { saveAppSetting } from "@/lib/appSettingsSync";
export interface RegistrationSettings {
  allowRegistration: boolean;
  registrationMessage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  requireEmailConfirmation: boolean;
}

const defaultSettings: RegistrationSettings = {
  allowRegistration: true,
  registrationMessage: 'Registration is currently disabled. Please try again later.',
  maintenanceMode: false,
  maintenanceMessage: 'The site is under maintenance. Please check back later.',
  requireEmailConfirmation: false,
};

export const useRegistrationSettings = () => {
  const [settings, setSettings] = useState<RegistrationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_settings')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.value) {
        const dbSettings = data.value as unknown as RegistrationSettings;
        setSettings({ ...defaultSettings, ...dbSettings });
      }
    } catch (e) {
      console.error('Error loading registration settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<RegistrationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const settingsJson = JSON.parse(JSON.stringify(updatedSettings));
      await saveAppSetting('registration_settings', settingsJson);
      setSettings(updatedSettings);
      return { success: true };
    } catch (e) {
      console.error('Error saving registration settings:', e);
      return { success: false, error: e };
    }
  };

  return { settings, isLoading, updateSettings, refetch: fetchSettings };
};

export default useRegistrationSettings;
