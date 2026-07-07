import AdminHub from "./AdminHub";
import AdminMailboxes from "../AdminMailboxes";
import AdminMailboxHealth from "../AdminMailboxHealth";
import AdminIMAPSettings from "../AdminIMAPSettings";
import AdminSMTPSettings from "../AdminSMTPSettings";
import AdminEmailSetup from "../AdminEmailSetup";

const MailServersHub = () => (
  <AdminHub
    title="Mail Servers"
    description="Mailboxes, health/capacity, IMAP receiving, SMTP sending, and setup."
    tabs={[
      { value: "mailboxes", label: "Mailboxes", element: <AdminMailboxes /> },
      { value: "health", label: "Mailbox Health", element: <AdminMailboxHealth /> },
      { value: "imap", label: "IMAP", element: <AdminIMAPSettings /> },
      { value: "smtp", label: "SMTP", element: <AdminSMTPSettings /> },
      { value: "setup", label: "Setup Wizard", element: <AdminEmailSetup /> },
    ]}
  />
);
export default MailServersHub;
