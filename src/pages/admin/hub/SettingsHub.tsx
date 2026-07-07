import AdminHub from "./AdminHub";
import AdminGeneralSettings from "../AdminGeneralSettings";
import AdminAdvancedSettings from "../AdminAdvancedSettings";
import AdminSettingsOverview from "../AdminSettingsOverview";
import AdminAPI from "../AdminAPI";

const SettingsHub = () => (
  <AdminHub
    title="Settings"
    tabs={[
      { value: "general", label: "General", element: <AdminGeneralSettings /> },
      { value: "advanced", label: "Advanced", element: <AdminAdvancedSettings /> },
      { value: "overview", label: "Overview", element: <AdminSettingsOverview /> },
      { value: "api", label: "API", element: <AdminAPI /> },
    ]}
  />
);
export default SettingsHub;
