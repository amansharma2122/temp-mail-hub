import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { useCaptchaSettings, CaptchaSettings } from "@/hooks/useCaptchaSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminCaptcha = () => {
  const { settings, isLoading, updateSettings, isSaving } = useCaptchaSettings();
  const [localSettings, setLocalSettings] = useState<CaptchaSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(localSettings);
  };

  const updateSetting = <K extends keyof CaptchaSettings>(key: K, value: CaptchaSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Captcha Settings
          </h1>
          <p className="text-muted-foreground">Configure captcha protection</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {localSettings.enabled && !localSettings.siteKey && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertDescription className="text-amber-200">
            Captcha is enabled but no Site Key is configured. Please add your reCAPTCHA site key.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Captcha Provider
              <div className="flex items-center gap-2">
                <Label htmlFor="captcha-enabled">Enable Captcha</Label>
                <Switch
                  id="captcha-enabled"
                  checked={localSettings.enabled}
                  onCheckedChange={(checked) => updateSetting('enabled', checked)}
                />
              </div>
            </CardTitle>
            <CardDescription>Choose your captcha provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={localSettings.provider} onValueChange={(v) => updateSetting('provider', v as CaptchaSettings['provider'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recaptcha">Google reCAPTCHA v3</SelectItem>
                  <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                  <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteKey">Site Key (Public)</Label>
                <Input
                  id="siteKey"
                  value={localSettings.siteKey}
                  onChange={(e) => updateSetting('siteKey', e.target.value)}
                  placeholder="Enter site key"
                />
                <p className="text-xs text-muted-foreground">This key is used in the browser</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretKey">Secret Key (Private)</Label>
                <Input
                  id="secretKey"
                  type="password"
                  value={localSettings.secretKey}
                  onChange={(e) => updateSetting('secretKey', e.target.value)}
                  placeholder="Enter secret key"
                />
                <p className="text-xs text-muted-foreground">This key is used for server-side verification</p>
              </div>
            </div>
            {localSettings.provider === 'recaptcha' && (
              <div className="space-y-2">
                <Label htmlFor="threshold">Score Threshold (0.0 - 1.0)</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={localSettings.threshold}
                  onChange={(e) => updateSetting('threshold', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Higher values = stricter verification (0.5 recommended)</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protected Pages</CardTitle>
            <CardDescription>Enable captcha on specific actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Login Page</Label>
                <p className="text-sm text-muted-foreground">Protect login form</p>
              </div>
              <Switch
                checked={localSettings.enableOnLogin}
                onCheckedChange={(checked) => updateSetting('enableOnLogin', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Registration Page</Label>
                <p className="text-sm text-muted-foreground">Protect signup form</p>
              </div>
              <Switch
                checked={localSettings.enableOnRegister}
                onCheckedChange={(checked) => updateSetting('enableOnRegister', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Contact Form</Label>
                <p className="text-sm text-muted-foreground">Protect contact page</p>
              </div>
              <Switch
                checked={localSettings.enableOnContact}
                onCheckedChange={(checked) => updateSetting('enableOnContact', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Generation</Label>
                <p className="text-sm text-muted-foreground">Protect email generator</p>
              </div>
              <Switch
                checked={localSettings.enableOnEmailGen}
                onCheckedChange={(checked) => updateSetting('enableOnEmailGen', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className={`font-semibold ${localSettings.enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {localSettings.enabled ? 'Active' : 'Disabled'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Provider</p>
                <p className="font-semibold text-foreground capitalize">{localSettings.provider}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Site Key</p>
                <p className={`font-semibold ${localSettings.siteKey ? 'text-green-500' : 'text-amber-500'}`}>
                  {localSettings.siteKey ? 'Configured' : 'Missing'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Secret Key</p>
                <p className={`font-semibold ${localSettings.secretKey ? 'text-green-500' : 'text-amber-500'}`}>
                  {localSettings.secretKey ? 'Configured' : 'Missing'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCaptcha;
