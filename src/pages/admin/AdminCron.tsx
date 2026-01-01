import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Clock, Play, Loader2, RefreshCw, Calendar, CheckCircle, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  last_run: string | null;
  next_run: string | null;
  status: 'active' | 'paused' | 'running';
  last_result: 'success' | 'failed' | null;
}

const DEFAULT_CRON_JOBS: CronJob[] = [
  { 
    id: 'clean-emails', 
    name: 'Clean Expired Emails', 
    description: 'Delete temporary emails that have passed their expiration time',
    schedule: '0 * * * *', 
    last_run: null, 
    next_run: null,
    status: 'active',
    last_result: null
  },
  { 
    id: 'imap-poll', 
    name: 'IMAP Polling', 
    description: 'Check mailboxes for new incoming emails',
    schedule: '*/5 * * * *', 
    last_run: null, 
    next_run: null,
    status: 'active',
    last_result: null
  },
  { 
    id: 'cleanup-backups', 
    name: 'Cleanup Old Backups', 
    description: 'Remove expired backup records from the database',
    schedule: '0 0 * * *', 
    last_run: null, 
    next_run: null,
    status: 'active',
    last_result: null
  },
];

const AdminCron = () => {
  const [jobs, setJobs] = useState<CronJob[]>(DEFAULT_CRON_JOBS);
  const [isLoading, setIsLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  const fetchCronJobs = async () => {
    try {
      const { data, error } = await api.admin.getCronJobs();
      if (error) throw new Error(error.message);
      
      if (data && data.length > 0) {
        setJobs(data);
      }
      // If no data from API, use default jobs
    } catch (error) {
      console.error('Error fetching cron jobs:', error);
      // Keep using default jobs
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCronJobs();
  }, []);

  const handleRunJob = async (jobId: string, jobName: string) => {
    setRunningJobs(prev => new Set(prev).add(jobId));
    
    try {
      const { data, error } = await api.admin.runCronJob(jobId);
      if (error) throw new Error(error.message);
      
      toast.success(`${jobName} executed successfully`);
      
      // Update last run time
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, last_run: new Date().toISOString(), last_result: 'success' as const }
          : job
      ));
    } catch (error: any) {
      console.error('Error running cron job:', error);
      toast.error(error.message || `Failed to run ${jobName}`);
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, last_result: 'failed' as const }
          : job
      ));
    } finally {
      setRunningJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    try {
      const { error } = await api.admin.toggleCronJob(jobId, enabled);
      if (error) throw new Error(error.message);
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: enabled ? 'active' : 'paused' }
          : job
      ));
      
      toast.success(`Job ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error toggling cron job:', error);
      toast.error(error.message || 'Failed to toggle job');
    }
  };

  const parseSchedule = (schedule: string): string => {
    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    if (minute === '*' && hour === '*') return 'Every minute';
    if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
    if (minute === '0' && hour === '*') return 'Every hour';
    if (minute === '0' && hour === '0') return 'Daily at midnight';
    
    return schedule;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Cron Jobs
          </h1>
          <p className="text-muted-foreground">Manage scheduled background tasks</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={fetchCronJobs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh job status</TooltipContent>
        </Tooltip>
      </div>

      {api.isSupabase && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-600">
              Cron job management is limited when using Lovable Cloud. 
              Jobs are managed automatically via scheduled edge functions.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            Background tasks that run on a schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            jobs.map(job => (
              <div 
                key={job.id} 
                className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-foreground">{job.name}</p>
                    <Badge 
                      variant={job.status === 'active' ? 'default' : 'secondary'}
                      className={job.status === 'active' ? 'bg-green-500/20 text-green-500' : ''}
                    >
                      {job.status}
                    </Badge>
                    {job.last_result && (
                      <Tooltip>
                        <TooltipTrigger>
                          {job.last_result === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          Last run: {job.last_result}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-secondary px-2 py-0.5 rounded">
                      {parseSchedule(job.schedule)}
                    </span>
                    {job.last_run && (
                      <span>
                        Last run: {formatDistanceToNow(new Date(job.last_run), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!api.isSupabase && (
                    <Switch
                      checked={job.status === 'active'}
                      onCheckedChange={(checked) => handleToggleJob(job.id, checked)}
                    />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleRunJob(job.id, job.name)}
                        disabled={runningJobs.has(job.id)}
                      >
                        {runningJobs.has(job.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run now</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Cron Schedule Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cron Schedule Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <p className="font-mono text-muted-foreground">* * * * *</p>
              <p className="text-xs mt-1">min hr day mon dow</p>
            </div>
            <div>
              <p className="font-mono text-primary">*/5 * * * *</p>
              <p className="text-xs text-muted-foreground">Every 5 mins</p>
            </div>
            <div>
              <p className="font-mono text-primary">0 * * * *</p>
              <p className="text-xs text-muted-foreground">Every hour</p>
            </div>
            <div>
              <p className="font-mono text-primary">0 0 * * *</p>
              <p className="text-xs text-muted-foreground">Daily</p>
            </div>
            <div>
              <p className="font-mono text-primary">0 0 * * 0</p>
              <p className="text-xs text-muted-foreground">Weekly</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCron;
