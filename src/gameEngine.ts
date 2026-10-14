import { Obstacle, ObstacleType, Particle, Pole, GameState, MagneticArc, Shockwave, Afterimage, SpeedLine } from './types';
import { sound } from './audio';
import { DifficultyLevel, DIFFICULTY_SETTINGS, getDifficultyBestScores, saveDifficultyBestScore } from './difficulty';

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public viewWidth = 800;
  public viewHeight = 600;

  // Track & 3D Projection parameters
  public trackWidth = 480;
  public fov = 440;
  public cameraY = 165;
  public playerZ = 130;
  public playerRadius = 22;

  // Selected Difficulty Level
  public selectedDifficulty: DifficultyLevel = 'normal';

  // Physics & Difficulty parameters (Dynamically scales with gameTime & distance)
  public gameTime: number = 0;
  public currentMagnetForce: number = 1400;      // Starts gentle (1400), scales to intense (8000)
  public currentMagnetRadius: number = 420;     // Starts compact (420), scales to wide (740)
  public currentPlayerControlForce: number = 1750; // Starts strong (1750 > 1400), scales to auxiliary (1350)
  public directInputX: number = 0;

  // Game state
  public state: GameState = {
    distance: 0,
    bestDistance: 0,
    selectedDifficulty: 'normal',
    bestScores: {
      easy: 0,
      normal: 0,
      hard: 0,
      hell: 0,
    },
    speed: 300,
    gameTime: 0,
    difficulty: 0,
    playerX: 0,
    playerVx: 0,
    directInputX: 0,
    playerPole: 'N',
    isPlaying: false,
    isGameOver: false,
    invulnerableTime: 0,
    screenShake: 0,
    lastPoleSwitchTime: 0,
    nearMissFlash: 0,
    tutorialStage: 0,
    isNeutral: false,
    neutralTime: 0,
    neutralCooldown: 0,
    previousPole: 'N',

    // 🎯 PERFECT & 💨 NEAR MISS & ⚡ SHOCKWAVE Sensory States
    perfectCombo: 0,
    comboTimer: 0,
    perfectPopup: null,
    nearMissPopup: null,
    edgeVignetteIntensity: 0,
    shockwaveFlash: 0,
    lastHitObstacle: null,
  };

  // World objects
  public obstacles: Obstacle[] = [];
  public particles: Particle[] = [];
  public activeArcs: MagneticArc[] = [];
  public pulseRings: { x: number; y: number; z: number; radius: number; maxRadius: number; color: string; life: number }[] = [];
  public shockwaves: Shockwave[] = [];
  public afterimages: Afterimage[] = [];
  public speedLines: SpeedLine[] = [];

  // Slow-motion & sensation timers
  public slowMoTimer: number = 0;
  public slowMoScale: number = 1.0;
  private popupIdCounter: number = 1;

  // Timing & Animation
  private lastTime: number = 0;
  private animationId: number = 0;
  private nextObstacleId: number = 1;
  private trackScroll: number = 0;

  // Procedural Map Generation & Guaranteed Safe Path System
  public runSeed: number = 1;
  private rngSeed: number = 1;
  private safePathX: number = 0;

  // Callbacks
  public onStateUpdate?: (state: GameState) => void;
  public onGameOver?: (finalDistance: number, isNewBest: boolean, difficulty: DifficultyLevel) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;

    // Load best distances per difficulty
    const bestScores = getDifficultyBestScores();
    this.state.bestScores = bestScores;
    this.state.bestDistance = bestScores[this.selectedDifficulty] || 0;

    const initialCfg = DIFFICULTY_SETTINGS[this.selectedDifficulty];
    this.currentMagnetForce = 1300 * initialCfg.magnetForceMultiplier;
    this.currentMagnetRadius = 400 * initialCfg.magnetRadiusMultiplier;
    this.currentPlayerControlForce = initialCfg.playerControlForce;
    this.state.speed = initialCfg.baseSpeed;

    this.initSpeedLines();
  }

  public setDifficulty(level: DifficultyLevel) {
    this.selectedDifficulty = level;
    this.state.selectedDifficulty = level;
    this.state.bestDistance = this.state.bestScores[level] || 0;
    const cfg = DIFFICULTY_SETTINGS[level];
    this.currentMagnetForce = 1300 * cfg.magnetForceMultiplier;
    this.currentMagnetRadius = 400 * cfg.magnetRadiusMultiplier;
    this.currentPlayerControlForce = cfg.playerControlForce;
    this.state.speed = cfg.baseSpeed;
    this.notifyState();
  }

  public init(startImmediately: boolean = false) {
    this.reset(startImmediately);
  }

  private initSpeedLines() {
    this.speedLines = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 1.6) - Math.PI * 0.8;
      const dist = 220 + Math.random() * 280;
      const x = Math.sin(angle) * dist;
      const y = Math.max(5, Math.cos(angle) * dist);
      const z = 80 + Math.random() * 1900;
      this.speedLines.push({
        x,
        y,
        z,
        length: 80 + Math.random() * 120,
        speedMultiplier: 0.85 + Math.random() * 0.35,
        alpha: 0.25 + Math.random() * 0.55,
      });
    }
  }

  public resize(width: number, height: number, dpr: number) {
    this.viewWidth = width;
    this.viewHeight = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public reset(startImmediately: boolean = true) {
    const cfg = DIFFICULTY_SETTINGS[this.selectedDifficulty];
    this.directInputX = 0;
    this.gameTime = 0;
    this.currentMagnetForce = 1300 * cfg.magnetForceMultiplier;
    this.currentMagnetRadius = 400 * cfg.magnetRadiusMultiplier;
    this.currentPlayerControlForce = cfg.playerControlForce;

    this.state.distance = 0;
    this.state.gameTime = 0;
    this.state.difficulty = 0;
    this.state.speed = cfg.baseSpeed;
    this.state.playerX = 0;
    this.state.playerVx = 0;
    this.state.directInputX = 0;
    this.state.playerPole = 'N';
    this.state.isPlaying = startImmediately;
    this.state.isGameOver = false;
    this.state.invulnerableTime = 0;
    this.state.screenShake = 0;
    this.state.lastPoleSwitchTime = performance.now() / 1000;
    this.state.nearMissFlash = 0;
    this.state.tutorialStage = 0;
    this.state.lastHitObstacle = null;
    this.state.selectedDifficulty = this.selectedDifficulty;
    this.state.bestDistance = this.state.bestScores[this.selectedDifficulty] || 0;

    // Reset neutral mode
    this.state.isNeutral = false;
    this.state.neutralTime = 0;
    this.state.neutralCooldown = 0;
    this.state.previousPole = 'N';

    // Reset sensory states
    this.state.perfectCombo = 0;
    this.state.comboTimer = 0;
    this.state.perfectPopup = null;
    this.state.nearMissPopup = null;
    this.state.edgeVignetteIntensity = 0;
    this.state.shockwaveFlash = 0;

    this.obstacles = [];
    this.particles = [];
    this.activeArcs = [];
    this.pulseRings = [];
    this.shockwaves = [];
    this.afterimages = [];
    this.slowMoTimer = 0;
    this.slowMoScale = 1.0;
    this.nextObstacleId = 1;
    this.trackScroll = 0;

    this.initSpeedLines();

    // 1. Generate a fresh random seed for this run
    const freshSeed = Math.floor(Math.random() * 2147483647) + 1;
    this.setSeed(freshSeed);

    // 2. Procedurally generate initial verified, fair random obstacle layout
    this.initProceduralRun();

    this.notifyState();
  }

  public setSeed(seed: number) {
    this.runSeed = seed;
    this.rngSeed = seed;
    this.state.runSeed = seed;
  }

  private nextRandom(): number {
    let t = (this.rngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private randomRange(min: number, max: number): number {
    return min + this.nextRandom() * (max - min);
  }

  public setDirectInput(inputX: number) {
    this.directInputX = Math.max(-1, Math.min(1, inputX));
    this.state.directInputX = this.directInputX;
    if (!this.state.isPlaying && !this.state.isGameOver && inputX !== 0) {
      this.state.isPlaying = true;
    }
  }

  /**
   * 🛣️ SAFE PATH FIRST - PROCEDURAL INITIALIZATION
   * Every game start & restart creates a freshly randomized map
   * with guaranteed traversable safe corridors.
   */
  private initProceduralRun() {
    this.safePathX = 0;
    this.obstacles = [];

    // Pre-populate slices stretching up to the spawn horizon (2400)
    let currentZ = 440;
    while (currentZ <= 2400) {
      const spacing = this.calculateSliceSpacing();
      currentZ += spacing;
      this.generateAndValidateSlice(currentZ);
    }
  }

  public switchPole() {
    if (this.state.isGameOver) return;
    if (!this.state.isPlaying) {
      this.state.isPlaying = true;
    }

    // If currently neutral, update previousPole so when neutral expires it returns to the switched pole
    if (this.state.isNeutral) {
      this.state.previousPole = this.state.previousPole === 'N' ? 'S' : 'N';
      return;
    }

    const prevPole = this.state.playerPole;
    this.state.playerPole = prevPole === 'N' ? 'S' : 'N';
    this.state.lastPoleSwitchTime = performance.now() / 1000;

    const poleColor = this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff';

    // 1️⃣ ⚡ 극 전환 충격파 사운드 (Electric zap + thump)
    sound.playSwitchShockwave(this.state.playerPole);

    // 1. Shockwave energy ring (Effect 1) - expands from player center, fades within ~0.38s
    if (this.shockwaves.length >= 4) {
      this.shockwaves.shift();
    }
    this.shockwaves.push({
      x: this.state.playerX,
      y: 16,
      z: this.playerZ,
      radius: 14,
      maxRadius: 210,
      life: 0.38,
      maxLife: 0.38,
      color: poleColor,
      pole: this.state.playerPole,
    });

    // 2. High-speed electric particles with erratic jitter
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 140 + Math.random() * 120;
      this.particles.push({
        x: this.state.playerX,
        y: 16,
        z: this.playerZ,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.3) * 60,
        vz: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.12,
        maxLife: 0.4,
        color: Math.random() < 0.35 ? '#ffffff' : poleColor,
        size: 3.5 + Math.random() * 2.5,
        type: 'electric',
      });
    }

    // 3. Player short afterimage (잔상 효과)
    this.spawnAfterimage(poleColor, 0.32);

    // 4. Color change emphasis & shockwave screen flash
    this.state.shockwaveFlash = 0.32;

    this.notifyState();
  }

  // Spawn player afterimage (ghost trail)
  public spawnAfterimage(color: string, life: number = 0.32) {
    if (this.afterimages.length >= 8) {
      this.afterimages.shift();
    }
    this.afterimages.push({
      x: this.state.playerX,
      y: 16,
      z: this.playerZ,
      vx: this.state.playerVx,
      pole: this.state.playerPole,
      isNeutral: this.state.isNeutral,
      alpha: 0.7,
      life,
      maxLife: life,
      color,
    });
  }

  // 🟣 Activate Neutral Mode (Triggered by SPACE)
  public activateNeutral() {
    if (this.state.isGameOver) return;
    if (!this.state.isPlaying) {
      this.state.isPlaying = true;
    }

    // Must not be currently neutral and cooldown must be <= 0
    if (this.state.isNeutral || this.state.neutralCooldown > 0) {
      return;
    }

    this.state.isNeutral = true;
    this.state.neutralTime = 3.0;
    this.state.neutralCooldown = 5.0; // 5.0s cooldown starts at the moment of activation
    this.state.previousPole = this.state.playerPole;

    // Ethereal purple sound
    sound.playNeutral();

    // 1. Purple pulse ring
    this.pulseRings.push({
      x: this.state.playerX,
      y: 0,
      z: this.playerZ,
      radius: 20,
      maxRadius: 200,
      color: '#9B59FF',
      life: 1.0,
    });

    // 2. Purple energy sparks
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 120 + Math.random() * 90;
      this.particles.push({
        x: this.state.playerX,
        y: 16,
        z: this.playerZ,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.2) * 60,
        vz: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        color: '#C084FF',
        size: 3.5 + Math.random() * 3,
        type: 'spark',
      });
    }

    this.notifyState();
  }

  public start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    sound.stopMagnetHum();
  }

  private loop = (currentTime?: number) => {
    const validCurrentTime = (typeof currentTime === 'number' && Number.isFinite(currentTime) && currentTime > 0)
      ? currentTime
      : performance.now();
    const rawDt = this.lastTime > 0 ? (validCurrentTime - this.lastTime) / 1000 : 0.016;
    const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.08) : 0.016;
    this.lastTime = validCurrentTime;

    this.update(dt);
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (!this.state.isPlaying) {
      for (const line of this.speedLines) {
        line.z -= 180 * dt;
        if (line.z < 10) {
          line.z = 1800 + Math.random() * 200;
        }
      }
      this.trackScroll += 120 * dt;
      return;
    }

    // Slow-motion timer & effective delta time calculation
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) {
        this.slowMoTimer = 0;
        this.slowMoScale = 1.0;
      }
    }
    const safeScale = Number.isFinite(this.slowMoScale) && this.slowMoScale > 0 ? this.slowMoScale : 1.0;
    const simDt = dt * (this.slowMoTimer > 0 ? safeScale : 1.0);

    // Combo decay timer (3.5s window)
    if (this.state.comboTimer > 0) {
      this.state.comboTimer -= dt;
      if (this.state.comboTimer <= 0) {
        this.state.perfectCombo = 0;
        this.state.comboTimer = 0;
      }
    }

    // Sensory popup animation decays
    if (this.state.perfectPopup) {
      this.state.perfectPopup.opacity -= dt * 1.4;
      this.state.perfectPopup.scale = Math.max(1.0, this.state.perfectPopup.scale - dt * 0.9);
      if (this.state.perfectPopup.opacity <= 0) {
        this.state.perfectPopup = null;
      }
    }
    if (this.state.nearMissPopup) {
      this.state.nearMissPopup.opacity -= dt * 1.8;
      if (this.state.nearMissPopup.opacity <= 0) {
        this.state.nearMissPopup = null;
      }
    }
    if (this.state.edgeVignetteIntensity > 0) {
      this.state.edgeVignetteIntensity -= dt * 2.2;
      if (this.state.edgeVignetteIntensity < 0) this.state.edgeVignetteIntensity = 0;
    }
    if (this.state.shockwaveFlash > 0) {
      this.state.shockwaveFlash -= dt * 3.5;
      if (this.state.shockwaveFlash < 0) this.state.shockwaveFlash = 0;
    }

    if (!this.state.isGameOver) {
      const cfg = DIFFICULTY_SETTINGS[this.selectedDifficulty];

      // 1. Time & Distance Progression
      this.gameTime += simDt;
      this.state.gameTime = this.gameTime;

      // Calculate smooth difficulty factor (0 to 1, scaled by progressionSpeedMultiplier)
      const currentDist = Number.isFinite(this.state.distance) && this.state.distance >= 0 ? this.state.distance : 0;
      const timeProgress = Math.min((this.gameTime * cfg.progressionSpeedMultiplier) / 55, 1.0);
      const distProgress = Math.min((currentDist * cfg.progressionSpeedMultiplier) / 500, 1.0);
      const rawDiff = Math.max(timeProgress, distProgress * 0.85);

      // Smoothstep easing (3x^2 - 2x^3) for organic difficulty curve
      const difficulty = rawDiff * rawDiff * (3 - 2 * rawDiff);
      this.state.difficulty = Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : 0;

      // Magnetic forces scaled by difficulty configuration
      this.currentMagnetForce = (1300 + this.state.difficulty * 6700) * cfg.magnetForceMultiplier;
      this.currentMagnetRadius = (400 + this.state.difficulty * 320) * cfg.magnetRadiusMultiplier;
      this.currentPlayerControlForce = cfg.playerControlForce - this.state.difficulty * 450;

      // Smooth track forward speed: baseSpeed + scaled ramp bonus
      const speedBonus = (this.state.difficulty * 240 + Math.min(cfg.maxSpeedBonus, Math.pow(Math.max(0, currentDist), 0.45) * 14)) * cfg.speedIncreaseRate;
      const speedCalc = cfg.baseSpeed + speedBonus;
      this.state.speed = Number.isFinite(speedCalc) && speedCalc >= cfg.baseSpeed ? speedCalc : cfg.baseSpeed;

      // Score / Distance progression
      const distanceGain = (this.state.speed * simDt) * 0.05;
      if (Number.isFinite(distanceGain) && distanceGain >= 0) {
        this.state.distance += distanceGain;
      }
      if (!Number.isFinite(this.state.distance) || this.state.distance < 0) {
        this.state.distance = 0;
      }
      this.trackScroll += this.state.speed * simDt;

      if (this.state.invulnerableTime > 0) {
        this.state.invulnerableTime -= simDt;
      }

      // 🟣 Update Neutral Mode
      if (this.state.neutralCooldown > 0) {
        this.state.neutralCooldown = Math.max(0, this.state.neutralCooldown - dt);
      }
      if (this.state.isNeutral) {
        this.state.neutralTime -= dt;
        if (this.state.neutralTime <= 0) {
          this.state.isNeutral = false;
          this.state.neutralTime = 0;
          // Restore the previous pole
          this.state.playerPole = this.state.previousPole;
          // Pulse on deactivating
          this.pulseRings.push({
            x: this.state.playerX,
            y: 0,
            z: this.playerZ,
            radius: 12,
            maxRadius: 130,
            color: this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff',
            life: 0.6,
          });
        }
      }

      // 2. Direct player input force
      const inputForceX = this.directInputX * this.currentPlayerControlForce;

      // 3. Physics: Magnetic force calculation
      let magnetForceX = 0;
      this.activeArcs = [];
      let strongestInfluence = 0;
      let isAttractingActive = false;

      // 🟣 Neutral Mode check: In Neutral state, all magnet force is strictly 0!
      if (this.state.isNeutral) {
        magnetForceX = 0;
      } else {
        const playerPole = this.state.playerPole;

        for (const obs of this.obstacles) {
          if (obs.type === 'magnet_n' || obs.type === 'magnet_s') {
            const dx = obs.x - this.state.playerX;
            const dz = obs.z - this.playerZ;

            const distance = Math.sqrt(dx * dx + dz * dz);

            // Skip if out of dynamic magnetic radius or too close to avoid divide-by-zero
            if (distance > this.currentMagnetRadius || distance < 0.01) {
              continue;
            }

            // Direction from player to magnet on lateral axis (X)
            const directionX = dx / distance;

            // Magnet pole identification
            const magnetPole: Pole = obs.type === 'magnet_n' ? 'N' : 'S';
            const arcColor = obs.type === 'magnet_n' ? '#ff3b5c' : '#36a9ff';

            const samePole = playerPole === magnetPole;
            const isAttracting = !samePole;

            // Different pole attracts (+directionX), same pole repels (-directionX)
            const forceDirection = samePole ? -directionX : directionX;

            // Quadratic proximity scaling: strength rises dramatically near the magnet
            const normalizedDistance = distance / this.currentMagnetRadius;
            const proximity = Math.pow(1 - normalizedDistance, 2);
            const strength = proximity * this.currentMagnetForce;

            const forceX = forceDirection * strength;
            magnetForceX += forceX;

            const influence = 1 - normalizedDistance;
            if (influence > strongestInfluence) {
              strongestInfluence = influence;
              isAttractingActive = isAttracting;
            }

            // Visual magnetic energy arc between player and magnet
            this.activeArcs.push({
              sourceX: obs.x,
              sourceY: obs.height * 0.5,
              sourceZ: obs.z,
              targetX: this.state.playerX,
              targetY: 15,
              targetZ: this.playerZ,
              color: arcColor,
              isAttracting,
              strength: Math.min(1, proximity * 1.5 + 0.1),
            });
          }
        }
      }

      // Audio feedback based on magnetic proximity
      if (strongestInfluence > 0.1 && !this.state.isNeutral) {
        sound.playMagnetHum(strongestInfluence, isAttractingActive);
      } else {
        sound.stopMagnetHum();
      }

      // 4. Force Integration & Lateral Velocity
      // Direct input force + Magnet force -> Player lateral acceleration
      const totalAccelX = inputForceX + magnetForceX;
      this.state.playerVx += totalAccelX * simDt;

      // Natural damping (smooth friction decay without resetting velocity)
      this.state.playerVx *= Math.pow(0.91, simDt * 60);

      const maxVx = 1100;
      this.state.playerVx = Math.max(-maxVx, Math.min(maxVx, this.state.playerVx));
      this.state.directInputX = this.directInputX;

      // Update lateral position
      const prevPlayerX = this.state.playerX;
      this.state.playerX += this.state.playerVx * simDt;

      // Track boundaries: smoothly stop at boundary edges without leaving track
      const maxTrackX = this.trackWidth / 2 - this.playerRadius - 10;
      if (this.state.playerX < -maxTrackX) {
        this.state.playerX = -maxTrackX;
        if (this.state.playerVx < 0) {
          this.state.playerVx = 0;
        }
        if (this.directInputX < 0 || magnetForceX < -100) {
          this.spawnRailSparks(-maxTrackX, this.playerZ);
        }
      } else if (this.state.playerX > maxTrackX) {
        this.state.playerX = maxTrackX;
        if (this.state.playerVx > 0) {
          this.state.playerVx = 0;
        }
        if (this.directInputX > 0 || magnetForceX > 100) {
          this.spawnRailSparks(maxTrackX, this.playerZ);
        }
      }
      const currentPlayerX = this.state.playerX;

      // 5. Update Obstacles
      for (const obs of this.obstacles) {
        const prevObsZ = obs.z;
        const prevObsX = obs.x;

        obs.z -= this.state.speed * simDt;

        if (obs.moveSpeed && obs.moveRange && obs.initialX !== undefined) {
          obs.x = obs.initialX + Math.sin(this.state.distance * 0.05 * obs.moveSpeed) * obs.moveRange;
        }

        // 💥 Physical Collision Check (Magnets & Hazards)
        // In standard state, direct contact with ANY magnet (N or S) or hazard triggers immediate GAME OVER
        if (this.state.invulnerableTime <= 0) {
          const isColliding = this.checkObstacleCollision(
            obs,
            prevObsX,
            prevObsZ,
            prevPlayerX,
            currentPlayerX
          );

          if (isColliding) {
            this.handleGameOver(obs);
            break;
          }
        }

        // 2️⃣ 🎯 PERFECT & 3️⃣ 💨 NEAR MISS detection
        // Triggered when obstacle passes player plane (z <= playerZ + 20)
        // Evaluated once per obstacle to avoid duplicated triggers
        if (!obs.closePassEvaluated && obs.z <= this.playerZ + 20) {
          obs.closePassEvaluated = true;
          obs.passed = true;

          // Lateral clearance between player boundary and obstacle boundary
          const distToObstacle = Math.abs(this.state.playerX - obs.x) - (obs.width / 2 + this.playerRadius);

          if (distToObstacle >= 0 && distToObstacle <= 28) {
            // 🎯 PERFECT! (Razor-thin shave)
            this.triggerPerfect(obs);
          } else if (distToObstacle > 28 && distToObstacle <= 72) {
            // 💨 NEAR MISS! (Close brush)
            this.triggerNearMiss(obs);
          }
        }
      }

      // Remove passed obstacles
      this.obstacles = this.obstacles.filter(o => o.z > -120);

      // 6. Spawn new obstacles procedurally
      this.spawnProceduralObstacles();
    }

    // 6. Update Screen Shake & Flash
    if (this.state.screenShake > 0) {
      this.state.screenShake -= dt * 3.5;
      if (this.state.screenShake < 0) this.state.screenShake = 0;
    }
    if (this.state.nearMissFlash > 0) {
      this.state.nearMissFlash -= dt * 2.0;
    }

    // 7. Update Pulse Rings
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const ring = this.pulseRings[i];
      ring.radius += (ring.maxRadius - ring.radius) * dt * 8;
      ring.life -= dt * 2.2;
      if (ring.life <= 0) {
        this.pulseRings.splice(i, 1);
      }
    }

    // 1️⃣ Update Shockwaves (fades within ~0.38s)
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * dt * 9;
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Player Afterimages (ghost trails)
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const ai = this.afterimages[i];
      ai.life -= dt;
      ai.alpha = (ai.life / ai.maxLife) * 0.7;
      if (ai.life <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

    // 4️⃣ 🌌 Update Speed Lines (moving backwards toward player at hyper-speed)
    const lineSpeed = this.state.speed * 2.2;
    for (const line of this.speedLines) {
      line.z -= lineSpeed * line.speedMultiplier * simDt;
      if (line.z < 15) {
        line.z = 1700 + Math.random() * 400;
        const angle = (Math.random() * Math.PI * 1.6) - Math.PI * 0.8;
        const dist = 220 + Math.random() * 260;
        line.x = Math.sin(angle) * dist;
        line.y = Math.max(5, Math.cos(angle) * dist);
        line.length = 80 + Math.random() * 120;
        line.alpha = 0.25 + Math.random() * 0.55;
      }
    }

    // 8. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Spawn player thruster trail (with purple trail in Neutral mode)
    if (!this.state.isPlaying || this.state.isGameOver) {
      // no trail
    } else if (Math.random() < 0.85) {
      let trailColor = this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff';
      if (this.state.isNeutral) {
        trailColor = '#9B59FF';
      }

      this.particles.push({
        x: this.state.playerX + (Math.random() - 0.5) * 12,
        y: 8 + Math.random() * 8,
        z: this.playerZ - 15,
        vx: (Math.random() - 0.5) * 20 - this.state.playerVx * 0.1,
        vy: (Math.random() - 0.3) * 20,
        vz: -this.state.speed * 0.4,
        life: 0.25,
        maxLife: 0.25,
        color: trailColor,
        size: 3.5 + Math.random() * 2.5,
        type: 'trail',
      });
    }

    this.notifyState();
  }

  /**
   * Evaluates physical collision between the player craft and an obstacle (magnet or hazard).
   * Implements:
   * 1. Ground-plane distance & radius check (distance < playerRadius + magnetRadius)
   * 2. Box-to-circle clamped distance check (matches visual 3D bounding geometry)
   * 3. Continuous Collision Detection (CCD) along relative trajectory to prevent high-speed tunneling
   */
  private checkObstacleCollision(
    obs: Obstacle,
    prevObsX: number,
    prevObsZ: number,
    prevPlayerX: number,
    currentPlayerX: number
  ): boolean {
    const playerZ = this.playerZ;
    const playerRadius = this.playerRadius; // 22

    const hw = obs.width / 2;
    const hd = obs.depth / 2;
    const isMagnet = obs.type === 'magnet_n' || obs.type === 'magnet_s';
    const magnetRadius = isMagnet ? obs.width / 2 : Math.min(hw, hd);
    const radialCollisionDist = playerRadius + magnetRadius;

    // Helper: test collision at specific sample points (px, playerZ) and (ox, oz)
    const testPointCollision = (px: number, ox: number, oz: number): boolean => {
      // 1. Radial distance test (Three.js ground plane distance concept: distanceTo < playerRadius + magnetRadius)
      const dx = px - ox;
      const dz = playerZ - oz;
      const centerDistSq = dx * dx + dz * dz;

      if (centerDistSq < radialCollisionDist * radialCollisionDist) {
        return true;
      }

      // 2. Box-to-circle clamped distance test (matches visual cuboid/pillar edges)
      const clampedX = Math.max(ox - hw, Math.min(ox + hw, px));
      const clampedZ = Math.max(oz - hd, Math.min(oz + hd, playerZ));
      const boxDistSq = (px - clampedX) * (px - clampedX) + (playerZ - clampedZ) * (playerZ - clampedZ);

      if (boxDistSq < playerRadius * playerRadius) {
        return true;
      }

      // 3. Axis-Aligned Overlap test
      if (Math.abs(px - ox) < hw + playerRadius && Math.abs(playerZ - oz) < hd + playerRadius) {
        return true;
      }

      return false;
    };

    // 1) Test at current frame end positions
    if (testPointCollision(currentPlayerX, obs.x, obs.z)) {
      return true;
    }

    // 2) Continuous Collision Detection (CCD): Check if obstacle swept past or through player's Z range in this frame
    const zSpan = hd + playerRadius;
    const minZ = Math.min(prevObsZ, obs.z) - zSpan;
    const maxZ = Math.max(prevObsZ, obs.z) + zSpan;

    if (playerZ >= minZ && playerZ <= maxZ) {
      const deltaZ = prevObsZ - obs.z;
      if (Math.abs(deltaZ) > 0.001) {
        // Sample 1: The exact fraction t where obstacle center Z matches player Z
        const tPlane = (prevObsZ - playerZ) / deltaZ;
        const tClamped = Math.max(0, Math.min(1, tPlane));
        const px1 = prevPlayerX + tClamped * (currentPlayerX - prevPlayerX);
        const ox1 = prevObsX + tClamped * (obs.x - prevObsX);
        const oz1 = prevObsZ + tClamped * (obs.z - prevObsZ);

        if (testPointCollision(px1, ox1, oz1)) {
          return true;
        }

        // Sample 2: Mid-step test
        const pxMid = (prevPlayerX + currentPlayerX) * 0.5;
        const oxMid = (prevObsX + obs.x) * 0.5;
        const ozMid = (prevObsZ + obs.z) * 0.5;
        if (testPointCollision(pxMid, oxMid, ozMid)) {
          return true;
        }

        // Sample 3: Closest point in 2D trajectory
        const deltaX = (currentPlayerX - prevPlayerX) - (obs.x - prevObsX);
        const relX0 = prevPlayerX - prevObsX;
        const relZ0 = playerZ - prevObsZ;
        const denom = deltaX * deltaX + deltaZ * deltaZ;
        if (denom > 0.001) {
          const tMin = -(relX0 * deltaX - relZ0 * deltaZ) / denom;
          const tMinClamped = Math.max(0, Math.min(1, tMin));
          const pxMin = prevPlayerX + tMinClamped * (currentPlayerX - prevPlayerX);
          const oxMin = prevObsX + tMinClamped * (obs.x - prevObsX);
          const ozMin = prevObsZ + tMinClamped * (obs.z - prevObsZ);
          if (testPointCollision(pxMin, oxMin, ozMin)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private handleGameOver(obs?: Obstacle) {
    this.state.isGameOver = true;
    this.state.isPlaying = false;
    this.state.lastHitObstacle = obs?.type || null;
    this.state.screenShake = 1.0;
    this.state.perfectCombo = 0;
    this.state.comboTimer = 0;
    this.state.perfectPopup = null;
    this.state.nearMissPopup = null;
    this.slowMoTimer = 0;
    this.slowMoScale = 1.0;
    sound.playCrash();

    let isNewBest = false;
    const safeDistance = Number.isFinite(this.state.distance) && this.state.distance >= 0 ? this.state.distance : 0;
    const diff = this.selectedDifficulty;
    const diffBest = this.state.bestScores[diff] || 0;
    this.state.distance = safeDistance;

    if (safeDistance > diffBest) {
      this.state.bestScores[diff] = safeDistance;
      this.state.bestDistance = safeDistance;
      isNewBest = true;
      saveDifficultyBestScore(diff, safeDistance);
    } else {
      this.state.bestDistance = diffBest;
    }

    const poleColor = this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff';
    for (let i = 0; i < 40; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 150 + Math.random() * 250;

      this.particles.push({
        x: this.state.playerX,
        y: 20,
        z: this.playerZ,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.8 + 60,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        color: Math.random() < 0.7 ? poleColor : '#ffffff',
        size: 3 + Math.random() * 5,
        type: 'shatter',
      });
    }

    this.notifyState();
    if (this.onGameOver) {
      this.onGameOver(this.state.distance, isNewBest, this.selectedDifficulty);
    }
  }

  // 2️⃣ 🎯 PERFECT! (Razor-thin clearance near-miss)
  private triggerPerfect(obs: Obstacle) {
    if (this.state.isGameOver) return;

    // 1. Increment Combo & refresh 3.5s combo window
    this.state.perfectCombo++;
    this.state.comboTimer = 3.5;

    // 2. Slow motion (~0.18s slow-down to 35% speed)
    this.slowMoTimer = 0.18;
    this.slowMoScale = 0.35;

    // 3. Player afterimages (golden adrenaline streak)
    this.spawnAfterimage('#fbbf24', 0.4);
    setTimeout(() => {
      if (!this.state.isGameOver) {
        this.spawnAfterimage('#fbbf24', 0.35);
      }
    }, 45);

    // 4. Subtle screen shake pulse & edge vignette
    this.state.screenShake = Math.max(this.state.screenShake, 0.28);
    this.state.edgeVignetteIntensity = 0.65;

    // 5. Score bonus (scales with combo)
    const comboBonus = 15 + Math.min(50, (this.state.perfectCombo - 1) * 5);
    this.state.distance += comboBonus;

    // 6. Dynamic popup (PERFECT ×combo)
    this.state.perfectPopup = {
      text: this.state.perfectCombo > 1 ? `PERFECT ×${this.state.perfectCombo}` : 'PERFECT!',
      combo: this.state.perfectCombo,
      opacity: 1.0,
      scale: 1.4 + Math.min(0.35, (this.state.perfectCombo - 1) * 0.08),
      id: this.popupIdCounter++,
    };
    this.state.nearMissPopup = null; // Replaces lower-priority NEAR MISS

    // 7. Sparks burst around obstacle
    this.spawnSparkBurst(obs.x, 18, obs.z, '#fbbf24', 16);

    // 8. Chime sound (pitch scales with combo)
    sound.playPerfect(this.state.perfectCombo);
  }

  // 3️⃣ 💨 NEAR MISS! (Close brush outside PERFECT zone)
  private triggerNearMiss(_obs: Obstacle) {
    if (this.state.isGameOver) return;

    // 1. Small score bonus
    this.state.distance += 5;

    // 2. Screen edge light effect & flash
    this.state.edgeVignetteIntensity = Math.max(this.state.edgeVignetteIntensity, 0.38);
    this.state.nearMissFlash = 0.22;

    // 3. Player short afterimage
    const poleColor = this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff';
    this.spawnAfterimage(poleColor, 0.26);

    // 4. Popup notification (only if no higher priority PERFECT is actively visible)
    if (!this.state.perfectPopup) {
      this.state.nearMissPopup = {
        text: 'NEAR MISS!',
        opacity: 1.0,
        id: this.popupIdCounter++,
      };
    }

    // 5. High-speed whoosh sound
    sound.playNearMiss();
  }

  private spawnSparkBurst(x: number, y: number, z: number, color: string, count: number = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 100 + Math.random() * 110;
      this.particles.push({
        x,
        y: y + (Math.random() - 0.5) * 12,
        z,
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.2) * 50,
        vz: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.15,
        maxLife: 0.45,
        color,
        size: 3 + Math.random() * 3,
        type: 'spark',
      });
    }
  }

  private spawnRailSparks(x: number, z: number) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: 10 + Math.random() * 15,
        z: z + (Math.random() - 0.5) * 10,
        vx: (x < 0 ? 1 : -1) * (60 + Math.random() * 80),
        vy: 40 + Math.random() * 60,
        vz: (Math.random() - 0.5) * 60,
        life: 0.25,
        maxLife: 0.25,
        color: '#ffea6c',
        size: 2.5,
        type: 'spark',
      });
    }
  }

  private spawnProceduralObstacles() {
    const spawnHorizon = 2400;
    let maxZ = this.obstacles.length > 0
      ? Math.max(...this.obstacles.map(o => o.z))
      : 0;

    if (maxZ < spawnHorizon) {
      const spacing = this.calculateSliceSpacing();
      const nextZ = Math.max(maxZ + spacing, spawnHorizon);
      this.generateAndValidateSlice(nextZ);
    }
  }

  /**
   * 📏 DYNAMIC SPACING:
   * Scales spacing based on speed & game duration, ensuring generous reaction time early on
   * and tight, exciting pacing in late game without ever becoming impossible.
   */
  private calculateSliceSpacing(): number {
    const cfg = DIFFICULTY_SETTINGS[this.selectedDifficulty];
    const diff = this.state.difficulty;
    const time = this.gameTime;
    let base = 680;

    if (time < 15 && diff < 0.28) {
      // 🟢 Early game: wide, relaxed spacing (650 ~ 720px)
      base = 700 - diff * 200;
    } else if (time < 40 && diff < 0.72) {
      // 🟡 Mid game: balanced rhythm (520 ~ 620px)
      base = 580 - (diff - 0.28) * 160;
    } else {
      // 🔴 Late game: fast-paced (390 ~ 470px)
      base = Math.max(390, 460 - (diff - 0.72) * 140);
    }

    base = base * cfg.spawnSpacingMultiplier;
    const jitter = (this.nextRandom() * 60) - 30;
    return Math.max(290, base + jitter);
  }

  /**
   * 🛡️ SAFE CORRIDOR CLEARANCE:
   * Width of guaranteed escape route. Always exceeds player craft width (44px)
   * by a generous margin so steering is forgiving and fair.
   * NEVER generates impossible paths.
   */
  private calculateSafeRadius(): number {
    const cfg = DIFFICULTY_SETTINGS[this.selectedDifficulty];
    const diff = this.state.difficulty;
    const time = this.gameTime;

    let baseRadius = 48;
    if (time < 15 && diff < 0.28) {
      // 🟢 Early: wide clearance
      baseRadius = 85;
    } else if (time < 40 && diff < 0.72) {
      // 🟡 Mid: standard clearance
      baseRadius = 65;
    } else {
      // 🔴 Late: compact clearance
      baseRadius = 48;
    }

    // Multiply by safeGapMultiplier. Ensure safeRadius is always at least 38 (corridor width 76px vs player 44px)
    return Math.max(38, baseRadius * cfg.safeGapMultiplier);
  }

  /**
   * 🧠 PLAYABILITY VALIDATION ENGINE:
   * Strictly inspects candidate obstacles before adding to world:
   * 1. Safe corridor [safeX - safeRadius, safeX + safeRadius] MUST have zero obstacle intersection.
   * 2. Moving obstacle sweep range MUST NOT intersect the safe corridor.
   * 3. Track width CANNOT be blocked wall-to-wall (must leave >= 62px open passage).
   * 4. Multi-magnet traps prohibited: magnets must be >= 140px apart so player isn't crushed.
   * 5. Lateral reachability verified: player can reach safeX from prevSafeX at current speed.
   */
  private validateSlice(
    candidates: Obstacle[],
    targetSafeX: number,
    safeRadius: number,
    prevSafeX: number
  ): boolean {
    // Check 1: Safe corridor clearance
    for (const obs of candidates) {
      const minClearance = (obs.width / 2) + safeRadius + 8;
      if (Math.abs(obs.x - targetSafeX) < minClearance) {
        return false;
      }

      // If obstacle oscillates, check maximum sweep envelope
      if (obs.moveRange && obs.moveRange > 0 && obs.initialX !== undefined) {
        const minX = obs.initialX - obs.moveRange - obs.width / 2;
        const maxX = obs.initialX + obs.moveRange + obs.width / 2;
        const safeMin = targetSafeX - safeRadius;
        const safeMax = targetSafeX + safeRadius;
        if (maxX > safeMin && minX < safeMax) {
          return false;
        }
      }
    }

    // Check 2: Total track width blockage check (No impossible full-width walls)
    // Find union of all blocked intervals in [-208, 208]
    const blockedIntervals: [number, number][] = [];
    for (const obs of candidates) {
      const halfWidth = obs.width / 2 + this.playerRadius + 6;
      let left = obs.x - halfWidth;
      let right = obs.x + halfWidth;
      if (obs.moveRange && obs.moveRange > 0 && obs.initialX !== undefined) {
        left = Math.min(left, obs.initialX - obs.moveRange - halfWidth);
        right = Math.max(right, obs.initialX + obs.moveRange + halfWidth);
      }
      blockedIntervals.push([Math.max(-208, left), Math.min(208, right)]);
    }

    // Merge overlapping intervals
    blockedIntervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const interval of blockedIntervals) {
      if (merged.length === 0) {
        merged.push([...interval]);
      } else {
        const last = merged[merged.length - 1];
        if (interval[0] <= last[1]) {
          last[1] = Math.max(last[1], interval[1]);
        } else {
          merged.push([...interval]);
        }
      }
    }

    // Calculate free intervals across track bounds [-208, 208]
    const freeGaps: number[] = [];
    let currentX = -208;
    for (const b of merged) {
      if (b[0] > currentX) {
        freeGaps.push(b[0] - currentX);
      }
      currentX = Math.max(currentX, b[1]);
    }
    if (currentX < 208) {
      freeGaps.push(208 - currentX);
    }

    // Must have at least one free corridor with comfortable clearance
    const minRequiredGap = this.playerRadius * 2 + 16; // 60px
    const maxFreeGap = freeGaps.length > 0 ? Math.max(...freeGaps) : 0;
    if (maxFreeGap < minRequiredGap) {
      return false; // Screen is blocked wall-to-wall! REJECT!
    }

    // Check 3: Inescapable magnetic trap check
    const magnets = candidates.filter(o => o.type === 'magnet_n' || o.type === 'magnet_s');
    if (magnets.length >= 2) {
      for (let i = 0; i < magnets.length; i++) {
        for (let j = i + 1; j < magnets.length; j++) {
          const dist = Math.abs(magnets[i].x - magnets[j].x);
          if (dist < 140) {
            return false; // Magnets too close together, creates crushing force trap!
          }
        }
      }
      const leftMag = magnets.find(m => m.x < targetSafeX);
      const rightMag = magnets.find(m => m.x > targetSafeX);
      if (leftMag && rightMag) {
        const pinchGap = rightMag.x - leftMag.x;
        if (pinchGap < safeRadius * 2 + 25) {
          return false;
        }
      }
    }

    // Check 4: Lateral reachability
    if (Math.abs(targetSafeX - prevSafeX) > 165) {
      return false; // Requires impossible lateral jump
    }

    return true;
  }

  /**
   * 🎲 DIVERSE PROCEDURAL ARCHETYPES:
   * Handcrafted procedural building blocks with dynamic randomization
   */
  private generateCandidateArchetype(
    patternType: number,
    targetZ: number,
    targetSafeX: number,
    safeRadius: number,
    difficultyLevel: number
  ): Obstacle[] {
    const list: Obstacle[] = [];
    const rndPole = (): 'magnet_n' | 'magnet_s' => this.nextRandom() < 0.5 ? 'magnet_n' : 'magnet_s';

    switch (patternType) {
      case 0: {
        // 🎯 Pattern 0: Single Flank Magnet (Left or Right)
        // Magnet on rail opposite to safe corridor
        const magnetX = targetSafeX >= 0
          ? this.randomRange(-185, -145)
          : this.randomRange(145, 185);
        list.push({
          id: 0,
          x: magnetX,
          y: 0,
          z: targetZ,
          width: 58,
          height: 70,
          depth: 58,
          type: rndPole(),
          passed: false,
        });
        break;
      }

      case 1: {
        // 🚪 Pattern 1: Wide Dual Pylon Gate
        // Left & Right magnets with wide safe path running through the center
        const leftX = this.randomRange(-190, -155);
        const rightX = this.randomRange(155, 190);
        const pole1 = rndPole();
        const pole2 = difficultyLevel === 1 ? pole1 : rndPole(); // Same pole in early game gives gentle center pushing
        list.push({
          id: 0,
          x: leftX,
          y: 0,
          z: targetZ,
          width: 58,
          height: 70,
          depth: 58,
          type: pole1,
          passed: false,
        });
        list.push({
          id: 0,
          x: rightX,
          y: 0,
          z: targetZ,
          width: 58,
          height: 70,
          depth: 58,
          type: pole2,
          passed: false,
        });
        break;
      }

      case 2: {
        // 🏛️ Pattern 2: Center Barrier with Dual Open Side Wings
        // Central block at x ≈ 0, both left and right lanes wide open
        const hazardWidth = difficultyLevel === 1 ? 100 : 120;
        list.push({
          id: 0,
          x: 0,
          y: 0,
          z: targetZ,
          width: hazardWidth,
          height: 75,
          depth: 50,
          type: 'hazard',
          passed: false,
        });
        // Optional guide magnet on the outer flank
        if (difficultyLevel > 1 && this.nextRandom() < 0.6) {
          const sideX = targetSafeX > 0 ? 180 : -180;
          list.push({
            id: 0,
            x: sideX,
            y: 0,
            z: targetZ - 70,
            width: 58,
            height: 70,
            depth: 58,
            type: rndPole(),
            passed: false,
          });
        }
        break;
      }

      case 3: {
        // 〰️ Pattern 3: Staggered Slalom Magnets
        // One magnet on left at targetZ, another on right at targetZ + 240px
        const side = targetSafeX > 0 ? -1 : 1;
        list.push({
          id: 0,
          x: side * this.randomRange(150, 180),
          y: 0,
          z: targetZ,
          width: 58,
          height: 70,
          depth: 58,
          type: rndPole(),
          passed: false,
        });
        list.push({
          id: 0,
          x: -side * this.randomRange(150, 180),
          y: 0,
          z: targetZ + 240,
          width: 58,
          height: 70,
          depth: 58,
          type: rndPole(),
          passed: false,
        });
        break;
      }

      case 4: {
        // 🧱 Pattern 4: Offset Hazard Barrier + Guide Magnet
        // Hazard block placed safely away from safe corridor
        const hazardX = targetSafeX >= 0
          ? this.randomRange(-140, -110)
          : this.randomRange(110, 140);
        list.push({
          id: 0,
          x: hazardX,
          y: 0,
          z: targetZ,
          width: 110,
          height: 75,
          depth: 50,
          type: 'hazard',
          passed: false,
        });
        // Flank guide magnet at rail
        if (this.nextRandom() < 0.7) {
          const magnetX = targetSafeX >= 0 ? 180 : -180;
          list.push({
            id: 0,
            x: magnetX,
            y: 0,
            z: targetZ - 60,
            width: 58,
            height: 70,
            depth: 58,
            type: rndPole(),
            passed: false,
          });
        }
        break;
      }

      case 5: {
        // ⚡ Pattern 5: Staggered Dual Hazard Chicane (Mid/Late Game)
        // Smooth S-curve passage between two staggered hazard gates
        const isLeftFirst = targetSafeX > 0;
        list.push({
          id: 0,
          x: isLeftFirst ? -130 : 130,
          y: 0,
          z: targetZ,
          width: 110,
          height: 75,
          depth: 50,
          type: 'hazard',
          passed: false,
        });
        list.push({
          id: 0,
          x: isLeftFirst ? 130 : -130,
          y: 0,
          z: targetZ + 230,
          width: 110,
          height: 75,
          depth: 50,
          type: 'hazard',
          passed: false,
        });
        break;
      }

      case 6: {
        // 🛸 Pattern 6: Moving Patrol Magnet (Late Game)
        // Oscillates within a strictly bounded half of track, NEVER crossing safe corridor
        const patrolSide = targetSafeX > 0 ? -1 : 1;
        const initialX = patrolSide * 140;
        const moveRange = 38; // Only patrols between ±(102~178), keeping safe side 100% open
        list.push({
          id: 0,
          x: initialX,
          y: 0,
          z: targetZ,
          width: 60,
          height: 75,
          depth: 60,
          type: rndPole(),
          passed: false,
          moveSpeed: 1.5 + this.state.difficulty * 0.7,
          moveRange,
          initialX,
        });
        break;
      }

      default: {
        // 🌌 Pattern 7: Magnetic Precision Slalom (Late Game)
        // Alternating staggered magnets with guaranteed center/wing corridor
        const sideA = targetSafeX >= 0 ? -165 : 165;
        const sideB = targetSafeX >= 0 ? 165 : -165;
        list.push({
          id: 0,
          x: sideA,
          y: 0,
          z: targetZ,
          width: 58,
          height: 70,
          depth: 58,
          type: rndPole(),
          passed: false,
        });
        list.push({
          id: 0,
          x: sideB,
          y: 0,
          z: targetZ + 190,
          width: 58,
          height: 70,
          depth: 58,
          type: rndPole(),
          passed: false,
        });
        break;
      }
    }

    return list;
  }

  /**
   * 🛡️ SAFE PATH WAYPOINT GENERATOR & SLICE EMITTER:
   * Generates obstacle slices using the safe-path-first rule, validated for 100% playability.
   */
  private generateAndValidateSlice(targetZ: number) {
    const diff = this.state.difficulty;
    const time = this.gameTime;
    const diffSetting = this.selectedDifficulty;

    let difficultyTier = 1;
    if (diffSetting === 'easy') {
      difficultyTier = diff > 0.65 ? 2 : 1;
    } else if (diffSetting === 'normal') {
      difficultyTier = (time < 15 && diff < 0.28) ? 1 : (time < 40 && diff < 0.72) ? 2 : 3;
    } else if (diffSetting === 'hard') {
      difficultyTier = (time < 8 && diff < 0.2) ? 2 : 3;
    } else if (diffSetting === 'hell') {
      difficultyTier = 3;
    }

    // 1. Calculate safe waypoint for this slice
    const dt = Math.max(0.4, (targetZ - this.playerZ) / Math.max(300, this.state.speed));
    const maxShift = Math.min(150, Math.max(45, dt * 260));

    let nextSafeX = this.safePathX + (this.nextRandom() * 2 - 1) * maxShift;
    nextSafeX = Math.max(-145, Math.min(145, nextSafeX));

    // Edge bounce: gently guide safe path toward center if drifting near rails
    if (Math.abs(nextSafeX) > 120) {
      nextSafeX = this.safePathX - Math.sign(this.safePathX) * (maxShift * 0.45);
    }

    const safeRadius = this.calculateSafeRadius();

    // Archetype selection pool based on difficulty tier and setting
    let archetypePool = [0, 1, 2, 3];
    if (difficultyTier === 2) {
      archetypePool = [0, 1, 2, 3, 4, 5];
    } else if (difficultyTier === 3) {
      archetypePool = diffSetting === 'easy' ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7];
    }

    // Try up to 5 attempts to generate and validate a fair candidate pattern
    let accepted = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const pType = archetypePool[Math.floor(this.nextRandom() * archetypePool.length)];
      const candidates = this.generateCandidateArchetype(pType, targetZ, nextSafeX, safeRadius, difficultyTier);

      if (this.validateSlice(candidates, nextSafeX, safeRadius, this.safePathX)) {
        // Assign unique obstacle IDs and register
        for (const obs of candidates) {
          obs.id = this.nextObstacleId++;
          this.obstacles.push(obs);
        }
        this.safePathX = nextSafeX;
        accepted = true;
        break;
      }
    }

    // 100% Fail-safe backup: If all attempts failed (rare), emit a guaranteed safe single flank magnet
    if (!accepted) {
      const safeFlankX = nextSafeX >= 0 ? -175 : 175;
      this.obstacles.push({
        id: this.nextObstacleId++,
        x: safeFlankX,
        y: 0,
        z: targetZ,
        width: 58,
        height: 70,
        depth: 58,
        type: this.nextRandom() < 0.5 ? 'magnet_n' : 'magnet_s',
        passed: false,
      });
      this.safePathX = nextSafeX;
    }
  }

  private notifyState() {
    if (this.onStateUpdate) {
      this.onStateUpdate({ ...this.state });
    }
  }

  // 3D Perspective Projection Utility
  public project(x: number, y: number, z: number): { x: number; y: number; scale: number; visible: boolean } {
    if (z <= 1) {
      return { x: 0, y: 0, scale: 0, visible: false };
    }

    const scale = this.fov / z;
    const centerX = this.viewWidth / 2;
    const horizonY = this.viewHeight * 0.44;

    const screenX = centerX + x * scale;
    const screenY = horizonY + (this.cameraY - y) * scale;

    return {
      x: screenX,
      y: screenY,
      scale,
      visible: z > 5 && screenY < this.viewHeight + 200 && screenY > -100,
    };
  }

  // -------------------------------------------------------------
  // RENDERING PIPELINE
  // -------------------------------------------------------------
  public render() {
    const { ctx } = this;
    const width = this.viewWidth;
    const height = this.viewHeight;

    ctx.save();
    if (this.state.screenShake > 0) {
      const shakeAmt = this.state.screenShake * 16;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Background sky & futuristic cyber grid horizon
    this.renderBackground(width, height);

    // 2. 3D Track surface & glowing rails
    this.renderTrack(width, height);

    // 3. Draw Z-sorted Objects (includes obstacles, magnetic arcs, shockwaves, afterimages, player)
    this.renderSceneObjects();

    // 4. 🌌 Speed Lines (Radial hyper-speed streaks outside track center)
    this.renderSpeedLines();

    // 5. 🎯 PERFECT / 💨 NEAR MISS & Screen sensation overlays
    this.renderSensoryOverlays(width, height);

    ctx.restore();
  }

  private renderBackground(width: number, height: number) {
    const { ctx } = this;
    const horizonY = height * 0.44;

    // Dark space gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#04060c');
    skyGrad.addColorStop(0.7, '#080b14');
    skyGrad.addColorStop(1, '#111728');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY);

    // Distant cyber horizon glow
    const horizonGlow = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 10);
    horizonGlow.addColorStop(0, 'rgba(54, 169, 255, 0)');
    horizonGlow.addColorStop(0.8, 'rgba(255, 59, 92, 0.15)');
    horizonGlow.addColorStop(1, 'rgba(54, 169, 255, 0.25)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, horizonY - 40, width, 50);

    // Distant neon sun / magnetic core at horizon center
    const sunGrad = ctx.createRadialGradient(width / 2, horizonY, 5, width / 2, horizonY, 80);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    sunGrad.addColorStop(0.3, 'rgba(255, 59, 92, 0.4)');
    sunGrad.addColorStop(0.7, 'rgba(54, 169, 255, 0.2)');
    sunGrad.addColorStop(1, 'rgba(8, 11, 20, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width / 2, horizonY, 80, 0, Math.PI * 2);
    ctx.fill();

    // Horizon line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();
  }

  private renderTrack(width: number, height: number) {
    const { ctx } = this;
    const horizonY = height * 0.44;

    // Track Ground Background
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGrad.addColorStop(0, '#090d18');
    groundGrad.addColorStop(0.5, '#070a13');
    groundGrad.addColorStop(1, '#05070e');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    const maxZ = 2200;
    const minZ = 40;
    const halfTrack = this.trackWidth / 2;

    // Track Surface polygon
    const pFarLeft = this.project(-halfTrack, 0, maxZ);
    const pFarRight = this.project(halfTrack, 0, maxZ);
    const pNearLeft = this.project(-halfTrack, 0, minZ);
    const pNearRight = this.project(halfTrack, 0, minZ);

    if (pFarLeft.visible && pNearLeft.visible) {
      const trackGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      trackGrad.addColorStop(0, '#0d1322');
      trackGrad.addColorStop(0.6, '#10172a');
      trackGrad.addColorStop(1, '#131d35');

      ctx.fillStyle = trackGrad;
      ctx.beginPath();
      ctx.moveTo(pFarLeft.x, pFarLeft.y);
      ctx.lineTo(pFarRight.x, pFarRight.y);
      ctx.lineTo(pNearRight.x, pNearRight.y);
      ctx.lineTo(pNearLeft.x, pNearLeft.y);
      ctx.closePath();
      ctx.fill();

      // Left Rail
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#36a9ff';
      ctx.strokeStyle = '#36a9ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pFarLeft.x, pFarLeft.y);
      ctx.lineTo(pNearLeft.x, pNearLeft.y);
      ctx.stroke();

      // Right Rail
      ctx.shadowColor = '#ff3b5c';
      ctx.strokeStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.moveTo(pFarRight.x, pFarRight.y);
      ctx.lineTo(pNearRight.x, pNearRight.y);
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    // Moving horizontal grid lines
    const gridSpacing = 120;
    const offset = this.trackScroll % gridSpacing;

    ctx.lineWidth = 1.2;
    for (let z = minZ + (gridSpacing - offset); z < maxZ; z += gridSpacing) {
      const pL = this.project(-halfTrack, 0, z);
      const pR = this.project(halfTrack, 0, z);

      if (pL.visible && pR.visible) {
        const alpha = Math.max(0, 1 - (z / maxZ));
        ctx.strokeStyle = `rgba(100, 160, 255, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
      }
    }

    // Longitudinal lane markers
    const lanesX = [-halfTrack * 0.5, 0, halfTrack * 0.5];
    for (const lx of lanesX) {
      const isCenter = lx === 0;
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.strokeStyle = isCenter ? 'rgba(255, 255, 255, 0.25)' : 'rgba(70, 120, 200, 0.18)';

      const pFar = this.project(lx, 0, maxZ);
      const pNear = this.project(lx, 0, minZ);

      if (pFar.visible && pNear.visible) {
        ctx.beginPath();
        ctx.moveTo(pFar.x, pFar.y);
        ctx.lineTo(pNear.x, pNear.y);
        ctx.stroke();
      }
    }
  }

  private renderSceneObjects() {
    interface Renderable {
      z: number;
      draw: () => void;
    }

    const drawList: Renderable[] = [];

    // 1. Magnetic Arcs
    for (const arc of this.activeArcs) {
      const avgZ = (arc.sourceZ + arc.targetZ) / 2;
      drawList.push({
        z: avgZ,
        draw: () => this.drawMagneticArc(arc),
      });
    }

    // 2. Pulse Rings
    for (const ring of this.pulseRings) {
      drawList.push({
        z: ring.z,
        draw: () => this.drawPulseRing(ring),
      });
    }

    // 2b. ⚡ Shockwaves (expanding ground/space energy rings)
    for (const sw of this.shockwaves) {
      drawList.push({
        z: sw.z,
        draw: () => this.drawShockwave(sw),
      });
    }

    // 2c. Player Afterimages (ghost trails)
    for (const ai of this.afterimages) {
      drawList.push({
        z: ai.z,
        draw: () => this.drawAfterimage(ai),
      });
    }

    // 3. Obstacles
    for (const obs of this.obstacles) {
      drawList.push({
        z: obs.z,
        draw: () => this.drawObstacle(obs),
      });
    }

    // 4. Particles
    for (const p of this.particles) {
      drawList.push({
        z: p.z,
        draw: () => this.drawParticle(p),
      });
    }

    // 5. Player
    if (!this.state.isGameOver) {
      drawList.push({
        z: this.playerZ,
        draw: () => this.drawPlayer(),
      });
    }

    // Sort far to near
    drawList.sort((a, b) => b.z - a.z);

    for (const item of drawList) {
      item.draw();
    }
  }

  private drawMagneticArc(arc: MagneticArc) {
    const { ctx } = this;
    const p1 = this.project(arc.sourceX, arc.sourceY, arc.sourceZ);
    const p2 = this.project(arc.targetX, arc.targetY, arc.targetZ);

    if (!p1.visible && !p2.visible) return;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = arc.color;

    const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 10;
    const midY = (p1.y + p2.y) / 2 - 20 + (Math.random() - 0.5) * 8;

    ctx.strokeStyle = arc.color;
    ctx.lineWidth = Math.max(1.5, 4 * p1.scale);
    ctx.globalAlpha = Math.min(0.9, 0.3 + arc.strength * 0.7);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 1.5 * p1.scale);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
    ctx.stroke();

    ctx.restore();
  }

  private drawPulseRing(ring: { x: number; y: number; z: number; radius: number; color: string; life: number }) {
    const { ctx } = this;
    const proj = this.project(ring.x, 0, ring.z);
    if (!proj.visible) return;

    const rX = ring.radius * proj.scale;
    const rY = ring.radius * proj.scale * 0.35;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, rX, rY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = Math.max(1.5, 5 * ring.life * proj.scale);
    ctx.shadowBlur = 16;
    ctx.shadowColor = ring.color;
    ctx.globalAlpha = Math.max(0, ring.life);
    ctx.stroke();
    ctx.restore();
  }

  private drawObstacle(obs: Obstacle) {
    const { ctx } = this;
    const hw = obs.width / 2;
    const hd = obs.depth / 2;
    const h = obs.height;

    const p0 = this.project(obs.x - hw, obs.y || 0, obs.z - hd);
    const p1 = this.project(obs.x + hw, obs.y || 0, obs.z - hd);
    const p2 = this.project(obs.x + hw, obs.y || 0, obs.z + hd);
    const p3 = this.project(obs.x - hw, obs.y || 0, obs.z + hd);

    const p4 = this.project(obs.x - hw, (obs.y || 0) + h, obs.z - hd);
    const p5 = this.project(obs.x + hw, (obs.y || 0) + h, obs.z - hd);
    const p6 = this.project(obs.x + hw, (obs.y || 0) + h, obs.z + hd);
    const p7 = this.project(obs.x - hw, (obs.y || 0) + h, obs.z + hd);

    if (!p0.visible && !p2.visible) return;

    ctx.save();

    const isMagnetN = obs.type === 'magnet_n';
    const isMagnetS = obs.type === 'magnet_s';
    const isHazard = obs.type === 'hazard';

    const mainColor = isMagnetN ? '#ff3b5c' : isMagnetS ? '#36a9ff' : '#f59e0b';
    const darkFace = isHazard ? '#151922' : isMagnetN ? '#3b0a14' : '#082542';
    const midFace = isHazard ? '#232938' : isMagnetN ? '#6b1122' : '#0e4170';
    const brightFace = isHazard ? '#323b4e' : isMagnetN ? '#a81c38' : '#1462a6';

    // Left / Right Face
    if (obs.x < this.state.playerX) {
      ctx.fillStyle = midFace;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p6.x, p6.y);
      ctx.lineTo(p5.x, p5.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = midFace;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p7.x, p7.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Top Face
    ctx.fillStyle = brightFace;
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.lineTo(p7.x, p7.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Front Face
    ctx.fillStyle = darkFace;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 10;
    ctx.shadowColor = mainColor;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(1.5, 3 * p0.scale);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const frontCenterX = (p0.x + p1.x + p5.x + p4.x) / 4;
    const frontCenterY = (p0.y + p1.y + p5.y + p4.y) / 4;
    const glyphSize = Math.max(8, 26 * p0.scale);

    if (isHazard) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p5.x, p5.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(2, 5 * p0.scale);
      const span = p1.x - p0.x;
      for (let sx = -span; sx < span * 2; sx += 18 * p0.scale) {
        ctx.beginPath();
        ctx.moveTo(p0.x + sx, p0.y);
        ctx.lineTo(p0.x + sx + 26 * p0.scale, p4.y);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${glyphSize}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#f59e0b';
      ctx.fillText('⚠', frontCenterX, frontCenterY);
      ctx.restore();
    } else {
      const poleLetter = isMagnetN ? 'N' : 'S';

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${glyphSize * 1.1}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 14;
      ctx.shadowColor = mainColor;
      ctx.fillText(poleLetter, frontCenterX, frontCenterY);

      const time = performance.now() / 320;
      const ringScale = (time % 1);
      const ringRadius = (28 + ringScale * 36) * p0.scale;
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = Math.max(1, 2 * p0.scale);
      ctx.globalAlpha = Math.max(0, 1 - ringScale) * 0.6;
      ctx.beginPath();
      ctx.ellipse(frontCenterX, p0.y, ringRadius * 1.4, ringRadius * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPlayer() {
    const { ctx } = this;
    const proj = this.project(this.state.playerX, 16, this.playerZ);
    if (!proj.visible) return;

    ctx.save();
    ctx.translate(proj.x, proj.y);

    const rollAngle = Math.max(-0.28, Math.min(0.28, -this.state.playerVx * 0.00045));
    ctx.rotate(rollAngle);

    const isNeutral = this.state.isNeutral;
    let poleColor = this.state.playerPole === 'N' ? '#ff3b5c' : '#36a9ff';
    let coreGlow = this.state.playerPole === 'N' ? 'rgba(255, 59, 92, 0.8)' : 'rgba(54, 169, 255, 0.8)';
    let displayLetter: string = this.state.playerPole;

    if (isNeutral) {
      poleColor = '#9B59FF';
      coreGlow = 'rgba(155, 89, 255, 0.9)';
      displayLetter = '0';
    }

    const scale = proj.scale;

    // Ground shadow
    const shadowProj = this.project(this.state.playerX, 0, this.playerZ);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.scale(dpr, dpr);
    ctx.beginPath();
    ctx.ellipse(shadowProj.x, shadowProj.y, 30 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();
    ctx.restore();

    // 🟣 Neutral Aura Sphere (Surrounding translucent purple glow)
    if (isNeutral) {
      const auraRad = (38 + Math.sin(performance.now() * 0.01) * 4) * scale;
      const auraGrad = ctx.createRadialGradient(0, 0, 10 * scale, 0, 0, auraRad);
      auraGrad.addColorStop(0, 'rgba(192, 132, 252, 0.25)');
      auraGrad.addColorStop(0.7, 'rgba(155, 89, 255, 0.5)');
      auraGrad.addColorStop(1, 'rgba(155, 89, 255, 0)');

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, auraRad, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#C084FF';
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([6 * scale, 4 * scale]);
      ctx.beginPath();
      ctx.arc(0, 0, auraRad * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Outer Capsule Body
    const craftW = 36 * scale;
    const craftH = 20 * scale;

    ctx.shadowBlur = 16;
    ctx.shadowColor = poleColor;

    const bodyGrad = ctx.createLinearGradient(0, -craftH, 0, craftH);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, poleColor);
    bodyGrad.addColorStop(0.8, '#0b101c');
    bodyGrad.addColorStop(1, '#05070d');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, craftW, craftH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = poleColor;
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.stroke();

    // Central Core
    const coreGrad = ctx.createRadialGradient(0, 0, 2 * scale, 0, 0, 12 * scale);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, poleColor);
    coreGrad.addColorStop(1, coreGlow);

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Core Pole Letter
    ctx.fillStyle = '#080b14';
    ctx.font = `900 ${Math.max(10, 13 * scale)}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLetter, 0, 0.5);

    // Side Stabilizer Fins
    ctx.fillStyle = poleColor;
    ctx.beginPath();
    ctx.ellipse(-craftW * 0.9, craftH * 0.2, 4.5 * scale, 9 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(craftW * 0.9, craftH * 0.2, 4.5 * scale, 9 * scale, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawParticle(p: Particle) {
    const { ctx } = this;
    const proj = this.project(p.x, p.y, p.z);
    if (!proj.visible) return;

    ctx.save();
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;

    const size = Math.max(1, p.size * proj.scale);

    if (p.type === 'spark' || p.type === 'shatter') {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'electric') {
      // ⚡ Snappy electric diamond spark
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y - size * 1.5);
      ctx.lineTo(proj.x + size * 0.9, proj.y);
      ctx.lineTo(proj.x, proj.y + size * 1.5);
      ctx.lineTo(proj.x - size * 0.9, proj.y);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'trail') {
      ctx.beginPath();
      ctx.ellipse(proj.x, proj.y, size * 1.4, size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 1️⃣ ⚡ Polar Switch Shockwave Rendering
  private drawShockwave(sw: Shockwave) {
    const { ctx } = this;
    const proj = this.project(sw.x, sw.y, sw.z);
    if (!proj.visible) return;

    const progress = 1 - (sw.life / sw.maxLife);
    const alpha = Math.max(0, sw.life / sw.maxLife);
    const r = sw.radius * proj.scale;

    ctx.save();
    // Expanding glowing energy shock ring (elliptical perspective)
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = Math.max(2, (8 - progress * 5) * proj.scale);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 18;
    ctx.shadowColor = sw.color;

    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, r * 1.5, r * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright white energy ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2.5 * proj.scale);
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Player Afterimage Ghost Silhouette
  private drawAfterimage(ai: Afterimage) {
    const { ctx } = this;
    const proj = this.project(ai.x, 15, ai.z);
    if (!proj.visible) return;

    const scale = proj.scale;
    const craftW = 34 * scale;
    const craftH = 22 * scale;

    const roll = (ai.vx / 1100) * 0.35;
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(roll * 0.75);
    ctx.globalAlpha = Math.max(0, ai.alpha);
    ctx.fillStyle = ai.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = ai.color;

    // Ghost craft silhouette
    ctx.beginPath();
    ctx.moveTo(0, -craftH * 1.3);
    ctx.lineTo(craftW, craftH);
    ctx.lineTo(craftW * 0.35, craftH * 0.65);
    ctx.lineTo(-craftW * 0.35, craftH * 0.65);
    ctx.lineTo(-craftW, craftH);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 4️⃣ 🌌 Speed Lines (Radial/Perspective speed streaks)
  private renderSpeedLines() {
    const { ctx } = this;
    const speedRatio = Math.min(1.0, Math.max(0, (this.state.speed - 280) / 460));
    // Line density scales with speed (starts gentle, becomes intense)
    const activeCount = Math.floor(22 + speedRatio * 28);
    const centerX = this.viewWidth / 2;
    const centerY = this.viewHeight * 0.44;

    ctx.save();
    for (let i = 0; i < activeCount && i < this.speedLines.length; i++) {
      const line = this.speedLines[i];
      const p1 = this.project(line.x, line.y, line.z);
      const p2 = this.project(line.x, line.y, line.z + line.length * (1 + speedRatio * 0.9));

      if (!p1.visible && !p2.visible) continue;

      // Keep center region clear so player craft & center track are always visible
      const distFromCenter = Math.hypot(p1.x - centerX, p1.y - centerY);
      if (distFromCenter < 75) continue;

      const lineAlpha = line.alpha * (0.2 + speedRatio * 0.65);
      const isHighSpeed = speedRatio > 0.6;

      ctx.strokeStyle = isHighSpeed
        ? `rgba(224, 242, 254, ${lineAlpha})`
        : `rgba(125, 211, 252, ${lineAlpha * 0.7})`;
      ctx.lineWidth = Math.max(0.8, (1 + speedRatio * 1.4) * p1.scale);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Sensation Overlay: Flashes, Edge Vignette, and PERFECT / NEAR MISS popups
  private renderSensoryOverlays(width: number, height: number) {
    const { ctx } = this;

    // 1. Shockwave Polarity Flash
    if (this.state.shockwaveFlash > 0) {
      const shockColor = this.state.playerPole === 'N' ? 'rgba(255, 59, 92,' : 'rgba(54, 169, 255,';
      ctx.fillStyle = `${shockColor} ${this.state.shockwaveFlash * 0.22})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Near-miss Impact Flash
    if (this.state.nearMissFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.nearMissFlash * 0.28})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Screen Edge Light / Vignette Effect (PERFECT golden or NEAR MISS cyan/violet)
    if (this.state.edgeVignetteIntensity > 0) {
      const edgeGrad = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.35,
        width / 2, height / 2, Math.max(width, height) * 0.72
      );
      const intensity = this.state.edgeVignetteIntensity;
      const isPerfect = !!this.state.perfectPopup;
      const ringColor = isPerfect ? '251, 191, 36' : '155, 89, 255';
      edgeGrad.addColorStop(0, `rgba(${ringColor}, 0)`);
      edgeGrad.addColorStop(0.7, `rgba(${ringColor}, ${intensity * 0.15})`);
      edgeGrad.addColorStop(1, `rgba(${ringColor}, ${intensity * 0.42})`);

      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 4. 🎯 PERFECT! Popup & Combo Counter
    if (this.state.perfectPopup && this.state.perfectPopup.opacity > 0.01) {
      const pop = this.state.perfectPopup;
      const comboBonusScale = Math.min(1.35, 1.0 + (pop.combo - 1) * 0.07);
      const baseFontSize = Math.floor(26 * pop.scale * comboBonusScale);
      const yPos = height * 0.35;

      ctx.save();
      ctx.translate(width / 2, yPos);
      ctx.scale(pop.scale, pop.scale);
      ctx.globalAlpha = Math.min(1.0, pop.opacity);

      // Golden intense bloom
      ctx.shadowBlur = 18 + Math.min(22, pop.combo * 3);
      ctx.shadowColor = '#fbbf24';

      ctx.font = `900 ${baseFontSize}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outer outline
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.strokeText(`🎯 ${pop.text}`, 0, 0);

      // Metallic golden gradient
      const textGrad = ctx.createLinearGradient(0, -baseFontSize / 2, 0, baseFontSize / 2);
      textGrad.addColorStop(0, '#ffffff');
      textGrad.addColorStop(0.4, '#fde68a');
      textGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = textGrad;
      ctx.fillText(`🎯 ${pop.text}`, 0, 0);

      // Combo sub-label if combo >= 2
      if (pop.combo >= 2) {
        ctx.font = `800 13px Orbitron, sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f59e0b';
        ctx.fillText(`COMBO BOOST! +${15 + (pop.combo - 1) * 5}M`, 0, baseFontSize * 0.68);
      }

      ctx.restore();
    } else if (this.state.nearMissPopup && this.state.nearMissPopup.opacity > 0.01) {
      // 5. 💨 NEAR MISS! Popup (Crisp cyan/ice with subtle glow)
      const pop = this.state.nearMissPopup;
      const fontSize = 21;
      const yPos = height * 0.38;

      ctx.save();
      ctx.translate(width / 2, yPos);
      ctx.globalAlpha = Math.min(1.0, pop.opacity);

      ctx.shadowBlur = 14;
      ctx.shadowColor = '#38bdf8';

      ctx.font = `800 ${fontSize}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 3.5;
      ctx.strokeText(`💨 ${pop.text}`, 0, 0);

      ctx.fillStyle = '#f0f9ff';
      ctx.fillText(`💨 ${pop.text}`, 0, 0);

      ctx.restore();
    }
  }
}
