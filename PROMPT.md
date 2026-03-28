# Comprehensive Project Prompt: Collective Defense

**Role:** Expert Game Designer, Full-Stack System Architect, Interactive Experience Specialist, and Open-Source Maintainer.

**Task:** Build a live, multiplayer interactive conference game designed to demonstrate the effects and challenges of "collective behavior." The project must be production-ready, containerized, fully tested, and open-source friendly.

## 1. Context & Setup
*   The game is played live during a conference presentation.
*   The main game screen is projected on a large screen behind the speaker.
*   The audience participates using their smartphones by scanning a QR code projected on the screen.
*   No formal registration or username/password is required. Users instantly connect via a web browser.
*   **Crucial User Behavior:** Players keep their eyes fixed on the projector screen. They do not look at their phones while playing. The mobile UI must be minimalist and "eyes-free."

## 2. Core Gameplay Mechanics
*   **The Grid:** A 2D arcade-style shooter on a massive virtual grid (e.g., 16x8).
*   **The Roles:** Upon joining, players are randomly and secretly divided into two groups:
    *   **The Helmsmen:** Control the ship's vertical movement. They swipe up or down blindly on their phones. The ship's movement is determined by the *live net sum* of all Helmsmen inputs (a collective tug-of-war).
    *   **The Gunners:** Control the ship's weapons. They tap anywhere on their screens to fire a laser. Firing depletes a shared, slowly recharging "Energy Bar."
*   **The Enemies:** Emoji-based enemies spawn on the right and move left towards the ship.
*   **Win/Loss:** The audience wins if they survive the onslaught for a set duration (e.g., 2-3 minutes). They lose if the ship's HP reaches zero.

## 3. Bells, Whistles, & Polish
*   **Combo System:** Consecutive hits build a combo multiplier, drastically increasing the score. The combo resets if a shot misses or the ship takes damage.
*   **Visual Feedback:**
    *   Screen shake effect when the ship takes damage.
    *   Floating combat text (score popups) when enemies are destroyed.
    *   An animated, infinitely scrolling parallax starfield background.
    *   Visual indicators of collective input (e.g., "Helm Momentum" tug-of-war gauge, thruster particles based on total swipe volume).
*   **Mobile Feedback:** Haptic feedback (vibrations) and audio cues to confirm actions (swipes, taps) without requiring visual attention.
*   **Dynamic Difficulty:** Enemies spawn faster and energy recharges slower as the game progresses.

## 4. Technical Architecture & Stack
*   **Frontend:** React 19, Vite, Tailwind CSS v4, `lucide-react` (icons), `qrcode.react` (QR generation).
*   **Backend:** Node.js, Express, `socket.io` (for real-time, low-latency bidirectional communication).
*   **State Management:** Authoritative server model. The server runs a fixed-tick game loop. The core game logic must be isolated in a pure, decoupled game engine (`src/lib/engine.ts`) for maximum testability.

## 5. DevOps, Testing, & Open-Source Readiness
*   **Testing:** Comprehensive unit testing using `vitest` and `jsdom`. Must include tests for the pure game engine and React components (`@testing-library/react`). Code coverage tracking must be configured (`@vitest/coverage-v8`).
*   **Containerization:**
    *   A multi-stage `Dockerfile` optimized for lean production deployments (PaaS-ready, no shell access required).
    *   A `docker-compose.yml` file configured for local development with volume mounts for instant hot-reloading (compatible with both Docker and Podman).
*   **Documentation:** A thorough `README.md` detailing local setup (Node & Docker), testing instructions, and production deployment steps. A `CONTRIBUTING.md` file outlining guidelines for open-source contributors.
