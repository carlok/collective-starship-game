export const COLS = 16;
export const ROWS = 8;
export const TICK_RATE_MS = 100;       // 10 FPS — input responsiveness
export const MOVE_EVERY_N_TICKS = 2;  // objects move at 5 FPS (original speed)

export type Role = 'helmsman' | 'gunner' | 'dual';

export interface Ship {
  row: number;
  col: number;
  hp: number;
  energy: number;
}

export interface Enemy {
  id: string;
  row: number;
  col: number;
  emoji: string;
}

export interface Projectile {
  id: string;
  row: number;
  col: number;
}

export interface FloatingText {
  id: string;
  row: number;
  col: number;
  text: string;
  life: number; // ticks remaining
}

export interface GameState {
  status: 'waiting' | 'playing' | 'gameover' | 'victory';
  ship: Ship;
  enemies: Enemy[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  stats: {
    score: number;
    helmsmenCount: number;
    gunnersCount: number;
    totalInputs: number;
    combo: number;
    maxCombo: number;
  };
  config: {
    maxHp: number;
    maxEnergy: number;
  };
  feedback: {
    netSwipes: number; // For tug-of-war gauge
    totalSwipes: number; // For thruster particles (conflict)
    recentFires: number; // For laser intensity
  };
}

export interface ActionPayload {
  type: 'swipe' | 'fire';
  dir?: number; // -1 for up, 1 for down
}
