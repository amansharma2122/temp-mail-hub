import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Check, 
  Loader2,
  Star,
  RefreshCw,
  ExternalLink,
  Server,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface DomainSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  serverIP?: string;
}

interface DNSRecord {
  type: string;
  host: string;
  value: string;
  priority?: number;
}

interface StepStatus {
  checked: boolean;
  passed: boolean;
  message?: string;
}

const steps = [
  { id: 'domain', title: 'Domain Name', required: true },
  { id: 'mx', title: 'MX Record', required: true },
  { id: 'spf', title: 'SPF Record', required: false },
  { id: 'dkim', title: 'DKIM Record', required: false },
  { id: 'dmarc', title: 'DMARC Record', required: false },
  { id: 'review', title: 'Review & Activate', required: true },
];

const DomainSetupWizard = ({ open, onOpenChange, onComplete, serverIP = '0.0.0.0' }: DomainSetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [domainName, setDomainName] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    mx: { checked: false, passed: false },
    spf: { checked: false, passed: false },
    dkim: { checked: false, passed: false },
    dmarc: { checked: false, passed: false },
  });
  const [activating, setActivating] = useState(false);

  const cleanDomain = domainName.replace(/^@/, '').toLowerCase();

  const getDNSRecords = (): Record<string, DNSRecord> => ({
    mx: {
      type: 'MX',
      host: '@',
      value: `mail.${cleanDomain}`,
      priority: 10,
    },
    spf: {
      type: 'TXT',
      host: '@',
      value: `v=spf1 ip4:${serverIP} a mx ~all`,
    },
    dkim: {
      type: 'TXT',
      host: 'default._domainkey',
      value: `v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY`,
    },
    dmarc: {
      type: 'TXT',
      host: '_dmarc',
      value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${cleanDomain}`,
    },
  });

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success("Copied to clipboard");
  };

  const handleCreateDomain = async () => {
    if (!domainName.trim()) {
      toast.error("Please enter a domain name");
      return;
    }

    const normalized = domainName.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/.test(normalized)) {
      toast.error("Please enter a valid domain name (e.g., example.com)");
      return;
    }

    setChecking(true);
    try {
      const { data, error } = await api.admin.addDomain(`@${normalized}`, isPremium);
      if (error) {
        toast.error(error.message || "Failed to add domain");
        return;
      }
      setDomainId(data?.id);
      setCurrentStep(1);
      toast.success("Domain created! Now configure your DNS records.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add domain");
    } finally {
      setChecking(false);
    }
  };

  const handleCheckDNS = async (recordType: string) => {
    if (!cleanDomain) return;

    setChecking(true);
    try {
      const { data, error } = await api.admin.verifyDomainDNS(cleanDomain);
      
      if (error) {
        setStepStatuses(prev => ({
          ...prev,
          [recordType]: { checked: true, passed: false, message: error.message },
        }));
        return;
      }

      const checks = data?.checks || {};
      const recordCheck = checks[recordType.toUpperCase()] || checks[recordType];
      const passed = recordCheck?.status === 'pass';

      setStepStatuses(prev => ({
        ...prev,
        [recordType]: { 
          checked: true, 
          passed, 
          message: recordCheck?.message || (passed ? 'Record verified' : 'Record not found'),
        },
      }));

      if (passed) {
        toast.success(`${recordType.toUpperCase()} record verified!`);
      } else {
        toast.error(`${recordType.toUpperCase()} record not found or invalid`);
      }
    } catch (err: any) {
      setStepStatuses(prev => ({
        ...prev,
        [recordType]: { checked: true, passed: false, message: err.message },
      }));
      toast.error(err.message || "Failed to check DNS");
    } finally {
      setChecking(false);
    }
  };

  const handleSkipStep = () => {
    const stepId = steps[currentStep].id;
    setStepStatuses(prev => ({
      ...prev,
      [stepId]: { checked: true, passed: false, message: 'Skipped' },
    }));
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleActivate = async () => {
    if (!domainId) {
      toast.error("Domain ID not found");
      return;
    }

    setActivating(true);
    try {
      const { error } = await api.admin.updateDomain(domainId, { is_active: true });
      if (error) {
        toast.error(error.message || "Failed to activate domain");
        return;
      }
      toast.success("Domain activated successfully!");
      onComplete();
      onOpenChange(false);
      resetWizard();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate domain");
    } finally {
      setActivating(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setDomainName("");
    setIsPremium(false);
    setDomainId(null);
    setStepStatuses({
      mx: { checked: false, passed: false },
      spf: { checked: false, passed: false },
      dkim: { checked: false, passed: false },
      dmarc: { checked: false, passed: false },
    });
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const renderStepContent = () => {
    const dnsRecords = getDNSRecords();

    switch (steps[currentStep].id) {
      case 'domain':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Globe className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Enter Your Domain</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This domain will be used for temporary email addresses
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Domain Name</Label>
                <Input
                  placeholder="example.com"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your domain without @ or https://
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <div>
                    <Label>Premium-Only Domain</Label>
                    <p className="text-xs text-muted-foreground">
                      Only paying subscribers can use this domain
                    </p>
                  </div>
                </div>
                <Switch checked={isPremium} onCheckedChange={setIsPremium} />
              </div>
            </div>

            <Button 
              onClick={handleCreateDomain} 
              className="w-full"
              disabled={checking || !domainName.trim()}
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      case 'mx':
      case 'spf':
      case 'dkim':
      case 'dmarc':
        const recordType = steps[currentStep].id;
        const record = dnsRecords[recordType];
        const status = stepStatuses[recordType];
        const isRequired = steps[currentStep].required;

        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                status.passed ? 'bg-emerald-500/20' : 'bg-primary/20'
              }`}>
                {status.passed ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                ) : (
                  <Server className="w-8 h-8 text-primary" />
                )}
              </div>
              <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                Configure {record.type} Record
                {isRequired ? (
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add this record in your domain's DNS settings
              </p>
            </div>

            <Card className="bg-secondary/30">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Type</span>
                  <span className="font-mono text-sm">{record.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Host/Name</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{record.host}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(record.host, `${recordType}-host`)}
                    >
                      {copiedField === `${recordType}-host` ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                {record.priority !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Priority</span>
                    <span className="font-mono text-sm">{record.priority}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Value</span>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-sm text-right break-all">{record.value}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(record.value, `${recordType}-value`)}
                    >
                      {copiedField === `${recordType}-value` ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {status.checked && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                status.passed 
                  ? 'bg-emerald-500/10 border border-emerald-500/30' 
                  : 'bg-destructive/10 border border-destructive/30'
              }`}>
                {status.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <span className={status.passed ? 'text-emerald-500' : 'text-destructive'}>
                  {status.message}
                </span>
              </div>
            )}

            {/* DNS Provider Guides */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="guides" className="border-none">
                <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    DNS Provider Setup Guides
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Tabs defaultValue="cloudflare" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-auto">
                      <TabsTrigger value="cloudflare" className="text-xs py-1">Cloudflare</TabsTrigger>
                      <TabsTrigger value="godaddy" className="text-xs py-1">GoDaddy</TabsTrigger>
                      <TabsTrigger value="namecheap" className="text-xs py-1">Namecheap</TabsTrigger>
                      <TabsTrigger value="other" className="text-xs py-1">Other</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="cloudflare" className="mt-3 space-y-2">
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Log in to your Cloudflare dashboard</li>
                        <li>Select your domain</li>
                        <li>Click <strong className="text-foreground">DNS</strong> in the sidebar</li>
                        <li>Click <strong className="text-foreground">Add record</strong></li>
                        <li>Select type: <code className="bg-secondary px-1 rounded">{record.type}</code></li>
                        <li>Set Name: <code className="bg-secondary px-1 rounded">{record.host}</code></li>
                        {record.priority !== undefined && (
                          <li>Set Priority: <code className="bg-secondary px-1 rounded">{record.priority}</code></li>
                        )}
                        <li>Paste the value from above</li>
                        <li>Click <strong className="text-foreground">Save</strong></li>
                      </ol>
                      <a 
                        href="https://dash.cloudflare.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        Open Cloudflare Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </TabsContent>
                    
                    <TabsContent value="godaddy" className="mt-3 space-y-2">
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Log in to GoDaddy</li>
                        <li>Go to <strong className="text-foreground">My Products</strong></li>
                        <li>Click <strong className="text-foreground">DNS</strong> next to your domain</li>
                        <li>Scroll to Records section</li>
                        <li>Click <strong className="text-foreground">Add</strong></li>
                        <li>Select type: <code className="bg-secondary px-1 rounded">{record.type}</code></li>
                        <li>Enter Host: <code className="bg-secondary px-1 rounded">{record.host === '@' ? '@' : record.host}</code></li>
                        {record.priority !== undefined && (
                          <li>Set Priority: <code className="bg-secondary px-1 rounded">{record.priority}</code></li>
                        )}
                        <li>Paste the value</li>
                        <li>Click <strong className="text-foreground">Save</strong></li>
                      </ol>
                      <a 
                        href="https://dcc.godaddy.com/manage" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        Open GoDaddy Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </TabsContent>
                    
                    <TabsContent value="namecheap" className="mt-3 space-y-2">
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Log in to Namecheap</li>
                        <li>Go to <strong className="text-foreground">Domain List</strong></li>
                        <li>Click <strong className="text-foreground">Manage</strong> on your domain</li>
                        <li>Click <strong className="text-foreground">Advanced DNS</strong> tab</li>
                        <li>Click <strong className="text-foreground">Add New Record</strong></li>
                        <li>Select type: <code className="bg-secondary px-1 rounded">{record.type}</code></li>
                        <li>Set Host: <code className="bg-secondary px-1 rounded">{record.host}</code></li>
                        {record.priority !== undefined && (
                          <li>Set Priority: <code className="bg-secondary px-1 rounded">{record.priority}</code></li>
                        )}
                        <li>Paste the value</li>
                        <li>Click the checkmark to save</li>
                      </ol>
                      <a 
                        href="https://ap.www.namecheap.com/domains/list" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        Open Namecheap Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </TabsContent>
                    
                    <TabsContent value="other" className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        For other providers, the general steps are:
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Log in to your domain registrar or DNS provider</li>
                        <li>Find DNS settings or DNS management</li>
                        <li>Add a new <code className="bg-secondary px-1 rounded">{record.type}</code> record</li>
                        <li>Set the host/name to <code className="bg-secondary px-1 rounded">{record.host}</code></li>
                        {record.priority !== undefined && (
                          <li>Set priority to <code className="bg-secondary px-1 rounded">{record.priority}</code></li>
                        )}
                        <li>Paste the value</li>
                        <li>Set TTL to Auto or 3600</li>
                        <li>Save the record</li>
                      </ol>
                      <p className="text-xs text-muted-foreground mt-2">
                        DNS changes can take up to 48 hours to propagate, but usually take 15-30 minutes.
                      </p>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipStep}
                disabled={isRequired && !status.passed}
                className="flex-1"
              >
                {isRequired ? "Skip (requires pass)" : "Skip for now"}
              </Button>
              <Button
                onClick={() => handleCheckDNS(recordType)}
                disabled={checking}
                className="flex-1"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verify Record
                  </>
                )}
              </Button>
            </div>

            {(status.passed || !isRequired) && (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="w-full"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Review & Activate</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review your DNS configuration before activating
              </p>
            </div>

            <Card className="bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {domainName}
                  {isPremium && (
                    <Badge className="bg-yellow-500/20 text-yellow-500">
                      <Star className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {['mx', 'spf', 'dkim', 'dmarc'].map((type) => {
                  const status = stepStatuses[type];
                  const isRequired = type === 'mx';
                  return (
                    <div key={type} className="flex items-center justify-between py-1">
                      <span className="text-sm uppercase font-medium">{type}</span>
                      <div className="flex items-center gap-2">
                        {status.passed ? (
                          <Badge className="bg-emerald-500/20 text-emerald-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : status.checked ? (
                          <Badge variant="secondary">
                            Skipped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not checked
                          </Badge>
                        )}
                        {isRequired && !status.passed && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {!stepStatuses.mx.passed && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">MX Record Not Verified</p>
                  <p className="text-xs text-yellow-500/80 mt-0.5">
                    The domain may not receive emails without a valid MX record.
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleActivate}
              disabled={activating}
              className="w-full"
              variant="neon"
            >
              {activating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  Activate Domain
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetWizard();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Domain Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={index <= currentStep ? 'text-primary font-medium' : ''}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="absolute left-4 bottom-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DomainSetupWizard;
