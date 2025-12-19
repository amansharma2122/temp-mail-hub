import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileText, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ReceivedEmail } from "@/hooks/useSecureEmailService";
import { useConfetti } from "@/hooks/useConfetti";

interface EmailExportProps {
  email: ReceivedEmail;
}

export const EmailExport = ({ email }: EmailExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const { fireSuccessConfetti } = useConfetti();

  const exportAsEML = () => {
    setIsExporting(true);
    try {
      const emlContent = `From: ${email.from_address}
To: ${email.temp_email_id}
Subject: ${email.subject || "(No Subject)"}
Date: ${new Date(email.received_at).toUTCString()}
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

${email.html_body || email.body || ""}
`;

      const blob = new Blob([emlContent], { type: "message/rfc822" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `email-${email.id.slice(0, 8)}.eml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Email exported as EML!");
      fireSuccessConfetti();
    } catch (error) {
      toast.error("Failed to export email");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    setIsExporting(true);
    try {
      // Create a printable HTML version
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Please allow popups to export as PDF");
        return;
      }

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${email.subject || "Email"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #1a1a1a;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .meta {
      color: #6b7280;
      font-size: 14px;
      margin: 8px 0;
    }
    .subject {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 10px;
    }
    .body {
      margin-top: 20px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }
    @media print {
      body { margin: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="subject">${email.subject || "(No Subject)"}</h1>
    <p class="meta"><strong>From:</strong> ${email.from_address}</p>
    <p class="meta"><strong>Date:</strong> ${new Date(email.received_at).toLocaleString()}</p>
  </div>
  <div class="body">
    ${email.html_body || `<pre style="white-space: pre-wrap; font-family: inherit;">${email.body || ""}</pre>`}
  </div>
  <div class="footer">
    Exported from Nullsto Email on ${new Date().toLocaleString()}
  </div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>
`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success("Opening print dialog for PDF export...");
      fireSuccessConfetti();
    } catch (error) {
      toast.error("Failed to export email");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsText = () => {
    setIsExporting(true);
    try {
      const textContent = `From: ${email.from_address}
Subject: ${email.subject || "(No Subject)"}
Date: ${new Date(email.received_at).toLocaleString()}

${email.body || ""}
`;

      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `email-${email.id.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Email exported as text!");
      fireSuccessConfetti();
    } catch (error) {
      toast.error("Failed to export email");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="gap-2 hover-lift"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-card">
        <DropdownMenuItem onClick={exportAsPDF} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-500" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsEML} className="gap-2 cursor-pointer">
          <File className="w-4 h-4 text-blue-500" />
          Export as EML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsText} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Export as Text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EmailExport;
