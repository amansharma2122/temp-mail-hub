import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { findNavItem } from "@/lib/adminNav";

const AdminBreadcrumbs = () => {
  const { pathname } = useLocation();
  const match = findNavItem(pathname);

  if (pathname === "/admin" || !match) {
    return (
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Admin</Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      <Link to="/admin" className="hover:text-foreground shrink-0">Admin</Link>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      <span className="shrink-0">{match.groupLabel}</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      <span className="text-foreground font-medium truncate">{match.title}</span>
    </nav>
  );
};

export default AdminBreadcrumbs;