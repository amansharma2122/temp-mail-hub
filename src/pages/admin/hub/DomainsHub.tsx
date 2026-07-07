import AdminHub from "./AdminHub";
import AdminDomains from "../AdminDomains";
import AdminCustomDomains from "../AdminCustomDomains";

const DomainsHub = () => (
  <AdminHub
    title="Domains"
    tabs={[
      { value: "domains", label: "Domains", element: <AdminDomains /> },
      { value: "custom", label: "Custom Domains", element: <AdminCustomDomains /> },
    ]}
  />
);
export default DomainsHub;
