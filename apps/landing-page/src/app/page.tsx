import styles from './LandingPage.module.css';
import Navbar from '../components/Navbar';
import ROICalculator from '../components/ROICalculator';
import { ArrowRight, Smartphone, ShieldCheck, Zap, Users } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <Navbar />

      {/* 2. Hero Section: The Buyer's Hook */}
      <section className={styles.hero}>
        <div className={`${styles.heroBadge} animate-fade-in`}>
          Industry Standard Orchestration
        </div>
        <h1 className={`${styles.headline} animate-fade-in`}>
          Eliminate Waiting Room <span style={{ color: 'var(--primary)' }}>Chaos</span> and Recover Lost Revenue.
        </h1>
        <p className={`${styles.subheadline} animate-fade-in`} style={{ animationDelay: '0.2s' }}>
          The intelligent queue and pharmacy orchestration engine built for high-volume polyclinics.
        </p>
        <div className={`${styles.heroActions} animate-fade-in`} style={{ animationDelay: '0.4s' }}>
          <Link href="#calculator" className={styles.ctaButton}>
            Calculate Your ROI
          </Link>
          <Link href="/demo" className={styles.secondaryButton}>
            Watch Product Tour
          </Link>
        </div>
      </section>

      {/* 3. Patient Experience Section: Selling via Empathy */}
      <section className={styles.section} id="experience">
        <span className={styles.sectionLabel}>Patient Experience</span>
        <h2 className={styles.sectionTitle}>Give your patients a 5-star experience.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div className={styles.textBlock}>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--accent)', borderRadius: '0.5rem' }}>
                  <Smartphone style={{ color: 'var(--primary)' }} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Token Tracking</h3>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6 }}>
                Your patients track their tokens live from their phones. They arrive exactly when you are ready. No more crowded lobbies or hostile front desks.
              </p>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--accent)', borderRadius: '0.5rem' }}>
                  <Zap style={{ color: 'var(--primary)' }} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Zero Ghost Wait Times</h3>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6 }}>
                Active Bubbling™ technology automatically fills no-show gaps with waiting walk-ins, keeping your doctors productive 100% of the time.
              </p>
            </div>
          </div>
          <div style={{ 
            background: 'var(--foreground)', 
            borderRadius: '3rem', 
            height: '600px', 
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Mockup Placeholder */}
            <div style={{ 
              background: 'var(--background)', 
              height: '100%', 
              borderRadius: '2rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              color: '#000'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '50%' }}></div>
                <div style={{ width: '80px', height: '12px', background: '#f1f5f9', borderRadius: '6px', marginTop: '14px' }}></div>
              </div>
              <div style={{ 
                background: 'var(--primary)', 
                height: '160px', 
                borderRadius: '1.5rem',
                padding: '1.5rem',
                color: 'white',
                marginBottom: '1.5rem'
              }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>Current Token</p>
                <p style={{ fontSize: '3rem', fontWeight: 900 }}>A-108</p>
                <p style={{ fontSize: '0.75rem', marginTop: '1rem' }}>Estimated wait: 12 mins</p>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: '1.5rem', padding: '1rem' }}>
                <div style={{ height: '40px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>A-109</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Next</span>
                </div>
                <div style={{ height: '40px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>W-204</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Walking In</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pharmacy ROI Section: The Wallet Hook */}
      <section className={styles.section} id="calculator">
        <span className={styles.sectionLabel}>Revenue Recovery</span>
        <h2 className={styles.sectionTitle}>Stop leaking prescriptions to the pharmacy down the street.</h2>
        <p style={{ color: 'var(--secondary)', maxWidth: '600px', marginBottom: '2rem' }}>
          Our orchestration engine ensures that prescriptions written in your clinic are filled in your clinic. Calculate how much revenue you are currently leaving on the table.
        </p>
        <ROICalculator />
      </section>

      {/* 5. Footer: The Basement */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '4rem 5%', marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div className={styles.logo} style={{ marginBottom: '1rem' }}>KLOQO</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', maxWidth: '300px' }}>
              The industrial-grade orchestration engine for modern healthcare facilities.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '4rem' }}>
            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.1em' }}>Product</h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="#">Features</Link></li>
                <li><Link href="#">Pricing</Link></li>
                <li><Link href="#">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.1em' }}>Partners</h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="#">Standalone Pharmacies</Link></li>
                <li><Link href="#">Clinic Owners</Link></li>
                <li><Link href="#">Referral Program</Link></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.1em' }}>Legal</h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--secondary)', textAlign: 'center' }}>
          © {new Date().getFullYear()} Kloqo Technologies. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
