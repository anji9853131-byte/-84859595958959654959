export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'hell';

export interface DifficultyConfig {
  id: DifficultyLevel;
  name: string;
  badge: string;
  emoji: string;
  tagline: string;
  description: string;
  
  // Theme & Aesthetics
  themeColor: 'emerald' | 'cyan' | 'rose' | 'hell';
  accentColor: string;
  borderClass: string;
  activeBorderClass: string;
  bgGradient: string;
  cardGlow: string;
  badgeClass: string;
  selectedBgClass: string;

  // Real Gameplay & Physics Units
  baseSpeed: number;                 // Starting track speed (px/sec)
  speedIncreaseRate: number;         // Multiplier on speed ramp-up over time & distance
  maxSpeedBonus: number;             // Top speed ceiling addition
  magnetForceMultiplier: number;     // Magnetic pull/repulsion strength factor
  magnetRadiusMultiplier: number;    // Magnetic interaction reach
  playerControlForce: number;        // Direct lateral steering thrust (px/s^2)
  spawnSpacingMultiplier: number;    // Multiplier for slice distance (higher = more space, lower = denser obstacles)
  safeGapMultiplier: number;         // Safe escape corridor width multiplier
  progressionSpeedMultiplier: number;// How fast game reaches peak difficulty curve (0.0 -> 1.0)
}

export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'EASY',
    badge: '🟢 EASY',
    emoji: '🟢',
    tagline: '편안하게 연습하기',
    description: '느린 속도와 넓은 안전 공간으로 자석의 극성과 조작을 익히기에 완벽합니다.',
    themeColor: 'emerald',
    accentColor: '#10b981',
    borderClass: 'border-emerald-500/30 hover:border-emerald-400/60',
    activeBorderClass: 'border-emerald-400 ring-2 ring-emerald-400/50',
    bgGradient: 'from-emerald-950/40 via-emerald-900/20 to-zinc-950',
    cardGlow: 'shadow-[0_0_25px_rgba(16,185,129,0.3)]',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    selectedBgClass: 'bg-emerald-500/15',
    baseSpeed: 230,
    speedIncreaseRate: 0.5,
    maxSpeedBonus: 140,
    magnetForceMultiplier: 0.65,
    magnetRadiusMultiplier: 0.85,
    playerControlForce: 2100,
    spawnSpacingMultiplier: 1.35,
    safeGapMultiplier: 1.3,
    progressionSpeedMultiplier: 0.55,
  },
  normal: {
    id: 'normal',
    name: 'NORMAL',
    badge: '🔵 NORMAL',
    emoji: '🔵',
    tagline: '기본 난이도',
    description: '가장 균형 잡힌 속도와 자석 물리로 긴장감 있는 주행을 선사합니다.',
    themeColor: 'cyan',
    accentColor: '#06b6d4',
    borderClass: 'border-cyan-500/30 hover:border-cyan-400/60',
    activeBorderClass: 'border-cyan-400 ring-2 ring-cyan-400/50',
    bgGradient: 'from-cyan-950/40 via-cyan-900/20 to-zinc-950',
    cardGlow: 'shadow-[0_0_25px_rgba(6,182,212,0.3)]',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    selectedBgClass: 'bg-cyan-500/15',
    baseSpeed: 300,
    speedIncreaseRate: 1.0,
    maxSpeedBonus: 260,
    magnetForceMultiplier: 1.0,
    magnetRadiusMultiplier: 1.0,
    playerControlForce: 1800,
    spawnSpacingMultiplier: 1.0,
    safeGapMultiplier: 1.0,
    progressionSpeedMultiplier: 1.0,
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    badge: '🔴 HARD',
    emoji: '🔴',
    tagline: '빠른 판단이 필요합니다',
    description: '빠른 속도와 강력한 자력. 극 전환과 중성 모드를 전략적으로 구사해야 합니다.',
    themeColor: 'rose',
    accentColor: '#f43f5e',
    borderClass: 'border-rose-500/30 hover:border-rose-400/60',
    activeBorderClass: 'border-rose-400 ring-2 ring-rose-400/50',
    bgGradient: 'from-rose-950/40 via-rose-900/20 to-zinc-950',
    cardGlow: 'shadow-[0_0_30px_rgba(244,63,94,0.35)]',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    selectedBgClass: 'bg-rose-500/15',
    baseSpeed: 380,
    speedIncreaseRate: 1.45,
    maxSpeedBonus: 360,
    magnetForceMultiplier: 1.35,
    magnetRadiusMultiplier: 1.15,
    playerControlForce: 1650,
    spawnSpacingMultiplier: 0.82,
    safeGapMultiplier: 0.82,
    progressionSpeedMultiplier: 1.45,
  },
  hell: {
    id: 'hell',
    name: 'HELL',
    badge: '👿 HELL',
    emoji: '👿',
    tagline: '살아남을 수 있다면...',
    description: '극한의 반응 속도와 완벽한 타이밍! 피할 길은 반드시 있지만 실수가 용납되지 않습니다.',
    themeColor: 'hell',
    accentColor: '#d946ef',
    borderClass: 'border-purple-600/40 hover:border-fuchsia-400/70',
    activeBorderClass: 'border-fuchsia-500 ring-2 ring-purple-500/70 shadow-[0_0_35px_rgba(217,70,239,0.5),0_0_15px_rgba(239,68,68,0.4)]',
    bgGradient: 'from-purple-950/50 via-red-950/30 to-zinc-950',
    cardGlow: 'shadow-[0_0_35px_rgba(217,70,239,0.4),0_0_20px_rgba(225,29,72,0.3)]',
    badgeClass: 'bg-gradient-to-r from-red-600/30 to-purple-600/30 text-fuchsia-200 border-purple-500/60 animate-pulse',
    selectedBgClass: 'bg-gradient-to-r from-red-950/40 via-purple-950/50 to-red-950/40',
    baseSpeed: 460,
    speedIncreaseRate: 1.9,
    maxSpeedBonus: 440,
    magnetForceMultiplier: 1.65,
    magnetRadiusMultiplier: 1.25,
    playerControlForce: 1550,
    spawnSpacingMultiplier: 0.72,
    safeGapMultiplier: 0.72,
    progressionSpeedMultiplier: 1.85,
  },
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard', 'hell'];

