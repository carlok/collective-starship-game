import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import os from 'os';
import { createInitialState, processTick } from './src/lib/engine';
import { TICK_RATE_MS } from './src/lib/types';

function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    // Skip virtual/container interfaces
    if (/^(docker|podman|veth|virbr|vmnet|vboxnet|br-|lo)/i.test(name)) continue;
    for (const iface of addrs ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      candidates.push(iface.address);
    }
  }

  // Prefer 192.168.x.x (home/office WiFi), then 10.x.x.x, then whatever is left
  return (
    candidates.find(ip => ip.startsWith('192.168.')) ??
    candidates.find(ip => ip.startsWith('10.'))      ??
    candidates[0]                                    ??
    'localhost'
  );
}

/** Env for projector UI; default on. Set SHOW_SOLO_QR=false at boot to hide solo QR. */
function readShowSoloQr(): boolean {
  const v = process.env.SHOW_SOLO_QR?.trim().toLowerCase();
  if (v === undefined || v === '') return true;
  return !(v === '0' || v === 'false' || v === 'no' || v === 'off');
}

function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Base URL for QR codes and /play links (no trailing slash).
 * - PUBLIC_ORIGIN (e.g. https://avgame0.octopuslab.ai) overrides everything.
 * - Else if HOST_IP is set and is not an IPv4 address → https://HOST_IP (implicit 443 behind nginx).
 * - Else if PUBLIC_HTTPS is set → forces https or http for the advertised host.
 * - Else IPv4 → http://ip:PORT; other hostnames without TLS hint → http://host (port 80 implied).
 */
function computeJoinBaseUrl(advertisedHost: string, port: number, hostIpEnvSet: boolean): string {
  const origin = process.env.PUBLIC_ORIGIN?.trim().replace(/\/$/, '');
  if (origin) return origin;

  const explicit = process.env.PUBLIC_HTTPS?.trim().toLowerCase();
  let useHttps: boolean;
  if (explicit !== undefined && explicit !== '') {
    useHttps = !(explicit === '0' || explicit === 'false' || explicit === 'no' || explicit === 'off');
  } else {
    useHttps = hostIpEnvSet && !isIpv4Host(advertisedHost);
  }

  if (useHttps) return `https://${advertisedHost}`;
  if (isIpv4Host(advertisedHost)) return `http://${advertisedHost}:${port}`;
  return `http://${advertisedHost}`;
}

// Initial State
let state = createInitialState();

// Input Aggregation
let pendingSwipes = 0;
let totalSwipesThisTick = 0;
let pendingFires = 0;

// Game Loop Variables
let tickCount = 0;
let gameTimer = 0;
const MAX_GAME_TIME_TICKS = (3 * 60 * 1000) / TICK_RATE_MS; // 3 minutes

function resetGame() {
  const oldStats = state.stats;
  state = createInitialState();
  state.status = 'playing';
  state.stats.helmsmenCount = oldStats.helmsmenCount;
  state.stats.gunnersCount = oldStats.gunnersCount;
  
  pendingSwipes = 0;
  totalSwipesThisTick = 0;
  pendingFires = 0;
  tickCount = 0;
  gameTimer = 0;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  const PORT = 3000;
  const hostIpEnv = process.env.HOST_IP?.trim();
  const advertisedHost = hostIpEnv || getLocalIP();
  const hostIpEnvSet = Boolean(hostIpEnv);
  const joinBaseUrl = computeJoinBaseUrl(advertisedHost, PORT, hostIpEnvSet);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/info', (req, res) => {
    res.json({
      ip: advertisedHost,
      port: PORT,
      showSoloQr: readShowSoloQr(),
      joinBaseUrl,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Socket.io Logic
  io.on('connection', (socket) => {
    const isProjector = socket.handshake.query.projector === 'true';

    // Send initial state to everyone
    socket.emit('state', state);

    socket.on('control', (data: { action: 'start' | 'stop' | 'restart' }) => {
      if (data.action === 'start' && state.status === 'waiting') {
        resetGame();
        io.emit('state', state);
      } else if (data.action === 'stop' && state.status === 'playing') {
        state.status = 'waiting';
        io.emit('state', state);
      } else if (data.action === 'restart') {
        resetGame();
        io.emit('state', state);
      }
    });

    // Players only from here on
    if (isProjector) return;

    // Assign role — solo=true gives dual role (both helmsman + gunner)
    // Otherwise alternate: helmsman on odd join, gunner on even join
    const isSolo = socket.handshake.query.solo === 'true';
    const totalPlayers = state.stats.helmsmenCount + state.stats.gunnersCount;
    const role = isSolo ? 'dual' : (totalPlayers % 2 === 0 ? 'helmsman' : 'gunner');
    socket.emit('role', role);

    if (role === 'dual') {
      state.stats.helmsmenCount++;
      state.stats.gunnersCount++;
    } else if (role === 'helmsman') {
      state.stats.helmsmenCount++;
    } else {
      state.stats.gunnersCount++;
    }

    io.emit('state', state);

    socket.on('action', (data) => {
      if (state.status !== 'playing') return;
      state.stats.totalInputs++;

      if (data.type === 'swipe' && (role === 'helmsman' || role === 'dual')) {
        pendingSwipes += data.dir; // -1 for up, 1 for down
        totalSwipesThisTick++;
      } else if (data.type === 'fire' && (role === 'gunner' || role === 'dual')) {
        pendingFires++;
      }
    });

    socket.on('disconnect', () => {
      if (role === 'dual') {
        state.stats.helmsmenCount--;
        state.stats.gunnersCount--;
      } else if (role === 'helmsman') {
        state.stats.helmsmenCount--;
      } else {
        state.stats.gunnersCount--;
      }
    });
  });

  // Game Loop
  setInterval(() => {
    if (state.status !== 'playing') return;

    gameTimer++;
    tickCount++;

    const { newState, events } = processTick(
      state,
      pendingSwipes,
      totalSwipesThisTick,
      pendingFires,
      gameTimer,
      MAX_GAME_TIME_TICKS,
      tickCount
    );

    state = newState;

    // Reset inputs for next tick
    pendingSwipes = 0;
    totalSwipesThisTick = 0;
    pendingFires = 0;

    // Broadcast haptic events
    events.forEach(event => {
      io.emit('haptic', { type: event });
    });

    // Broadcast State
    io.emit('state', state);

  }, TICK_RATE_MS);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\nServer running:`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${advertisedHost}:${PORT}`);
    console.log(`  Join QR base: ${joinBaseUrl}`);
    console.log(`  Players: ${joinBaseUrl}/play`);
    console.log(`  Solo:    ${joinBaseUrl}/play?solo=true\n`);
  });
}

startServer();
