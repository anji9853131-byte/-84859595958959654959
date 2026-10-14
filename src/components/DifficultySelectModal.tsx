import React from 'react';
import { DifficultyLevel, DIFFICULTY_SETTINGS, DIFFICULTY_ORDER } from '../difficulty';
import { Trophy, Zap, ShieldAlert, Sparkles, CheckCircle2, Play } from 'lucide-react';

interface DifficultySelectModalProps {
  selectedDifficulty: DifficultyLevel;
  bestScores: Record<DifficultyLevel, number>;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  onStartGame: (diff?: DifficultyLevel) => void;
  isInitialScreen?: boolean;
}

export const DifficultySelectModal: React.FC<DifficultySelectModalProps> = ({
  selectedDifficulty,
  bestScores,
  onSelectDifficulty,
  onStartGame,
  isInitialScreen = true,
}) => {
  const currentConfig = DIFFICULTY_SETTINGS[selectedDifficulty];

  return (
    <div
      id="difficulty-select-screen"
      className="absolute inset-0 z-40 bg-[#060810]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto pointer-events-auto select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-xl bg-[#0b0f1d]/95 border-2 border-white/15 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center my-auto transition-all">
        {/* Game Title Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl sm:text-3xl animate-bounce">🧲</span>
            <h1 className="text-2xl sm:text-3xl font-black font-orbitron tracking-widest bg-gradient-to-r from-[#ff3b5c] via-white to-[#36a9ff] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]">
              MAGNET RUSH
            </h1>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white/80 font-rajdhani tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            난이도를 선택하세요
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </h2>
          <p className="text-[11px] sm:text-xs text-white/50 font-rajdhani mt-0.5">
            자신의 실력에 맞는 코스를 선택하고 최고 기록에 도전하세요
          </p>
        </div>

        {/* 4 Difficulty Cards Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5">
          {DIFFICULTY_ORDER.map((diffKey) => {
            const cfg = DIFFICULTY_SETTINGS[diffKey];
            const isSelected = selectedDifficulty === diffKey;
            const score = bestScores[diffKey] || 0;

            // Custom border and glow styles per difficulty
            let cardClasses = 'relative p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer text-left flex flex-col justify-between overflow-hidden ';
            if (isSelected) {
              if (diffKey === 'easy') {
                cardClasses += 'bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.35)] scale-[1.02]';
              } else if (diffKey === 'normal') {
                cardClasses += 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.35)] scale-[1.02]';
              } else if (diffKey === 'hard') {
                cardClasses += 'bg-rose-950/40 border-rose-400 ring-2 ring-rose-400/50 shadow-[0_0_25px_rgba(244,63,94,0.4)] scale-[1.02]';
              } else {
                cardClasses += 'bg-gradient-to-br from-red-950/60 via-purple-950/60 to-zinc-950 border-fuchsia-500 ring-2 ring-purple-500/70 shadow-[0_0_35px_rgba(217,70,239,0.5),0_0_15px_rgba(239,68,68,0.4)] scale-[1.02] animate-pulse';
              }
            } else {
              cardClasses += 'bg-[#10162a]/70 hover:bg-[#141c35] border-white/10 hover:border-white/25 opacity-80 hover:opacity-100';
            }

            return (
              <button
                key={diffKey}
                id={`btn-difficulty-${diffKey}`}
                type="button"
                onClick={() => onSelectDifficulty(diffKey)}
                onDoubleClick={() => onStartGame(diffKey)}
                className={cardClasses}
                aria-label={`Select difficulty ${cfg.name}`}
              >
                {/* Top Row: Emoji, Name & Selected Badge */}
                <div className="flex items-center justify-between mb-1.5 w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">{cfg.emoji}</span>
                    <div className="flex flex-col">
                      <span className="font-black font-orbitron text-base sm:text-lg tracking-wider text-white">
                        {cfg.name}
                      </span>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black font-orbitron text-white bg-white/15 px-2 py-0.5 rounded-full border border-white/25">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>선택됨</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-white/30 font-rajdhani">
                      클릭하여 선택
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <div className="mb-2">
                  <p className={`text-xs sm:text-sm font-bold font-rajdhani tracking-wide ${
                    diffKey === 'easy' ? 'text-emerald-300' :
                    diffKey === 'normal' ? 'text-cyan-300' :
                    diffKey === 'hard' ? 'text-rose-300' :
                    'text-fuchsia-300 font-black'
                  }`}>
                    {cfg.tagline}
                  </p>
                  <p className="text-[11px] text-white/60 font-rajdhani line-clamp-2 leading-tight mt-0.5">
                    {cfg.description}
                  </p>
                </div>

                {/* Bottom Row: Best Record Pill */}
                <div className="w-full pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-white/50 tracking-wider font-rajdhani flex items-center gap-1">
                    <Trophy className="w-2.5 h-2.5 text-amber-400" /> 최고 기록:
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-xs sm:text-sm font-black font-orbitron tabular-nums ${
                      score > 0 ? 'text-amber-300' : 'text-white/40'
                    }`}>
                      {score > 0 ? Math.floor(score) : 0}
                    </span>
                    <span className="text-[10px] font-semibold text-white/40 font-orbitron">m</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Summary & Start Button */}
        <div className="w-full flex flex-col items-center gap-2.5">
          <button
            id="start-game-button"
            type="button"
            onClick={() => onStartGame()}
            className={`w-full py-3.5 sm:py-4 px-6 rounded-2xl font-black font-orbitron tracking-widest text-base sm:text-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:scale-95 ${
              selectedDifficulty === 'easy'
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:brightness-110'
                : selectedDifficulty === 'normal'
                ? 'bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.45)] hover:brightness-110'
                : selectedDifficulty === 'hard'
                ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.5)] hover:brightness-110'
                : 'bg-gradient-to-r from-purple-700 via-red-600 to-fuchsia-600 text-white shadow-[0_0_40px_rgba(217,70,239,0.6)] animate-pulse hover:brightness-110'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{currentConfig.badge} 시작하기</span>
          </button>

          {/* Controls / Hotkeys Guide */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] text-white/50 font-rajdhani">
            <span>단축키:</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">1</span>
            <span>EASY</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">2</span>
            <span>NORMAL</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">3</span>
            <span>HARD</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">4</span>
            <span>HELL</span>
            <span className="text-white/30">•</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">SPACE / ENTER</span>
            <span>시작</span>
          </div>
        </div>
      </div>
    </div>
  );
};
