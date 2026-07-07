import AdminHub from "./AdminHub";
import AdminAppearance from "../AdminAppearance";
import AdminThemes from "../AdminThemes";
import AdminSEO from "../AdminSEO";
import AdminLanguages from "../AdminLanguages";

const AppearanceHub = () => (
  <AdminHub
    title="Appearance"
    tabs={[
      { value: "appearance", label: "Appearance", element: <AdminAppearance /> },
      { value: "themes", label: "Themes", element: <AdminThemes /> },
      { value: "seo", label: "SEO", element: <AdminSEO /> },
      { value: "languages", label: "Languages", element: <AdminLanguages /> },
    ]}
  />
);
export default AppearanceHub;
