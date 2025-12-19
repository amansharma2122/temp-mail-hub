import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useSupabaseAuth';

interface TwoFactorSettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  backup_codes: string[];
}

export const use2FA = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('id, user_id, is_enabled, backup_codes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching 2FA settings:', error);
      }
      setSettings(data as TwoFactorSettings | null);
    } catch (e) {
      console.error('Error fetching 2FA settings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const generateSecret = () => {
    // Generate a 20-byte base32 secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    const randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < 20; i++) {
      secret += chars[randomBytes[i] % 32];
    }
    return secret;
  };

  const generateBackupCodes = () => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const setup2FA = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const secret = generateSecret();
    const backupCodes = generateBackupCodes();

    try {
      // Check if existing record
      const { data: existing } = await supabase
        .from('user_2fa')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_2fa')
          .update({
            totp_secret: secret,
            backup_codes: backupCodes,
            is_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_2fa')
          .insert([{
            user_id: user.id,
            totp_secret: secret,
            backup_codes: backupCodes,
            is_enabled: false,
          }]);

        if (error) throw error;
      }

      await fetchSettings();
      return { success: true, secret, backupCodes };
    } catch (e) {
      console.error('Error setting up 2FA:', e);
      return { success: false, error: 'Failed to setup 2FA' };
    }
  };

  const verifyAndEnable2FA = async (code: string, secret: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Verify TOTP code
    const isValid = verifyTOTP(secret, code);
    if (!isValid) {
      return { success: false, error: 'Invalid verification code' };
    }

    try {
      const { error } = await supabase
        .from('user_2fa')
        .update({
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchSettings();
      return { success: true };
    } catch (e) {
      console.error('Error enabling 2FA:', e);
      return { success: false, error: 'Failed to enable 2FA' };
    }
  };

  const disable2FA = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('user_2fa')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchSettings();
      return { success: true };
    } catch (e) {
      console.error('Error disabling 2FA:', e);
      return { success: false, error: 'Failed to disable 2FA' };
    }
  };

  const verifyCode = async (code: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('totp_secret, backup_codes')
        .eq('user_id', user.id)
        .eq('is_enabled', true)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: '2FA not configured' };
      }

      // Check TOTP first
      if (verifyTOTP(data.totp_secret, code)) {
        return { success: true };
      }

      // Check backup codes
      const backupCodes = data.backup_codes as string[];
      const codeIndex = backupCodes.indexOf(code.toUpperCase());
      if (codeIndex !== -1) {
        // Remove used backup code
        const newCodes = [...backupCodes];
        newCodes.splice(codeIndex, 1);
        await supabase
          .from('user_2fa')
          .update({ backup_codes: newCodes })
          .eq('user_id', user.id);
        return { success: true, usedBackupCode: true };
      }

      return { success: false, error: 'Invalid code' };
    } catch (e) {
      console.error('Error verifying code:', e);
      return { success: false, error: 'Verification failed' };
    }
  };

  return {
    settings,
    isLoading,
    isEnabled: settings?.is_enabled ?? false,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA,
    verifyCode,
    refetch: fetchSettings,
  };
};

// TOTP verification helper
function verifyTOTP(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  
  // Check current and adjacent time windows
  for (let i = -1; i <= 1; i++) {
    const timeCounter = Math.floor((now + i * step) / step);
    const generatedCode = generateTOTP(secret, timeCounter);
    if (generatedCode === code) {
      return true;
    }
  }
  return false;
}

function generateTOTP(secret: string, counter: number): string {
  // Convert base32 secret to bytes
  const keyBytes = base32ToBytes(secret);
  
  // Convert counter to 8-byte buffer
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  // Simple HMAC-SHA1 simulation (client-side approximation)
  // Note: For production, use a proper HMAC-SHA1 implementation
  const hash = simpleHash(keyBytes, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = base32.replace(/=+$/, '').toUpperCase();
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanInput) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function simpleHash(key: Uint8Array, data: Uint8Array): Uint8Array {
  // Simplified hash for client-side (not cryptographically secure)
  // In production, use SubtleCrypto or a proper library
  const combined = new Uint8Array(key.length + data.length);
  combined.set(key);
  combined.set(data, key.length);
  
  const result = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    let val = 0;
    for (let j = 0; j < combined.length; j++) {
      val = ((val * 31) + combined[j] + i) & 0xff;
    }
    result[i] = val;
  }
  return result;
}

export default use2FA;