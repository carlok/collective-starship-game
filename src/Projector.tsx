import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { GameState, COLS, ROWS } from './lib/types';
import { Users, Play, Square, RotateCcw } from 'lucide-react';

const SOCKET_URL = window.location.origin;

export default function Projector() {
  const [state, setState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [serverIP, setServerIP] = useState<string | null>(null);
  const [showSoloQr, setShowSoloQr] = useState(true);
  const prevHpRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/info')
      .then(r => r.json())
      .then(
        ({
          ip,
          port,
          showSoloQr: solo,
        }: {
          ip: string;
          port: number;
          showSoloQr?: boolean;
        }) => {
          setServerIP(`${ip}:${port}`);
          if (typeof solo === 'boolean') setShowSoloQr(solo);
        }
      )
      .catch(() => setServerIP(window.location.host));
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { query: { projector: 'true' } });
    setSocket(newSocket);

    newSocket.on('state', (newState: GameState) => {
      setState(newState);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (state && prevHpRef.current !== null && state.ship.hp < prevHpRef.current) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
    if (state) {
      prevHpRef.current = state.ship.hp;
    }
  }, [state?.ship.hp]);

  if (!state) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <h1 className="text-4xl font-mono animate-pulse">Initializing System...</h1>
      </div>
    );
  }

  const baseUrl = serverIP ? `http://${serverIP}` : window.location.origin;
  const playUrl = `${baseUrl}/play`;
  const soloUrl = `${baseUrl}/play?solo=true`;

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white flex overflow-hidden font-mono relative ${isShaking ? 'animate-shake' : ''}`}>
      <div className="starfield absolute inset-0 opacity-20 pointer-events-none" />
      {/* Main Game Grid (Left 80%) */}
      <div className="flex-1 p-8 flex flex-col relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold tracking-widest text-cyan-400">COLLECTIVE.DEFENSE</h1>
          <div className="text-2xl">
            SCORE: <span className="text-yellow-400 font-bold">{state.stats.score}</span>
          </div>
        </div>

        {/* The Grid */}
        <div className="flex-1 bg-[#111] border-2 border-cyan-900 rounded-lg relative overflow-hidden flex flex-col">
          {Array.from({ length: ROWS }).map((_, r) => (
            <div key={r} className="flex-1 flex border-b border-cyan-900/30 last:border-b-0">
              {Array.from({ length: COLS }).map((_, c) => {
                const isShip = state.ship.row === r && state.ship.col === c;
                const enemy = state.enemies.find((e) => e.row === r && e.col === c);
                const isProjectile = state.projectiles.some((p) => p.row === r && p.col === c);
                const floatingText = state.floatingTexts.find((ft) => ft.row === r && ft.col === c);

                return (
                  <div
                    key={`${r}-${c}`}
                    className={`flex-1 border-r border-cyan-900/30 last:border-r-0 flex items-center justify-center relative
                      ${isShip ? 'bg-cyan-500/10' : ''}
                    `}
                  >
                    {isShip && (
                      <div 
                        className="text-4xl filter drop-shadow-[0_0_10px_rgba(6,182,212,0.8)] relative z-10"
                        style={{
                          transform: `scale(${1 + Math.min(state.feedback.totalSwipes * 0.05, 0.5)})`,
                          transition: 'transform 0.1s ease-out'
                        }}
                      >
                        🚀
                        {/* Thruster conflict particles */}
                        {state.feedback.totalSwipes > 0 && Math.abs(state.feedback.netSwipes) < state.feedback.totalSwipes && (
                          <div className="absolute inset-0 bg-orange-500/30 blur-md rounded-full animate-pulse -z-10" />
                        )}
                      </div>
                    )}
                    {enemy && (
                      <div className="text-5xl animate-bounce relative z-10">
                        {enemy.emoji}
                      </div>
                    )}
                    {isProjectile && (
                      <div 
                        className="w-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)] rounded-full relative z-0" 
                        style={{ 
                          height: `${Math.min(8 + state.feedback.recentFires * 2, 24)}px`,
                          opacity: Math.min(0.5 + state.feedback.recentFires * 0.1, 1)
                        }}
                      />
                    )}
                    {floatingText && (
                      <div className="absolute z-50 text-yellow-300 font-black text-2xl animate-float-up pointer-events-none drop-shadow-md">
                        {floatingText.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Overlays */}
          {state.status === 'gameover' && (
            <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center z-50">
              <h2 className="text-8xl font-black text-white mb-4">SYSTEM FAILURE</h2>
              <p className="text-2xl">Final Score: {state.stats.score}</p>
            </div>
          )}
          {state.status === 'victory' && (
            <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center z-50">
              <h2 className="text-8xl font-black text-white mb-4">SURVIVED</h2>
              <p className="text-2xl">Final Score: {state.stats.score}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard (Right 20%) */}
      <div className="w-80 bg-[#141414] border-l border-cyan-900 p-6 flex flex-col">
        {/* QR Code Section */}
        <div className="bg-white p-4 rounded-xl mb-4 flex flex-col items-center">
          <QRCodeSVG value={playUrl} size={180} />
          <p className="text-black font-bold mt-3 text-center text-xs">
            SCAN TO JOIN
          </p>
          <p className="text-gray-500 text-[10px] mt-1 text-center break-all">
            {playUrl}
          </p>
        </div>
        {showSoloQr && (
          <div className="bg-gray-900 border border-cyan-800 rounded-lg p-3 mb-4 flex flex-col items-center">
            <p className="text-cyan-500 text-xs font-bold tracking-widest mb-2">SOLO PLAY</p>
            <QRCodeSVG value={soloUrl} size={100} bgColor="#111" fgColor="#22d3ee" />
            <p className="text-gray-500 text-[10px] mt-2 text-center break-all">
              {soloUrl}
            </p>
          </div>
        )}

        {/* Speaker Controls */}
        <div className="mb-4">
          {state.status === 'waiting' && (
            <button
              onClick={() => socket?.emit('control', { action: 'start' })}
              className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-black tracking-widest py-3 rounded-lg transition-colors"
            >
              <Play size={18} /> START GAME
            </button>
          )}
          {state.status === 'playing' && (
            <button
              onClick={() => socket?.emit('control', { action: 'stop' })}
              className="w-full flex items-center justify-center gap-2 bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-black tracking-widest py-3 rounded-lg transition-colors"
            >
              <Square size={18} /> STOP GAME
            </button>
          )}
          {(state.status === 'gameover' || state.status === 'victory') && (
            <button
              onClick={() => socket?.emit('control', { action: 'restart' })}
              className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-black font-black tracking-widest py-3 rounded-lg transition-colors"
            >
              <RotateCcw size={18} /> RESTART
            </button>
          )}
        </div>

        {/* Live Roster */}
        <div className="space-y-6 flex-1">
          {/* Combo Multiplier */}
          {state.stats.combo > 1 && (
            <div className="bg-yellow-900/30 border border-yellow-500/50 p-3 rounded text-center animate-pulse">
              <div className="text-yellow-500 text-xs font-bold tracking-widest mb-1">COMBO MULTIPLIER</div>
              <div className="text-3xl font-black text-yellow-400">{state.stats.combo}x</div>
            </div>
          )}

          <div>
            <h3 className="text-cyan-500 text-sm tracking-widest mb-2 flex items-center gap-2">
              <Users size={16} /> ACTIVE ROSTER
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-900/30 p-3 rounded border border-blue-500/30">
                <div className="text-blue-400 text-xs mb-1">HELMSMEN</div>
                <div className="text-2xl font-bold">{state.stats.helmsmenCount}</div>
              </div>
              <div className="bg-red-900/30 p-3 rounded border border-red-500/30">
                <div className="text-red-400 text-xs mb-1">GUNNERS</div>
                <div className="text-2xl font-bold">{state.stats.gunnersCount}</div>
              </div>
            </div>
          </div>

          {/* Tug of War Gauge */}
          <div>
            <h3 className="text-cyan-500 text-sm tracking-widest mb-2">HELM MOMENTUM</h3>
            <div className="h-4 bg-gray-800 rounded-sm overflow-hidden relative flex">
              <div className="flex-1 border-r border-gray-600 relative">
                {/* Up momentum (negative netSwipes) */}
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-blue-500 transition-all duration-100"
                  style={{ width: `${Math.min((Math.max(-state.feedback.netSwipes, 0) / 10) * 100, 100)}%` }}
                />
              </div>
              <div className="flex-1 relative">
                {/* Down momentum (positive netSwipes) */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-100"
                  style={{ width: `${Math.min((Math.max(state.feedback.netSwipes, 0) / 10) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>UP</span>
              <span>DOWN</span>
            </div>
          </div>

          {/* HP Bar */}
          <div>
            <h3 className="text-cyan-500 text-sm tracking-widest mb-2">HULL INTEGRITY</h3>
            <div className="flex gap-1 h-8">
              {Array.from({ length: state.config.maxHp }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${
                    i < state.ship.hp ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Energy Bar */}
          <div>
            <h3 className="text-cyan-500 text-sm tracking-widest mb-2">WEAPON ENERGY</h3>
            <div className="h-8 bg-gray-800 rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-yellow-400 transition-all duration-200"
                style={{ width: `${(state.ship.energy / state.config.maxEnergy) * 100}%` }}
              />
            </div>
          </div>

          {/* Total Inputs */}
          <div className="mt-auto pt-8">
            <div className="text-xs text-gray-500">TOTAL COLLECTIVE INPUTS</div>
            <div className="text-xl text-gray-300">{state.stats.totalInputs.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
