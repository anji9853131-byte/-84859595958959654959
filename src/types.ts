import type { DifficultyLevel } from './difficulty';

export type Pole = 'N' | 'S';

export type ObstacleType = 
  | 'hazard' 
  | 'magnet_n' 
  | 'magnet_s';

export interface Obstacle {
  id: number;
  x: number;      // World X coordinate (-trackWidth/2 to +trackWidth/2)
  y: number;      // World Y coordinate (0 is track surface)
  z: number;      // World Z coordinate (distance ahead of player)
  width: number;
  height: number;
  depth: number;
  type: ObstacleType;
  passed: boolean;
  pulsePhase?: number;
  laneIndex?: number;
  closePassEvaluated?: boolean; // Evaluated for PERFECT or NEAR MISS once
  // Optional moving obstacles in advanced stages
  moveSpeed?: number;
  moveRange?: number;
  initialX?: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'pulse' | 'spark' | 'field' | 'trail' | 'shatter' | 'electric';
}

export interface Shockwave {
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  pole: Pole;
}

export interface Afterimage {
  x: number;
  y: number;
  z: number;
  vx: number;
  pole: Pole;
  isNeutral: boolean;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface SpeedLine {
  x: number;
  y: number;
  z: number;
  length: number;
  speedMultiplier: number;
  alpha: number;
}

export interface MagneticArc {
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  color: string;
  isAttracting: boolean;
  strength: number;
}

export interface GameState {
  distance: number;
  bestDistance: number;
  selectedDifficulty: DifficultyLevel;
  bestScores: Record<DifficultyLevel, number>;
  speed: number;
  gameTime: number;
  difficulty: number;
  playerX: number;
  playerVx: number;
  directInputX: number;
  playerPole: Pole;
  isPlaying: boolean;
  isGameOver: boolean;
  invulnerableTime: number;
  screenShake: number;
  lastPoleSwitchTime: number;
  nearMissFlash: number;
  tutorialStage: number;

  // 🟣 Neutral Mode States (Core player ability)
  isNeutral: boolean;
  neutralTime: number;        // Active duration (starts at 3.0s, counts down to 0)
  neutralCooldown: number;    // Cooldown duration (starts at 5.0s, counts down to 0)
  previousPole: Pole;         // Pre-neutral pole to restore after 3s

  // 🎯 PERFECT & 💨 NEAR MISS & ⚡ SHOCKWAVE Sensory States
  perfectCombo: number;
  comboTimer: number;
  perfectPopup: { text: string; combo: number; opacity: number; scale: number; id: number } | null;
  nearMissPopup: { text: string; opacity: number; id: number } | null;
  edgeVignetteIntensity: number;
  shockwaveFlash: number;
  lastHitObstacle?: ObstacleType | null;
  runSeed?: number;
}

