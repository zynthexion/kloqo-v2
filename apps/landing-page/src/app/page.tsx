'use client';

import { useState } from 'react';
import styles from './LandingPage.module.css';
import Navbar from '../components/Navbar';
import PricingSection from '../components/PricingSection';
import { FadeUp, StaggeredText, ParallaxGlow } from '../components/AnimationWrappers';
import { 
  Smartphone, 
  Zap, 
  Stethoscope, 
  PlusSquare, 
  AlertTriangle, 
  RefreshCcw, 
  Coins, 
  ShieldCheck, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setEmail('');
      } else {
        setError(data.error || 'Failed to submit interest.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.gridOverlay} />
      <Navbar />

      {/* Hero Section */}
      <section className={styles.hero}>
        <ParallaxGlow className={styles.glow} />
        <span className={styles.badge}>Kloqo V2 Enterprise</span>
        <StaggeredText 
          text="Stop Managing Calendars. Start Optimizing Your Clinic’s Revenue & Patient Sanity." 
          className={styles.headline} 
        />
        <FadeUp delay={0.8}>
          <p className={styles.subheadline}>
            The world’s first elastic queue management and prescription tracking system built specifically for high-density, high-performance private clinics.
          </p>
        </FadeUp>
        <FadeUp delay={1.0}>
          <div className={styles.heroActions}>
            <Link href="#pricing" className={styles.btnPrimary}>
              Join the MVP Phase
            </Link>
            <Link href="#guide" className={styles.btnSecondary}>
              Read Clinic Owner's Guide <ArrowRight size={16} style={{ marginLeft: '6px' }} />
            </Link>
          </div>
        </FadeUp>
      </section>

      {/* Projected Market Metrics Section */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.metricsGrid}>
          <FadeUp delay={0.2}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>₹2.4L<span className={styles.metricUnit}>/mo</span></div>
              <div className={styles.metricLabel}>Rx Leakage Recaptured per Doctor</div>
            </div>
          </FadeUp>
          <FadeUp delay={0.4}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>75%</div>
              <div className={styles.metricLabel}>Reduction in Average Wait Times</div>
            </div>
          </FadeUp>
          <FadeUp delay={0.6}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>98%</div>
              <div className={styles.metricLabel}>Doctor Chair Utilization Rate</div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* The Problem Section */}
      <section id="problem" className={styles.section}>
        <FadeUp delay={0.2}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>The Silent Profit Leaks</span>
            <h2 className={styles.sectionTitle}>The Invisible Losses in Your Clinic</h2>
            <p className={styles.sectionSubtitle}>
              Every day, standard practice management software costs your clinic time, reputation, and revenue through three major leaks.
            </p>
          </div>
        </FadeUp>

        <div className={styles.problemGrid}>
          <FadeUp delay={0.4} className={styles.problemCard}>
            <div className={`${styles.problemIcon} ${styles.iconRed}`}>
              <AlertTriangle size={24} />
            </div>
            <h3 className={styles.cardTitle}>1. The Waiting Room Crisis</h3>
            <p className={styles.cardText}>
              Overcrowded waiting areas spike patient anxiety, leading to poor online reviews and immediate walkouts before consultation starts.
            </p>
          </FadeUp>

          <FadeUp delay={0.6} className={styles.problemCard}>
            <div className={`${styles.problemIcon} ${styles.iconOrange}`}>
              <RefreshCcw size={24} />
            </div>
            <h3 className={styles.cardTitle}>2. The Schedule Override Chaos</h3>
            <p className={styles.cardText}>
              When a doctor needs to change session hours or take an emergency break, standard apps either force a mass-cancellation (losing you money) or leave your nursing staff to manually call dozens of angry patients.
            </p>
          </FadeUp>

          <FadeUp delay={0.8} className={styles.problemCard}>
            <div className={`${styles.problemIcon} ${styles.iconAmber}`}>
              <Coins size={24} />
            </div>
            <h3 className={styles.cardTitle}>3. Pharmacy Prescription Leakage</h3>
            <p className={styles.cardText}>
              Clinics lose massive ecosystem value when prescriptions are printed and walked out the door to external, non-affiliated pharmacies.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* The Solution Section */}
      <section id="solution" className={styles.solutionSection}>
        <ParallaxGlow className={styles.glow} />
        <FadeUp delay={0.2}>
          <span className={styles.sectionLabel}>The Solution</span>
          <h2 className={styles.sectionTitle}>Why Choose Kloqo?</h2>
          <p className={styles.solutionText}>
            Kloqo isn’t just a digital calendar—it’s an <strong>Intelligent Operations Manager</strong>. We treat clinic scheduling like an elastic timeline that automatically stretches and compresses to maximize doctor utilization, protect patient travel times, and capture lost revenue.
          </p>
        </FadeUp>
      </section>

      {/* Core Features Section */}
      <section id="features" className={styles.section}>
        <FadeUp delay={0.2}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Capabilities</span>
            <h2 className={styles.sectionTitle}>Core Features Built for Scale</h2>
            <p className={styles.sectionSubtitle}>
              Engineered to handle high-density consultation queues, active doctor schedule changes, and pharmacy fulfillment pipelines.
            </p>
          </div>
        </FadeUp>

        <div className={styles.featuresGrid}>
          {/* Feature 1 */}
          <FadeUp delay={0.3} className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Zap size={24} />
            </div>
            <h3 className={styles.featureTitle}>1. Dynamic Queue Tracking & The "Fairness Handover"</h3>
            <ul className={styles.featureList}>
              <li><strong>Live Token Visualizer:</strong> Patients track their real-time token status from home, arriving exactly when the doctor is ready to see them.</li>
              <li><strong>Smart Damping Engine:</strong> If a doctor applies or cancels a break last minute, the system automatically protects patients close to the clinic from "time-reversal panic" while vacuuming waiting walk-ins into open gaps.</li>
              <li><strong>Zero Doctor Idle Time:</strong> The engine ensures the consultation chair is always filled, seamlessly blending advanced bookings with walk-in traffic.</li>
            </ul>
          </FadeUp>

          {/* Feature 2 */}
          <FadeUp delay={0.5} className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Stethoscope size={24} />
            </div>
            <h3 className={styles.featureTitle}>2. The Conflict Action Center</h3>
            <ul className={styles.featureList}>
              <li><strong>No More Mass Cancellations:</strong> When a doctor overrides availability (e.g., switching a morning session to evening), Kloqo doesn't wipe out your day.</li>
              <li><strong>Proportional Migration:</strong> The engine automatically calculates the closest matching slots in the new session to preserve patient priority.</li>
              <li><strong>The Triage Dashboard:</strong> Displaced patients are placed in a high-priority "Orphan Bucket" where nurses can re-map them into available walk-in buffers with a single click.</li>
            </ul>
          </FadeUp>

          {/* Feature 3 */}
          <FadeUp delay={0.7} className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Coins size={24} />
            </div>
            <h3 className={styles.featureTitle}>3. FinTech Tracking & Prescription Leakage Control</h3>
            <ul className={styles.featureList}>
              <li><strong>Fulfillment Optimization:</strong> Track your clinic's true ROI, total prescription value, and fulfillment rates directly from a clean, modern executive dashboard.</li>
              <li><strong>Connected Ecosystem:</strong> Securely bridge the gap between your clinic's desk and connected pharmacies to ensure patients fulfill their medicines internally, capturing 100% of your retail potential.</li>
            </ul>
          </FadeUp>

          {/* Feature 4 */}
          <FadeUp delay={0.9} className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <ShieldCheck size={24} />
            </div>
            <h3 className={styles.featureTitle}>4. Hardened Digital Prescription Canvas</h3>
            <ul className={styles.featureList}>
              <li><strong>Auto-Save & Draft Recovery:</strong> Doctors will never lose their handwriting or prescription progress mid-consultation if they switch tabs or accidentally refresh the page.</li>
              <li><strong>CORS-Secured Historical Duplication:</strong> Instantly pull up and draw over a patient’s historical prescription records without browser lag or security export hangs.</li>
            </ul>
          </FadeUp>
        </div>
      </section>

      {/* Clinic Owner's Guide & FAQ Section */}
      <section id="guide" className={styles.section}>
        <FadeUp delay={0.2}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Clinic Owner's Guide</span>
            <h2 className={styles.sectionTitle}>Everything You Need to Know About Kloqo</h2>
            <p className={styles.sectionSubtitle}>
              Making the decision to transition your clinic operations is significant. Here is how Kloqo directly drives clinical ease and safeguards your revenue.
            </p>
          </div>
        </FadeUp>

        <div className={styles.guideGrid}>
          <FadeUp delay={0.3} className={styles.guideCard}>
            <h3 className={styles.guideCardTitle}>What is Kloqo, exactly?</h3>
            <p className={styles.guideCardText}>
              Kloqo is an B2B enterprise operations engine that replaces traditional static calendars. It links your front-desk (Nurses), doctors (Prescription Canvas), and in-house pharmacy into a synchronized, live scheduling ecosystem. It treats time elastically—adjusting slots automatically when delays, breaks, or walks-ins occur.
            </p>
          </FadeUp>

          <FadeUp delay={0.4} className={styles.guideCard}>
            <h3 className={styles.guideCardTitle}>Why does my clinic need it?</h3>
            <p className={styles.guideCardText}>
              Traditional practice software is passive; it records slots but does nothing when schedules clash. Kloqo actively prevents three massive leaks:
            </p>
            <ul className={styles.guideCardList}>
              <li><strong>Reputation Leak:</strong> Crowded waiting rooms drive patients to write bad reviews or leave. Kloqo keeps them waiting at home or nearby.</li>
              <li><strong>Operations Leak:</strong> Session changes force manual call lists. Kloqo auto-migrates bookings and gives nurses a one-click Triage bar.</li>
              <li><strong>Pharmacy Revenue Leak:</strong> Up to 35% of patients buy medicines outside. Kloqo's real-time interception alerts front-desk staff to secure inside fulfillment.</li>
            </ul>
          </FadeUp>

          <FadeUp delay={0.5} className={styles.guideCard}>
            <h3 className={styles.guideCardTitle}>Does it replace my current EHR?</h3>
            <p className={styles.guideCardText}>
              No. Kloqo is built to run alongside your existing Electronic Health Record (EHR) software. It handles the high-frequency scheduling, live queue, and pharmacy sync layers where standard EHRs fail, requiring zero alterations to your record databases.
            </p>
          </FadeUp>

          <FadeUp delay={0.6} className={styles.guideCard}>
            <h3 className={styles.guideCardTitle}>How fast is the setup?</h3>
            <p className={styles.guideCardText}>
              Kloqo is entirely cloud-based. You can configure your clinic, onboard doctors, and launch the Nurse App on any standard tablet or computer in under 60 minutes. No local server installs or specialized hardware are needed.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* The Bottom Line (ROI Comparison Table) */}
      <section id="roi" className={styles.section}>
        <FadeUp delay={0.2}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>The Bottom Line</span>
            <h2 className={styles.sectionTitle}>The Kloqo ROI</h2>
            <p className={styles.sectionSubtitle}>
              Compare how Kloqo handles operations and revenue leakage versus legacy practice management software.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.4}>
          <div className={styles.tableWrapper}>
            <table className={styles.roiTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Legacy Software</th>
                  <th className={styles.highlightColumnHeader}>The Kloqo Way</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Schedule Changes</strong></td>
                  <td>Throws errors, forces cancellations, drives front-desk chaos.</td>
                  <td className={styles.highlightColumn}>
                    <strong>Asynchronous Triage Bar:</strong> Nurses resolve 20 conflicts in under 60 seconds.
                  </td>
                </tr>
                <tr>
                  <td><strong>Waiting Rooms</strong></td>
                  <td>Overcrowded, high stress, frequent patient walk-outs.</td>
                  <td className={styles.highlightColumn}>
                    <strong>Predictive Arrival:</strong> Patients wait at home, keeping the lobby perfectly clear.
                  </td>
                </tr>
                <tr>
                  <td><strong>Revenue Protection</strong></td>
                  <td>Zero tracking on walked-out printed prescriptions.</td>
                  <td className={styles.highlightColumn}>
                    <strong>Live Rx Queue:</strong> Monetizes and tracks fulfillment pipelines transparently.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </FadeUp>
      </section>

      {/* Pricing Section Component */}
      <FadeUp delay={0.2}>
        <PricingSection />
      </FadeUp>

      {/* Final CTA Card */}
      <FadeUp delay={0.4}>
        <section className={styles.section}>
          <div className={styles.ctaCard}>
            <h2 className={styles.sectionTitle}>Ready to run a zero-friction, maximum-utilization clinic?</h2>
            <p className={styles.ctaText}>
              Join our exclusive MVP test phase. Experience how Kloqo eliminates waiting room friction, empowers your nursing staff, and protects your bottom line from day one.
            </p>
            <div className={styles.ctaActions} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <form onSubmit={handleSubscribe} className={styles.subscribeForm}>
                <input
                  type="email"
                  placeholder="Enter your clinic or pharmacy email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.subscribeInput}
                  disabled={loading}
                  required
                />
                <button type="submit" className={styles.btnPrimary} disabled={loading} style={{ border: 'none', cursor: 'pointer' }}>
                  {loading ? 'Submitting...' : 'Join MVP Phase'}
                </button>
              </form>
              {message && <p className={styles.subscribeSuccess}>{message}</p>}
              {error && <p className={styles.subscribeError}>{error}</p>}
              
              <div style={{ marginTop: '1.5rem' }}>
                <a href="mailto:demo@kloqo.com" className={styles.btnSecondary}>
                  Email for Terminal Demo
                </a>
              </div>
            </div>
            <div className={styles.terminalDemoContact}>
              <span>📞 Contact us today to schedule a 10-minute live terminal demo.</span>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.logoContainer} style={{ marginBottom: '1.5rem' }}>
              <Image 
                src="/Kloqo_Logo_full (2) (1).webp" 
                alt="Kloqo Logo" 
                width={100} 
                height={28} 
                className={styles.logoImage}
              />
            </div>
            <p className={styles.footerDesc} style={{ marginBottom: '1.5rem' }}>
              The high-velocity orchestration engine for modern healthcare. Professional. Innovative. Revenue-focused.
            </p>
            <div className={styles.parentCompanyInfo}>
              <p className={styles.parentTitle}>Parent Company</p>
              <p className={styles.parentName}>Zynthexion Technologies Private Limited</p>
              <p className={styles.parentAddress}>
                Suite No. A96, Door No. 63/700, D Space, 6th Floor, Sky Tower,<br />
                Mavoor Road Junction, Bank Road, Kozhikode - 673001
              </p>
              <p className={styles.parentContact}>
                Email: <a href="mailto:info@zynthexion.com" className={styles.footerLinkUnderline}>info@zynthexion.com</a><br />
                Web: <a href="https://zynthexion.com/" target="_blank" rel="noopener noreferrer" className={styles.footerLinkUnderline}>zynthexion.com</a>
              </p>
            </div>
          </div>
          {/* Column 2: Platform Links */}
          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>Platform</h4>
            <div className={styles.footerLinks}>
              <Link href="#problem">The Problems</Link>
              <Link href="#solution">Why Kloqo</Link>
              <Link href="#features">Core Features</Link>
              <Link href="#roi">Kloqo ROI</Link>
            </div>
          </div>

          {/* Column 3: Resources Links */}
          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>Resources</h4>
            <div className={styles.footerLinks}>
              <Link href="#guide">Clinic Owner's Guide</Link>
              <Link href="#pricing">SaaS Pricing Plans</Link>
              <Link href="#pricing">Terminal Demo</Link>
            </div>
          </div>

          {/* Column 4: Legal & compliance */}
          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>Legal</h4>
            <div className={styles.footerLinks}>
              <span onClick={() => alert('Terms of Service and SLA agreements are provided in the registration packet.')}>Terms of Service</span>
              <span onClick={() => alert('We comply with global healthcare standards (HIPAA and local data regulations).')}>Privacy Policy</span>
              <span onClick={() => alert('All connections are SSL-encrypted with Firestore CORS rules.')}>Security Compliance</span>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © 2025 Zynthexion Technologies. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
