'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan';
export type FontSize = 'small' | 'medium' | 'large';
export type AnimationSpeed = 'instant' | 'fast' | 'normal' | 'slow';

interface ThemeState {
  theme: Theme;
  accentColor: AccentColor;
  fontSize: FontSize;
  animationSpeed: AnimationSpeed;
  reduceMotion: boolean;
  highContrast: boolean;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setReduceMotion: (reduce: boolean) => void;
  setHighContrast: (high: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      accentColor: 'blue',
      fontSize: 'medium',
      animationSpeed: 'normal',
      reduceMotion: false,
      highContrast: false,
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
    }),
    {
      name: 'policydiff-theme',
    }
  )
);

// Animation duration multipliers
export const animationDurations: Record<AnimationSpeed, number> = {
  instant: 0,
  fast: 0.5,
  normal: 1,
  slow: 2,
};

// Font size configurations
export const fontSizeConfigs: Record<FontSize, {
  base: string;
  scale: number;
}> = {
  small: { base: '14px', scale: 0.875 },
  medium: { base: '16px', scale: 1 },
  large: { base: '18px', scale: 1.125 },
};

// Accent color configurations
export const accentColorConfigs: Record<AccentColor, {
  light: {
    primary: string;
    secondary: string;
    hover: string;
    bg: string;
    border: string;
  };
  dark: {
    primary: string;
    secondary: string;
    hover: string;
    bg: string;
    border: string;
  };
}> = {
  blue: {
    light: {
      primary: 'rgb(59, 130, 246)',
      secondary: 'rgb(96, 165, 250)',
      hover: 'rgb(37, 99, 235)',
      bg: 'rgb(239, 246, 255)',
      border: 'rgb(191, 219, 254)',
    },
    dark: {
      primary: 'rgb(96, 165, 250)',
      secondary: 'rgb(59, 130, 246)',
      hover: 'rgb(147, 197, 253)',
      bg: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(96, 165, 250, 0.3)',
    },
  },
  purple: {
    light: {
      primary: 'rgb(147, 51, 234)',
      secondary: 'rgb(167, 139, 250)',
      hover: 'rgb(124, 58, 237)',
      bg: 'rgb(245, 243, 255)',
      border: 'rgb(221, 214, 254)',
    },
    dark: {
      primary: 'rgb(167, 139, 250)',
      secondary: 'rgb(147, 51, 234)',
      hover: 'rgb(196, 181, 253)',
      bg: 'rgba(147, 51, 234, 0.1)',
      border: 'rgba(167, 139, 250, 0.3)',
    },
  },
  green: {
    light: {
      primary: 'rgb(34, 197, 94)',
      secondary: 'rgb(74, 222, 128)',
      hover: 'rgb(22, 163, 74)',
      bg: 'rgb(240, 253, 244)',
      border: 'rgb(187, 247, 208)',
    },
    dark: {
      primary: 'rgb(74, 222, 128)',
      secondary: 'rgb(34, 197, 94)',
      hover: 'rgb(134, 239, 172)',
      bg: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(74, 222, 128, 0.3)',
    },
  },
  orange: {
    light: {
      primary: 'rgb(251, 146, 60)',
      secondary: 'rgb(253, 186, 116)',
      hover: 'rgb(249, 115, 22)',
      bg: 'rgb(255, 247, 237)',
      border: 'rgb(254, 215, 170)',
    },
    dark: {
      primary: 'rgb(253, 186, 116)',
      secondary: 'rgb(251, 146, 60)',
      hover: 'rgb(254, 215, 170)',
      bg: 'rgba(251, 146, 60, 0.1)',
      border: 'rgba(253, 186, 116, 0.3)',
    },
  },
  pink: {
    light: {
      primary: 'rgb(236, 72, 153)',
      secondary: 'rgb(244, 114, 182)',
      hover: 'rgb(219, 39, 119)',
      bg: 'rgb(253, 242, 248)',
      border: 'rgb(251, 207, 232)',
    },
    dark: {
      primary: 'rgb(244, 114, 182)',
      secondary: 'rgb(236, 72, 153)',
      hover: 'rgb(248, 180, 217)',
      bg: 'rgba(236, 72, 153, 0.1)',
      border: 'rgba(244, 114, 182, 0.3)',
    },
  },
  cyan: {
    light: {
      primary: 'rgb(6, 182, 212)',
      secondary: 'rgb(34, 211, 238)',
      hover: 'rgb(8, 145, 178)',
      bg: 'rgb(236, 254, 255)',
      border: 'rgb(165, 243, 252)',
    },
    dark: {
      primary: 'rgb(34, 211, 238)',
      secondary: 'rgb(6, 182, 212)',
      hover: 'rgb(103, 232, 249)',
      bg: 'rgba(6, 182, 212, 0.1)',
      border: 'rgba(34, 211, 238, 0.3)',
    },
  },
};

// Apply theme to document
export function applyTheme(state: ThemeState) {
  const root = document.documentElement;
  
  // Apply theme mode
  const isDark = 
    state.theme === 'dark' || 
    (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  root.classList.toggle('dark', isDark);
  
  // Apply accent color
  const colorConfig = accentColorConfigs[state.accentColor];
  const colors = isDark ? colorConfig.dark : colorConfig.light;
  
  root.style.setProperty('--accent-primary', colors.primary);
  root.style.setProperty('--accent-secondary', colors.secondary);
  root.style.setProperty('--accent-hover', colors.hover);
  root.style.setProperty('--accent-bg', colors.bg);
  root.style.setProperty('--accent-border', colors.border);
  
  // Apply font size
  const fontConfig = fontSizeConfigs[state.fontSize];
  root.style.setProperty('--font-size-base', fontConfig.base);
  root.style.setProperty('--font-size-scale', fontConfig.scale.toString());
  
  // Apply animation speed
  const duration = animationDurations[state.animationSpeed];
  root.style.setProperty('--animation-duration', `${duration}s`);
  
  // Apply accessibility settings
  root.classList.toggle('reduce-motion', state.reduceMotion);
  root.classList.toggle('high-contrast', state.highContrast);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#0a0a0a' : '#ffffff');
  }
}