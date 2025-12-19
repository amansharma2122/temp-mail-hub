import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback } from "react";

export const useEmailVerification = () => {
  const { user } = useAuth();
  const [isResending, setIsResending] = useState(false);

  const isEmailVerified = useCallback(() => {
    if (!user) return false;
    return !!user.email_confirmed_at;
  }, [user]);

  const requiresVerification = useCallback(() => {
    if (!user) return true;
    return !user.email_confirmed_at;
  }, [user]);

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email) {
      toast.error("No email address found");
      return false;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      toast.success("Verification email sent! Check your inbox.");
      return true;
    } catch (error) {
      toast.error("Failed to send verification email");
      return false;
    } finally {
      setIsResending(false);
    }
  }, [user?.email]);

  return {
    isEmailVerified,
    requiresVerification,
    resendVerificationEmail,
    isResending,
    userEmail: user?.email,
    confirmedAt: user?.email_confirmed_at,
  };
};

export default useEmailVerification;