import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import AdminPurgeCacheButton from "@/components/admin/AdminPurgeCacheButton";
import AdminAppSettingsUpdateToast from "@/components/admin/AdminAppSettingsUpdateToast";

const AdminLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminAppSettingsUpdateToast />
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/50 backdrop-blur-xl sticky top-0 z-10">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <AdminBreadcrumbs />
            </div>
            <AdminPurgeCacheButton />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
