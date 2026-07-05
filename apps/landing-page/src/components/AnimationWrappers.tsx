'use client';

import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { ReactNode, useRef } from 'react';

export function FadeUp({ children, delay = 0, className = "" }: { children: ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredText({ text, className = "" }: { text: string, className?: string }) {
  const words = text.split(" ");
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: 'inline-block' }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={item}
          style={{ display: 'inline-block', marginRight: '0.25em' }}
        >
          {word === 'Chaos' || word === 'Healthcare.' ? (
            <span style={{ color: 'var(--primary)' }}>{word}</span>
          ) : (
            word
          )}
        </motion.span>
      ))}
    </motion.div>
  );
}

export function ParallaxGlow({ className }: { className: string }) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <motion.div
      className={className}
      style={{ y, opacity }}
    />
  );
}

export function ScrollDraw({ children, className = "", style = {} }: { children?: ReactNode, className?: string, style?: React.CSSProperties }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"]
  });

  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ scaleX, transformOrigin: 'left center', ...style }}
    >
      {children}
    </motion.div>
  );
}
