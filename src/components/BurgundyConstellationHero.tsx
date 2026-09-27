import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Ear, Activity, Brain, Hand, Check, Sun, Moon, Sparkles, ChevronDown } from 'lucide-react';
import { UserProfile } from '../types';
import { isArabicLocale, localize } from '../lib/translations';

interface BurgundyConstellationHeroProps {
  profile: UserProfile;
  onLaunchPrimary: () => void;
  onExploreModes: () => void;
  onSelectSuite?: (suiteId: 'vision' | 'deaf' | 'motor' | 'neurodiversity') => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

interface ConstellationNode {
  id: 'vision' | 'hearing' | 'sign' | 'motor' | 'neuro';
  labelAr: string;
  labelEn: string;
  suiteId: 'vision' | 'deaf' | 'motor' | 'neurodiversity';
  Icon: React.ComponentType<{ className?: string }>;
  x: number; // percentage in SVG viewBox 0-400
  y: number; // percentage in SVG viewBox 0-300
  color: string;
  glowColor: string;
}

export default function BurgundyConstellationHero({
  profile,
  onLaunchPrimary,
  onExploreModes,
  onSelectSuite,
  isDarkMode = true,
  toggleTheme,
}: BurgundyConstellationHeroProps) {
  const isAr = isArabicLocale(profile.language);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  // Female grammatical inflection for Esraa / female users or respectful inclusive Arabic
  const isFemaleUser = !!(profile.name && /esraa|israa|sara|sarah|mariam|fatma|nour|reem|salma/i.test(profile.name));
  const primaryCtaText = isAr
    ? isFemaleUser ? 'ابدئي رحلتكِ الآن' : 'ابدأ رحلتك الآن'
    : 'Start Your Journey Now';
  const secondaryCtaText = isAr
    ? isFemaleUser ? 'استكشفي الأوضاع' : 'استكشف الأوضاع'
    : 'Explore Assistive Suites';

  // The 5 true interconnected disability symbols
  const nodes: ConstellationNode[] = [
    {
      id: 'vision',
      labelAr: 'البصر',
      labelEn: 'Vision',
      suiteId: 'vision',
      Icon: Eye,
      x: 200,
      y: 42,
      color: '#FB7185', // Rose
      glowColor: 'rgba(251, 113, 133, 0.45)',
    },
    {
      id: 'hearing',
      labelAr: 'السمع',
      labelEn: 'Hearing',
      suiteId: 'deaf',
      Icon: Ear,
      x: 320,
      y: 110,
      color: '#E5A93C', // Gold
      glowColor: 'rgba(229, 169, 60, 0.45)',
    },
    {
      id: 'sign',
      labelAr: 'لغة الإشارة',
      labelEn: 'Sign Language',
      suiteId: 'deaf',
      Icon: Hand,
      x: 260,
      y: 220,
      color: '#F43F5E', // Deep Rose
      glowColor: 'rgba(244, 63, 94, 0.45)',
    },
    {
      id: 'motor',
      labelAr: 'الحركة',
      labelEn: 'Motor',
      suiteId: 'motor',
      Icon: Activity,
      x: 140,
      y: 220,
      color: '#FBBF24', // Amber
      glowColor: 'rgba(251, 191, 36, 0.45)',
    },
    {
      id: 'neuro',
      labelAr: 'العقل',
      labelEn: 'Cognitive',
      suiteId: 'neurodiversity',
      Icon: Brain,
      x: 80,
      y: 110,
      color: '#C084FC', // Purple
      glowColor: 'rgba(192, 132, 252, 0.45)',
    },
  ];

  // Connections between all 5 nodes (complete unified network)
  const connections: [number, number][] = [
    [0, 1], // Vision - Hearing
    [1, 2], // Hearing - Sign
    [2, 3], // Sign - Motor
    [3, 4], // Motor - Neuro
    [4, 0], // Neuro - Vision
    [0, 2], // Vision - Sign
    [0, 3], // Vision - Motor
    [1, 4], // Hearing - Neuro
    [1, 3], // Hearing - Motor
    [2, 4], // Sign - Neuro
  ];

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full relative overflow-hidden rounded-3xl cognify-burgundy-hero p-5 sm:p-8 md:p-10 select-none transition-all shadow-2xl"
      style={{
        background: 'radial-gradient(circle at 50% 18%, rgba(159, 18, 57, 0.42) 0%, rgba(45, 11, 22, 0.95) 50%, rgba(13, 4, 7, 0.99) 100%)',
        border: '1px solid rgba(229, 169, 60, 0.28)',
      }}
    >
      {/* Ambient Lighting Orbs */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-burgundy/30 rounded-full blur-3xl pointer-events-none" />

      {/* ── CARD HEADER: Brand Logo + Tagline + Theme Toggle ── */}
      <div className="relative z-10 flex items-center justify-between pb-6 border-b border-rose-950/60 gap-3 flex-wrap">
        {/* Right side: Cognify with gold monogram + Arabic tagline */}
        <div className="flex items-center gap-3">
          {/* Monogram Badge as seen in screenshot: gold border [NI] */}
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border-2 border-[#E5A93C] flex items-center justify-center text-[#E5A93C] font-black text-sm shadow-md shadow-amber-950/50">
            <span className="tracking-tighter">N|</span>
          </div>
          <div>
            <div className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Cognify</span>
            </div>
            <div className="text-xs font-semibold text-rose-300/80">
              {localize(profile.language, 'Adaptive Learning Companion', 'رفيقك التعليمي المتكيّف')}
            </div>
          </div>
        </div>

        {/* Left side: Light / Dark Theme Toggle Pill */}
        <div className="flex items-center bg-[#18050E] border border-rose-900/40 p-1 rounded-2xl shadow-inner gap-1">
          <button
            onClick={() => {
              if (!isDarkMode && toggleTheme) toggleTheme();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isDarkMode
                ? 'bg-[#831843] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span>{localize(profile.language, 'Dark', 'داكن')}</span>
          </button>
          <button
            onClick={() => {
              if (isDarkMode && toggleTheme) toggleTheme();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              !isDarkMode
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>{localize(profile.language, 'Light', 'فاتح')}</span>
          </button>
        </div>
      </div>

      {/* ── HERO CONTENT & CONSTELLATION MESH ── */}
      <div className="relative z-10 text-center pt-8 pb-4 max-w-3xl mx-auto flex flex-col items-center">
        {/* Top Gold Pill Badge with checkmark */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E5A93C]/60 bg-[#E5A93C]/10 text-[#FDE68A] text-xs font-bold mb-6 shadow-sm shadow-amber-950/40"
        >
          <span>{localize(profile.language, 'Every need has its symbol, all unified in one design', 'كل احتياج له رمزه، وكلهم متصلين في تصميم واحد')}</span>
          <Check className="w-3.5 h-3.5 text-[#E5A93C]" />
        </motion.div>

        {/* ── CONSTELLATION GRAPHIC CANVAS ── */}
        <div className="w-full max-w-md sm:max-w-lg h-56 sm:h-64 relative my-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 400 280">
            <defs>
              <linearGradient id="burgundyGoldLine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB7185" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#E5A93C" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#C084FC" stopOpacity="0.45" />
              </linearGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting Constellation Lines */}
            {connections.map(([fromIdx, toIdx], cIdx) => {
              const from = nodes[fromIdx];
              const to = nodes[toIdx];
              const isHighlighted = activeNode === from.id || activeNode === to.id;
              return (
                <line
                  key={cIdx}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isHighlighted ? '#E5A93C' : 'url(#burgundyGoldLine)'}
                  strokeWidth={isHighlighted ? 2.5 : 1.25}
                  strokeDasharray={isHighlighted ? 'none' : '4 3'}
                  strokeOpacity={isHighlighted ? 0.9 : 0.4}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Node Circles */}
            {nodes.map((node) => {
              const isActive = activeNode === node.id;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer group"
                  onClick={() => {
                    setActiveNode(node.id);
                    onSelectSuite?.(node.suiteId);
                  }}
                  onMouseEnter={() => setActiveNode(node.id)}
                  onMouseLeave={() => setActiveNode(null)}
                >
                  {/* Outer Pulsing Glow */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 28 : 22}
                    fill={node.glowColor}
                    className="transition-all duration-300"
                  />
                  {/* Border Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 22 : 18}
                    fill="#1C060F"
                    stroke={isActive ? '#E5A93C' : node.color}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className="transition-all duration-300 drop-shadow-md"
                  />
                  {/* Label Text below node */}
                  <text
                    x={node.x}
                    y={node.y + 34}
                    textAnchor="middle"
                    fill={isActive ? '#FDE68A' : '#E2D9E2'}
                    fontSize="11"
                    fontWeight={isActive ? 'bold' : 'normal'}
                    className="select-none transition-colors"
                  >
                    {isAr ? node.labelAr : node.labelEn}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Overlay of Icons centered on each SVG node */}
          {nodes.map((node) => {
            const leftPct = (node.x / 400) * 100;
            const topPct = (node.y / 280) * 100;
            const isActive = activeNode === node.id;
            return (
              <button
                key={`icon-${node.id}`}
                onClick={() => {
                  setActiveNode(node.id);
                  onSelectSuite?.(node.suiteId);
                }}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode(null)}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label={isAr ? node.labelAr : node.labelEn}
                className="absolute z-20 w-8 h-8 rounded-full flex items-center justify-center pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C]"
              >
                <node.Icon
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isActive ? 'scale-125 text-amber-300' : 'text-white'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* ── HEADLINE ── */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-snug mt-2 mb-4"
        >
          {localize(profile.language, 'The Power of Accessibility Starts', 'قوة الوصول تبدأ')}{' '}
          <span className="block sm:inline bg-gradient-to-r from-rose-400 via-amber-300 to-rose-300 bg-clip-text text-transparent drop-shadow-sm">
            {localize(profile.language, 'From Confidence in Design', 'من ثقة التصميم')}
          </span>
        </motion.h1>

        {/* ── MANIFESTO SUBTEXT ── */}
        <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal max-w-xl mx-auto mb-8 px-2">
          {localize(
            profile.language,
            'Vision, Hearing, Sign Language, Motor, and Mind — five genuine symbols coexisting in the same design, so no one feels like an afterthought or exception. Every need has a distinct visual presence, and all are part of the same strong identity.',
            'البصر، السمع، لغة الإشارة، الحركة، والعقل — خمسة رموز حقيقية متجاورة في نفس التصميم، عشان محدش يحس إنه ملحق أو استثناء. كل احتياج ليه حضور بصري واضح، وكلهم جزء من نفس الهوية القوية.'
          )}
        </p>

        {/* ── ACTION BUTTONS ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
          {/* Primary CTA: Burgundy filled button */}
          <button
            onClick={onLaunchPrimary}
            className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#881337] via-[#9F1239] to-[#831843] hover:from-[#9F1239] hover:to-[#BE123C] text-white font-black text-sm tracking-wide shadow-xl shadow-rose-950/60 border border-rose-400/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{primaryCtaText}</span>
          </button>

          {/* Secondary CTA: Dark with gold border */}
          <button
            onClick={onExploreModes}
            className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 rounded-2xl bg-[#18050E]/80 border-2 border-[#E5A93C] text-[#FDE68A] hover:bg-[#E5A93C]/15 font-black text-sm tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{secondaryCtaText}</span>
            <ChevronDown className="w-4 h-4 text-[#E5A93C]" />
          </button>
        </div>

        {/* ── GOLDEN HORIZON GLOWING ARC ── */}
        <div className="w-64 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#E5A93C] to-transparent mx-auto mt-8 shadow-[0_0_24px_#E5A93C]" />
      </div>
    </div>
  );
}
