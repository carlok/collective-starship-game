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
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
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
  const localIP = getLocalIP();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/info', (req, res) => {
    res.json({ ip: localIP, port: PORT });
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
    // Assign role — solo=true gives dual role (both helmsman + gunner)
    const isSolo = socket.handshake.query.solo === 'true';
    const role = isSolo ? 'dual' : (Math.random() > 0.5 ? 'helmsman' : 'gunner');
    socket.emit('role', role);

    if (role === 'dual') {
      state.stats.helmsmenCount++;
      state.stats.gunnersCount++;
    } else if (role === 'helmsman') {
      state.stats.helmsmenCount++;
    } else {
      state.stats.gunnersCount++;
    }

    // Start game if enough players join and waiting
    if (state.status === 'waiting' && (state.stats.helmsmenCount + state.stats.gunnersCount) > 0) {
      resetGame();
    }

    // Send initial state
    socket.emit('state', state);

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
      MAX_GAME_TIME_TICKS
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
    console.log(`  Network: http://${localIP}:${PORT}`);
    console.log(`  Players: http://${localIP}:${PORT}/play`);
    console.log(`  Solo:    http://${localIP}:${PORT}/play?solo=true\n`);
  });
}

startServer();
