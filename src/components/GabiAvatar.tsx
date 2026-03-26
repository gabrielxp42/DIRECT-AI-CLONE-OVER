import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './GabiAvatar.css';

export type GabiMood = 'idle' | 'thinking' | 'happy' | 'error' | 'listening' | 'success';

interface GabiAvatarProps {
  mood?: GabiMood;
  size?: number;
  className?: string;
}

// Color palette per mood
const MOOD_COLORS: Record<GabiMood, { primary: string; glow: string }> = {
  idle:      { primary: 'var(--primary-custom)', glow: 'var(--primary-custom)' },   // Dynamic theme color
  thinking:  { primary: '#06b6d4', glow: '#22d3ee' },   // Cyan
  happy:     { primary: '#22c55e', glow: '#4ade80' },   // Green
  error:     { primary: '#ef4444', glow: '#f87171' },   // Red
  listening: { primary: '#f59e0b', glow: '#fbbf24' },   // Amber
  success:   { primary: '#10b981', glow: '#34d399' },   // Emerald
};

export const GabiAvatar: React.FC<GabiAvatarProps> = ({
  mood = 'idle',
  size = 48,
  className = '',
}) => {
  const colors = MOOD_COLORS[mood];
  const isThinking = mood === 'thinking';

  // SVG viewBox is 200x100, scaled by `size`
  const viewW = 200;
  const viewH = 110;
  const scale = size / viewH;

  const filterId = useMemo(() => `gabi-glow-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div
      className={`gabi-avatar gabi-avatar--${mood} ${className}`}
      style={{ width: viewW * scale, height: viewH * scale }}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width={viewW * scale}
        height={viewH * scale}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Neon glow filter */}
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <AnimatePresence mode="wait">
          {isThinking ? (
            /* ===== THINKING: Infinity Symbol ===== */
            <motion.g
              key="infinity"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
              filter={`url(#${filterId})`}
            >
              {/* Infinity path — figure-8 centered in viewbox */}
              <motion.path
                d="M 60 55 C 60 30, 100 30, 100 55 C 100 80, 140 80, 140 55 C 140 30, 100 30, 100 55 C 100 80, 60 80, 60 55 Z"
                fill="none"
                stroke={colors.primary}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0.5 }}
                animate={{
                  pathLength: [0, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  pathLength: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                }}
              />
              {/* Outer glow trace */}
              <motion.path
                d="M 60 55 C 60 30, 100 30, 100 55 C 100 80, 140 80, 140 55 C 140 30, 100 30, 100 55 C 100 80, 60 80, 60 55 Z"
                fill="none"
                stroke={colors.glow}
                strokeWidth="2"
                strokeLinecap="round"
                opacity={0.4}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
            </motion.g>
          ) : (
            /* ===== NORMAL: Two Eyes with Eyelashes ===== */
            <motion.g
              key="eyes"
              className="gabi-eyes"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
            >
              {/* ---- LEFT EYE ---- */}
              <g filter={`url(#${filterId})`}>
                {/* Outer glow ring */}
                <motion.circle
                  cx="65"
                  cy="58"
                  r="32"
                  fill="none"
                  className="gabi-eye-glow"
                  animate={{ stroke: colors.glow }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="3"
                  opacity={0.35}
                />
                {/* Main ring */}
                <motion.circle
                  cx="65"
                  cy="58"
                  r="30"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Dark interior */}
                <circle cx="65" cy="58" r="26" fill="rgba(10, 5, 20, 0.85)" />

                {/* Eyelashes — top-left, curving outward (3 lashes) */}
                <motion.path
                  d="M 42 38 Q 34 28, 28 22"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={0.9}
                />
                <motion.path
                  d="M 38 42 Q 28 35, 22 30"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={0.75}
                />
                <motion.path
                  d="M 36 48 Q 26 43, 20 40"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity={0.6}
                />
              </g>

              {/* ---- RIGHT EYE ---- */}
              <g filter={`url(#${filterId})`}>
                {/* Outer glow ring */}
                <motion.circle
                  cx="135"
                  cy="58"
                  r="32"
                  fill="none"
                  className="gabi-eye-glow"
                  animate={{ stroke: colors.glow }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="3"
                  opacity={0.35}
                />
                {/* Main ring */}
                <motion.circle
                  cx="135"
                  cy="58"
                  r="30"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Dark interior */}
                <circle cx="135" cy="58" r="26" fill="rgba(10, 5, 20, 0.85)" />

                {/* Eyelashes — top-right, curving outward (3 lashes) */}
                <motion.path
                  d="M 158 38 Q 166 28, 172 22"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={0.9}
                />
                <motion.path
                  d="M 162 42 Q 172 35, 178 30"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={0.75}
                />
                <motion.path
                  d="M 164 48 Q 174 43, 180 40"
                  fill="none"
                  animate={{ stroke: colors.primary }}
                  transition={{ duration: 0.8 }}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity={0.6}
                />
              </g>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Success flash overlay */}
        {mood === 'success' && (
          <circle
            cx="100"
            cy="55"
            r="10"
            fill={colors.glow}
            className="gabi-success-flash"
          />
        )}
      </svg>
    </div>
  );
};

export default GabiAvatar;
