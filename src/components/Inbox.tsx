import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Trash2, Star, Clock, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  isRead: boolean;
  isStarred: boolean;
}

const mockEmails: Email[] = [
  {
    id: "1",
    from: "noreply@github.com",
    subject: "Your verification code is 847291",
    preview: "Hi there, please use the following code to verify your account: 847291. This code expires in 10 minutes.",
    time: "2 min ago",
    isRead: false,
    isStarred: false,
  },
  {
    id: "2",
    from: "welcome@spotify.com",
    subject: "Welcome to Spotify Premium",
    preview: "Thank you for joining Spotify Premium! You now have access to unlimited music streaming without ads...",
    time: "15 min ago",
    isRead: true,
    isStarred: true,
  },
  {
    id: "3",
    from: "security@dropbox.com",
    subject: "New sign-in from Chrome on Windows",
    preview: "We noticed a new sign-in to your Dropbox account. If this was you, no action is needed.",
    time: "1 hour ago",
    isRead: true,
    isStarred: false,
  },
];

const Inbox = () => {
  const [emails, setEmails] = useState<Email[]>(mockEmails);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(emails.map(email => 
      email.id === id ? { ...email, isStarred: !email.isStarred } : email
    ));
  };

  const deleteEmail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(emails.filter(email => email.id !== id));
    if (selectedEmail?.id === id) setSelectedEmail(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="w-full max-w-4xl mx-auto mt-8"
    >
      <div className="glass-card overflow-hidden">
        {/* Inbox Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Inbox</h2>
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              {emails.filter(e => !e.isRead).length} new
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Email List */}
        <div className="divide-y divide-border">
          <AnimatePresence>
            {emails.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <Mail className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No emails yet</p>
                <p className="text-sm text-muted-foreground mt-1">Waiting for incoming messages...</p>
              </motion.div>
            ) : (
              emails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedEmail(email)}
                  className={`group p-4 cursor-pointer transition-colors hover:bg-secondary/30 ${
                    !email.isRead ? 'bg-primary/5' : ''
                  } ${selectedEmail?.id === email.id ? 'bg-secondary/50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>

                    {/* Email Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {email.from}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{email.time}</span>
                        </div>
                      </div>
                      <p className={`text-sm truncate ${!email.isRead ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {email.preview}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => toggleStar(email.id, e)}
                        className={`p-1.5 rounded hover:bg-secondary transition-colors ${
                          email.isStarred ? 'text-yellow-400' : 'text-muted-foreground'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={email.isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={(e) => deleteEmail(email.id, e)}
                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Selected Email Preview */}
        <AnimatePresence>
          {selectedEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-secondary/20"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">{selectedEmail.subject}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                    Close
                  </Button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedEmail.from}</p>
                    <p className="text-xs text-muted-foreground">{selectedEmail.time}</p>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/80">{selectedEmail.preview}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Inbox;
