import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, UserCheck, FileText, Mail } from "lucide-react";

const PrivacyPolicy = () => {
  const lastUpdated = "December 18, 2024";

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
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Privacy Policy
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
            className="glass-card p-8 md:p-12 space-y-8"
          >
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to Nullsto ("we," "our," or "us"). We are committed to protecting your privacy 
                and ensuring the security of your personal information. This Privacy Policy explains 
                how we collect, use, disclose, and safeguard your information when you use our 
                temporary email service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                2. Information We Collect
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p><strong className="text-foreground">2.1 Automatically Collected Information:</strong></p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>IP address (anonymized after 24 hours)</li>
                  <li>Browser type and version</li>
                  <li>Device type and operating system</li>
                  <li>Usage patterns and statistics</li>
                  <li>Temporary email addresses generated</li>
                </ul>
                
                <p><strong className="text-foreground">2.2 Information You Provide:</strong></p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account registration details (if you choose to create an account)</li>
                  <li>Email forwarding addresses (if you use this feature)</li>
                  <li>Contact information when reaching out to support</li>
                </ul>

                <p><strong className="text-foreground">2.3 Email Content:</strong></p>
                <p>
                  Emails received at your temporary addresses are stored temporarily and are 
                  automatically deleted after the expiration period. We do not read, analyze, 
                  or share the content of these emails.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Lock className="w-6 h-6 text-primary" />
                3. How We Use Your Information
              </h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>We use collected information to:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>Provide and maintain our temporary email service</li>
                  <li>Improve and optimize our service performance</li>
                  <li>Detect and prevent abuse, spam, and malicious activities</li>
                  <li>Generate anonymous usage statistics</li>
                  <li>Respond to your inquiries and support requests</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-primary" />
                4. Data Retention
              </h2>
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p>
                  <strong className="text-foreground">Temporary Emails:</strong> All temporary email 
                  addresses and their contents are automatically deleted after the specified expiration 
                  period (default: 1 hour for standard, customizable for registered users).
                </p>
                <p>
                  <strong className="text-foreground">Account Data:</strong> If you create an account, 
                  your account information is retained until you request deletion.
                </p>
                <p>
                  <strong className="text-foreground">Logs:</strong> System logs containing anonymized 
                  data are retained for up to 30 days for security and debugging purposes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Sharing</h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>We do not sell, trade, or rent your personal information. We may share data:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>With service providers who assist in operating our service</li>
                  <li>When required by law or legal process</li>
                  <li>To protect our rights, privacy, safety, or property</li>
                  <li>In connection with a merger, acquisition, or sale of assets</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">6. Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement industry-standard security measures including encryption (SSL/TLS), 
                secure data storage, regular security audits, and access controls. However, no 
                method of transmission over the Internet is 100% secure, and we cannot guarantee 
                absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">7. Your Rights</h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Object to processing of your data</li>
                  <li>Data portability</li>
                  <li>Withdraw consent at any time</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">8. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our service is not intended for children under 13. We do not knowingly collect 
                personal information from children under 13. If you believe we have collected 
                such information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">9. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any 
                changes by posting the new Privacy Policy on this page and updating the "Last 
                updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                10. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-foreground font-medium">Nullsto Privacy Team</p>
                <p className="text-muted-foreground">Email: privacy@nullsto.com</p>
                <p className="text-muted-foreground">Address: Your Company Address</p>
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
