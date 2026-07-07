import AdminHub from "./AdminHub";
import AdminHomepage from "../AdminHomepage";
import AdminPages from "../AdminPages";
import AdminBlogs from "../AdminBlogs";
import AdminBlogSettings from "../AdminBlogSettings";
import AdminFriendlyWebsites from "../AdminFriendlyWebsites";

const ContentHub = () => (
  <AdminHub
    title="Content"
    tabs={[
      { value: "homepage", label: "Homepage", element: <AdminHomepage /> },
      { value: "pages", label: "Pages", element: <AdminPages /> },
      { value: "blogs", label: "Blogs", element: <AdminBlogs /> },
      { value: "blog-settings", label: "Blog Settings", element: <AdminBlogSettings /> },
      { value: "friendly", label: "Friendly Sites", element: <AdminFriendlyWebsites /> },
    ]}
  />
);
export default ContentHub;
