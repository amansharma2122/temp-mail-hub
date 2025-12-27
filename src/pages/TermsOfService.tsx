import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { FileText, AlertTriangle, CheckCircle, XCircle, Scale, Globe } from "lucide-react";

const TermsOfService = () => {
  const lastUpdated = "December 18, 2024";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Terms of Service
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
                <Scale className="w-6 h-6 text-primary" />
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Nullsto's temporary email service ("Service"), you agree to 
                be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
                you may not use the Service. We reserve the right to modify these Terms at any time, 
                and your continued use of the Service constitutes acceptance of any modifications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nullsto provides temporary, disposable email addresses that allow users to receive 
                emails anonymously. The Service is designed for legitimate purposes such as 
                protecting privacy when signing up for websites, testing applications, and avoiding 
                spam in your primary inbox.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-neon-green" />
                3. Acceptable Use
              </h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>You may use our Service to:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>Protect your primary email from spam</li>
                  <li>Register for websites and services anonymously</li>
                  <li>Test email functionality in applications</li>
                  <li>Receive one-time verification codes</li>
                  <li>Maintain privacy when interacting with unknown parties</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <XCircle className="w-6 h-6 text-destructive" />
                4. Prohibited Activities
              </h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>You agree NOT to use our Service for:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>Illegal activities or to facilitate illegal transactions</li>
                  <li>Fraud, phishing, or identity theft</li>
                  <li>Harassment, threats, or abuse of others</li>
                  <li>Sending spam or unsolicited communications</li>
                  <li>Violating intellectual property rights</li>
                  <li>Distributing malware or harmful code</li>
                  <li>Attempting to gain unauthorized access to systems</li>
                  <li>Creating accounts on services that prohibit temporary emails</li>
                  <li>Any activity that violates applicable laws or regulations</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">5. Email Retention</h2>
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p>
                  <strong className="text-foreground">Temporary Nature:</strong> All emails 
                  received at temporary addresses are automatically deleted after the expiration 
                  period. We do not guarantee recovery of deleted emails.
                </p>
                <p>
                  <strong className="text-foreground">No Permanent Storage:</strong> This Service 
                  is not designed for long-term email storage. Do not use it for important 
                  communications that you need to preserve.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">6. User Accounts</h2>
              <div className="text-muted-foreground leading-relaxed">
                <p>If you create an account:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  <li>You are responsible for maintaining the confidentiality of your credentials</li>
                  <li>You are responsible for all activities under your account</li>
                  <li>You must provide accurate and complete information</li>
                  <li>You must notify us immediately of any unauthorized use</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                7. Disclaimers
              </h2>
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p>
                  <strong className="text-foreground">AS-IS BASIS:</strong> The Service is provided 
                  "as is" and "as available" without warranties of any kind, either express or implied.
                </p>
                <p>
                  <strong className="text-foreground">NO GUARANTEE:</strong> We do not guarantee 
                  that the Service will be uninterrupted, secure, or error-free.
                </p>
                <p>
                  <strong className="text-foreground">EMAIL DELIVERY:</strong> We cannot guarantee 
                  delivery of all emails. Some senders may block temporary email domains.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, Nullsto and its affiliates shall not be 
                liable for any indirect, incidental, special, consequential, or punitive damages, 
                including loss of profits, data, or use, arising from your use of or inability to 
                use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">9. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless Nullsto, its officers, directors, employees, 
                and agents from any claims, damages, losses, or expenses arising from your use of 
                the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">10. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate your access to the Service at any time, 
                without notice, for any reason, including violation of these Terms. Upon termination, 
                your right to use the Service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                11. Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of 
                [Your Jurisdiction], without regard to its conflict of law provisions. Any disputes 
                arising from these Terms shall be resolved in the courts of [Your Jurisdiction].
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">12. Severability</h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that 
                provision shall be limited or eliminated to the minimum extent necessary, and 
                the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">13. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-foreground font-medium">Nullsto Legal Team</p>
                <p className="text-muted-foreground">Email: legal@nullsto.com</p>
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

export default TermsOfService;
