/**
 * diffHighlighter.js — Verse-pair diff component (vanilla JS)
 *
 * API:
 *   createDiffHighlighter(group, options?) → HTMLElement
 *
 * options:
 *   mode: 'word' | 'char'  (default 'word')
 *
 * For 2-verse groups: side-by-side two-column diff.
 *   Left card  (A): same tokens + removed tokens + changed tokens showing oldWord
 *   Right card (B): same tokens + added tokens + changed tokens showing newWord
 *
 * For 3+ verse groups: consecutive pairs (0–1, 1–2, …) each in a two-column row.
 */

import { computeWordDiff, computeCharDiff } from './arabicDiff.js';

const DIFF_TYPE_LABELS = {
  'زيادة':        'زيادة',
  'نقصان':        'نقصان',
  'إبدال_حرف':   'إبدال حرف',
  'تقديم_تأخير': 'تقديم وتأخير',
  'إبدال_كلمة':  'إبدال كلمة',
  'صرفي':         'اختلاف صرفي',
};

const LEGEND = [
  { key: 'same',    label: 'مشترك' },
  { key: 'added',   label: 'زيادة' },
  { key: 'removed', label: 'نقصان' },
  { key: 'changed', label: 'تغيير' },
];

// ── html2canvas lazy loader (module-level singleton) ─────────────────────────
let _h2c = null;
function _loadHtml2Canvas() {
  if (_h2c) return Promise.resolve(_h2c);
  if (window.html2canvas) { _h2c = window.html2canvas; return Promise.resolve(_h2c); }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload  = () => { _h2c = window.html2canvas; resolve(_h2c); };
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
}

