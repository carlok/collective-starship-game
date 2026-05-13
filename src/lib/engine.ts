import { GameState, COLS, ROWS, Enemy, Projectile, MOVE_EVERY_N_TICKS } from './types';

export const MAX_HP = 10;
export const MAX_ENERGY = 100;
export const ENERGY_RECHARGE_RATE = 5;
export const ENERGY_COST_PER_SHOT = 20;
export const EMOJIS = ['🪨', '☄️', '🌑', '🪐', '💫', '🌠', '⚫', '🌙'];

export function createInitialState(): GameState {
  return {
    status: 'waiting',
    ship: { row: Math.floor(ROWS / 2), col: 0, hp: MAX_HP, energy: MAX_ENERGY },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    stats: { score: 0, helmsmenCount: 0, gunnersCount: 0, totalInputs: 0, combo: 0, maxCombo: 0 },
    config: { maxHp: MAX_HP, maxEnergy: MAX_ENERGY },
    feedback: { netSwipes: 0, totalSwipes: 0, recentFires: 0 },
  };
}

export function processTick(
  state: GameState,
  pendingSwipes: number,
  totalSwipesThisTick: number,
  pendingFires: number,
  gameTimer: number,
  maxGameTimeTicks: number,
  tickCount = 0
): { newState: GameState; events: string[] } {
  const moveObjects = tickCount % MOVE_EVERY_N_TICKS === 0;
  const events: string[] = [];
  // Deep clone state to avoid mutating the original directly in pure function
  const newState: GameState = JSON.parse(JSON.stringify(state));

  // 1. Process Helmsmen Inputs (Tug of War)
  newState.feedback.netSwipes = pendingSwipes;
  newState.feedback.totalSwipes = totalSwipesThisTick;
  newState.feedback.recentFires = pendingFires;

  if (pendingSwipes !== 0) {
    if (pendingSwipes < 0 && newState.ship.row > 0) {
      newState.ship.row--;
    } else if (pendingSwipes > 0 && newState.ship.row < ROWS - 1) {
      newState.ship.row++;
    }
  }

  // 2. Process Gunner Inputs
  if (pendingFires > 0 && newState.ship.energy >= ENERGY_COST_PER_SHOT) {
    newState.projectiles.push({
      id: Math.random().toString(36).slice(2, 11),
      row: newState.ship.row,
      col: newState.ship.col + 1,
    });
    newState.ship.energy -= ENERGY_COST_PER_SHOT;
    events.push('fire');
  }

  // Recharge Energy
  if (newState.ship.energy < MAX_ENERGY) {
    newState.ship.energy = Math.min(MAX_ENERGY, newState.ship.energy + ENERGY_RECHARGE_RATE);
  }

  // 3. Move Projectiles
  if (moveObjects) {
    newState.projectiles.forEach((p: Projectile) => p.col++);
  }
  const offScreenProjectiles = newState.projectiles.filter((p: Projectile) => p.col >= COLS);
  if (offScreenProjectiles.length > 0) {
    newState.stats.combo = 0; // Reset combo on miss
  }
  newState.projectiles = newState.projectiles.filter((p: Projectile) => p.col < COLS);

  // 4. Move Enemies
  if (moveObjects) {
    newState.enemies.forEach((e: Enemy) => e.col--);
  }
  newState.enemies = newState.enemies.filter((e: Enemy) => {
    if (e.col <= newState.ship.col) {
      if (e.row === newState.ship.row) {
        newState.ship.hp--;
        newState.stats.combo = 0; // Reset combo on damage
        events.push('damage');
      }
      return false;
    }
    return true;
  });

  // 5. Collisions (Projectiles vs Enemies)
  const enemiesToRemove = new Set<string>();
  const projectilesToRemove = new Set<string>();

  newState.projectiles.forEach((p: Projectile) => {
    newState.enemies.forEach((e: Enemy) => {
      if (p.row === e.row && (p.col === e.col || p.col === e.col + 1)) {
        enemiesToRemove.add(e.id);
        projectilesToRemove.add(p.id);
        
        newState.stats.combo++;
        if (newState.stats.combo > newState.stats.maxCombo) {
          newState.stats.maxCombo = newState.stats.combo;
        }
        
        const points = 10 * newState.stats.combo;
        newState.stats.score += points;
        
        newState.floatingTexts.push({
          id: Math.random().toString(36).slice(2, 11),
          row: e.row,
          col: e.col,
          text: `+${points}`,
          life: 5
        });
        
        events.push('hit');
      }
    });
  });

  newState.enemies = newState.enemies.filter((e: Enemy) => !enemiesToRemove.has(e.id));
  newState.projectiles = newState.projectiles.filter((p: Projectile) => !projectilesToRemove.has(p.id));

  // Update Floating Texts
  newState.floatingTexts.forEach(ft => ft.life--);
  newState.floatingTexts = newState.floatingTexts.filter(ft => ft.life > 0);

  // 6. Spawn Enemies
  const spawnChance = Math.min(0.8, 0.1 + (gameTimer / maxGameTimeTicks) * 0.7);
  if (moveObjects && Math.random() < spawnChance) {
    newState.enemies.push({
      id: Math.random().toString(36).slice(2, 11),
      row: Math.floor(Math.random() * ROWS),
      col: COLS - 1,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    });
  }

  // 7. Check Game Over / Victory
  if (newState.ship.hp <= 0) {
    newState.status = 'gameover';
    events.push('gameover');
  } else if (gameTimer >= maxGameTimeTicks) {
    newState.status = 'victory';
    events.push('victory');
  }

  return { newState, events };
}
