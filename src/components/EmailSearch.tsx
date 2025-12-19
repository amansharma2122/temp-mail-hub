import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Filter, Calendar, User, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ReceivedEmail } from "@/hooks/useSecureEmailService";

interface EmailSearchProps {
  emails: ReceivedEmail[];
  onFilteredEmails: (emails: ReceivedEmail[]) => void;
}

interface SearchFilters {
  unreadOnly: boolean;
  hasAttachments: boolean;
  dateRange: "all" | "today" | "week" | "month";
}

export const EmailSearch = ({ emails, onFilteredEmails }: EmailSearchProps) => {
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    unreadOnly: false,
    hasAttachments: false,
    dateRange: "all",
  });

  const filterEmails = useCallback(
    (searchQuery: string, currentFilters: SearchFilters) => {
      let result = [...emails];

      // Text search
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        result = result.filter(
          (email) =>
            email.subject?.toLowerCase().includes(lowerQuery) ||
            email.from_address.toLowerCase().includes(lowerQuery) ||
            email.body?.toLowerCase().includes(lowerQuery)
        );
      }

      // Filter: Unread only
      if (currentFilters.unreadOnly) {
        result = result.filter((email) => !email.is_read);
      }

      // Filter: Date range
      if (currentFilters.dateRange !== "all") {
        const now = new Date();
        const cutoff = new Date();
        
        switch (currentFilters.dateRange) {
          case "today":
            cutoff.setHours(0, 0, 0, 0);
            break;
          case "week":
            cutoff.setDate(now.getDate() - 7);
            break;
          case "month":
            cutoff.setMonth(now.getMonth() - 1);
            break;
        }
        
        result = result.filter(
          (email) => new Date(email.received_at) >= cutoff
        );
      }

      onFilteredEmails(result);
    },
    [emails, onFilteredEmails]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    filterEmails(value, filters);
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    filterEmails(query, updated);
  };

  const clearSearch = () => {
    setQuery("");
    setFilters({
      unreadOnly: false,
      hasAttachments: false,
      dateRange: "all",
    });
    onFilteredEmails(emails);
  };

  const hasActiveFilters =
    filters.unreadOnly || filters.hasAttachments || filters.dateRange !== "all";

  const resultCount = useMemo(() => {
    let count = emails.length;
    if (query || hasActiveFilters) {
      let result = [...emails];
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        result = result.filter(
          (email) =>
            email.subject?.toLowerCase().includes(lowerQuery) ||
            email.from_address.toLowerCase().includes(lowerQuery) ||
            email.body?.toLowerCase().includes(lowerQuery)
        );
      }
      if (filters.unreadOnly) {
        result = result.filter((email) => !email.is_read);
      }
      count = result.length;
    }
    return count;
  }, [emails, query, filters, hasActiveFilters]);

  return (
    <div className="relative">
      <motion.div
        initial={false}
        animate={{ width: isExpanded ? "100%" : "auto" }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Search emails..."
            className="pl-10 pr-10 bg-secondary/50 border-border focus:border-primary/50 transition-all"
          />
          <AnimatePresence>
            {(query || hasActiveFilters) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`relative ${hasActiveFilters ? "border-primary text-primary" : ""}`}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 glass-card" align="end">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Filters</h4>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unread"
                    checked={filters.unreadOnly}
                    onCheckedChange={(checked) =>
                      handleFilterChange({ unreadOnly: checked as boolean })
                    }
                  />
                  <Label htmlFor="unread" className="text-sm cursor-pointer">
                    Unread only
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="attachments"
                    checked={filters.hasAttachments}
                    onCheckedChange={(checked) =>
                      handleFilterChange({ hasAttachments: checked as boolean })
                    }
                  />
                  <Label htmlFor="attachments" className="text-sm cursor-pointer">
                    Has attachments
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Range
                </Label>
                <div className="flex flex-wrap gap-1">
                  {(["all", "today", "week", "month"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={filters.dateRange === range ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => handleFilterChange({ dateRange: range })}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="w-full text-muted-foreground"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      <AnimatePresence>
        {(query || hasActiveFilters) && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-muted-foreground mt-2"
          >
            {resultCount} {resultCount === 1 ? "result" : "results"} found
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmailSearch;
