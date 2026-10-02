'use strict';
// Shared by the game and dependency-free progression tests.
(() => {
  const difficulties = [
    { name: 'Street', reward: 1, density: 1, health: 1, damage: 1, speed: 1, attack: 1, boss: 1, elite: 0 },
    { name: 'Overdrive', reward: 1.5, density: 1.2, health: 1.15, damage: 1.2, speed: 1.04, attack: 1.08, boss: 1.25, elite: .04 },
    { name: 'Nightmare', reward: 2.2, density: 1.45, health: 1.35, damage: 1.4, speed: 1.08, attack: 1.16, boss: 1.6, elite: .08 },
    { name: 'Cataclysm', reward: 3.2, density: 1.7, health: 1.6, damage: 1.7, speed: 1.12, attack: 1.25, boss: 2, elite: .12 }
  ];
  const costs = [40, 70, 110, 170, 250, 350, 475, 625, 800, 1000];
  const upgrades = [
    { id: 'hull', name: 'Reinforced hull', icon: '♥', costs: [30, 50, 80, 120, 175, 240, 320, 415, 525, 650], bonus: rank => `+${rank * 10} starting hull`, description: '+10 starting and maximum hull per rank.' },
    { id: 'rounds', name: 'Hotter rounds', icon: '↗', costs, bonus: rank => `+${rank * 6}% round damage`, description: '+6% starting bullet damage per rank. Scales with your run upgrades.' },
    { id: 'attackSpeed', name: 'Rapid cycling', icon: '≋', costs, bonus: rank => `+${rank * 8}% attack speed`, description: '+8% starting firing speed per rank. Stacks with Trigger happy during a run.' },
    { id: 'magnet', name: 'Salvage field', icon: '◈', costs: [15, 25, 40, 60, 85, 115, 150, 190, 235, 285], bonus: rank => `+${rank * 10}% pickup radius`, description: '+10% starting shard pickup radius per rank.' },
    { id: 'dash', name: 'Dash capacitor', icon: 'ϟ', costs: [25, 45, 75, 110, 155, 210, 280, 360, 450, 550], bonus: rank => `−${rank * 4}% dash cooldown`, description: '4% shorter starting dash cooldown per rank.' },
    { id: 'rerolls', name: 'Second opinions', icon: '↻', costs: [45, 85, 140, 210, 300, 410, 540, 690, 860, 1050], bonus: rank => `+${rank} draft rerolls`, description: 'One extra upgrade reroll per run, per rank.' }
  ];
  const integer = (value, max) => Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
  function normalize(raw) {
    const data = raw && typeof raw === 'object' && raw.version === 1 ? raw : {};
    const unlocked = integer(data.unlocked, difficulties.length - 1);
    return {
      version: 1, scrap: integer(data.scrap, 1e7), unlocked,
      selected: integer(data.selected, unlocked),
      endless: data.endless === true && integer(data.wins?.[3], 1e7) > 0,
      ranks: Object.fromEntries(upgrades.map(u => [u.id, integer(data.ranks?.[u.id], u.costs.length)])),
      wins: difficulties.map((_, i) => integer(data.wins?.[i], 1e7))
    };
  }
  function buy(profile, id) {
    const upgrade = upgrades.find(u => u.id === id);
    if (!upgrade) return false;
    const rank = profile.ranks[id], cost = upgrade.costs[rank];
    if (cost === undefined || profile.scrap < cost) return false;
    profile.scrap -= cost; profile.ranks[id]++; return true;
  }
  function reward(seconds, kills, won, difficulty) {
    // No incentive to keep the boss alive and farm an endless swarm.
    const survival = Math.floor(Math.min(180, Math.max(0, seconds)) / 6);
    const combat = Math.floor(Math.min(500, Math.max(0, kills)) / 10);
    const victory = won ? 60 : 0;
    const multiplier = difficulties[difficulty].reward;
    const retainedPercent = won ? 100 : 50;
    // Integer arithmetic avoids floating-point rounding at whole-Scrap boundaries.
    const weighted = (survival + combat + victory) * Math.round(multiplier * 10);
    const total = Math.floor(weighted * retainedPercent / 1000);
    return { survival, combat, victory, multiplier, retainedPercent, total };
  }
  function settle(profile, earnings, won, difficulty) {
    profile.scrap = Math.min(1e7, profile.scrap + earnings.total);
    if (won) {
      profile.wins[difficulty] = Math.min(1e7, profile.wins[difficulty] + 1);
      profile.unlocked = Math.max(profile.unlocked, Math.min(difficulties.length - 1, difficulty + 1));
    }
  }
  function endlessReward(minutes) {
    const n = Math.max(0, Math.floor(minutes));
    return 100 * n + 10 * n * (n + 1);
  }
  const api = { endlessReward, difficulties, upgrades, normalize, buy, reward, settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.RiotProgression = api;
})();
