import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../gameEngine';
import { GameState } from '../types';
import { sound } from '../audio';
import { DifficultyLevel, DIFFICULTY_SETTINGS } from '../difficulty';
import { DifficultySelectModal } from './DifficultySelectModal';
import { Volume2, VolumeX, RotateCcw, Zap, Sparkles, HelpCircle, Trophy, ChevronLeft, ChevronRight, CircleDot, Gamepad2 } from 'lucide-react';

export const MagnetRushGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const touchStateRef = useRef<{
    active: boolean;
    startX: number;
    currentX: number;
    isCenterTap: boolean;
  }>({
    active: false,
    startX: 0,
    currentX: 0,
    isCenterTap: false,
  });

  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('normal');
  const [showDifficultySelect, setShowDifficultySelect] = useState<boolean>(true);

  const [gameState, setGameState] = useState<GameState>({
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
    perfectCombo: 0,
    comboTimer: 0,
    perfectPopup: null,
    nearMissPopup: null,
    edgeVignetteIntensity: 0,
    shockwaveFlash: 0,
    lastHitObstacle: null,
  });

  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [activeTouchDir, setActiveTouchDir] = useState<'left' | 'right' | null>(null);

  // Update engine direct input based on active keyboard keys
  const updateKeyboardInput = useCallback(() => {
    if (!engineRef.current) return;
    const keys = activeKeysRef.current;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = keys.has('KeyD') || keys.has('ArrowRight') || keys.has('d') || keys.has('D');

    let inputX = 0;
    if (left && !right) inputX = -1;
    else if (right && !left) inputX = 1;

    engineRef.current.setDirectInput(inputX);
    if (inputX !== 0 && !gameStarted) {
      setGameStarted(true);
    }
  }, [gameStarted]);

  // Initialize game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    const resizeCanvas = () => {
      if (!canvas || !engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      engineRef.current.resize(rect.width, rect.height, dpr);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    engine.onStateUpdate = (updatedState: GameState) => {
      setGameState(updatedState);
      if (updatedState.selectedDifficulty) {
        setSelectedDifficulty(updatedState.selectedDifficulty);
      }
    };

    engine.onGameOver = (_finalDistance: number, isBest: boolean, diff: DifficultyLevel) => {
      setIsNewRecord(isBest);
      setSelectedDifficulty(diff);
      activeKeysRef.current.clear();
      setActiveTouchDir(null);
    };

    engine.init(false);
    engine.start();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      engine.stop();
    };
  }, []);

  // Polarity switch handler
  const handleSwitchPole = useCallback(() => {
    if (!engineRef.current) return;
    if (gameState.isGameOver || showDifficultySelect) return;

    if (!gameStarted) {
      setGameStarted(true);
    }
    engineRef.current.switchPole();
  }, [gameState.isGameOver, showDifficultySelect, gameStarted]);

  // Neutral mode activation handler (SPACE)
  const handleActivateNeutral = useCallback(() => {
    if (!engineRef.current) return;
    if (gameState.isGameOver || showDifficultySelect) return;

    if (!gameStarted) {
      setGameStarted(true);
    }
    engineRef.current.activateNeutral();
  }, [gameState.isGameOver, showDifficultySelect, gameStarted]);

  // Difficulty selection handlers
  const handleSelectDifficulty = useCallback((diff: DifficultyLevel) => {
    setSelectedDifficulty(diff);
    sound.playSelect();
    if (engineRef.current) {
      engineRef.current.setDifficulty(diff);
    }
  }, []);

  const handleStartGame = useCallback((diffToStart?: DifficultyLevel) => {
    if (!engineRef.current) return;
    const targetDiff = diffToStart || selectedDifficulty;
    setSelectedDifficulty(targetDiff);
    sound.playGameStart();
    setShowDifficultySelect(false);
    setIsNewRecord(false);
    setGameStarted(true);
    activeKeysRef.current.clear();
    setActiveTouchDir(null);
    engineRef.current.setDifficulty(targetDiff);
    engineRef.current.reset(true);
  }, [selectedDifficulty]);

  const handleOpenDifficultySelect = useCallback(() => {
    sound.playSelect();
    setShowDifficultySelect(true);
    if (engineRef.current) {
      engineRef.current.state.isGameOver = false;
      engineRef.current.reset(false);
    }
  }, []);

  // Restart handler (with currently selected difficulty)
  const handleRestart = useCallback(() => {
    if (!engineRef.current) return;
    sound.playGameStart();
    setIsNewRecord(false);
    setGameStarted(true);
    setShowDifficultySelect(false);
    activeKeysRef.current.clear();
    setActiveTouchDir(null);
    engineRef.current.reset(true);
  }, []);

  // Keyboard Event Handlers (keydown & keyup)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 🎮 Difficulty selection hotkeys when start modal is active
      if (showDifficultySelect) {
        if (e.key === '1') {
          handleSelectDifficulty('easy');
          return;
        }
        if (e.key === '2') {
          handleSelectDifficulty('normal');
          return;
        }
        if (e.key === '3') {
          handleSelectDifficulty('hard');
          return;
        }
        if (e.key === '4') {
          handleSelectDifficulty('hell');
          return;
        }
        if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleStartGame();
          return;
        }
        return;
      }

      // Space key: Activate Neutral Mode (or restart if game over)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (gameState.isGameOver) {
          handleRestart();
        } else {
          handleActivateNeutral();
        }
        return;
      }

      // Escape or M key when Game Over: Return to Difficulty Selection
      if (gameState.isGameOver && (e.key === 'Escape' || e.code === 'KeyM' || e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        handleOpenDifficultySelect();
        return;
      }

      // W / Up Arrow / Shift / KeyQ / KeyE: Switch Polarity
      if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W' || e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyQ' || e.code === 'KeyE') {
        e.preventDefault();
        if (!gameState.isGameOver) {
          handleSwitchPole();
        }
        return;
      }

      // Enter key for restart if game over
      if (e.key === 'Enter' && gameState.isGameOver) {
        e.preventDefault();
        handleRestart();
        return;
      }

      // Prevent arrow key scrolling
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }

      // Left / Right Steering (A / D, Left / Right Arrow)
      const isLeft = e.code === 'KeyA' || e.key === 'a' || e.key === 'A' || e.code === 'ArrowLeft' || e.key === 'ArrowLeft';
      const isRight = e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.code === 'ArrowRight' || e.key === 'ArrowRight';

      if (isLeft) {
        activeKeysRef.current.add('KeyA');
        updateKeyboardInput();
      } else if (isRight) {
        activeKeysRef.current.add('KeyD');
        updateKeyboardInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isLeft = e.code === 'KeyA' || e.key === 'a' || e.key === 'A' || e.code === 'ArrowLeft' || e.key === 'ArrowLeft';
      const isRight = e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.code === 'ArrowRight' || e.key === 'ArrowRight';

      if (isLeft) {
        activeKeysRef.current.delete('KeyA');
        activeKeysRef.current.delete('ArrowLeft');
        activeKeysRef.current.delete('a');
        activeKeysRef.current.delete('A');
        updateKeyboardInput();
      } else if (isRight) {
        activeKeysRef.current.delete('KeyD');
        activeKeysRef.current.delete('ArrowRight');
        activeKeysRef.current.delete('d');
        activeKeysRef.current.delete('D');
        updateKeyboardInput();
      }
    };

    const handleBlur = () => {
      activeKeysRef.current.clear();
      engineRef.current?.setDirectInput(0);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [showDifficultySelect, handleSelectDifficulty, handleStartGame, handleOpenDifficultySelect, handleActivateNeutral, handleSwitchPole, handleRestart, updateKeyboardInput, gameState.isGameOver]);

  // Touch Steer Controls
  const setTouchSteer = (dir: 'left' | 'right' | null) => {
    setActiveTouchDir(dir);
    if (!engineRef.current) return;
    if (dir === 'left') {
      engineRef.current.setDirectInput(-1);
    } else if (dir === 'right') {
      engineRef.current.setDirectInput(1);
    } else {
      engineRef.current.setDirectInput(0);
    }
  };

  // Fullscreen touch / pointer handler for screen zone taps and drag steering
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('#game-over-modal')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const relX = (clientX - rect.left) / rect.width;

    touchStateRef.current = {
      active: true,
      startX: clientX,
      currentX: clientX,
      isCenterTap: relX >= 0.35 && relX <= 0.65,
    };

    if (gameState.isGameOver) return;

    if (relX < 0.35) {
      setTouchSteer('left');
    } else if (relX > 0.65) {
      setTouchSteer('right');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStateRef.current.active || gameState.isGameOver) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    touchStateRef.current.currentX = e.clientX;
    const deltaX = e.clientX - touchStateRef.current.startX;

    // If dragged more than 15px, switch from zone hold to drag steering
    if (Math.abs(deltaX) > 15) {
      touchStateRef.current.isCenterTap = false;
      const normalized = Math.max(-1, Math.min(1, deltaX / 65));
      engineRef.current?.setDirectInput(normalized);
      if (normalized < -0.15) {
        setActiveTouchDir('left');
      } else if (normalized > 0.15) {
        setActiveTouchDir('right');
      } else {
        setActiveTouchDir(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStateRef.current.active) return;
    const target = e.target as HTMLElement;
    const wasCenter = touchStateRef.current.isCenterTap;
    const deltaX = Math.abs(touchStateRef.current.currentX - touchStateRef.current.startX);

    touchStateRef.current.active = false;
    setTouchSteer(null);

    // If it was a quick center tap without dragging, toggle polarity
    if (wasCenter && deltaX < 15 && !target.closest('button') && !gameState.isGameOver) {
      handleSwitchPole();
    }
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const toggleTutorial = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTutorial(prev => !prev);
  };

  const isNPole = gameState.playerPole === 'N';
  const isNeutral = gameState.isNeutral;
  const poleColor = isNeutral ? '#9B59FF' : isNPole ? '#ff3b5c' : '#36a9ff';
  
  const poleBg = isNeutral
    ? 'bg-[#9B59FF]/20 border-[#9B59FF] text-[#C084FF] shadow-[0_0_25px_rgba(155,89,255,0.4)]'
    : isNPole 
      ? 'bg-[#ff3b5c]/20 border-[#ff3b5c] text-[#ff3b5c] shadow-[0_0_25px_rgba(255,59,92,0.4)]' 
      : 'bg-[#36a9ff]/20 border-[#36a9ff] text-[#36a9ff] shadow-[0_0_25px_rgba(54,169,255,0.4)]';

  const displayDistance = Number.isFinite(gameState.distance) ? Math.max(0, Math.floor(gameState.distance)) : 0;
  const currentDiffConfig = DIFFICULTY_SETTINGS[selectedDifficulty];
  const diffBestDistance = Number.isFinite(gameState.bestScores?.[selectedDifficulty])
    ? Math.max(0, Math.floor(gameState.bestScores[selectedDifficulty]))
    : 0;
  const neutralCooldown = Number.isFinite(gameState.neutralCooldown) ? Math.max(0, gameState.neutralCooldown) : 0;
  const neutralReady = neutralCooldown <= 0 && !isNeutral;

  return (
    <div 
      id="magnet-rush-container"
      className="relative w-full h-screen overflow-hidden bg-[#080b14] flex flex-col justify-between select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 3D WebGL / Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none pointer-events-none"
      />

      {/* Top HUD */}
      <header className="relative z-10 w-full px-4 sm:px-8 pt-4 pb-2 flex justify-between items-start pointer-events-none">
        {/* Left: Distance, Difficulty Pill & Combo */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div id="hud-distance" className="bg-[#0b101c]/85 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2 rounded-xl shadow-lg flex flex-col">
            <span className="text-[10px] sm:text-xs font-bold tracking-widest text-white/50 uppercase font-rajdhani">DISTANCE</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-white font-orbitron tabular-nums">
                {displayDistance}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white/60 font-orbitron">m</span>
            </div>
          </div>

          {/* Current Difficulty Badge Button */}
          <button
            id="hud-difficulty-btn"
            type="button"
            onClick={handleOpenDifficultySelect}
            className={`px-2.5 sm:px-3 py-2 rounded-xl border flex flex-col items-start backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg ${
              selectedDifficulty === 'easy'
                ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300'
                : selectedDifficulty === 'normal'
                ? 'bg-cyan-950/80 border-cyan-500/70 text-cyan-300'
                : selectedDifficulty === 'hard'
                ? 'bg-rose-950/80 border-rose-500/70 text-rose-300'
                : 'bg-purple-950/90 border-fuchsia-500/80 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.4)]'
            }`}
            title="난이도 변경하기"
          >
            <span className="text-[9px] font-bold tracking-widest opacity-60 uppercase font-rajdhani">DIFFICULTY</span>
            <span className="text-xs sm:text-sm font-black font-orbitron flex items-center gap-1">
              {currentDiffConfig.badge}
            </span>
          </button>

          {gameState.perfectCombo > 1 && (
            <div 
              id="hud-combo-badge"
              className="bg-amber-950/80 backdrop-blur-md border border-amber-400/60 px-2.5 sm:px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.35)] flex flex-col animate-bounce"
            >
              <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-amber-300 uppercase font-rajdhani">
                COMBO
              </span>
              <span className="text-sm sm:text-base font-black text-amber-200 font-orbitron tabular-nums">
                ×{gameState.perfectCombo}
              </span>
            </div>
          )}
        </div>

        {/* Center: Title */}
        <div id="hud-title" className="flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl animate-pulse">🧲</span>
            <h1 className="text-lg sm:text-2xl font-black tracking-wider font-orbitron bg-gradient-to-r from-[#ff3b5c] via-white to-[#36a9ff] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
              MAGNET RUSH
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold tracking-widest text-cyan-400/80 uppercase font-rajdhani">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
            <span>RANDOM MAP #{gameState.runSeed ? gameState.runSeed.toString().slice(-5) : 'LIVE'}</span>
            <span className="text-white/30">•</span>
            <span className="text-emerald-400/90">SAFE PATH VERIFIED</span>
          </div>
        </div>

        {/* Right: Best Score & Utility Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div id="hud-best" className="bg-[#0b101c]/85 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2 rounded-xl shadow-lg flex flex-col text-right">
            <span className="text-[10px] sm:text-xs font-bold tracking-widest text-amber-400/80 uppercase font-rajdhani flex items-center justify-end gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> {currentDiffConfig.name} BEST
            </span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-orbitron tabular-nums">
                {diffBestDistance}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-amber-400/60 font-orbitron">m</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              id="sound-toggle-btn"
              onClick={toggleSound}
              className="p-2 sm:p-2.5 rounded-xl bg-[#0b101c]/85 border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all shadow-lg active:scale-95 cursor-pointer"
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "소리 켜기" : "소리 끄기"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              id="help-toggle-btn"
              onClick={toggleTutorial}
              className={`p-2 sm:p-2.5 rounded-xl bg-[#0b101c]/85 border ${showTutorial ? 'border-cyan-400/60 text-cyan-400' : 'border-white/10 text-white/70'} hover:text-white transition-all shadow-lg active:scale-95 cursor-pointer`}
              aria-label="Tutorial Guide"
              title="도움말 열기/닫기"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Tutorial Hint (Active at start or toggled) */}
      {showTutorial && (
        <div className="relative z-20 self-center max-w-sm sm:max-w-lg mx-4 bg-[#0c1222]/95 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-center shadow-2xl pointer-events-auto transition-all">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/10">
            <span className="text-xs font-bold font-orbitron text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 게임 규칙 & 조작법
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowTutorial(false); }}
              className="text-white/40 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs font-rajdhani text-left mb-2.5">
            <div className="bg-[#ff3b5c]/10 border border-[#ff3b5c]/30 rounded-lg p-2">
              <div className="font-bold text-[#ff3b5c] flex items-center gap-1 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b5c] inline-block"></span> 같은 극 (밀어냄)
              </div>
              <p className="text-white/80 text-[11px]">🔴+🔴 / 🔵+🔵 = 반대로 튕겨냄</p>
            </div>
            <div className="bg-[#36a9ff]/10 border border-[#36a9ff]/30 rounded-lg p-2">
              <div className="font-bold text-[#36a9ff] flex items-center gap-1 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#36a9ff] inline-block"></span> 다른 극 (끌어당김)
              </div>
              <p className="text-white/80 text-[11px]">🔴+🔵 = 자석 쪽으로 끌림</p>
            </div>
          </div>

          <div className="bg-[#9B59FF]/10 border border-[#9B59FF]/30 rounded-lg p-2 text-left text-xs font-rajdhani">
            <div className="font-bold text-[#C084FF] flex items-center gap-1 mb-0.5">
              <CircleDot className="w-3.5 h-3.5" /> 🟣 중성(Neutral) 모드 [SPACE]
            </div>
            <p className="text-white/90 text-[11px]">3초간 모든 자석 물리 무시 (쿨타임 5초). 위험 장애물 구간 긴급 회피용!</p>
          </div>
        </div>
      )}

      {/* Bottom Controls & Active Pole HUD */}
      <footer className="relative z-10 w-full px-4 sm:px-8 pb-5 flex flex-col items-center gap-3 pointer-events-none">
        {/* Interactive Steering, Neutral & Pole Switch Controls */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-2 sm:gap-3 pointer-events-auto">
          {/* Left Steer Button */}
          <button
            id="btn-steer-left"
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); setTouchSteer('left'); }}
            onPointerUp={(e) => { e.stopPropagation(); setTouchSteer(null); }}
            onPointerCancel={(e) => { e.stopPropagation(); setTouchSteer(null); }}
            onPointerLeave={() => setTouchSteer(null)}
            className={`flex-1 max-w-[100px] sm:max-w-[130px] py-3 px-2 sm:px-3 rounded-2xl border-2 backdrop-blur-md flex items-center justify-center gap-1 font-orbitron font-bold transition-all shadow-lg select-none cursor-pointer ${
              activeTouchDir === 'left' || gameState.directInputX < 0
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300 scale-95 shadow-[0_0_20px_rgba(54,169,255,0.5)]'
                : 'bg-[#0b101c]/80 border-white/15 text-white/80 hover:border-cyan-400/50 hover:text-white'
            }`}
            aria-label="Move Left"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs sm:text-sm">LEFT (A)</span>
          </button>

          {/* Center-Left: Polarity Switch Button (N ↔ S) */}
          <button
            id="hud-pole-status-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSwitchPole();
            }}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-2xl border-2 transition-all duration-150 backdrop-blur-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${poleBg}`}
            aria-label="Switch Polarity"
          >
            <span 
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full animate-ping"
              style={{ backgroundColor: poleColor }}
            />
            <div className="flex flex-col items-center">
              <span className="text-xs sm:text-sm font-black tracking-wider font-orbitron leading-tight">
                {isNeutral ? '🟣 NEUTRAL' : isNPole ? '🔴 N POLE' : '🔵 S POLE'}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-white/70 font-rajdhani tracking-wider">
                W / ↑ 극 전환
              </span>
            </div>
            <Zap className="w-3.5 h-3.5 animate-bounce hidden sm:block" style={{ color: poleColor }} />
          </button>

          {/* Center-Right: Neutral Mode Button (SPACE) */}
          <button
            id="btn-neutral-mode"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleActivateNeutral();
            }}
            disabled={!neutralReady && !isNeutral}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-2xl border-2 transition-all duration-150 backdrop-blur-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isNeutral
                ? 'bg-purple-600/40 border-purple-400 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.6)] animate-pulse'
                : neutralReady
                  ? 'bg-purple-950/40 border-purple-500/70 text-purple-300 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'bg-black/40 border-white/10 text-white/40 cursor-not-allowed'
            }`}
            aria-label="Activate Neutral Mode"
          >
            <CircleDot className={`w-3.5 h-3.5 ${isNeutral ? 'animate-spin text-purple-300' : neutralReady ? 'text-purple-400' : 'text-white/30'}`} />
            <div className="flex flex-col items-center">
              <span className="text-xs sm:text-sm font-black tracking-wider font-orbitron leading-tight">
                {isNeutral 
                  ? `${gameState.neutralTime.toFixed(1)}s ON`
                  : neutralReady 
                    ? '🟣 NEUTRAL' 
                    : `${neutralCooldown.toFixed(1)}s`}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-white/70 font-rajdhani tracking-wider">
                SPACE / 중성 모드
              </span>
            </div>
          </button>

          {/* Right Steer Button */}
          <button
            id="btn-steer-right"
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); setTouchSteer('right'); }}
            onPointerUp={(e) => { e.stopPropagation(); setTouchSteer(null); }}
            onPointerCancel={(e) => { e.stopPropagation(); setTouchSteer(null); }}
            onPointerLeave={() => setTouchSteer(null)}
            className={`flex-1 max-w-[100px] sm:max-w-[130px] py-3 px-2 sm:px-3 rounded-2xl border-2 backdrop-blur-md flex items-center justify-center gap-1 font-orbitron font-bold transition-all shadow-lg select-none cursor-pointer ${
              activeTouchDir === 'right' || gameState.directInputX > 0
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300 scale-95 shadow-[0_0_20px_rgba(54,169,255,0.5)]'
                : 'bg-[#0b101c]/80 border-white/15 text-white/80 hover:border-cyan-400/50 hover:text-white'
            }`}
            aria-label="Move Right"
          >
            <span className="text-xs sm:text-sm">RIGHT (D)</span>
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Input Instructions Bar */}
        <div id="hud-instructions" className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-semibold tracking-wider text-white/70 font-rajdhani bg-[#090d18]/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
          <div className="flex items-center gap-1">
            <span className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono text-[10px]">A/D</span>
            <span className="text-white/40">또는</span>
            <span className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono text-[10px]">←/→</span>
            <span className="text-white/90">좌우 이동</span>
          </div>
          <span className="text-white/30 hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span className="bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[10px] border border-purple-500/40">SPACE</span>
            <span className="text-purple-200">중성 모드 (자석 무시)</span>
          </div>
          <span className="text-white/30 hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono text-[10px]">W / ↑</span>
            <span className="text-white/90">극 전환 (N ↔ S)</span>
          </div>
        </div>
      </footer>

      {/* Start / Difficulty Selection Modal Screen */}
      {showDifficultySelect && (
        <DifficultySelectModal
          selectedDifficulty={selectedDifficulty}
          bestScores={gameState.bestScores || { easy: 0, normal: 0, hard: 0, hell: 0 }}
          onSelectDifficulty={handleSelectDifficulty}
          onStartGame={handleStartGame}
          isInitialScreen={!gameStarted}
        />
      )}

      {/* Game Over Modal Screen */}
      {gameState.isGameOver && !showDifficultySelect && (
        <div 
          id="game-over-modal"
          className="absolute inset-0 z-30 bg-[#080b14]/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm sm:max-w-md bg-[#0d1424] border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(255,59,92,0.3)] flex flex-col items-center">
            {/* Warning / Skull Header */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-3xl text-red-500 shadow-inner">
              💀
            </div>

            <h2 className="text-3xl sm:text-4xl font-black font-orbitron tracking-widest text-red-500 mb-1 drop-shadow-[0_0_15px_rgba(255,59,92,0.6)]">
              GAME OVER
            </h2>
            <p className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani tracking-wide mb-4">
              {gameState.lastHitObstacle === 'magnet_n'
                ? '🔴 N극 자석에 충돌하여 탐사선이 파괴되었습니다'
                : gameState.lastHitObstacle === 'magnet_s'
                ? '🔵 S극 자석에 충돌하여 탐사선이 파괴되었습니다'
                : gameState.lastHitObstacle === 'hazard'
                ? '위험 장벽에 충돌하여 탐사선이 파괴되었습니다'
                : '자석/장애물에 충돌하여 탐사선이 파괴되었습니다'}
            </p>

            {/* Selected Difficulty Badge */}
            <div className="w-full mb-3 flex items-center justify-center">
              <div className={`px-4 py-1.5 rounded-full border text-xs sm:text-sm font-black font-orbitron flex items-center gap-2 shadow-md ${
                selectedDifficulty === 'easy'
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
                  : selectedDifficulty === 'normal'
                  ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300'
                  : selectedDifficulty === 'hard'
                  ? 'bg-rose-950/70 border-rose-400 text-rose-300'
                  : 'bg-purple-950/80 border-fuchsia-400 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.5)]'
              }`}>
                <span className="text-white/60 text-xs font-rajdhani font-bold">난이도:</span>
                <span>{currentDiffConfig.badge}</span>
              </div>
            </div>

            {/* Score & Record Display */}
            <div className="w-full grid grid-cols-2 gap-3 mb-4">
              {/* Current Distance */}
              <div className="bg-[#121b30] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center">
                <span className="text-[11px] font-bold text-white/50 tracking-wider font-rajdhani">거리</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-white font-orbitron tabular-nums">
                    {displayDistance}
                  </span>
                  <span className="text-xs font-semibold text-white/60 font-orbitron">m</span>
                </div>
              </div>

              {/* Best Distance */}
              <div className="bg-[#121b30] border border-amber-500/30 rounded-2xl p-3.5 flex flex-col items-center relative overflow-hidden">
                {isNewRecord && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] bg-amber-400 text-black font-black px-1.5 py-0.5 rounded font-orbitron uppercase">
                    NEW!
                  </span>
                )}
                <span className="text-[11px] font-bold text-amber-400/80 tracking-wider font-rajdhani">BEST</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-300 font-orbitron tabular-nums">
                    {diffBestDistance}
                  </span>
                  <span className="text-xs font-semibold text-amber-400/60 font-orbitron">m</span>
                </div>
              </div>
            </div>

            {/* Seed & Fair Guarantee Info */}
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-rajdhani mb-3 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>맵 시드 #{gameState.runSeed ? gameState.runSeed.toString().slice(-6) : '000000'} • 안전 경로 검증 완료</span>
            </div>

            {/* Action Buttons: Retry & Change Difficulty */}
            <div className="w-full flex flex-col gap-2 mt-1">
              <button
                id="restart-button"
                type="button"
                onClick={handleRestart}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#ff3b5c] via-[#ff5b77] to-[#36a9ff] hover:opacity-95 active:scale-95 text-white font-black font-orbitron tracking-widest text-base shadow-[0_0_25px_rgba(255,59,92,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" /> 다시 도전
              </button>

              <button
                id="select-difficulty-button"
                type="button"
                onClick={handleOpenDifficultySelect}
                className="w-full py-3 px-6 rounded-2xl bg-[#141c33] hover:bg-[#1a2544] border border-white/20 active:scale-95 text-white/90 hover:text-white font-bold font-orbitron tracking-wider text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4 text-cyan-400" /> 난이도 선택
              </button>
            </div>

            <p className="text-xs text-white/40 mt-3 font-rajdhani">
              스페이스바(SPACE): 다시 도전 • ESC / M: 난이도 선택
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

