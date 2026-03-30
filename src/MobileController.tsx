import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Role } from './lib/types';
import { Navigation, Crosshair, Zap } from 'lucide-react';

const SOCKET_URL = window.location.origin;
const isSolo = new URLSearchParams(window.location.search).get('solo') === 'true';

export default function MobileController() {
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const touchStartY = useRef<number>(0);

  // Unlock & warm up AudioContext on join tap
  function unlockAudio() {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      // Play a silent buffer to unlock audio on iOS
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch (_) {}
  }

  function playBeep(freq: number, type: OscillatorType) {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (_) {}
  }

  function handleJoin() {
    if (joined) return;
    unlockAudio();
    setJoined(true);
  }

  // Connect socket only after the user taps JOIN (audio is unlocked by then)
  useEffect(() => {
    if (!joined) return;

    const preventDefault = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });

    const socket = io(SOCKET_URL, { query: { solo: isSolo ? 'true' : 'false' } });
    socketRef.current = socket;

    socket.on('role', (assignedRole: Role) => setRole(assignedRole));

    socket.on('haptic', (data: { type: string }) => {
      navigator.vibrate?.([]);
      switch (data.type) {
        case 'fire':    navigator.vibrate?.(50); break;
        case 'damage':  navigator.vibrate?.([200, 50, 200]); break;
        case 'hit':     navigator.vibrate?.([50, 50, 50]); break;
        case 'gameover':navigator.vibrate?.(1000); break;
        case 'victory': navigator.vibrate?.([100, 50, 100, 50, 100, 50, 500]); break;
      }
    });

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      socket.close();
    };
  }, [joined]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const socket = socketRef.current;
    if (!socket || !role) return;

    const diff = touchStartY.current - e.changedTouches[0].clientY;
    const isSwipe = Math.abs(diff) > 30;

    if ((role === 'helmsman' || role === 'dual') && isSwipe) {
      socket.emit('action', { type: 'swipe', dir: diff > 0 ? -1 : 1 });
      navigator.vibrate?.(30);
      playBeep(400, 'sine');
    } else if (role === 'gunner' || (role === 'dual' && !isSwipe)) {
      socket.emit('action', { type: 'fire' });
      navigator.vibrate?.(30);
      playBeep(800, 'square');
    }
  };

  const handleClick = () => {
    const socket = socketRef.current;
    if ((role === 'gunner' || role === 'dual') && socket) {
      socket.emit('action', { type: 'fire' });
      navigator.vibrate?.(30);
      playBeep(800, 'square');
    }
  };

  // ── PRE-JOIN: full-screen tap prompt (this tap unlocks audio) ──
  if (!joined) {
    return (
      <div
        className="fixed inset-0 bg-black flex flex-col items-center justify-center select-none touch-none font-mono"
        onClick={handleJoin}
        onTouchEnd={handleJoin}
      >
        <div className="animate-pulse flex flex-col items-center gap-8 text-white">
          <Zap size={100} className="text-yellow-400" />
          <h1 className="text-5xl font-black tracking-widest">TAP TO JOIN</h1>
          <p className="text-gray-500 text-sm tracking-widest">COLLECTIVE.DEFENSE</p>
        </div>
      </div>
    );
  }

  // ── JOINED, waiting for role assignment ──
  if (!role) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <p className="animate-pulse tracking-widest">CONNECTING TO MOTHERSHIP...</p>
      </div>
    );
  }

  // ── ROLE SCREEN ──
  const isDual = role === 'dual';
  const isHelmsman = role === 'helmsman';

  const teamLabel = isDual ? 'BOTH TEAMS' : isHelmsman ? 'TEAM 1 — HELM' : 'TEAM 2 — GUNS';
  const teamSub   = isDual ? 'SWIPE = HELM · TAP = FIRE' : isHelmsman ? 'SWIPE UP / DOWN' : 'TAP TO FIRE';
  const bgClass   = isDual ? 'bg-purple-950 text-purple-300' : isHelmsman ? 'bg-blue-950 text-blue-400' : 'bg-red-950 text-red-400';

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center select-none touch-none ${bgClass} font-mono`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center gap-8 opacity-40 pointer-events-none">
        {isDual ? (
          <div className="flex gap-10">
            <Navigation size={80} />
            <Crosshair size={80} />
          </div>
        ) : isHelmsman ? (
          <Navigation size={120} />
        ) : (
          <Crosshair size={120} />
        )}
        <div className="text-center">
          <p className="text-xs tracking-[0.3em] mb-2 opacity-60">YOU ARE</p>
          <h1 className="text-4xl font-black tracking-widest">{teamLabel}</h1>
          <p className="text-lg tracking-widest mt-3 opacity-70">{teamSub}</p>
        </div>
      </div>
    </div>
  );
}
