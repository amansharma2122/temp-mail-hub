import AdminHub from "./AdminHub";
import AdminUsers from "../AdminUsers";
import AdminAdmins from "../AdminAdmins";
import AdminRoleApprovals from "../AdminRoleApprovals";
import AdminUserSettings from "../AdminUserSettings";

const UsersHub = () => (
  <AdminHub
    title="Users & Access"
    description="All user accounts, admin roles, role approvals, and default limits."
    tabs={[
      { value: "users", label: "All Users", element: <AdminUsers /> },
      { value: "admins", label: "Admins", element: <AdminAdmins /> },
      { value: "approvals", label: "Role Approvals", element: <AdminRoleApprovals /> },
      { value: "defaults", label: "User & Guest Defaults", element: <AdminUserSettings /> },
    ]}
  />
);
export default UsersHub;