/**
 * Storage helpers for individual difficulty best scores
 */
export function getDifficultyBestScores(): Record<DifficultyLevel, number> {
  const scores: Record<DifficultyLevel, number> = {
    easy: 0,
    normal: 0,
    hard: 0,
    hell: 0,
  };

  try {
    for (const diff of DIFFICULTY_ORDER) {
      const saved = localStorage.getItem(`magnet_rush_best_${diff}`);
      if (saved) {
        const val = parseFloat(saved);
        if (Number.isFinite(val) && val >= 0) {
          scores[diff] = val;
        }
      }
    }

    // Migration: if general key exists and normal is 0, initialize normal with it
    const legacy = localStorage.getItem('magnet_rush_best');
    if (legacy && scores.normal === 0) {
      const legacyVal = parseFloat(legacy);
      if (Number.isFinite(legacyVal) && legacyVal > 0) {
        scores.normal = legacyVal;
        localStorage.setItem('magnet_rush_best_normal', legacyVal.toFixed(1));
      }
    }
  } catch {
    // ignore
  }

  return scores;
}

export function saveDifficultyBestScore(diff: DifficultyLevel, distance: number): boolean {
  try {
    const key = `magnet_rush_best_${diff}`;
    const prevStr = localStorage.getItem(key);
    const prev = prevStr ? parseFloat(prevStr) || 0 : 0;
    if (distance > prev) {
      localStorage.setItem(key, distance.toFixed(1));
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
