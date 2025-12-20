import { useEffect, useCallback, useState } from 'react';
import { useCaptchaSettings } from '@/hooks/useCaptchaSettings';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export const useRecaptcha = () => {
  const { settings, isLoading } = useCaptchaSettings();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isLoading || !settings.enabled || settings.provider !== 'recaptcha' || !settings.siteKey) {
      return;
    }

    // Check if script already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setIsReady(true));
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${settings.siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha.ready(() => setIsReady(true));
    };
    
    document.head.appendChild(script);

    return () => {
      // Clean up script on unmount if needed
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [settings.enabled, settings.provider, settings.siteKey, isLoading]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!settings.enabled || settings.provider !== 'recaptcha' || !settings.siteKey) {
      return null;
    }

    if (!isReady || !window.grecaptcha) {
      console.warn('reCAPTCHA not ready');
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(settings.siteKey, { action });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      return null;
    }
  }, [settings.enabled, settings.provider, settings.siteKey, isReady]);

  return {
    executeRecaptcha,
    isReady,
    isEnabled: settings.enabled && settings.provider === 'recaptcha' && !!settings.siteKey,
    settings,
    isLoading,
  };
};

export default useRecaptcha;
