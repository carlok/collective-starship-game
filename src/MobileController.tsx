import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Role } from './lib/types';
import { Navigation, Crosshair } from 'lucide-react';

const SOCKET_URL = window.location.origin;
const isSolo = new URLSearchParams(window.location.search).get('solo') === 'true';

export default function MobileController() {
  const [role, setRole] = useState<Role | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    // Prevent default touch behaviors (scrolling, zooming)
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });

    const newSocket = io(SOCKET_URL, { query: { solo: isSolo ? 'true' : 'false' } });
    setSocket(newSocket);

    newSocket.on('role', (assignedRole: Role) => {
      setRole(assignedRole);
    });

    newSocket.on('haptic', (data: { type: string }) => {
      if (!navigator.vibrate) return;
      
      switch (data.type) {
        case 'fire':
          if (role === 'gunner') navigator.vibrate(50);
          break;
        case 'damage':
          navigator.vibrate([200, 50, 200]);
          break;
        case 'hit':
          navigator.vibrate([50, 50, 50]);
          break;
        case 'gameover':
          navigator.vibrate(1000);
          break;
        case 'victory':
          navigator.vibrate([100, 50, 100, 50, 100, 50, 500]);
          break;
      }
    });

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      newSocket.close();
    };
  }, [role]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!socket || !role) return;

    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    const isSwipe = Math.abs(diff) > 30;

    if (role === 'helmsman' || (role === 'dual' && isSwipe)) {
      if (isSwipe) {
        socket.emit('action', { type: 'swipe', dir: diff > 0 ? -1 : 1 });
        navigator.vibrate?.(30);
        playBeep(400, 'sine');
      }
    }
    if (role === 'gunner' || (role === 'dual' && !isSwipe)) {
      socket.emit('action', { type: 'fire' });
      navigator.vibrate?.(30);
      playBeep(800, 'square');
    }
  };

  // Simple Web Audio API beep for feedback
  const playBeep = (freq: number, type: OscillatorType) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
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
    } catch (e) {
      // Ignore audio errors
    }
  };

  if (!role) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        Connecting to Mothership...
      </div>
    );
  }

  const isDual = role === 'dual';
  const isHelmsman = role === 'helmsman';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center select-none touch-none ${
        isDual ? 'bg-purple-950 text-purple-400' : isHelmsman ? 'bg-blue-950 text-blue-500' : 'bg-red-950 text-red-500'
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        // Fallback for click if touch isn't used
        if ((role === 'gunner' || role === 'dual') && socket) {
          socket.emit('action', { type: 'fire' });
          navigator.vibrate?.(30);
          playBeep(800, 'square');
        }
      }}
    >
      <div className="flex flex-col items-center opacity-30 pointer-events-none">
        {isDual ? (
          <>
            <div className="flex gap-8 mb-8">
              <Navigation size={80} />
              <Crosshair size={80} />
            </div>
            <h1 className="text-3xl font-black tracking-widest text-center">SWIPE = HELM<br/>TAP = FIRE</h1>
          </>
        ) : isHelmsman ? (
          <>
            <Navigation size={120} className="mb-8" />
            <h1 className="text-4xl font-black tracking-widest text-center">SWIPE<br/>UP / DOWN</h1>
          </>
        ) : (
          <>
            <Crosshair size={120} className="mb-8" />
            <h1 className="text-4xl font-black tracking-widest text-center">TAP<br/>TO FIRE</h1>
          </>
        )}
      </div>
    </div>
  );
}
