'use client';

import { useState } from 'react';
import styles from '../app/LandingPage.module.css';
import { Check, X } from 'lucide-react';

const CLINIC_PLANS = [
  {
    name: "Starter Scan / BYOD",
    price: "₹999",
    featured: false,
    sub: "+ ₹1,499 setup fee",
    features: [
      "Mobile App Rx Scanner",
      "Zero behavior change for doctor",
      "Pen & paper friendly",
      "2,000 WhatsApp alerts/month",
    ],
    negatives: [
      "No write-on-glass workflow",
      "No hardware tablet bundle options"
    ]
  },
  {
    name: "The Complete Suite",
    price: "₹1,999",
    featured: true,
    sub: "Most popular choice",
    features: [
      "Write-on-glass workflow (Zero typing)",
      "Instant digital routing to pharmacy",
      "Dynamic queue & token sync",
      "Unlimited WhatsApp Deliveries",
      "Optional high-fidelity Tablet bundles",
      "Conflict Action Center (Orphan Bucket)"
    ],
    negatives: []
  },
  {
    name: "Standalone Software",
    price: "₹3,999",
    featured: false,
    sub: "Desktop receptionist dashboard",
    features: [
      "Full Cloud EMR Access",
      "Receptionist Dashboard",
      "Basic Queue Management",
    ],
    negatives: [
      "Manual typing required",
      "Capped at 1,000 WhatsApp alerts/month"
    ]
  }
];

const PHARMACY_PLANS = [
  {
    name: "Pharmacy Monopoly",
    price: "₹2,999",
    featured: false,
    sub: "Per clinic pharmacy hub",
    features: [
      "Dedicated Pharmacy Hub Portal",
      "Seamless doctor connection",
      "Instant digital Rx routing",
      "Fulfillment pipeline tracking",
      "Prescription leakage alerts",
      "Real-time patient walk-out alerts"
    ],
    negatives: []
  }
];

export default function PricingSection() {
  const [activeTab, setActiveTab] = useState<'clinic' | 'pharmacy'>('clinic');
  const plans = activeTab === 'clinic' ? CLINIC_PLANS : PHARMACY_PLANS;

  return (
    <section id="pricing" className={styles.section}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <span className={styles.sectionLabel}>Pricing Plans</span>
        <h2 className={styles.sectionTitle}>Transparent plans for every scale.</h2>
        <p className="text-slate-400 mt-2 text-sm">First month software is completely FREE on all plans!</p>
      </div>

      <div className={styles.pricingToggle}>
        <button 
          className={`${styles.toggleBtn} ${activeTab === 'clinic' ? styles.toggleBtnActive : ''}`}
          onClick={() => setActiveTab('clinic')}
        >
          For Clinics
        </button>
        <button 
          className={`${styles.toggleBtn} ${activeTab === 'pharmacy' ? styles.toggleBtnActive : ''}`}
          onClick={() => setActiveTab('pharmacy')}
        >
          For Pharmacies
        </button>
      </div>

      <div className={`${styles.pricingGrid} ${activeTab === 'pharmacy' ? styles.pricingGridPharmacy : ''}`}>
        {plans.map((plan) => (
          <div key={plan.name} className={`${styles.pricingCard} ${plan.featured ? styles.pricingCardFeatured : ''}`}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>{plan.name}</h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '1.5rem', fontWeight: 600 }}>{plan.sub}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '2rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>{plan.price}</span>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>/mo</span>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 3rem 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {plan.features.map(feature => (
                <li key={feature} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', alignItems: 'flex-start' }}>
                  <Check size={16} className="text-emerald-500" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{feature}</span>
                </li>
              ))}
              {plan.negatives && plan.negatives.map(neg => (
                <li key={neg} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', alignItems: 'flex-start', color: '#64748b' }}>
                  <X size={16} className="text-red-500/70" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{neg}</span>
                </li>
              ))}
            </ul>

            <button className={plan.featured ? styles.btnPrimary : styles.btnSecondary} style={{ width: '100%' }}>
              Select Plan
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
