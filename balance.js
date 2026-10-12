'use strict';
// Pure balance rules. Time arguments are simulation seconds; no DOM or mutable run state.
(() => {
  const constants = {
    STEP: 1 / 60, BOSS_TIME: 180, CELL: 90,
    BLADE_ORBIT: 90, BLADE_RADIUS: 18, BLADE_SPEED: 4.2,
    HEALTH_PICKUP_LIMIT: 5, ENDLESS_LIMIT: 400, NORMAL_LIMIT: 210,
    ENDLESS_BOSS_INTERVAL: 90, ENDLESS_FIRST_BOSS: 240,
    SPAWN_RADIUS: 560, AIM_RANGE: 460, ATTACK_RANGE: 340,
    XP_MULTIPLIER: 1.5, WEAK_HALF_ANGLE: Math.PI / 3,
    BOSS_HP: 72000, PROJECTILE_BASE: 175, PROJECTILE_PER_RANK: 52.5, PROJECTILE_RANGE: 840,
    ENDLESS_BASE_BUDGET: 150, ENDLESS_BUDGET_GROWTH: 1.5, ENDLESS_DAMAGE_GROWTH: 1.4,
    BOSS_AGE_DAMAGE: 1.2, BOSS_AGE_PACE: 1.1, BOSS_AGE_PACE_CAP: 2,
    THREAT_COST: { chaser: 1, runner: 2, shooter: 3, tank: 4 },
    BUDGET_CURVE: [8, 16, 30, 46, 64, 86, 108]
  };
  const difficulties = [
    { name: 'Street', reward: 1, density: 1, health: 1, damage: 1, speed: 1, attack: 1, boss: 1, elite: 0 },
    { name: 'Overdrive', reward: 1.5, density: 1.2, health: 1.15, damage: 1.2, speed: 1.04, attack: 1.08, boss: 1.25, elite: .04 },
    { name: 'Nightmare', reward: 2.2, density: 1.45, health: 1.35, damage: 1.4, speed: 1.08, attack: 1.16, boss: 1.6, elite: .08 },
    { name: 'Cataclysm', reward: 3.2, density: 1.7, health: 1.6, damage: 1.7, speed: 1.12, attack: 1.25, boss: 2, elite: .12 }
  ];
  const C = constants;
  function threatBudget(seconds, density, endless, bossSpawned) {
    if (endless && seconds >= C.BOSS_TIME) return Math.floor(C.ENDLESS_BASE_BUDGET * Math.pow(C.ENDLESS_BUDGET_GROWTH, (seconds - C.BOSS_TIME) / 60));
    const t = Math.min(seconds, C.BOSS_TIME) / 30, i = Math.min(5, Math.floor(t));
    const next = endless && i === 5 ? C.ENDLESS_BASE_BUDGET / density : C.BUDGET_CURVE[i + 1];
    const budget = C.BUDGET_CURVE[i] + (next - C.BUDGET_CURVE[i]) * (t - i);
    return Math.floor(budget * density * (bossSpawned ? .4 : 1));
  }
  const replacementStrength = (budget, saturation, endless) => endless && saturation > 0 ? Math.max(1, budget / saturation) : 1;
  const spawnDamage = (seconds, endless) => endless ? C.ENDLESS_DAMAGE_GROWTH ** Math.max(0, (seconds - C.BOSS_TIME) / 60) : 1;
  const ageMultiplier = (seconds, spawnedAt, enabled, rate, cap = Infinity) => enabled ? Math.min(cap, rate ** (Math.max(0, seconds - spawnedAt) / 60)) : 1;
  const projectileSpeed = rank => C.PROJECTILE_BASE + rank * C.PROJECTILE_PER_RANK;
  const projectileLifetime = speed => C.PROJECTILE_RANGE / speed;
  const bossHealth = (difficulty, endless, serial) => C.BOSS_HP * difficulty * (endless ? 2 ** Math.max(0, serial - 1) : 1);
  function freeze(value) { for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item); return Object.freeze(value); }
  const api = freeze({ constants, difficulties, threatBudget, replacementStrength, spawnDamage, ageMultiplier, projectileSpeed, projectileLifetime, bossHealth });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.RiotBalance = api;
})();
