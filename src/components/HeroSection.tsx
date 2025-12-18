import { motion } from "framer-motion";
import { Shield, Zap, Clock, Globe } from "lucide-react";
import EmailGenerator from "./EmailGenerator";

const HeroSection = () => {
  const features = [
    { icon: Shield, label: "100% Anonymous" },
    { icon: Zap, label: "Instant Generation" },
    { icon: Clock, label: "Auto-Expire" },
    { icon: Globe, label: "Multiple Domains" },
  ];

  return (
    <section className="relative min-h-screen pt-24 pb-12 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern bg-[size:50px_50px] opacity-[0.02]" />
      </div>

      <div className="container mx-auto px-4">
        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">Trusted by 1M+ users worldwide</span>
          </motion.div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-foreground">Protect Your Privacy with</span>
            <br />
            <span className="gradient-text neon-text">Disposable Emails</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Generate instant, anonymous email addresses. Perfect for sign-ups, 
            testing, and keeping your real inbox spam-free.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap justify-center gap-6 md:gap-12 mb-12"
        >
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-muted-foreground">
              <feature.icon className="w-4 h-4 text-primary" />
              <span className="text-sm">{feature.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Email Generator */}
        <EmailGenerator />
      </div>
    </section>
  );
};

export default HeroSection;
