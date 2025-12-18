import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Server, Mail, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

interface ImapFetchStats {
  timestamp: string;
  scanned: number;
  matched: number;
  stored: number;
  noMatch: number;
  failed: number;
  duration?: number;
  error?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  fromEmail: string;
  enabled: boolean;
}

const IMAP_STATS_KEY = 'last_imap_fetch_stats';
const SMTP_SETTINGS_KEY = 'smtp_settings';

export const saveImapFetchStats = (stats: Omit<ImapFetchStats, 'timestamp'>) => {
  storage.set(IMAP_STATS_KEY, {
    ...stats,
    timestamp: new Date().toISOString(),
  });
};

const InboxDiagnostics = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imapStats, setImapStats] = useState<ImapFetchStats | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);

  const loadDiagnostics = () => {
    const stats = storage.get<ImapFetchStats | null>(IMAP_STATS_KEY, null);
    setImapStats(stats);

    const smtp = storage.get<SmtpConfig | null>(SMTP_SETTINGS_KEY, null);
    setSmtpConfig(smtp);
  };

  useEffect(() => {
    loadDiagnostics();
    // Refresh every 10 seconds when expanded
    const interval = isExpanded ? setInterval(loadDiagnostics, 10000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExpanded]);

  const getImapStatus = () => {
    if (!imapStats) return { status: 'unknown', color: 'text-muted-foreground', message: 'No fetch recorded' };
    if (imapStats.error) return { status: 'error', color: 'text-destructive', message: imapStats.error };
    if (imapStats.stored > 0) return { status: 'success', color: 'text-green-500', message: `${imapStats.stored} emails stored` };
    if (imapStats.noMatch > 0) return { status: 'warning', color: 'text-yellow-500', message: `${imapStats.noMatch} scanned, none matched` };
    return { status: 'idle', color: 'text-muted-foreground', message: 'No new emails' };
  };

  const getSmtpStatus = () => {
    if (!smtpConfig?.host) return { status: 'unconfigured', color: 'text-muted-foreground', message: 'Not configured' };
    if (!smtpConfig.username) return { status: 'incomplete', color: 'text-yellow-500', message: 'Missing credentials' };
    
    // Check if fromEmail matches username domain
    const userDomain = smtpConfig.username.split('@')[1];
    const fromDomain = smtpConfig.fromEmail?.split('@')[1];
    if (userDomain && fromDomain && userDomain !== fromDomain) {
      return { status: 'warning', color: 'text-yellow-500', message: `From domain mismatch (${fromDomain} ≠ ${userDomain})` };
    }
    
    return { status: 'configured', color: 'text-green-500', message: `${smtpConfig.host}:${smtpConfig.port}` };
  };

  const imapStatus = getImapStatus();
  const smtpStatus = getSmtpStatus();

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" />
          <span>Diagnostics</span>
          {imapStats?.error && <AlertCircle className="w-3 h-3 text-destructive" />}
        </div>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3 bg-secondary/10 border-t border-border/30">
              {/* Refresh button */}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={loadDiagnostics} className="h-6 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>

              {/* IMAP Status */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Mail className="w-3 h-3 text-primary" />
                  <span>Last IMAP Fetch</span>
                </div>
                <div className="pl-5 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {imapStatus.status === 'error' ? (
                      <XCircle className={`w-3 h-3 ${imapStatus.color}`} />
                    ) : imapStatus.status === 'success' ? (
                      <CheckCircle className={`w-3 h-3 ${imapStatus.color}`} />
                    ) : (
                      <AlertCircle className={`w-3 h-3 ${imapStatus.color}`} />
                    )}
                    <span className={imapStatus.color}>{imapStatus.message}</span>
                  </div>
                  {imapStats && (
                    <>
                      <div className="text-muted-foreground">
                        Scanned: {imapStats.scanned} | Matched: {imapStats.matched} | Stored: {imapStats.stored}
                      </div>
                      <div className="text-muted-foreground">
                        {formatDistanceToNow(new Date(imapStats.timestamp), { addSuffix: true })}
                        {imapStats.duration && ` (${imapStats.duration}ms)`}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SMTP Status */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Server className="w-3 h-3 text-primary" />
                  <span>SMTP Configuration</span>
                </div>
                <div className="pl-5 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {smtpStatus.status === 'configured' ? (
                      <CheckCircle className={`w-3 h-3 ${smtpStatus.color}`} />
                    ) : smtpStatus.status === 'warning' ? (
                      <AlertCircle className={`w-3 h-3 ${smtpStatus.color}`} />
                    ) : (
                      <XCircle className={`w-3 h-3 ${smtpStatus.color}`} />
                    )}
                    <span className={smtpStatus.color}>{smtpStatus.message}</span>
                  </div>
                  {smtpConfig?.host && (
                    <div className="text-muted-foreground">
                      From: {smtpConfig.fromEmail || smtpConfig.username || 'Not set'}
                    </div>
                  )}
                </div>
              </div>

              {/* Error details */}
              {imapStats?.error && (
                <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
                  <strong>Last Error:</strong> {imapStats.error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InboxDiagnostics;
