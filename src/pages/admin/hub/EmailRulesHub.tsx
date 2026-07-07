import AdminHub from "./AdminHub";
import AdminEmailTemplates from "../AdminEmailTemplates";
import AdminEmailRestrictions from "../AdminEmailRestrictions";
import AdminEmailBlocking from "../AdminEmailBlocking";

const EmailRulesHub = () => (
  <AdminHub
    title="Email Rules"
    description="Templates for outbound messages, restrictions on addresses, and blocked patterns."
    tabs={[
      { value: "templates", label: "Templates", element: <AdminEmailTemplates /> },
      { value: "restrictions", label: "Restrictions", element: <AdminEmailRestrictions /> },
      { value: "blocking", label: "Blocking", element: <AdminEmailBlocking /> },
    ]}
  />
);
export default EmailRulesHub;
