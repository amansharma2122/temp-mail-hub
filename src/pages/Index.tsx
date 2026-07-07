import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Inbox from "@/components/Inbox";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import JsonLd from "@/components/JsonLd";
import BannerDisplay from "@/components/BannerDisplay";
import LiveStatsWidget from "@/components/LiveStatsWidget";
import { lazy, Suspense } from "react";
// FriendlyWebsitesWidget is heavy (framer-motion + full lucide-react set) and
// only paints in a corner overlay — defer it out of the initial bundle so the
// public site's LCP isn't blocked by widget code.
const FriendlyWebsitesWidget = lazy(() => import("@/components/FriendlyWebsitesWidget"));
import BackendHealthBanner from "@/components/BackendHealthBanner";
import { motion } from "framer-motion";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const Index = () => {
  const { quickTips, isSectionEnabled } = useHomepageContent();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead />
      <JsonLd />
      <Header />
      
      {/* Spacer for fixed header + announcement bar */}
      <div className="h-[104px] md:h-[104px]" />
      
      {/* Header Banner */}
      <div className="container mx-auto px-4">
        <BannerDisplay position="header" />
      </div>

      {/* Backend Health Banner - shows only when issues detected */}
      <BackendHealthBanner />
      
      <main>
        <HeroSection />
        
        {/* Real-time Inbox Header - Below Email Generator */}
        <section className="py-4 sm:py-6 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          <div className="container mx-auto px-4">
            {/* Section Header - Centered */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-4"
            >
              <span className="text-primary text-xs sm:text-sm font-medium tracking-wider uppercase">Your Messages</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 sm:mt-3 text-foreground">
                Real-time <span className="gradient-text">Inbox</span>
              </h2>
              <p className="text-muted-foreground mt-2 sm:mt-3 max-w-xl mx-auto text-sm sm:text-base px-4">
                Receive and manage your temporary emails instantly. All messages auto-delete for your privacy.
              </p>
            </motion.div>

            {/* Content Banner - Top */}
            <BannerDisplay position="content" className="mb-4" />

            {/* Inbox - full width; Quick Tips has moved next to the live stats */}
            <motion.div
              className="w-full flex flex-col"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="h-full flex flex-col">
                <Inbox />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Live Stats + Quick Tips (side-by-side: stats left, tips right) */}
        <section className="py-4 border-y border-border/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:items-stretch">
              <div className="min-w-0 max-h-40">
                <LiveStatsWidget />
              </div>
              {isSectionEnabled("quick_tips") && (
                <motion.div
                  className="relative flex h-full max-h-40 flex-col overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-3 shadow-lg shadow-primary/5"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-accent to-primary opacity-20 blur-sm animate-pulse" />
                  <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-ping opacity-75" />
                  <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-accent rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
                  <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground lg:text-base">
                      <motion.span
                        className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-accent"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {quickTips.title}
                      </span>
                    </h3>
                    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
                      {quickTips.tips.map((tip, index) => (
                        <motion.li
                          key={index}
                          className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/50 p-2 transition-colors hover:border-primary/30"
                          whileHover={{ x: 4 }}
                        >
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <span className="text-xs leading-snug text-foreground">{tip}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <BannerDisplay position="sidebar" />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>
        <FeaturesSection />
        <HowItWorks />

        {/* Content Banner - Between sections */}
        <div className="container mx-auto px-4 py-4">
          <BannerDisplay position="content" />
        </div>

        <FAQSection />
        <CTASection />
      </main>

      {/* Footer Banner */}
      <div className="container mx-auto px-4 pb-4">
        <BannerDisplay position="footer" />
      </div>
      
      <Footer />
      
      {/* Friendly Websites Sidebar Widget */}
      <Suspense fallback={null}>
        <FriendlyWebsitesWidget />
      </Suspense>
    </div>
  );
};

export default Index;
