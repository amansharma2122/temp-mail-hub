import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Users, TrendingUp, Clock, CreditCard, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  proSubscribers: number;
  businessSubscribers: number;
  recentAssignments: {
    id: string;
    user_email: string;
    tier_name: string;
    assigned_at: string;
    expires_at: string;
  }[];
}

const SubscriptionStatsWidget = () => {
  const [stats, setStats] = useState<SubscriptionStats>({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    proSubscribers: 0,
    businessSubscribers: 0,
    recentAssignments: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch subscription counts
      const { data: subsData, error: subsError } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          status,
          current_period_end,
          created_at,
          user_id,
          subscription_tiers (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (subsError) throw subsError;

      const subscriptions = subsData || [];
      const activeCount = subscriptions.filter(s => s.status === 'active').length;
      
      // Count by tier
      let proCount = 0;
      let businessCount = 0;
      subscriptions.forEach(sub => {
        const tierName = (sub.subscription_tiers as any)?.name?.toLowerCase() || '';
        if (sub.status === 'active') {
          if (tierName === 'pro') proCount++;
          if (tierName === 'business') businessCount++;
        }
      });

      // Get recent assignments with user emails
      const recentSubs = subscriptions.slice(0, 5);
      const userIds = recentSubs.map(s => s.user_id).filter(Boolean);
      
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, email, display_name')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesData.forEach(p => {
            userEmails[p.user_id] = p.email || p.display_name || 'Unknown';
          });
        }
      }

      const recentAssignments = recentSubs.map(sub => ({
        id: sub.id,
        user_email: userEmails[sub.user_id] || 'Unknown User',
        tier_name: (sub.subscription_tiers as any)?.name || 'Unknown',
        assigned_at: sub.created_at,
        expires_at: sub.current_period_end,
      }));

      setStats({
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeCount,
        proSubscribers: proCount,
        businessSubscribers: businessCount,
        recentAssignments,
      });
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Set up realtime subscription
    const channel = supabase
      .channel('subscription_stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getTierColor = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'business':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
      case 'pro':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Subscription Stats</h2>
            <p className="text-sm text-muted-foreground">Real-time subscription metrics</p>
          </div>
        </div>
        <a 
          href="/admin/subscriptions" 
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Manage <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? '...' : stats.totalSubscriptions}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-500">
            {isLoading ? '...' : stats.activeSubscriptions}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Pro</span>
          </div>
          <p className="text-2xl font-bold text-purple-500">
            {isLoading ? '...' : stats.proSubscribers}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Business</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">
            {isLoading ? '...' : stats.businessSubscribers}
          </p>
        </div>
      </div>

      {/* Recent Assignments */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Assignments
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : stats.recentAssignments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No subscriptions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-medium">
                    {assignment.user_email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                      {assignment.user_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getTierColor(assignment.tier_name)}>
                    {assignment.tier_name}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires {format(new Date(assignment.expires_at), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SubscriptionStatsWidget;