export function createDiffHighlighter(group, options = {}) {
  let mode = options.mode || 'word';

  const root = document.createElement('div');
  root.className = 'dh-root';
  root.dir = 'rtl';

  function render() {
    root.innerHTML = '';
    root.appendChild(_buildHeader());
    root.appendChild(_buildGrid());
    root.appendChild(_buildLegend());
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  function _buildHeader() {
    const el = document.createElement('div');
    el.className = 'dh-header';

    const title = document.createElement('span');
    title.className = 'dh-title';
    title.textContent = group.title;

    const controls = document.createElement('div');
    controls.className = 'dh-controls';

    if (group.diffType) {
      const badge = document.createElement('span');
      badge.className = 'dh-type-badge';
      badge.textContent = DIFF_TYPE_LABELS[group.diffType] || group.diffType;
      controls.appendChild(badge);
    }

    const toggle = document.createElement('button');
    toggle.className = 'dh-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'تبديل وضع المقارنة بين الكلمة والحرف');
    _renderToggle(toggle);
    toggle.addEventListener('click', () => {
      mode = mode === 'word' ? 'char' : 'word';
      render();
    });
    controls.appendChild(toggle);
    controls.appendChild(_buildCopyBtn());

    el.appendChild(title);
    el.appendChild(controls);
    return el;
  }

  function _renderToggle(btn) {
    btn.innerHTML = '';
    const opts = [
      { text: 'كلمة', modeKey: 'word' },
      { text: '/',    modeKey: null  },
      { text: 'حرف',  modeKey: 'char' },
    ];
    opts.forEach(({ text, modeKey }) => {
      const span = document.createElement('span');
      if (modeKey === null) {
        span.className = 'dh-toggle-sep';
      } else {
        span.className = 'dh-toggle-opt' + (mode === modeKey ? ' active' : '');
      }
      span.textContent = text;
      btn.appendChild(span);
    });
  }

  // ── Cards grid ───────────────────────────────────────────────────────────────

  function _buildGrid() {
    const verses = group.verses;
    const grid = document.createElement('div');
    grid.className = 'dh-grid';

    if (!verses || verses.length === 0) return grid;

    if (verses.length === 1) {
      grid.appendChild(_buildVerseCard(verses[0], null, null, false));
    } else if (verses.length === 2) {
      grid.classList.add('dh-grid-2');
      const tokens = computeWordDiff(verses[0].text, verses[1].text);
      grid.appendChild(_buildVerseCard(verses[0], tokens, 'left',  !!options.starMode));
      grid.appendChild(_buildVerseCard(verses[1], tokens, 'right', false));
    } else if (options.starMode) {
      // Star topology: verses[0] is master — compare every other verse against it
      for (let i = 1; i < verses.length; i++) {
        const pair = document.createElement('div');
        pair.className = 'dh-pair dh-grid-2';
        const tokens = computeWordDiff(verses[0].text, verses[i].text);
        pair.appendChild(_buildVerseCard(verses[0], tokens, 'left',  true));
        pair.appendChild(_buildVerseCard(verses[i], tokens, 'right', false));
        grid.appendChild(pair);
      }
    } else {
      // Consecutive pairs: (0,1), (1,2), …
      for (let i = 0; i < verses.length - 1; i++) {
        const pair = document.createElement('div');
        pair.className = 'dh-pair dh-grid-2';
        const tokens = computeWordDiff(verses[i].text, verses[i + 1].text);
        pair.appendChild(_buildVerseCard(verses[i],     tokens, 'left',  false));
        pair.appendChild(_buildVerseCard(verses[i + 1], tokens, 'right', false));
        grid.appendChild(pair);
      }
    }

    return grid;
  }

  function _buildVerseCard(verse, tokens, side, isMaster) {
    const card = document.createElement('div');
    card.className = 'dh-verse-card' + (isMaster ? ' dh-verse-master' : '');

    const header = document.createElement('div');
    header.className = 'dh-card-header';

    const surahName = document.createElement('span');
    surahName.className = 'dh-surah-name';
    surahName.textContent = verse.surahName;

    const ayahBadge = document.createElement('span');
    ayahBadge.className = 'dh-ayah-badge';
    ayahBadge.textContent = verse.ayahNumber;

    header.appendChild(surahName);
    header.appendChild(ayahBadge);

    if (isMaster) {
      const masterBadge = document.createElement('span');
      masterBadge.className = 'dh-master-badge';
      masterBadge.textContent = 'مرجع';
      header.appendChild(masterBadge);
    }

    card.appendChild(header);

    const textEl = document.createElement('p');
    textEl.className = 'dh-verse-text';
    textEl.lang = 'ar';

    if (!tokens) {
      textEl.textContent = verse.text;
    } else if (side === 'left') {
      _renderLeftTokens(textEl, tokens);
    } else {
      _renderRightTokens(textEl, tokens);
    }

    card.appendChild(textEl);
    return card;
  }

  // ── Token renderers ──────────────────────────────────────────────────────────

  // Left card (A): same ✓  |  removed ✓  |  changed → shows oldWord
  function _renderLeftTokens(el, tokens) {
    tokens.forEach(tok => {
      if (tok.status === 'added') return; // not present in A — skip

      if (tok.status === 'changed' && mode === 'char' && tok.oldWord) {
        el.appendChild(_charDiffSpan(tok.oldWord, tok.word, 'left'));
      } else {
        const word   = tok.status === 'changed' ? tok.oldWord : tok.word;
        const status = tok.status; // 'same' | 'removed' | 'changed'
        el.appendChild(_makeToken(word, status));
      }
      el.appendChild(document.createTextNode(' '));
    });
  }

  // Right card (B): same ✓  |  added ✓  |  changed → shows newWord
  function _renderRightTokens(el, tokens) {
    tokens.forEach(tok => {
      if (tok.status === 'removed') return; // not present in B — skip

      if (tok.status === 'changed' && mode === 'char' && tok.oldWord) {
        el.appendChild(_charDiffSpan(tok.oldWord, tok.word, 'right'));
      } else {
        el.appendChild(_makeToken(tok.word, tok.status)); // 'same' | 'added' | 'changed'
      }
      el.appendChild(document.createTextNode(' '));
    });
  }

  // ── Char-level diff wrapper ──────────────────────────────────────────────────

  function _charDiffSpan(oldWord, newWord, side) {
    const wrapper = document.createElement('span');
    wrapper.className = 'dh-token dh-changed';

    const chars = computeCharDiff(oldWord, newWord);
    chars.forEach(cd => {
      // Left shows same + removed chars; right shows same + added chars
      if (side === 'left'  && cd.status === 'added')   return;
      if (side === 'right' && cd.status === 'removed')  return;

      const span = document.createElement('span');
      span.className = `dh-char dh-char-${cd.status}`;
      span.textContent = cd.char;
      wrapper.appendChild(span);
    });

    return wrapper;
  }

  // ── Token factory ────────────────────────────────────────────────────────────

  function _makeToken(word, status) {
    const span = document.createElement('span');
    span.className = `dh-token dh-${status}`;
    span.textContent = word;
    return span;
  }

  // ── Legend ───────────────────────────────────────────────────────────────────

  function _buildLegend() {
    const bar = document.createElement('div');
    bar.className = 'dh-legend';
    bar.setAttribute('aria-hidden', 'true');

    LEGEND.forEach(({ key, label }) => {
      const item = document.createElement('span');
      item.className = 'dh-legend-item';

      const dot = document.createElement('span');
      dot.className = `dh-legend-dot dh-${key}`;

      const lbl = document.createElement('span');
      lbl.textContent = label;

      item.appendChild(dot);
      item.appendChild(lbl);
      bar.appendChild(item);
    });

    return bar;
  }

  // ── Copy-as-image ────────────────────────────────────────────────────────────

  function _buildCopyBtn() {
    const btn = document.createElement('button');
    btn.className = 'dh-copy-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'نسخ المقارنة كصورة');
    btn.innerHTML =
      `<svg class="dh-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>` +
      `<svg class="dh-copy-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>` +
      `<span class="dh-copy-label">نسخ صورة</span>`;
    btn.addEventListener('click', () => _copyAsImage(btn));
    return btn;
  }

  async function _copyAsImage(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('loading');

    try {
      const html2canvas = await _loadHtml2Canvas();

      // Capture root without the copy button itself (hide briefly)
      btn.style.visibility = 'hidden';
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(root).backgroundColor || '#ffffff',
        logging: false,
      });
      btn.style.visibility = '';

      _addWatermark(canvas);

      // Try clipboard API first, fall back to download
      let usedClipboard = false;
      if (navigator.clipboard?.write) {
        try {
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          usedClipboard = true;
        } catch { /* clipboard denied — fall through to download */ }
      }

      if (!usedClipboard) {
        const a = document.createElement('a');
        a.download = `mutashabihat-${group.id}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }

      _setCopyState(btn, usedClipboard ? 'copied' : 'downloaded');
    } catch (err) {
      console.error('[DiffHighlighter] copy-as-image failed:', err);
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  function _addWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    const text = 'متشابهات القرآن الكريم';
    const scale = canvas.width / root.offsetWidth;
    const size = Math.round(12 * scale);
    ctx.save();
    ctx.font = `bold ${size}px Cairo, 'Readex Pro', sans-serif`;
    ctx.fillStyle = 'rgba(80, 80, 80, 0.45)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, canvas.width - Math.round(10 * scale), canvas.height - Math.round(8 * scale));
    ctx.restore();
  }

  function _setCopyState(btn, state) {
    btn.classList.remove('loading');
    btn.classList.add(state); // 'copied' | 'downloaded'
    const lbl = btn.querySelector('.dh-copy-label');
    if (lbl) lbl.textContent = state === 'copied' ? 'تم النسخ' : 'تم التنزيل';
    setTimeout(() => {
      btn.classList.remove(state);
      if (lbl) lbl.textContent = 'نسخ صورة';
      btn.disabled = false;
    }, 2200);
  }

  render();
  return root;
}
