# Collective Defense

A live, multiplayer interactive conference game designed to demonstrate the effects and challenges of "collective behavior."

## Overview
The game is a 2D arcade-style shooter built on a massive virtual grid. The main game screen is projected on a large screen behind the speaker. The audience participates using their smartphones by scanning a QR code projected on the screen.

When users scan the QR code, they are randomly divided into two distinct groups:
1. **The Helmsmen**: Swipe up or down blindly on their mobile screens. The alien spaceship's vertical movement is determined by the live net sum of all Helmsmen inputs.
2. **The Gunners**: Tap anywhere on their mobile screens to fire. The alien spaceship fires a laser across the grid if at least one Gunner taps, depleting a shared energy bar.

### Bells & Whistles
- **Combo System**: Consecutive hits build a combo multiplier, drastically increasing score. The combo resets if a shot misses or the ship takes damage.
- **Visual Polish**: Includes screen shake on damage, floating combat text for score popups, and an animated starfield background.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Node.js, Express, Socket.io
- **Language**: TypeScript
- **Testing**: Vitest, React Testing Library
- **DevOps**: Docker, Docker Compose, Podman

## Local Development (Podman First)

Run the game via Podman so you don’t need to install/run Node tooling directly on the host.

To achieve quick iteration and hot-reloading without rebuilding containers, use the provided Compose configuration. It mounts your local directory as a volume.

**Using Podman Compose (recommended):**
```bash
podman-compose up --build
```

If you’re using Docker instead, you can run:
```bash
docker-compose up --build
```

The app will be available at `http://localhost:3000`. Any changes you make to the source code locally will instantly restart the server or trigger HMR on the frontend.

## Testing & Code Coverage

The core game engine is decoupled from the network layer, making it highly testable. We use `vitest` for unit testing.

All test/coverage steps run inside containers (no host `npm test` / `npm coverage`).

**Run Unit Tests + Build (podman):**
```bash
podman build --target builder -t collective_starship_game-builder . && \
podman run --rm -e NODE_ENV=test collective_starship_game-builder sh -c "npm run lint && npm test && npm run build"
```

**Run Code Coverage (podman):**
```bash
podman run --rm -e NODE_ENV=test collective_starship_game-builder sh -c "npm run coverage"
```

This generates a `coverage/` directory with an HTML report detailing the test coverage of the core game logic (`src/lib/engine.ts`).

## Production Deployment (PaaS)

This application is designed to be deployed as a stateless container to any modern Platform as a Service (PaaS) like Render, Heroku, DigitalOcean App Platform, or AWS App Runner. No SSH access is required.

1. **Connect your GitHub Repository** to your PaaS provider.
2. **Select Docker** as the runtime environment. The PaaS will automatically detect the `Dockerfile` in the root of the repository.
3. **Set the Start Command** (if required by your PaaS, though the Dockerfile provides it):
   ```bash
   npm run start
   ```
4. **Environment Variables**: Ensure `NODE_ENV` is set to `production`.
5. **Port Configuration**: The application exposes port `3000`. Ensure your PaaS routes external HTTP/WebSocket traffic to this port.

The multi-stage `Dockerfile` ensures that only the compiled frontend assets and the minimal backend dependencies are included in the final production image, keeping it lightweight and secure.

## Architecture
- `server.ts`: The authoritative game server and WebSocket handler.
- `src/lib/engine.ts`: The pure, testable game state machine.
- `src/Projector.tsx`: The main visual interface for the audience.
- `src/MobileController.tsx`: The eyes-free mobile interface for players.
- `src/lib/types.ts`: Shared TypeScript interfaces and game constants.

## License
MIT
