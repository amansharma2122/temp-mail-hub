import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Save, AlertTriangle, CheckCircle, ExternalLink, Key } from "lucide-react";

interface PaymentSettings {
  stripeEnabled: boolean;
  stripePublishableKey: string;
  stripeSecretKeyConfigured: boolean;
  webhookEndpoint: string;
  testMode: boolean;
  currency: string;
}

const defaultSettings: PaymentSettings = {
  stripeEnabled: false,
  stripePublishableKey: '',
  stripeSecretKeyConfigured: false,
  webhookEndpoint: '',
  testMode: true,
  currency: 'usd',
};

const AdminPayments = () => {
  const [settings, setSettings] = useState<PaymentSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_settings')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as PaymentSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'payment_settings')
        .maybeSingle();

      const settingsToSave = {
        ...settings,
        // Don't store the actual secret key in app_settings
        // It should be stored in Supabase secrets
      };

      const settingsJson = JSON.parse(JSON.stringify(settingsToSave));

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({
            value: settingsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'payment_settings');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{
            key: 'payment_settings',
            value: settingsJson,
          }]);
        error = result.error;
      }

      if (error) {
        console.error('Error saving to database:', error);
        toast.error('Failed to save settings');
      } else {
        toast.success("Payment settings saved!");
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-primary" />
            Payment Settings
          </h1>
          <p className="text-muted-foreground">Configure Stripe payments for premium subscriptions</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Stripe Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Stripe Integration
            </CardTitle>
            <CardDescription>Enable and configure Stripe for payment processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Enable Stripe Payments</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to purchase premium subscriptions
                </p>
              </div>
              <Switch
                checked={settings.stripeEnabled}
                onCheckedChange={(checked) => updateSetting('stripeEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Test Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use Stripe test keys for development
                </p>
              </div>
              <Switch
                checked={settings.testMode}
                onCheckedChange={(checked) => updateSetting('testMode', checked)}
              />
            </div>

            {settings.testMode && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  Test mode is enabled. Payments will not be processed. Use test card numbers for testing.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription>Configure your Stripe API keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publishableKey">Publishable Key</Label>
              <Input
                id="publishableKey"
                value={settings.stripePublishableKey}
                onChange={(e) => updateSetting('stripePublishableKey', e.target.value)}
                placeholder={settings.testMode ? "pk_test_..." : "pk_live_..."}
              />
              <p className="text-xs text-muted-foreground">
                This key is safe to use in frontend code
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Secret Key</Label>
                {settings.stripeSecretKeyConfigured ? (
                  <span className="flex items-center text-sm text-green-500">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Configured
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not configured</span>
                )}
              </div>
              
              {showSecretKeyInput ? (
                <div className="space-y-2">
                  <Input
                    type="password"
                    value={secretKeyInput}
                    onChange={(e) => setSecretKeyInput(e.target.value)}
                    placeholder={settings.testMode ? "sk_test_..." : "sk_live_..."}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSecretKeyInput(false);
                        setSecretKeyInput('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (secretKeyInput) {
                          updateSetting('stripeSecretKeyConfigured', true);
                          toast.info('Secret key will be stored securely. Please add STRIPE_SECRET_KEY to your backend secrets.');
                          setShowSecretKeyInput(false);
                          setSecretKeyInput('');
                        }
                      }}
                    >
                      Save Secret Key
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowSecretKeyInput(true)}
                >
                  {settings.stripeSecretKeyConfigured ? 'Update Secret Key' : 'Add Secret Key'}
                </Button>
              )}
              
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <AlertTriangle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                  The secret key should be stored in your backend secrets (STRIPE_SECRET_KEY), not in the database. This setting only tracks whether it's configured.
                </AlertDescription>
              </Alert>
            </div>

            <div className="pt-4">
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Get your API keys from Stripe Dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card>
          <CardHeader>
            <CardTitle>Currency Settings</CardTitle>
            <CardDescription>Configure payment currency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Input
                id="currency"
                value={settings.currency}
                onChange={(e) => updateSetting('currency', e.target.value.toLowerCase())}
                placeholder="usd"
                maxLength={3}
                className="uppercase w-32"
              />
              <p className="text-xs text-muted-foreground">
                3-letter ISO currency code (e.g., usd, eur, gbp)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">Payments</p>
                <p className={`font-semibold ${settings.stripeEnabled ? 'text-green-500' : 'text-red-500'}`}>
                  {settings.stripeEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">Mode</p>
                <p className={`font-semibold ${settings.testMode ? 'text-amber-500' : 'text-green-500'}`}>
                  {settings.testMode ? 'Test' : 'Live'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">Publishable Key</p>
                <p className={`font-semibold ${settings.stripePublishableKey ? 'text-green-500' : 'text-red-500'}`}>
                  {settings.stripePublishableKey ? 'Set' : 'Missing'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">Secret Key</p>
                <p className={`font-semibold ${settings.stripeSecretKeyConfigured ? 'text-green-500' : 'text-red-500'}`}>
                  {settings.stripeSecretKeyConfigured ? 'Configured' : 'Missing'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPayments;