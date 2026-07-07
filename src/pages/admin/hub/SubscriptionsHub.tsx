import AdminHub from "./AdminHub";
import AdminSubscriptions from "../AdminSubscriptions";
import AdminPricing from "../AdminPricing";
import AdminPayments from "../AdminPayments";
import AdminWebhooks from "../AdminWebhooks";

const SubscriptionsHub = () => (
  <AdminHub
    title="Subscriptions"
    description="Plans, pricing, payment gateways, and webhooks in one place."
    tabs={[
      { value: "subscriptions", label: "Subscriptions", element: <AdminSubscriptions /> },
      { value: "pricing", label: "Pricing", element: <AdminPricing /> },
      { value: "payments", label: "Payments", element: <AdminPayments /> },
      { value: "webhooks", label: "Webhooks", element: <AdminWebhooks /> },
    ]}
  />
);
export default SubscriptionsHub;