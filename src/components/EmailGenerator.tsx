import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, RefreshCw, Check, QrCode, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const domains = [
  "@trashmail.io",
  "@tempbox.net",
  "@quickmail.xyz",
  "@disposable.email",
  "@burner.mail",
];

const generateRandomString = (length: number) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const EmailGenerator = () => {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState(domains[0]);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateEmail = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const username = generateRandomString(10);
      setEmail(username + domain);
      setIsGenerating(false);
    }, 500);
  };

  useEffect(() => {
    generateEmail();
  }, [domain]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    toast.success("Email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshEmail = () => {
    generateEmail();
    toast.success("New email generated!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="glass-card p-6 md:p-8">
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-sm mb-2">Your Temporary Email Address</p>
        </div>

        {/* Email Display */}
        <div className="relative mb-6">
          <motion.div
            key={email}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-secondary/50 rounded-xl p-4 md:p-6 border border-primary/20 neon-border"
          >
            <p className={`email-mono text-xl md:text-2xl text-center text-foreground break-all ${isGenerating ? 'blur-sm' : ''}`}>
              {email || "generating..."}
            </p>
          </motion.div>
          
          {/* Domain Selector */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-48 bg-card border-primary/30 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Button
            variant="neon"
            size="lg"
            onClick={copyToClipboard}
            className="min-w-[140px]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy
              </>
            )}
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={refreshEmail}
            disabled={isGenerating}
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            New Email
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={() => setShowQR(!showQR)}
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </Button>

          <Button variant="glass" size="lg">
            <Star className="w-4 h-4" />
            Save
          </Button>

          <Button variant="glass" size="lg">
            <Volume2 className="w-4 h-4" />
            Sound
          </Button>
        </div>

        {/* QR Code Display */}
        {showQR && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex justify-center mt-6 pt-6 border-t border-border"
          >
            <div className="bg-foreground p-4 rounded-xl">
              <QRCodeSVG value={email} size={150} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default EmailGenerator;
