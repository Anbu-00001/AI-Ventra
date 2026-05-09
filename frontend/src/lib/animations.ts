import { Variants } from "framer-motion";

// ===== FRAMER MOTION VARIANTS =====

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    borderColor: "rgba(255,255,255,0.08)",
    transition: { duration: 0.3 },
  },
  hover: {
    scale: 1.03,
    y: -8,
    borderColor: "rgba(192,24,42,0.5)",
    transition: { duration: 0.3 },
  },
};

// ===== GSAP DEFAULTS =====
export const GSAP_DEFAULTS = {
  scrollTrigger: {
    scrub: 1,
    start: "top 80%",
    end: "bottom 20%",
  },
  splitText: {
    stagger: 0.03,
    duration: 0.8,
    ease: "power3.out",
    y: 40,
  },
} as const;
