import AdminHub from "./AdminHub";
import AdminIPBlocking from "../AdminIPBlocking";
import AdminGeoBlocking from "../AdminGeoBlocking";
import AdminRegistrationIPs from "../AdminRegistrationIPs";
import AdminRegistration from "../AdminRegistration";
import AdminCaptcha from "../AdminCaptcha";
import AdminRateLimits from "../AdminRateLimits";

const SecurityHub = () => (
  <AdminHub
    title="Security"
    description="Access control: IP, geo, registration, captcha, and rate limits."
    tabs={[
      { value: "ip", label: "IP Blocking", element: <AdminIPBlocking /> },
      { value: "geo", label: "Geo Blocking", element: <AdminGeoBlocking /> },
      { value: "reg-ips", label: "Registration IPs", element: <AdminRegistrationIPs /> },
      { value: "registration", label: "Registration", element: <AdminRegistration /> },
      { value: "captcha", label: "Captcha", element: <AdminCaptcha /> },
      { value: "rate-limits", label: "Rate Limits", element: <AdminRateLimits /> },
    ]}
  />
);
export default SecurityHub;