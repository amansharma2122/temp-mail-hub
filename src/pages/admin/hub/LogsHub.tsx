import AdminHub from "./AdminHub";
import AdminAuditLogs from "../AdminAuditLogs";
import AdminErrorLogs from "../AdminErrorLogs";

const LogsHub = () => (
  <AdminHub
    title="Logs"
    tabs={[
      { value: "audit", label: "Audit", element: <AdminAuditLogs /> },
      { value: "errors", label: "Errors", element: <AdminErrorLogs /> },
    ]}
  />
);
export default LogsHub;
