'use client';

import { useState, useEffect } from 'react';
import styles from '../app/LandingPage.module.css';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`}>
        <div className={styles.logoContainer}>
          <Link href="/">
            <Image 
              src="/Kloqo_Logo_full (2) (1).webp" 
              alt="Kloqo Logo" 
              width={120} 
              height={32} 
              priority
              className={styles.logoImage}
            />
          </Link>
        </div>

        {/* Desktop Links */}
        <div className={styles.navLinks}>
          <Link href="#problem" className={styles.navLink}>The Problems</Link>
          <Link href="#solution" className={styles.navLink}>Why Kloqo</Link>
          <Link href="#features" className={styles.navLink}>Features</Link>
          <Link href="#roi" className={styles.navLink}>ROI</Link>
          <Link href="#pricing" className={styles.navLink}>Pricing</Link>
        </div>

        <div className={styles.navActions}>
          <a href="mailto:info@zynthexion.com" className={styles.btnPrimary} style={{ padding: '0.6rem 1.5rem', fontSize: '0.875rem', textDecoration: 'none' }}>
            Contact
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          className={styles.hamburger} 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            className={styles.mobileOverlay}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.mobileMenuLinks}>
              <Link href="#problem" className={styles.mobileNavLink} onClick={closeMenu}>The Problems</Link>
              <Link href="#solution" className={styles.mobileNavLink} onClick={closeMenu}>Why Kloqo</Link>
              <Link href="#features" className={styles.mobileNavLink} onClick={closeMenu}>Features</Link>
              <Link href="#roi" className={styles.mobileNavLink} onClick={closeMenu}>ROI</Link>
              <Link href="#pricing" className={styles.mobileNavLink} onClick={closeMenu}>Pricing</Link>
              
              <div className={styles.mobileMenuActions}>
                <a href="mailto:info@zynthexion.com" className={styles.btnPrimary} style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }} onClick={closeMenu}>
                  Contact
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
