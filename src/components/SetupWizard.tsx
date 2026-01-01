import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  Database, User, Mail, CheckCircle, ArrowRight, ArrowLeft, 
  Server, Shield, Loader2, Eye, EyeOff
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SetupWizardProps {
  onComplete: () => void;
}

const SetupWizard = ({ onComplete }: SetupWizardProps) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // Database config
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    name: '',
    user: '',
    pass: '',
  });
  
  // Admin config
  const [adminConfig, setAdminConfig] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  
  // SMTP config
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '',
  });
  
  // IMAP config
  const [imapConfig, setImapConfig] = useState({
    host: '',
    port: '993',
    user: '',
    pass: '',
  });

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/install.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_database', ...dbConfig }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Database connection successful!");
        setCompletedSteps(prev => [...prev, 1]);
        setStep(2);
      } else {
        toast.error(data.error || "Database connection failed");
      }
    } catch (error) {
      toast.error("Failed to test database connection");
    } finally {
      setIsLoading(false);
    }
  };

  const createTables = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/install.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tables', ...dbConfig }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Database tables created!");
        return true;
      } else {
        toast.error(data.error || "Failed to create tables");
        return false;
      }
    } catch (error) {
      toast.error("Failed to create database tables");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createAdmin = async () => {
    if (adminConfig.password !== adminConfig.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (adminConfig.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      // First create tables if not done
      await createTables();
      
      const response = await fetch(`${api.baseUrl}/install.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_admin',
          db: dbConfig,
          admin: {
            email: adminConfig.email,
            password: adminConfig.password,
            display_name: adminConfig.displayName,
          }
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Admin account created!");
        setCompletedSteps(prev => [...prev, 2]);
        setStep(3);
      } else {
        toast.error(data.error || "Failed to create admin");
      }
    } catch (error) {
      toast.error("Failed to create admin account");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSmtpConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/install.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save_config',
          db: dbConfig,
          smtp: smtpConfig,
          imap: imapConfig,
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Configuration saved!");
        setCompletedSteps(prev => [...prev, 3]);
        setStep(4);
      } else {
        toast.error(data.error || "Failed to save configuration");
      }
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const testSmtpConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/test-smtp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("SMTP connection successful!");
      } else {
        toast.error(data.error || "SMTP connection failed");
      }
    } catch (error) {
      toast.error("Failed to test SMTP connection");
    } finally {
      setIsLoading(false);
    }
  };

  const testImapConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/test-imap.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapConfig),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("IMAP connection successful!");
      } else {
        toast.error(data.error || "IMAP connection failed");
      }
    } catch (error) {
      toast.error("Failed to test IMAP connection");
    } finally {
      setIsLoading(false);
    }
  };

  const completeSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${api.baseUrl}/install.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_setup' }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Setup completed! Redirecting to login...");
        setCompletedSteps(prev => [...prev, 4]);
        setTimeout(() => onComplete(), 2000);
      } else {
        toast.error(data.error || "Failed to complete setup");
      }
    } catch (error) {
      toast.error("Failed to complete setup");
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Database", icon: Database },
    { number: 2, title: "Admin", icon: User },
    { number: 3, title: "Email", icon: Mail },
    { number: 4, title: "Complete", icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl">TempMail Setup Wizard</CardTitle>
          </div>
          <CardDescription>Configure your self-hosted TempMail instance</CardDescription>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {steps.map((s, i) => (
              <div key={s.number} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  step === s.number ? 'bg-primary text-primary-foreground' :
                  completedSteps.includes(s.number) ? 'bg-green-500/20 text-green-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  <s.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          
          <Progress value={(step / 4) * 100} className="mt-4" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Database */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Database Configuration</h3>
              </div>
              
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="db-host">Host</Label>
                    <Input
                      id="db-host"
                      value={dbConfig.host}
                      onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <Label htmlFor="db-name">Database Name</Label>
                    <Input
                      id="db-name"
                      value={dbConfig.name}
                      onChange={(e) => setDbConfig({ ...dbConfig, name: e.target.value })}
                      placeholder="tempmail_db"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="db-user">Username</Label>
                    <Input
                      id="db-user"
                      value={dbConfig.user}
                      onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                      placeholder="db_user"
                    />
                  </div>
                  <div>
                    <Label htmlFor="db-pass">Password</Label>
                    <div className="relative">
                      <Input
                        id="db-pass"
                        type={showPasswords['db'] ? 'text' : 'password'}
                        value={dbConfig.pass}
                        onChange={(e) => setDbConfig({ ...dbConfig, pass: e.target.value })}
                        placeholder="••••••••"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePassword('db')}
                      >
                        {showPasswords['db'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button onClick={testDatabaseConnection} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                Test Connection & Continue
              </Button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Create Admin Account</h3>
              </div>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="admin-name">Display Name</Label>
                  <Input
                    id="admin-name"
                    value={adminConfig.displayName}
                    onChange={(e) => setAdminConfig({ ...adminConfig, displayName: e.target.value })}
                    placeholder="Admin"
                  />
                </div>
                <div>
                  <Label htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminConfig.email}
                    onChange={(e) => setAdminConfig({ ...adminConfig, email: e.target.value })}
                    placeholder="admin@yourdomain.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="admin-pass">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-pass"
                        type={showPasswords['admin'] ? 'text' : 'password'}
                        value={adminConfig.password}
                        onChange={(e) => setAdminConfig({ ...adminConfig, password: e.target.value })}
                        placeholder="••••••••"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePassword('admin')}
                      >
                        {showPasswords['admin'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="admin-pass-confirm">Confirm Password</Label>
                    <Input
                      id="admin-pass-confirm"
                      type="password"
                      value={adminConfig.confirmPassword}
                      onChange={(e) => setAdminConfig({ ...adminConfig, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={createAdmin} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Admin & Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Email Configuration */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Email Configuration</h3>
              </div>
              
              {/* SMTP */}
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium text-sm">SMTP Settings (Outgoing)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtp-host">Host</Label>
                    <Input
                      id="smtp-host"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="smtp.yourdomain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input
                      id="smtp-port"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                      placeholder="587"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtp-user">Username</Label>
                    <Input
                      id="smtp-user"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="user@yourdomain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-pass">Password</Label>
                    <div className="relative">
                      <Input
                        id="smtp-pass"
                        type={showPasswords['smtp'] ? 'text' : 'password'}
                        value={smtpConfig.pass}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                        placeholder="••••••••"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePassword('smtp')}
                      >
                        {showPasswords['smtp'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="smtp-from">From Address</Label>
                  <Input
                    id="smtp-from"
                    value={smtpConfig.from}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={testSmtpConnection} disabled={isLoading}>
                  Test SMTP Connection
                </Button>
              </div>
              
              {/* IMAP */}
              <div className="p-4 border rounded-lg space-y-4">
                <h4 className="font-medium text-sm">IMAP Settings (Incoming)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imap-host">Host</Label>
                    <Input
                      id="imap-host"
                      value={imapConfig.host}
                      onChange={(e) => setImapConfig({ ...imapConfig, host: e.target.value })}
                      placeholder="imap.yourdomain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-port">Port</Label>
                    <Input
                      id="imap-port"
                      value={imapConfig.port}
                      onChange={(e) => setImapConfig({ ...imapConfig, port: e.target.value })}
                      placeholder="993"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imap-user">Username</Label>
                    <Input
                      id="imap-user"
                      value={imapConfig.user}
                      onChange={(e) => setImapConfig({ ...imapConfig, user: e.target.value })}
                      placeholder="user@yourdomain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-pass">Password</Label>
                    <div className="relative">
                      <Input
                        id="imap-pass"
                        type={showPasswords['imap'] ? 'text' : 'password'}
                        value={imapConfig.pass}
                        onChange={(e) => setImapConfig({ ...imapConfig, pass: e.target.value })}
                        placeholder="••••••••"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePassword('imap')}
                      >
                        {showPasswords['imap'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={testImapConnection} disabled={isLoading}>
                  Test IMAP Connection
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={saveSmtpConfig} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Configuration & Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold">Setup Complete!</h3>
                <p className="text-muted-foreground mt-2">
                  Your TempMail instance is ready to use.
                </p>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg text-left text-sm space-y-2">
                <p><strong>Next Steps:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Delete <code>install.php</code> for security</li>
                  <li>Configure cron jobs for email polling</li>
                  <li>Add your email domains in Admin → Domains</li>
                  <li>Configure additional mailboxes as needed</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={completeSetup} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Complete Setup & Login
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupWizard;
