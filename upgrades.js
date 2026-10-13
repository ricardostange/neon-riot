'use strict';
// In-run upgrade definitions: application and preview stay together.
(() => {
  function createUpgrades({ getPlayer, bladeDamage }) {
    const upgrades = [
      { id: 'damage', name: 'Hot rounds', icon: '↗', max: 6, offense: true,
        desc: 'Every bullet hits 30% harder. Simple. Extremely effective.',
        preview: () => `${Math.round(getPlayer().damage)} → ${Math.round(getPlayer().damage * 1.3)} damage / round`,
        apply: () => getPlayer().damage *= 1.3 },
      { id: 'rate', name: 'Trigger happy', icon: '≋', max: 6, offense: true,
        desc: 'Fire 22% faster. Less thinking, more bullets.',
        preview: () => `${(1 / getPlayer().fireRate).toFixed(1)} → ${(1.22 / getPlayer().fireRate).toFixed(1)} volleys / second`,
        apply: () => getPlayer().fireRate /= 1.22 },
      { id: 'multi', name: 'The more the merrier', icon: '⋮', max: 5, offense: true,
        desc: 'Add a projectile to every volley. Shotgun diplomacy.',
        preview: () => `${getPlayer().projectiles} → ${getPlayer().projectiles + 1} rounds / volley`,
        apply: () => getPlayer().projectiles++ },
      { id: 'pierce', name: 'Through & through', icon: '➜', max: 4, offense: true,
        desc: 'Each round passes through one more enemy. Punish a crowded room.',
        preview: () => `${getPlayer().pierce + 1} → ${getPlayer().pierce + 2} targets / round`,
        apply: () => getPlayer().pierce++ },
      { id: 'orbit', name: 'Blade aegis', icon: '✧', max: 5, offense: true,
        desc: 'Orbiting shield-blades shred enemies and intercept hostile shots on contact. Each rank adds a blade and strengthens every blade. Gaps remain: keep dodging.',
        preview: () => `${getPlayer().orbit} → ${getPlayer().orbit + 1} blades · ${Math.round(bladeDamage(getPlayer().orbit + 1))} damage / blade hit · blocks shots`,
        apply: () => getPlayer().orbit++ },
      { id: 'blast', name: 'Shock therapy', icon: '◎', max: 5, offense: true,
        desc: 'An automatic shockwave every 5s. Knocks back enemies and clears bullets.',
        preview: () => `${getPlayer().blast ? 40 + getPlayer().blast * 35 : 0} → ${40 + (getPlayer().blast + 1) * 35} area damage`,
        apply: () => { getPlayer().blast++; getPlayer().blastTimer = .5; } },
      { id: 'speed', name: 'Gotta go fast', icon: 'ϟ', max: 4,
        desc: 'Move 15% faster. Dash recharges 15% sooner. Never be where they expect.',
        preview: () => `Dash ${getPlayer().dashMax.toFixed(2)}s → ${(getPlayer().dashMax * .85).toFixed(2)}s · +15% speed`,
        apply: () => { getPlayer().speed *= 1.15; getPlayer().dashMax *= .85; getPlayer().dash = Math.min(getPlayer().dash, getPlayer().dashMax); } },
      { id: 'health', name: 'Built different', icon: '♥', max: 5,
        desc: 'Add 30 maximum hull and repair 50 immediately. A second wind.',
        preview: () => `${Math.ceil(getPlayer().hp)} / ${getPlayer().maxHp} → ${Math.ceil(Math.min(getPlayer().hp + 50, getPlayer().maxHp + 30))} / ${getPlayer().maxHp + 30} hull`,
        apply: () => { getPlayer().maxHp += 30; getPlayer().hp = Math.min(getPlayer().maxHp, getPlayer().hp + 50); } },
      { id: 'regen', name: 'Self repair', icon: '✚', max: 4,
        desc: 'Regenerate hull every second. A little breathing room goes a long way.',
        preview: () => `${getPlayer().regen.toFixed(1)} → ${(getPlayer().regen + 1.5).toFixed(1)} hull / second`,
        apply: () => getPlayer().regen += 1.5 },
      { id: 'magnet', name: 'Greedy little thing', icon: '◈', max: 3,
        desc: 'Pull in shards from 65% farther away. Spend less time chasing your lunch.',
        preview: () => `${Math.round(getPlayer().magnet)} → ${Math.round(getPlayer().magnet * 1.65)} pickup radius`,
        apply: () => getPlayer().magnet *= 1.65 },
      { id: 'crit', name: 'Bad intentions', icon: '✴', max: 5, offense: true,
        desc: 'Add 15% critical chance. Critical rounds deal triple damage.',
        preview: () => `${Math.round(getPlayer().crit * 100)}% → ${Math.round((getPlayer().crit + .15) * 100)}% critical chance`,
        apply: () => getPlayer().crit += .15 },
      { id: 'overdrive', name: 'Glass cannon', icon: '☄', max: 3, offense: true,
        desc: '55% more bullet damage. Fire 15% faster. Trade away 20 maximum hull.',
        preview: () => `${Math.round(getPlayer().damage)} → ${Math.round(getPlayer().damage * 1.55)} damage · hull ${getPlayer().maxHp} → ${getPlayer().maxHp - 20}`,
        available: () => getPlayer().maxHp > 40,
        apply: () => { getPlayer().damage *= 1.55; getPlayer().fireRate /= 1.15; getPlayer().maxHp -= 20; getPlayer().hp = Math.min(getPlayer().hp, getPlayer().maxHp); } }
    ];
      return upgrades;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = createUpgrades;
  else globalThis.createRiotUpgrades = createUpgrades;
})();
