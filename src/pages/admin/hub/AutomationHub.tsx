import AdminHub from "./AdminHub";
import AdminCron from "../AdminCron";
import AdminAlertSettings from "../AdminAlertSettings";
import AdminMaintenance from "../AdminMaintenance";
import AdminStatusSettings from "../AdminStatusSettings";

const AutomationHub = () => (
  <AdminHub
    title="Automation"
    tabs={[
      { value: "cron", label: "Cron Jobs", element: <AdminCron /> },
      { value: "alerts", label: "Alerts", element: <AdminAlertSettings /> },
      { value: "maintenance", label: "Maintenance", element: <AdminMaintenance /> },
      { value: "status", label: "Status Settings", element: <AdminStatusSettings /> },
    ]}
  />
);
export default AutomationHub;
