import { describe, it, expect } from 'vitest';
import { createInitialState, processTick, MAX_HP, MAX_ENERGY, ENERGY_COST_PER_SHOT, ENERGY_RECHARGE_RATE } from './engine';
import { MOVE_EVERY_N_TICKS } from './types';

describe('Game Engine', () => {
  it('should initialize correctly', () => {
    const state = createInitialState();
    expect(state.status).toBe('waiting');
    expect(state.ship.hp).toBe(MAX_HP);
    expect(state.ship.energy).toBe(MAX_ENERGY);
  });

  it('should move the ship up when net swipes are negative', () => {
    const state = createInitialState();
    state.status = 'playing';
    const initialRow = state.ship.row;

    const { newState } = processTick(state, -1, 1, 0, 1, 100);
    expect(newState.ship.row).toBe(initialRow - 1);
  });

  it('should move the ship down when net swipes are positive', () => {
    const state = createInitialState();
    state.status = 'playing';
    const initialRow = state.ship.row;

    const { newState } = processTick(state, 1, 1, 0, 1, 100);
    expect(newState.ship.row).toBe(initialRow + 1);
  });

  it('should not move the ship out of bounds', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.ship.row = 0;

    const { newState } = processTick(state, -1, 1, 0, 1, 100);
    expect(newState.ship.row).toBe(0); // Still 0
  });

  it('should fire a projectile when pendingFires > 0 and energy is sufficient', () => {
    const state = createInitialState();
    state.status = 'playing';

    const { newState, events } = processTick(state, 0, 0, 1, 1, 100);
    
    expect(newState.projectiles.length).toBe(1);
    expect(newState.ship.energy).toBe(MAX_ENERGY - ENERGY_COST_PER_SHOT + ENERGY_RECHARGE_RATE);
    expect(events).toContain('fire');
  });

  it('should not fire if energy is insufficient', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.ship.energy = 10; // Less than ENERGY_COST_PER_SHOT (20)

    const { newState, events } = processTick(state, 0, 0, 1, 1, 100);
    
    expect(newState.projectiles.length).toBe(0);
    expect(events).not.toContain('fire');
  });

  it('should handle collisions between projectiles and enemies', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.ship.row = 4;
    
    // Setup an enemy and a projectile about to collide
    state.enemies.push({ id: 'e1', row: 4, col: 5, emoji: '👾' });
    state.projectiles.push({ id: 'p1', row: 4, col: 4 });

    const { newState, events } = processTick(state, 0, 0, 0, 1, 100);
    
    // Projectile moves to col 5, enemy moves to col 4 -> collision!
    expect(newState.enemies.find(e => e.id === 'e1')).toBeUndefined();
    expect(newState.projectiles.find(p => p.id === 'p1')).toBeUndefined();
    expect(newState.stats.score).toBe(10);
    expect(newState.stats.combo).toBe(1);
    expect(newState.floatingTexts.length).toBe(1);
    expect(events).toContain('hit');
  });

  it('should reset combo on miss', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.stats.combo = 5;
    state.projectiles.push({ id: 'p1', row: 0, col: 15 }); // Will go off-screen (COLS=16)

    const { newState } = processTick(state, 0, 0, 0, 1, 100);
    expect(newState.stats.combo).toBe(0);
  });

  it('should decrease HP when enemy hits the ship', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.ship.row = 4;
    state.ship.col = 0;
    
    // Enemy right in front of the ship
    state.enemies.push({ id: 'e1', row: 4, col: 1, emoji: '👾' });

    const { newState, events } = processTick(state, 0, 0, 0, 1, 100);
    
    // Enemy moves to col 0, hits ship
    expect(newState.enemies.find(e => e.id === 'e1')).toBeUndefined();
    expect(newState.ship.hp).toBe(MAX_HP - 1);
    expect(events).toContain('damage');
  });

  it('should trigger gameover when HP reaches 0', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.ship.hp = 1;
    state.ship.row = 4;
    state.ship.col = 0;
    
    state.enemies.push({ id: 'e1', row: 4, col: 1, emoji: '👾' });

    const { newState, events } = processTick(state, 0, 0, 0, 1, 100);
    
    expect(newState.status).toBe('gameover');
    expect(events).toContain('gameover');
  });

  it('should trigger victory when timer reaches max', () => {
    const state = createInitialState();
    state.status = 'playing';
    
    const { newState, events } = processTick(state, 0, 0, 0, 100, 100);
    
    expect(newState.status).toBe('victory');
    expect(events).toContain('victory');
  });

  it('should not move enemies and projectiles on non-move ticks', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.enemies.push({ id: 'e1', row: 2, col: 10, emoji: '👾' });
    state.projectiles.push({ id: 'p1', row: 2, col: 3 });

    const { newState } = processTick(state, 0, 0, 0, 1, 100, MOVE_EVERY_N_TICKS - 1);

    expect(newState.enemies.find(e => e.id === 'e1')?.col).toBe(10);
    expect(newState.projectiles.find(p => p.id === 'p1')?.col).toBe(3);
  });

  it('should move enemies and projectiles on move ticks', () => {
    const state = createInitialState();
    state.status = 'playing';
    state.enemies.push({ id: 'e1', row: 2, col: 10, emoji: '👾' });
    state.projectiles.push({ id: 'p1', row: 2, col: 3 });

    const { newState } = processTick(state, 0, 0, 0, 1, 100, MOVE_EVERY_N_TICKS);

    expect(newState.enemies.find(e => e.id === 'e1')?.col).toBe(9);
    expect(newState.projectiles.find(p => p.id === 'p1')?.col).toBe(4);
  });
});
