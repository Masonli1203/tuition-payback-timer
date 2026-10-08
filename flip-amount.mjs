class FlipDigit {
  constructor() {
    this.element = document.createElement('span');
    this.element.className = 'flip-digit';
    this.halves = ['top', 'bottom', 'fold-top', 'fold-bottom'].map(part => {
      const half = document.createElement('span');
      half.className = `flip-half flip-${part}`;
      const glyph = document.createElement('span');
      half.append(glyph);
      this.element.append(half);
      return { half, glyph };
    });
    this.animations = [];
  }

  set(value, animate) {
    if (value === this.value) return;
    const previous = this.value;
    this.settle();
    this.value = value;
    this.element.dataset.value = value;
    if (!animate || previous === undefined) { this.settle(); return; }
    const [top, bottom, foldTop, foldBottom] = this.halves;
    top.glyph.textContent = value;
    bottom.glyph.textContent = previous;
    foldTop.glyph.textContent = previous;
    foldBottom.glyph.textContent = value;
    foldTop.half.hidden = foldBottom.half.hidden = false;
    const upper = foldTop.half.animate([
      { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
      { transform: 'rotateX(-90deg)', filter: 'brightness(.55)' },
    ], { duration: 220, easing: 'cubic-bezier(.55,.05,.85,.45)', fill: 'forwards' });
    const lower = foldBottom.half.animate([
      { transform: 'rotateX(90deg)', filter: 'brightness(.6)' },
      { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
    ], { duration: 300, delay: 220, easing: 'cubic-bezier(.15,.6,.3,1)', fill: 'both' });
    this.animations = [upper, lower];
    lower.finished.then(() => {
      if (this.animations.includes(lower)) this.settle();
    }).catch(() => {}); // Cancellation is expected on restore or reduced motion.
  }

  settle() {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    for (const { glyph } of this.halves) glyph.textContent = this.value ?? '0';
    this.halves[2].half.hidden = this.halves[3].half.hidden = true;
  }
}

export class FlipAmount {
  constructor(element, whole, fraction) {
    this.element = element;
    this.groups = [whole, fraction];
    this.slots = new Map();
  }

  update(whole, fraction, key, animate = false, decimal = '.') {
    const shouldFlip = animate && key === this.key;
    if (!shouldFlip) this.settle();
    this.key = key;
    const nextSlots = new Map();
    [whole, fraction ? `${decimal}${fraction}` : ''].forEach((text, groupIndex) => {
      const group = this.groups[groupIndex];
      const slots = [...text].map((character, index) => {
        // Anchor by distance from the decimal point, so 99 → 100 and
        // 999 → 1,000 retain the existing ones/tens/hundreds cards.
        const id = `${groupIndex}:${text.length - index}:${/\d/.test(character) ? 'digit' : 'separator'}`;
        let slot = this.slots.get(id);
        if (!slot) {
          if (/\d/.test(character)) slot = new FlipDigit();
          else {
            const element = document.createElement('span');
            element.className = 'flip-separator';
            element.textContent = character;
            slot = { element };
          }
        }
        nextSlots.set(id, slot);
        return { slot, character };
      });
      if (group.children.length !== slots.length || slots.some(({slot}, i) => group.children[i] !== slot.element)) {
        group.replaceChildren(...slots.map(({slot}) => slot.element));
      }
      for (const { slot, character } of slots) slot.set?.(character, shouldFlip);
      for (const { slot, character } of slots) if (!slot.set) slot.element.textContent = character;
    });
    for (const [id, slot] of this.slots) if (!nextSlots.has(id)) slot.settle?.();
    this.slots = nextSlots;
    const length = whole.replace(/\D/g, '').length;
    this.element.dataset.size = length >= 6 ? 'large' : length >= 4 ? 'medium' : 'normal';
  }

  settle() {
    for (const slot of this.slots.values()) slot.settle?.();
  }
}
