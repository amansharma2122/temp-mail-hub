import AdminHub from "./AdminHub";
import AdminBanners from "../AdminBanners";
import AdminAds from "../AdminAds";
import AdminAnnouncement from "../AdminAnnouncement";
import BannerCacheSettings from "@/components/admin/BannerCacheSettings";

const PromotionsHub = () => (
  <AdminHub
    title="Promotions"
    tabs={[
      { value: "banners", label: "Banners", element: <AdminBanners /> },
      { value: "banner-cache", label: "Banner Cache", element: <BannerCacheSettings /> },
      { value: "ads", label: "Ads", element: <AdminAds /> },
      { value: "announcement", label: "Announcement", element: <AdminAnnouncement /> },
    ]}
  />
);
export default PromotionsHub;
