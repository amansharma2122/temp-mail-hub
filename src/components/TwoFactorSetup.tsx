import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { use2FA } from '@/hooks/use2FA';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

const TwoFactorSetup = () => {
  const { user, profile } = useAuth();
  const { isEnabled, isLoading, setup2FA, verifyAndEnable2FA, disable2FA } = use2FA();
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'backup'>('initial');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const appName = 'Nullsto';
  const userEmail = profile?.email || user?.email || 'user';

  const handleStartSetup = async () => {
    setIsSubmitting(true);
    const result = await setup2FA();
    if (result.success && result.secret && result.backupCodes) {
      setSecret(result.secret);
      setBackupCodes(result.backupCodes);
      setStep('setup');
    } else {
      toast.error(result.error || 'Failed to start setup');
    }
    setIsSubmitting(false);
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyAndEnable2FA(verificationCode, secret);
    if (result.success) {
      toast.success('Two-factor authentication enabled!');
      setStep('backup');
    } else {
      toast.error(result.error || 'Invalid verification code');
    }
    setIsSubmitting(false);
  };

  const handleDisable = async () => {
    setIsSubmitting(true);
    const result = await disable2FA();
    if (result.success) {
      toast.success('Two-factor authentication disabled');
      setStep('initial');
      setSecret('');
      setBackupCodes([]);
    } else {
      toast.error(result.error || 'Failed to disable 2FA');
    }
    setIsSubmitting(false);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackup(true);
    toast.success('Backup codes copied to clipboard');
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const qrCodeUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isEnabled && step === 'initial') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>Your account is protected with 2FA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-500/50 bg-green-500/10">
            <Shield className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-600 dark:text-green-400">
              Two-factor authentication is enabled for your account.
            </AlertDescription>
          </Alert>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Disable Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'initial') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Two-factor authentication adds an additional layer of security to your account by requiring a verification code in addition to your password.
          </p>
          <Button onClick={handleStartSetup} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enable Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'setup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Setup Two-Factor Authentication
          </CardTitle>
          <CardDescription>Scan the QR code with your authenticator app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={qrCodeUrl} size={200} />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Can't scan? Enter this code manually:
              </p>
              <code className="bg-secondary px-3 py-1 rounded text-sm font-mono">
                {secret}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Enter the 6-digit code from your authenticator app
            </label>
            <Input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              maxLength={6}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('initial');
                setSecret('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isSubmitting || verificationCode.length !== 6}
              className="flex-1"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verify and Enable
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'backup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Save Your Backup Codes
          </CardTitle>
          <CardDescription>Store these codes in a safe place</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-600 dark:text-amber-400">
              Save these backup codes! You can use them to access your account if you lose your authenticator device. Each code can only be used once.
            </AlertDescription>
          </Alert>

          <div className="bg-secondary/50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="bg-background px-3 py-2 rounded text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={copyBackupCodes}
            className="w-full"
          >
            {copiedBackup ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Backup Codes
              </>
            )}
          </Button>

          <Button
            onClick={() => setStep('initial')}
            className="w-full"
          >
            I've Saved My Backup Codes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default TwoFactorSetup;