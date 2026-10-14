// Compare word/phrase line breaks and fit the largest readable reminder.
export function fitReminder(container, text) {
  let frame;
  const phrases = {
    '好好上课': ['好好', '上课'], '好好休息': ['好好', '休息'],
    '好好上課': ['好好', '上課'],
    '授業に集中': ['授業に', '集中'], 'ゆっくり休もう': ['ゆっくり', '休もう'],
  };
  const mutations = new MutationObserver(() => schedule());
  const observeText = () => mutations.observe(text, { childList: true, characterData: true, subtree: true });
  const fit = () => {
    frame = undefined;
    const style = getComputedStyle(container);
    const width = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (width <= 0 || height <= 0) return;
    const content = text.textContent;
    const leading = content.startsWith('¡') ? '¡' : '';
    const trailing = content.match(/[!！]$/)?.[0] ?? '';
    const body = content.slice(leading.length, trailing ? -1 : undefined);
    const words = phrases[body] ?? body.split(' ');
    const makeSpan = (className, value = '') => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = value;
      return span;
    };
    const render = mask => {
      const lines = [makeSpan('reminder-line')];
      words.forEach((word, index) => {
        if (index) {
          if (!phrases[body]) lines.at(-1).append(' ');
          if (mask & (1 << (index - 1))) lines.push(makeSpan('reminder-line'));
        }
        const span = makeSpan('reminder-word');
        if (index === 0 && leading) span.append(makeSpan('reminder-mark reminder-mark-start', leading));
        span.append(makeSpan('reminder-letters', word));
        if (index === words.length - 1 && trailing) span.append(makeSpan('reminder-mark reminder-mark-end', trailing));
        lines.at(-1).append(span);
      });
      text.replaceChildren(...lines);
    };
    // Keep our own markup changes from scheduling another fitting pass.
    mutations.disconnect();
    try {
      let bestSize = 0;
      let bestMask = 0;
      for (let mask = 0; mask < 2 ** (words.length - 1); mask++) {
        render(mask);
        text.style.fontSize = '100px';
        const bounds = text.getBoundingClientRect();
        const center = (bounds.left + bounds.right) / 2;
        let extent = 0;
        for (const part of text.querySelectorAll('.reminder-letters, .reminder-mark')) {
          const rect = part.getBoundingClientRect();
          extent = Math.max(extent, center - rect.left, rect.right - center);
        }
        const size = 100 * Math.min(width / (extent * 2), height / bounds.height);
        if (size > bestSize) { bestSize = size; bestMask = mask; }
      }
      render(bestMask);
      let size = Math.max(1, Math.floor(bestSize * 4) / 4);
      text.style.fontSize = `${size}px`;
      // Font hinting can shift punctuation by a fraction of a pixel after scaling.
      const fits = () => {
        const bounds = text.getBoundingClientRect();
        return bounds.height <= height && [...text.querySelectorAll('.reminder-letters, .reminder-mark')].every(part => {
          const rect = part.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right;
        });
      };
      while (size > 1 && !fits()) {
        size = Math.max(1, size - 0.25);
        text.style.fontSize = `${size}px`;
      }
    } finally { observeText(); }
  };
  const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(fit); };
  new ResizeObserver(schedule).observe(container);
  observeText();
  document.fonts.ready.then(schedule);
  schedule();
}
