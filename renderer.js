'use strict';
// Drawing only. Entity arrays in each snapshot are borrowed read-only.
(() => {
  function createRenderer({ ctx, rand, translate, onScreen, attackAngles, bladePosition, nearestBoss, weaponWeight, COLORS, BLADE_ORBIT, BLADE_RADIUS, WEAK_HALF_ANGLE }) {
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let view;
    function polygon(x, y, r, n, angle = 0) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = angle + i * TAU / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    }
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
    function ship(x, y, angle, alpha = 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function drawGrid(cx, cy, t) {
      const left = cx - view.viewW / 2, top = cy - view.viewH / 2;
      ctx.lineWidth = 1 / view.zoom; ctx.strokeStyle = '#13202c'; ctx.beginPath();
      for (let x = Math.floor(left / 60) * 60; x < left + view.viewW + 60; x += 60) { ctx.moveTo(x, top); ctx.lineTo(x, top + view.viewH); }
      for (let y = Math.floor(top / 60) * 60; y < top + view.viewH + 60; y += 60) { ctx.moveTo(left, y); ctx.lineTo(left + view.viewW, y); } ctx.stroke();
      ctx.fillStyle = '#2a3b4a';
      for (let x = Math.floor(left / 180) * 180; x < left + view.viewW + 180; x += 180) {
        for (let y = Math.floor(top / 180) * 180; y < top + view.viewH + 180; y += 180) { ctx.fillRect(x - 3, y - .5, 6, 1); ctx.fillRect(x - .5, y - 3, 1, 6); }
      }
      // Faint sector numbers give movement a sense of place without adding obstacles.
      ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#243241';
      for (let x = Math.floor(left / 540) * 540; x < left + view.viewW + 540; x += 540) {
        for (let y = Math.floor(top / 540) * 540; y < top + view.viewH + 540; y += 540) ctx.fillText(translate(`SECTOR ${Math.abs(x / 540)} : ${Math.abs(y / 540)}`), x + 9, y + 16);
      }
      if (!view.player) for (let i = 0; i < 24; i++) {
        const x = Math.sin(i * 78.3) * view.viewW * .8 + cx, y = ((i * 193 + t * (10 + i)) % (view.viewH + 100)) - view.viewH / 2 + cy;
        ctx.strokeStyle = i % 2 ? '#ff508f40' : '#a5ff7340'; polygon(x, y, 12 + i % 4 * 5, i % 2 ? 3 : 4, t * .2); ctx.stroke();
      }
    }
    function drawTelegraph(e) {
      if (e.windup <= 0) return;
      const progress = 1 - e.windup / e.windupMax;
      ctx.save(); ctx.strokeStyle = e.boss ? '#ff739e' : COLORS.blue;
      ctx.globalAlpha = .22 + progress * .45; ctx.lineWidth = 1.5; ctx.setLineDash([7, 7]);
      const length = e.boss && e.pattern % 2 === 0 ? 220 + progress * 160 : 550;
      for (const a of attackAngles(e)) {
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * (e.r + 7), e.y + Math.sin(a) * (e.r + 7));
        ctx.lineTo(e.x + Math.cos(a) * length, e.y + Math.sin(a) * length); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = .8; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, -Math.PI / 2, -Math.PI / 2 + progress * TAU); ctx.stroke();
      ctx.restore();
    }
    function drawEnemy(e, t) {
      if (e.dead || !onScreen(e.x, e.y, e.r + 40)) return;
      const a = Math.atan2(view.player.y - e.y, view.player.x - e.x);
      ctx.save();
      if (e.entry > 0) {
        ctx.globalAlpha = .55; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        circle(e.x, e.y, e.r + e.entry * 35); ctx.stroke();
      }
      ctx.fillStyle = e.flash > 0 && !view.calm ? '#f7fff4' : e.color + '22'; ctx.strokeStyle = e.flash > 0 && !view.calm ? '#fff' : e.color;
      ctx.lineWidth = e.boss ? 3 : 2; ctx.shadowColor = e.color; ctx.shadowBlur = view.calm ? 0 : e.boss ? 16 : 5;
      polygon(e.x, e.y, e.r, e.type === 'runner' ? 3 : e.type === 'tank' ? 6 : e.boss ? 8 : 4, e.boss ? t * .4 : a);
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = e.color;
      if (e.boss) {
        // Armor plates mark the blocked 240 degrees. The bare gap is vulnerable.
        const closedStart = e.weakAngle + WEAK_HALF_ANGLE, plate = (TAU - 2 * WEAK_HALF_ANGLE) / 8;
        ctx.strokeStyle = e.blockFlash > 0 && !view.calm ? '#d3eaff' : '#8494aa'; ctx.lineWidth = 7;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12, closedStart + i * plate + .035, closedStart + (i + 1) * plate - .035); ctx.stroke();
        }
        if (e.weakTimer <= 1.5 && e.armor <= 0) {
          const next = e.weakAngle + Math.PI / 2;
          ctx.strokeStyle = '#b0bfd1'; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 23, next + WEAK_HALF_ANGLE, next + TAU - WEAK_HALF_ANGLE); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.strokeStyle = e.color;
        if (e.armor > 0) { ctx.strokeStyle = COLORS.blue; ctx.lineWidth = 4; circle(e.x, e.y, e.r + 15); ctx.stroke(); ctx.strokeStyle = e.color; }
        polygon(e.x, e.y, e.r * .65, 4, -t); ctx.stroke();
        circle(e.x, e.y, 10 + (view.calm ? 0 : Math.sin(t * 5) * 3)); ctx.fill();
        if (e.enraged) { ctx.strokeStyle = COLORS.gold; polygon(e.x, e.y, e.r + 7, 8, -t * .3); ctx.stroke(); }
      } else if (e.type === 'shooter') {
        circle(e.x, e.y, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.windup ? e.aim : a) * 19, e.y + Math.sin(e.windup ? e.aim : a) * 19); ctx.stroke();
      } else { circle(e.x + Math.cos(a) * 4, e.y + Math.sin(a) * 4, 3); ctx.fill(); }
      if (e.elite) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; polygon(e.x, e.y, e.r + 6, 6, -t * .4); ctx.stroke(); }
      if (e.hp < e.maxHp && !e.boss) {
        ctx.fillStyle = '#ffffff18'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 2);
        ctx.fillStyle = e.color; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 2);
      }
      ctx.restore();
    }
    function drawPlayer(t) {
      if (!view.player || ((view.state === 'ending' || view.state === 'end') && !view.winRun)) return;
      if (view.player.orbit) {
        ctx.strokeStyle = '#54d9ff18'; ctx.lineWidth = 1; circle(view.player.x, view.player.y, BLADE_ORBIT); ctx.stroke();
        for (let i = 0; i < view.player.orbit; i++) {
          const blade = bladePosition(i), a = blade.angle;
          ctx.strokeStyle = '#54d9ff66'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(view.player.x, view.player.y, BLADE_ORBIT, a - .3, a); ctx.stroke();
          ctx.fillStyle = COLORS.mint; ctx.strokeStyle = COLORS.blue; ctx.lineWidth = 2;
          polygon(blade.x, blade.y, BLADE_RADIUS, 4, a + Math.PI / 4); ctx.fill(); ctx.stroke();
        }
      }
      if (view.player.blast) {
        ctx.strokeStyle = '#54d9ff65'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(view.player.x, view.player.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(view.player.blastTimer / 5, 0, 1))); ctx.stroke();
      }
      ctx.fillStyle = COLORS.mint;
      if (!view.calm) for (const trail of view.trails) ship(trail.x, trail.y, trail.angle, trail.life / .18 * .3);
      const angle = Math.atan2(view.player.dy, view.player.dx);
      if (view.player.moving > .1 && view.state === 'playing') {
        ctx.save(); ctx.translate(view.player.x, view.player.y); ctx.rotate(angle);
        ctx.fillStyle = '#a5ff7355'; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-19 - (view.calm ? 3 : Math.sin(t * 50) * 5), 0); ctx.lineTo(-8, 5); ctx.fill(); ctx.restore();
      }
      // Solid ship silhouette + shield ring instead of flashing the view.player out of existence.
      if (view.player.inv > 0) { ctx.strokeStyle = view.player.dashing > 0 ? '#ffffffbb' : '#a5ff7388'; ctx.lineWidth = 1.5; circle(view.player.x, view.player.y, 22); ctx.stroke(); }
      ctx.shadowColor = COLORS.mint; ctx.shadowBlur = view.calm ? 0 : 18; ctx.fillStyle = view.player.dashing > 0 ? '#fff' : COLORS.mint;
      ship(view.player.x, view.player.y, angle); ctx.shadowBlur = 0;
      ctx.fillStyle = '#101e1c'; circle(view.player.x, view.player.y, 4); ctx.fill();
      // A local dash meter keeps the important cooldown in your peripheral vision.
      ctx.strokeStyle = view.player.dash > 0 ? '#7f9893' : COLORS.mint; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(view.player.x, view.player.y, 24, Math.PI * .25, Math.PI * .25 + Math.PI * .5 * (1 - view.player.dash / view.player.dashMax)); ctx.stroke();
      if (view.hurtFlash > 0) {
        ctx.strokeStyle = COLORS.pink; ctx.lineWidth = 4; ctx.beginPath();
        ctx.arc(view.player.x, view.player.y, 37, view.player.hurtAngle - .6, view.player.hurtAngle + .6); ctx.stroke();
      }
      const boss = nearestBoss();
      if (boss && !onScreen(boss.x, boss.y, -35)) {
        const a = Math.atan2(boss.y - view.cam.y, boss.x - view.cam.x);
        const r = Math.max(30, Math.min((view.viewW / 2 - 35) / Math.max(.001, Math.abs(Math.cos(a))), (view.viewH / 2 - 110) / Math.max(.001, Math.abs(Math.sin(a)))));
        ctx.fillStyle = COLORS.pink; polygon(view.cam.x + Math.cos(a) * r, view.cam.y + Math.sin(a) * r, 11, 3, a); ctx.fill();
      }
    }
    function draw(snapshot, t) {
      view = snapshot;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); ctx.fillStyle = '#080c15'; ctx.fillRect(0, 0, view.W, view.H);
      const cx = view.player ? view.cam.x : view.calm ? 0 : Math.sin(t * .07) * 200, cy = view.player ? view.cam.y : view.calm ? 0 : t * 12;
      ctx.save(); ctx.translate(view.W / 2 + (view.calm ? 0 : rand(-view.shake, view.shake)), view.H / 2 + (view.calm ? 0 : rand(-view.shake, view.shake)));
      ctx.scale(view.zoom, view.zoom); ctx.translate(-cx, -cy);
      drawGrid(cx, cy, view.calm && !view.player ? 0 : t);
      for (const g of view.gems) {
        if (!onScreen(g.x, g.y, 20)) continue;
        ctx.fillStyle = g.heal ? COLORS.pink : COLORS.mint;
        if (g.heal) {
          ctx.strokeStyle = '#ff508f55'; ctx.lineWidth = 1; circle(g.x, g.y, 12); ctx.stroke();
          ctx.fillRect(g.x - 2, g.y - 6, 4, 12); ctx.fillRect(g.x - 6, g.y - 2, 12, 4);
        } else { polygon(g.x, g.y, g.r, 4); ctx.fill(); }
      }
      for (const r of view.rings) {
        ctx.globalAlpha = r.life / r.max * .65; ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
        circle(r.x, r.y, r.r * (1 - (r.life / r.max) ** 2)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const e of view.enemies) if (!e.dead) drawTelegraph(e);
      for (const b of view.bullets) {
        if (b.life <= 0) continue;
        const weight = weaponWeight(), trail = .018 + weight * .003;
        ctx.strokeStyle = weight >= 2 ? '#54d9ff' : '#a5eeff'; ctx.lineWidth = 2.5 + weight; ctx.beginPath();
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * trail, b.y - b.vy * trail); ctx.stroke();
        ctx.fillStyle = '#f4fdff'; circle(b.x, b.y, 2 + weight * .35); ctx.fill();
      }
      for (const e of view.enemies) drawEnemy(e, t);
      for (const p of view.particles) { ctx.globalAlpha = p.life / p.max * .8; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
      ctx.globalAlpha = 1;
      // Enemy bullets render above effects and have white cores + dark outlines for readability.
      for (const b of view.enemyShots) {
        if (b.life <= 0 || !onScreen(b.x, b.y, 20)) continue;
        ctx.strokeStyle = '#080c15'; ctx.lineWidth = 3; ctx.fillStyle = b.boss ? '#ff638d' : '#ffb65c';
        circle(b.x, b.y, b.r + 1); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff0d9'; circle(b.x, b.y, 2); ctx.fill();
      }
      drawPlayer(t);
      ctx.textAlign = 'center';
      for (const text of view.texts) {
        ctx.globalAlpha = Math.min(1, text.life * 4); ctx.fillStyle = text.color; ctx.font = `bold ${text.size}px Inter, sans-serif`;
        ctx.strokeStyle = '#080c15'; ctx.lineWidth = 3; ctx.strokeText(text.text, text.x, text.y); ctx.fillText(text.text, text.x, text.y);
      }
      ctx.globalAlpha = 1; ctx.restore();
      const gradient = ctx.createRadialGradient(view.W / 2, view.H / 2, Math.min(view.W, view.H) * .3, view.W / 2, view.H / 2, Math.max(view.W, view.H) * .72);
      gradient.addColorStop(0, '#080c1500'); gradient.addColorStop(1, '#03050c77'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, view.W, view.H);
      if (view.player && view.state === 'playing' && view.player.hp / view.player.maxHp < .3) {
        ctx.strokeStyle = `rgba(255,60,100,${view.calm ? .24 : .2 + Math.sin(t * 4) * .07})`; ctx.lineWidth = 7; ctx.strokeRect(0, 0, view.W, view.H);
      }
      if (view.hurtFlash > 0 && !view.calm) { ctx.fillStyle = `rgba(255,50,80,${view.hurtFlash * .24})`; ctx.fillRect(0, 0, view.W, view.H); }
    }
    return draw;
  }
  globalThis.createRiotRenderer = createRenderer;
})();
