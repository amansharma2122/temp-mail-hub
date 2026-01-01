import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Cookie, Settings, Shield, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const CookiePolicy = () => {
  const lastUpdated = "December 18, 2024";

  const cookieTypes = [
    {
      name: "Essential Cookies",
      icon: Shield,
      description: "These cookies are necessary for the website to function properly. They enable core functionality such as security, session management, and accessibility.",
      examples: ["Session ID", "Authentication tokens", "Security cookies"],
      canDisable: false,
    },
    {
      name: "Functional Cookies",
      icon: Settings,
      description: "These cookies enable personalized features such as remembering your preferences, language settings, and customizations.",
      examples: ["Language preference", "Theme preference", "Notification settings"],
      canDisable: true,
    },
    {
      name: "Analytics Cookies",
      icon: BarChart3,
      description: "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.",
      examples: ["Page views", "Traffic sources", "User interactions"],
      canDisable: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 md:pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Cookie className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Cookie Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            {/* Introduction */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">What Are Cookies?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files that are stored on your device when you visit a website. 
                They are widely used to make websites work more efficiently and provide information 
                to the website owners. At Nullsto, we use cookies to enhance your experience, 
                understand how our service is used, and improve our offerings.
              </p>
            </div>

            {/* Cookie Types */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-6">Types of Cookies We Use</h2>
              <div className="space-y-6">
                {cookieTypes.map((cookie, index) => (
                  <motion.div
                    key={cookie.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 rounded-xl bg-secondary/30 border border-border/50"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <cookie.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{cookie.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            cookie.canDisable 
                              ? "bg-primary/10 text-primary" 
                              : "bg-secondary text-muted-foreground"
                          }`}>
                            {cookie.canDisable ? "Optional" : "Required"}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mb-3">{cookie.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {cookie.examples.map((example) => (
                            <span 
                              key={example}
                              className="px-2 py-1 bg-background/50 rounded text-xs text-muted-foreground"
                            >
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Managing Cookies */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Managing Your Cookie Preferences</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  You have the right to decide whether to accept or reject cookies. You can manage 
                  your cookie preferences in the following ways:
                </p>
                
                <div className="space-y-4 mt-6">
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <h4 className="font-semibold text-foreground mb-2">Browser Settings</h4>
                    <p className="text-sm">
                      Most web browsers allow you to control cookies through their settings. 
                      You can set your browser to refuse cookies or delete certain cookies. 
                      Please note that if you disable cookies, some features of our Service may 
                      not function properly.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <h4 className="font-semibold text-foreground mb-2">Our Cookie Settings</h4>
                    <p className="text-sm mb-4">
                      You can manage your cookie preferences for our website using the button below. 
                      This will allow you to enable or disable non-essential cookies.
                    </p>
                    <Button variant="outline" className="border-primary/30 hover:bg-primary/10">
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Cookie Preferences
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Third-Party Cookies */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                In some cases, we use cookies from third-party services. These may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Analytics providers (to understand how our service is used)</li>
                <li>Authentication providers (for social login features)</li>
                <li>Content delivery networks (to serve content efficiently)</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                These third parties may set their own cookies. Please refer to their respective 
                privacy policies for more information about how they use cookies.
              </p>
            </div>

            {/* Data Retention */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Cookie Retention Periods</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-foreground font-semibold">Cookie Type</th>
                      <th className="py-3 px-4 text-foreground font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4">Session cookies</td>
                      <td className="py-3 px-4">Deleted when browser is closed</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4">Preference cookies</td>
                      <td className="py-3 px-4">Up to 1 year</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 pr-4">Analytics cookies</td>
                      <td className="py-3 px-4">Up to 2 years</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4">Authentication cookies</td>
                      <td className="py-3 px-4">Until logout or 30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Updates */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-primary" />
                Updates to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in our 
                practices or for other operational, legal, or regulatory reasons. We encourage 
                you to periodically review this page for the latest information on our cookie practices.
              </p>
            </div>

            {/* Contact */}
            <div className="glass-card p-8 md:p-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about our use of cookies, please contact us:
              </p>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-foreground font-medium">Nullsto Privacy Team</p>
                <p className="text-muted-foreground">Email: privacy@nullsto.com</p>
                <p className="text-muted-foreground">Address: Your Company Address</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;
