import AdminHub from "./AdminHub";
import AdminEmails from "../AdminEmails";
import AdminEmailLogs from "../AdminEmailLogs";

const EmailsHub = () => (
  <AdminHub
    title="Emails"
    tabs={[
      { value: "emails", label: "Emails", element: <AdminEmails /> },
      { value: "logs", label: "Email Logs", element: <AdminEmailLogs /> },
    ]}
  />
);
export default EmailsHub;
