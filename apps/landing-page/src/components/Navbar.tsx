'use client';

import { useState, useEffect } from 'react';
import styles from '../app/LandingPage.module.css';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`${styles.navbar} ${scrolled ? 'glass' : ''}`}>
      <div className={styles.logo}>KLOQO</div>
      <div className={styles.navActions}>
        <Link href="/patient-tracking" className={styles.utilityLink}>
          Patient Tracking Login
        </Link>
        <Link href="/book-demo" className={styles.ctaButton}>
          Book Clinic Demo
        </Link>
      </div>
    </nav>
  );
}
