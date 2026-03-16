import { motion, useMotionValue, useSpring } from 'framer-motion';
import React, { useEffect, useState } from 'react';

// =====================================================
// ANIMATION UTILITIES
// =====================================================

export const springConfig = {
  gentle: { stiffness: 120, damping: 14 },
  wobbly: { stiffness: 180, damping: 12 },
  stiff: { stiffness: 260, damping: 20 },
  slow: { stiffness: 280, damping: 60 },
};

// Return whether user has prefers-reduced-motion enabled
export const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
    const handler = () => setPrefersReduced(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
};

// =====================================================
// FRAMER MOTION VARIANTS
// =====================================================

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideInList = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
};

export const rotateIn = {
  initial: { rotate: -180, opacity: 0 },
  animate: { rotate: 0, opacity: 1 },
  exit: { rotate: 180, opacity: 0 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// =====================================================
// MAGNETIC COMPONENT EXAMPLE
// =====================================================
export const MagneticButton = ({ children, onClick, className }: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springX = useSpring(x, springConfig.gentle);
  const springY = useSpring(y, springConfig.gentle);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    x.set((e.clientX - centerX) * 0.1);
    y.set((e.clientY - centerY) * 0.1);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.span
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      className={`relative inline-flex ${className || ''}`}
    >
      {children}
    </motion.span>
  );
};
