// Coin counts use the full calculation, never the rounded display amount.
export function coinProgress(recovered) {
  const amount = Math.max(0, recovered);
  const count = Math.floor(amount / 10);
  // Round up so the hint never promises a coin before the actual threshold.
  const remaining = Math.ceil(((count + 1) * 10 - amount) * 100) / 100;
  return { count, remaining };
}

// Keep the canvas bounded for unusually large tuition values. The caption
// always reports the exact count; the visible pile shows its newest coins.
const MAX_VISIBLE = 600;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const noise = (index, salt) => ((Math.imul(index + 1, salt) >>> 0) % 997) / 997;
const smoothstep = value => value * value * (3 - 2 * value);

export class CoinPile {
  constructor(canvas, reducedMotion) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.restingCanvas = document.createElement('canvas');
    this.restingContext = this.restingCanvas.getContext('2d');
    this.reducedMotion = reducedMotion;
    this.count = 0;
    this.key = null;
    this.symbol = '$';
    this.coins = [];
    this.paintOrder = [];
    this.frame = null;
    this.width = 0;
    this.height = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    reducedMotion.addEventListener('change', () => this.settle());
  }

  reset() {
    this.settle();
    this.key = null;
    this.count = 0;
    this.coins = [];
    this.paintOrder = [];
    this.cacheResting();
    this.draw();
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.restingCanvas.width = this.canvas.width;
    this.restingCanvas.height = this.canvas.height;
    this.restingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout(0);
  }

  update(amount, key, animate = true) {
    const progress = coinProgress(amount);
    const restoring = this.skipNextDrop;
    this.skipNextDrop = false;
    if (key === this.key && progress.count === this.count) return progress;
    const previous = this.count;
    const changed = key !== this.key || progress.count < previous;
    this.key = key;
    this.count = progress.count;
    // On load, course changes, clock jumps and background recovery, restore
    // the pile directly. Only fresh small increments receive drop animations.
    const added = progress.count - previous;
    const drops = !restoring && !changed && animate && !this.reducedMotion.matches && added <= 8 ? Math.max(0, added) : 0;
    this.layout(drops);
    return progress;
  }

  layout(drops) {
    if (!this.width || !this.height) return;
    cancelAnimationFrame(this.frame);
    this.frame = null;
    const visible = Math.min(this.count, MAX_VISIBLE);
    // Size only changes when a dense pile needs more room, in 2px steps.
    // Ordinary additions keep every earlier coin at its existing position.
    const diameter = clamp(Math.floor(Math.sqrt((this.width - 24) * (this.height - 56) / (Math.max(1, visible) * .28)) / 2) * 2, 12, 40);
    const radius = diameter / 2;
    const columns = Math.max(1, Math.floor((this.width - 24) / (diameter * 1.45)));
    const spacing = Math.min(diameter * 1.45, (this.width - diameter - 16) / Math.max(1, columns - 1));
    const rows = Array(columns).fill(0);
    const thickness = diameter * .135;
    const maxRows = Math.max(1, Math.floor((this.height - 50) / thickness));
    const started = performance.now();
    const previous = this.coins;
    this.coins = [];
    for (let i = 0; i < visible; i++) {
      const random = salt => noise(i, salt);
      let column = i === 0 ? Math.floor(columns / 2) : Math.floor((random(2654435761) + random(1597334677)) / 2 * columns);
      if (rows[column] >= maxRows) column = rows.indexOf(Math.min(...rows));
      const row = rows[column]++;
      const depth = noise(column, 2246822519);
      const floor = this.height - 12 - depth * 15;
      const x = (this.width - (columns - 1) * spacing) / 2 + column * spacing + (random(3266489917) - .5) * radius * .3;
      const target = floor - (row + 1) * thickness;
      const dropping = i >= visible - drops;
      const old = previous[i];
      // Preserve an earlier coin's flight when another threshold arrives.
      if (drops && old?.active && old.x === x && old.target === target && old.radius === radius) {
        this.coins.push(old);
        continue;
      }
      const angle = (random(3812015801) - .5) * .12;
      const face = .36 + depth * .06;
      this.coins.push({ x, target, radius, thickness, floor, row, angle, face,
        y: dropping ? -diameter : target, drawX: x, drawAngle: angle, drawFace: face,
        active: dropping, start: started + (i - (visible - drops)) * 130,
        fall: Math.sqrt(2 * (target + diameter) / 1600) * 1000 + random(668265263) * 70,
        drift: (random(374761393) - .5) * 52,
        slide: (random(1274126177) - .5) * 8,
        spin: .7 + random(42595009) * .5 });
    }
    this.paintOrder = [...this.coins].sort((a, b) => a.floor - b.floor || a.row - b.row);
    this.cacheResting();
    this.draw();
    if (drops) this.frame = requestAnimationFrame(time => this.animate(time));
  }

  animate(time) {
    let active = false;
    let landed = false;
    for (const coin of this.coins) {
      if (!coin.active) continue;
      const elapsed = time - coin.start;
      if (elapsed < 0) { active = true; continue; }
      if (elapsed < coin.fall) {
        const u = elapsed / coin.fall;
        const flatten = smoothstep(clamp((u - .7) / .3, 0, 1));
        coin.y = -coin.radius * 2 + (coin.target + coin.radius * 2) * u * u;
        coin.drawX = coin.x + coin.drift * (1 - u) - coin.slide * u;
        const spinningFace = .1 + .84 * Math.abs(Math.cos(u * TAU * coin.spin));
        coin.drawFace = spinningFace * (1 - flatten) + coin.face * flatten;
        coin.drawAngle = coin.angle + Math.sin(u * Math.PI) * .55 * Math.sign(coin.drift);
      } else {
        const t = (elapsed - coin.fall) / 1000;
        // Two parabolic hops, then a damped rocking motion. No collision solver.
        const hop = t < .28 ? 4 * 12 * (t / .28) * (1 - t / .28)
          : t < .46 ? 4 * 3 * ((t - .28) / .18) * (1 - (t - .28) / .18) : 0;
        const damping = Math.exp(-7 * t);
        coin.y = coin.target - hop;
        coin.drawX = coin.x - coin.slide * Math.exp(-9 * t);
        coin.drawAngle = coin.angle + .24 * damping * Math.sin(29 * t);
        coin.drawFace = coin.face + .16 * damping * Math.sin(25 * t);
        if (t >= .86) {
          this.rest(coin);
          landed = true;
        }
      }
      active ||= coin.active;
    }
    if (landed) this.cacheResting();
    this.draw();
    this.frame = active ? requestAnimationFrame(next => this.animate(next)) : null;
  }

  rest(coin) {
    coin.y = coin.target;
    coin.drawX = coin.x;
    coin.drawAngle = coin.angle;
    coin.drawFace = coin.face;
    coin.active = false;
  }

  settle() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const coin of this.coins) this.rest(coin);
    this.cacheResting();
    this.draw();
  }

  cacheResting() {
    const ctx = this.restingContext;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const coin of this.paintOrder) {
      if (coin.row === 0) {
        ctx.save();
        ctx.translate(coin.x + 2, coin.floor + 1);
        ctx.scale(1, .24);
        const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, coin.radius * 1.5);
        shadow.addColorStop(0, 'rgba(0,0,0,.6)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadow;
        ctx.fillRect(-coin.radius * 1.5, -coin.radius * 1.5, coin.radius * 3, coin.radius * 3);
        ctx.restore();
      }
      if (!coin.active) this.drawCoin(ctx, coin);
    }
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.width || !this.height) return;
    ctx.drawImage(this.restingCanvas, 0, 0, this.width, this.height);
    for (const coin of this.paintOrder) {
      if (coin.active) this.drawCoin(ctx, coin);
    }
  }

  drawCoin(ctx, coin) {
    ctx.save();
    ctx.translate(coin.drawX, coin.y);
    ctx.rotate(coin.drawAngle);
    const r = coin.radius;
    const ry = r * coin.drawFace;
    const edge = coin.thickness;

    // Extruded front half of the disk: the visible thickness makes a flat
    // coin read as a cylinder, with each layer resting on the previous face.
    const rim = ctx.createLinearGradient(-r, 0, r, 0);
    rim.addColorStop(0, '#805019');
    rim.addColorStop(.26, '#d49a38');
    rim.addColorStop(.5, '#f4cb6b');
    rim.addColorStop(.8, '#ad7226');
    rim.addColorStop(1, '#684015');
    ctx.beginPath();
    ctx.ellipse(0, 0, r, ry, 0, Math.PI, 0, true);
    ctx.lineTo(r, edge);
    ctx.ellipse(0, edge, r, ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.strokeStyle = 'rgba(82,48,13,.5)';
    ctx.lineWidth = .65;
    for (let a = .15; a < Math.PI; a += .19) {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * ry;
      ctx.beginPath();
      ctx.moveTo(x, y + .5);
      ctx.lineTo(x, y + edge - .5);
      ctx.stroke();
    }

    const gold = ctx.createLinearGradient(-r * .6, -ry, r * .7, ry);
    gold.addColorStop(0, '#fff2bb');
    gold.addColorStop(.35, '#edc76d');
    gold.addColorStop(.7, '#c48b32');
    gold.addColorStop(1, '#f6d985');
    ctx.beginPath();
    ctx.ellipse(0, 0, r, ry, 0, 0, TAU);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.strokeStyle = '#fbe5a0';
    ctx.lineWidth = .8;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * .77, ry * .77, 0, 0, TAU);
    ctx.strokeStyle = '#aa7427';
    ctx.lineWidth = .7;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -.4, r * .68, ry * .68, 0, Math.PI, TAU);
    ctx.strokeStyle = 'rgba(255,245,203,.8)';
    ctx.stroke();
    if (r >= 7) {
      ctx.scale(1, coin.drawFace);
      ctx.font = `bold ${r * 1.2}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe7a2';
      ctx.fillText(this.symbol, .6, 1.2, r * 1.3);
      ctx.fillStyle = '#966022';
      ctx.fillText(this.symbol, 0, 0, r * 1.3);
    }
    ctx.restore();
  }
}
