(() => {
  const doc = document.documentElement;
  const cfg = window.ORAFDEV || { contact: {}, projects: {} };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.body.dataset.root || '';

  /* ---------- Running border lights ----------
     The light that runs around .live-btn and .btn-glow is a still conic gradient on a square that
     rotates behind a ring-shaped mask (styles.css "Running border lights"), so the GPU turns it. */
  $$('.live-btn, .btn-glow').forEach(b => {
    if (b.querySelector(':scope > .glow-ring')) return;
    const ring = document.createElement('span');
    ring.className = 'glow-ring'; ring.setAttribute('aria-hidden', 'true');
    ring.appendChild(document.createElement('i'));
    b.prepend(ring);
    b.classList.add('has-ring');
  });

  /* ---------- Call-to-action pulse ----------
     Same timing and curve as the old @keyframes cta-pulse (2.8s, --ease-out, grows over the first 70%), run
     by the compositor; each button gets its own scale so every edge moves out exactly 16px. It sleeps while
     its button is off screen. */
  if (!reduced && Element.prototype.animate) {
    const ease = getComputedStyle(doc).getPropertyValue('--ease-out').trim() || 'ease-out';
    const pulses = [];
    const syncPulse = p => { if (p.anim) (p.visible !== false && !doc.classList.contains('is-scrolling')) ? p.anim.play() : p.anim.pause(); };
    $$('.btn-glow').forEach(b => {
      if (b.querySelector(':scope > .glow-pulse')) return;
      const wrap = document.createElement('span');
      wrap.className = 'glow-pulse'; wrap.setAttribute('aria-hidden', 'true');
      const dot = document.createElement('i');
      wrap.appendChild(dot);
      b.prepend(wrap);
      b.classList.add('has-pulse');
      pulses.push({ b, dot, anim: null });
    });
    const start = p => {
      const w = p.b.offsetWidth, h = p.b.offsetHeight;
      if (!w || !h) return;
      const radius = getComputedStyle(p.b).borderTopLeftRadius;
      p.dot.style.borderRadius = radius;
      p.dot.parentElement.style.setProperty('--pr', radius);
      const grown = `scale(${(1 + 32 / w).toFixed(4)}, ${(1 + 32 / h).toFixed(4)})`;
      const t = p.anim ? p.anim.currentTime : 0;
      if (p.anim) p.anim.cancel();
      p.anim = p.dot.animate([
        { offset: 0, transform: 'scale(1, 1)', opacity: 1, easing: ease },
        { offset: 0.7, transform: grown, opacity: 0 },
        { offset: 1, transform: grown, opacity: 0 },
      ], { duration: 2800, iterations: Infinity });
      p.anim.currentTime = t || 0;
      syncPulse(p);
    };
    pulses.forEach(start);
    window.addEventListener('resize', () => pulses.forEach(start));
    document.fonts && document.fonts.ready.then(() => pulses.forEach(start));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        const p = pulses.find(x => x.b === e.target);
        if (!p) return;
        p.visible = e.isIntersecting;
        syncPulse(p);
      }), { rootMargin: '30% 0px' });
      pulses.forEach(p => io.observe(p.b));
    }
    window.addEventListener('scrollrest', () => pulses.forEach(syncPulse));
    window.addEventListener('scrollbusy', () => pulses.forEach(syncPulse));
  }

  /* ---------- Lights rest while scrolling ----------
     html.is-scrolling is set while the page is moving and cleared 180 ms after it stops. */
  {
    let restTimer = 0;
    window.addEventListener('scroll', () => {
      if (!doc.classList.contains('is-scrolling')) {
        doc.classList.add('is-scrolling');
        window.dispatchEvent(new Event('scrollbusy'));
      }
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        doc.classList.remove('is-scrolling');
        window.dispatchEvent(new Event('scrollrest'));
      }, 180);
    }, { passive: true });
  }

  /* ---------- Page entrance ---------- */
  const veil = $('.page-veil');
  let fromNav = false;
  try { fromNav = sessionStorage.getItem('orafdev-nav') === '1'; } catch (e) {}
  if (veil && fromNav) {
    try { sessionStorage.removeItem('orafdev-nav'); } catch (e) {}
    veil.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-entering')));
  }
  requestAnimationFrame(() => document.body.classList.add('is-loaded'));

  /* ---------- Config: contacts, links, screenshots ---------- */
  const c = cfg.contact || {};
  const waText = encodeURIComponent(cfg.whatsappMessage || '');
  // Social profiles are used as given; WhatsApp and email are turned into links.
  const urls = {
    ...c,
    whatsapp: c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${waText}` : '',
    email: c.email ? `mailto:${c.email}` : '',
  };
  $$('[data-channel]').forEach(li => {
    const url = urls[li.dataset.channel];
    const a = $('a', li);
    if (url) { a.href = url; if (li.dataset.channel === 'email') a.removeAttribute('target'); }
    else { li.setAttribute('data-missing', ''); a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  });
  $$('[data-wa-link]').forEach(a => {
    if (urls.whatsapp) { a.href = urls.whatsapp; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.href = (root || '') + '#contact'; }
  });
  const projects = cfg.projects || {};
  // Live site: shown only when a real URL exists
  $$('[data-live]').forEach(a => {
    const url = projects[a.dataset.live]?.live;
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false; }
    else { a.removeAttribute('href'); a.hidden = true; }
  });
  // The big email link follows config.js, one letter per span so it can ripple on hover
  $$('[data-email-link]').forEach(a => {
    if (!c.email) { a.hidden = true; return; }
    a.href = `mailto:${c.email}`;
    const text = $('.talk-mail-text', a);
    if (text) {
      a.setAttribute('aria-label', c.email);
      text.setAttribute('aria-hidden', 'true');
      text.innerHTML = [...c.email].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
    }
  });
  // Source code only appears when a repository is public
  $$('[data-source]').forEach(a => {
    const url = projects[a.dataset.source]?.source;
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false; } else a.hidden = true;
  });
  // Verified technologies only
  $$('[data-project]').forEach(el => {
    const tech = projects[el.dataset.project]?.tech || [];
    const line = $('[data-tech]', el);
    if (!line) return;
    if (tech.length) line.textContent = tech.join(', ');
    else if (line.closest('.case-meta')) line.parentElement.hidden = true;
    else line.textContent = '';
  });
  $$('[data-socials]').forEach(ul => { if (!ul.querySelector('li:not([data-missing])')) ul.parentElement.hidden = true; });
  $$('[data-channels]').forEach(ul => { if (!ul.querySelector('li:not([data-missing])')) ul.hidden = true; });

  /* ---------- Theme + language ---------- */
  const I18N = window.I18N || { t: s => s, apply() {}, setAttr: (el, n, v) => el.setAttribute(n, v), lang: 'en' };
  const t = I18N.t;
  const themeBtn = $('[data-theme-toggle]');
  const langBtn = $('[data-lang-toggle]');
  const themeMeta = $('meta[name="theme-color"]');
  const syncTheme = () => {
    const light = doc.dataset.theme === 'light';
    if (themeBtn) I18N.setAttr(themeBtn, 'aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    if (themeMeta) themeMeta.content = light ? '#F4F6FD' : '#050A1F';
  };
  const flipTheme = () => {
    doc.classList.add('theme-switching');
    doc.dataset.theme = doc.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('orafdev-theme', doc.dataset.theme); } catch (e) {}
    syncTheme();
  };
  themeBtn?.addEventListener('click', () => {
    // Ink spread: the new theme bleeds out from the button through an ink-blot mask.
    // Browsers without View Transitions, and reduced-motion users, get the instant switch.
    if (reduced || !document.startViewTransition) {
      flipTheme();
      requestAnimationFrame(() => requestAnimationFrame(() => doc.classList.remove('theme-switching')));
      return;
    }
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.style.setProperty('--ink-x', `${x}px`);
    doc.style.setProperty('--ink-y', `${y}px`);
    doc.style.setProperty('--ink-s', `${Math.ceil(reach / 0.25)}px`); // the ink is solid out to 25% of the image
    doc.classList.add('ink-switch');
    // A glowing rim rides on the ink's edge: its own layer, masked by the same geometry.
    const glow = document.createElement('div');
    glow.className = 'ink-glow';
    glow.setAttribute('aria-hidden', 'true');
    const vt = document.startViewTransition(() => { flipTheme(); document.body.appendChild(glow); });
    vt.ready.then(() => glow.classList.add('is-on')).catch(() => {});
    vt.finished.finally(() => { glow.remove(); doc.classList.remove('ink-switch', 'theme-switching'); });
  });
  const syncLangBtn = () => {
    if (!langBtn) return;
    const ar = I18N.lang === 'ar';
    langBtn.textContent = ar ? 'EN' : 'عربي';
    langBtn.lang = ar ? 'en' : 'ar';
    I18N.setAttr(langBtn, 'aria-label', ar ? 'Switch to English' : 'Switch to Arabic');
  };
  langBtn?.addEventListener('click', () => {
    I18N.apply(I18N.lang === 'ar' ? 'en' : 'ar');
    syncLangBtn(); syncTheme();
    const status = $('.form-status'); if (status) { status.textContent = t(''); status.classList.remove('is-ok'); }
    toggle && I18N.setAttr(toggle, 'aria-label', toggle.getAttribute('aria-expanded') === 'true' ? 'Close menu' : 'Open menu');
  });
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- Navigation ---------- */
  const nav = $('[data-nav]');
  // The scrolled look switches on once the page has moved 24px. It comes from an observer on a 1px marker 24px
  // down the page: reading window.scrollY in every scroll event forced a layout flush while the deck animated.
  if (nav) {
    const mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    mark.style.cssText = 'position:absolute;top:24px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
    document.body.prepend(mark);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => nav.classList.toggle('is-scrolled', !e.isIntersecting)).observe(mark);
    } else {
      const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
      onScrollNav();
      window.addEventListener('scroll', onScrollNav, { passive: true });
    }
  }

  const spyLinks = $$('[data-spy]');
  if (spyLinks.length) {
    const sections = spyLinks.map(a => document.getElementById(a.dataset.spy)).filter(Boolean);
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        spyLinks.forEach(a => a.classList.toggle('is-active', a.dataset.spy === e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- Mobile menu ---------- */
  const toggle = $('.menu-toggle');
  const menu = $('#mobile-menu');
  if (toggle && menu) {
    const setOpen = open => {
      toggle.setAttribute('aria-expanded', String(open));
      I18N.setAttr(toggle, 'aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add('is-open'));
        setTimeout(() => $('nav a', menu)?.focus(), 250);
      } else {
        menu.classList.remove('is-open');
        setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduced ? 0 : 600);
      }
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const sibs = Array.from(e.target.parentElement.children).filter(n => n.classList.contains('reveal'));
        const idx = Math.max(0, sibs.indexOf(e.target));
        e.target.style.setProperty('--d', `${Math.min(idx, 5) * 0.07}s`);
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- Pointer effects (desktop only) ---------- */
  if (finePointer && !reduced) {
    // Tilt with a light that follows the cursor
    $$('[data-tilt]').forEach(card => {
      const max = card.classList.contains('founder') ? 4 : 5;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
        card.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
        card.style.setProperty('--lx', `${x * 100}%`);
        card.style.setProperty('--ly', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
      });
    });

    // Magnetic buttons
    $$('[data-magnetic]').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * 0.18}px`);
        btn.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * 0.28}px`);
      });
      btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', '0px'); btn.style.setProperty('--my', '0px'); });
    });

    // Cursor: dot + trailing ring
    const cursor = $('.cursor');
    if (cursor) {
      document.body.classList.add('has-cursor');
      const dot = $('.cursor-dot', cursor), ring = $('.cursor-ring', cursor);
      let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, ringRaf = 0;
      window.addEventListener('pointermove', e => {
        x = e.clientX; y = e.clientY;
        dot.style.transform = `translate(${x}px, ${y}px)`;
        cursor.classList.remove('is-hidden');
        if (!ringRaf) ringRaf = requestAnimationFrame(loop);
      }, { passive: true });
      document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
      document.addEventListener('pointerover', e => {
        cursor.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt], select, label, .plate'));
      });
      // The ring eases after the pointer and sleeps once it has caught up (it used to run every frame forever,
      // which kept the whole page producing frames on desktop); the next pointer move wakes it.
      function loop() {
        rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
        const settled = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1;
        if (settled) { rx = x; ry = y; }
        ring.style.transform = `translate(${rx}px, ${ry}px)`;
        ringRaf = settled ? 0 : requestAnimationFrame(loop);
      }
      ringRaf = requestAnimationFrame(loop);
    }

    // Hero glow follows cursor
    const hero = $('.hero');
    const glow = $('.hero-glow');
    if (hero && glow) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        glow.style.setProperty('--gx', `${e.clientX - r.left}px`);
        glow.style.setProperty('--gy', `${e.clientY - r.top}px`);
      });
    }

    // Project previews tilt toward the cursor
    $$('[data-tilt-media]').forEach(media => {
      const inner = media.firstElementChild;
      if (!inner) return;
      media.addEventListener('pointermove', e => {
        const r = media.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = `rotateX(${-y * 6}deg) rotateY(${x * 8}deg)`;
      });
      media.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    });
  }

  /* ---------- Project mockups: the desktop layout, zoomed to fit small cards ---------- */
  const fitMocks = () => {
    $$('.mock-rental, .mock-ats').forEach(mock => {
      const media = mock.parentElement;
      if (window.innerWidth > 600) { mock.style.zoom = ''; return; }
      const cs = getComputedStyle(media);
      const room = media.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const natural = mock.classList.contains('mock-ats') ? 800 : 760; // the widths set in styles.css
      mock.style.zoom = Math.min(1, room / natural).toFixed(3);
    });
  };
  fitMocks();
  window.addEventListener('resize', fitMocks);

  const deckCss = () => !reduced && window.matchMedia('(max-width: 900px)').matches && window.CSS && CSS.supports('animation-timeline: scroll()');

  /* ---------- Touch screens: the same motion, driven by scrolling ---------- */
  if (!finePointer && !reduced) {
    document.body.classList.add('has-touch');
    const tilts = $$('[data-tilt]');
    const medias = $$('[data-tilt-media]');
    const deck = $$('.panel');
    const live = [...tilts, ...deck, ...$$('.pillar'), ...$$('.plan')];
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    let queued = false;
    const touchFx = () => {
      queued = false;
      const vh = window.innerHeight;
      // -1 above the middle of the screen .. 0 centred .. 1 below
      const offset = r => clamp(((r.top + r.height / 2) / vh - 0.5) * 2, -1, 1);
      tilts.forEach(card => {
        const r = card.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const d = offset(r);
        card.style.setProperty('--rx', `${(-d * 7).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(d * 3).toFixed(2)}deg`);
        card.style.setProperty('--lx', '50%');
        card.style.setProperty('--ly', `${((1 - d) * 50).toFixed(1)}%`);
      });
      const mediaRects = medias.map(media => media.getBoundingClientRect());
      const liveRects = live.map(el => el.getBoundingClientRect());
      medias.forEach((media, i) => {
        const inner = media.firstElementChild, r = mediaRects[i];
        if (!inner || r.bottom < 0 || r.top > vh) return;
        if (deckCss() && media.closest('.panel')) return; // styles.css tilts the project images (scroll-driven)
        const d = offset(r);
        inner.style.transform = `rotateX(${(-d * 9).toFixed(2)}deg) rotateY(${(d * 6).toFixed(2)}deg)`;
      });
      // the card in the middle of the screen plays its hover animation
      live.forEach((el, i) => {
        const r = liveRects[i];
        el.classList.toggle('is-live', r.top < vh * 0.64 && r.bottom > vh * 0.36);
      });
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(touchFx); } }, { passive: true });
    window.addEventListener('resize', touchFx);
    touchFx();
  }

  /* ---------- Experience counters ---------- */
  $$('[data-count]').forEach(el => {
    const end = Number(el.dataset.count);
    if (reduced || !('IntersectionObserver' in window)) return;
    el.textContent = '0';
    const cio = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      cio.disconnect();
      const t0 = performance.now(), dur = 1600;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 4))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    cio.observe(el);
  });

  /* ---------- Testimonials (real entries from config only) ---------- */
  const voices = $('#testimonials');
  const quotes = (cfg.testimonials || []).filter(q => q && q.quote && q.name);
  if (voices && quotes.length) {
    const track = $('[data-carousel]', voices);
    const dots = $('[data-dots]', voices);
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>';
    track.innerHTML = quotes.map((q, i) => {
      const initials = q.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const who = [q.role, q.company].filter(Boolean).map(esc).join(', ');
      const rating = Math.max(0, Math.min(5, Number(q.rating) || 0));
      return `<figure class="quote" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${quotes.length}" ${q.lang ? `lang="${esc(q.lang)}" dir="${q.lang === 'ar' ? 'rtl' : 'ltr'}"` : ''}>
        <svg class="quote-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M13 8H7a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h3v4l4-4v-9a3 3 0 0 0-1-3Zm15 0h-6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h3v4l4-4v-9a3 3 0 0 0-1-3Z"/></svg>
        ${rating ? `<div class="quote-stars" aria-label="${rating} / 5">${star.repeat(rating)}</div>` : ''}
        <blockquote>${esc(q.quote)}</blockquote>
        <footer>
          <span class="quote-avatar" aria-hidden="true">${q.avatar ? `<img src="${esc(root + q.avatar)}" alt="" loading="lazy">` : esc(initials)}</span>
          <span><span class="quote-name">${esc(q.name)}</span>${who ? `<br><span class="quote-role">${who}</span>` : ''}</span>
          ${q.project ? `<span class="quote-project">${esc(q.project)}</span>` : ''}
        </footer>
      </figure>`;
    }).join('');
    voices.hidden = false;
    const cardsEls = $$('.quote', track);
    dots.innerHTML = cardsEls.map((_, i) => `<button type="button" aria-label="${i + 1}"></button>`).join('');
    const dotBtns = $$('button', dots);
    const prev = $('[data-prev]', voices), next = $('[data-next]', voices);
    const stepSize = () => (cardsEls[1] ? Math.abs(cardsEls[1].offsetLeft - cardsEls[0].offsetLeft) : track.clientWidth);
    const dir = () => (doc.dir === 'rtl' ? -1 : 1);
    const go = d => track.scrollBy({ left: d * dir() * stepSize(), behavior: reduced ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    dotBtns.forEach((b, i) => b.addEventListener('click', () => cardsEls[i].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'start' })));
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(dir()); if (e.key === 'ArrowLeft') go(-dir()); });
    const vis = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('is-dim', e.intersectionRatio < 0.85));
      const firstVisible = cardsEls.findIndex(c => !c.classList.contains('is-dim'));
      dotBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === Math.max(0, firstVisible))));
      const max = track.scrollWidth - track.clientWidth;
      const pos = Math.abs(track.scrollLeft);
      prev.disabled = pos < 4; next.disabled = pos > max - 4;
    }, { root: track, threshold: [0, 0.85, 1] });
    cardsEls.forEach(c => vis.observe(c));
    // Drag to scroll with a mouse; touch uses native swipe
    let dragX = null, startLeft = 0, moved = false;
    track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; dragX = e.clientX; startLeft = track.scrollLeft; moved = false; track.classList.add('is-dragging'); });
    window.addEventListener('pointermove', e => { if (dragX === null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = startLeft - dx; });
    window.addEventListener('pointerup', () => { if (dragX === null) return; dragX = null; track.classList.remove('is-dragging'); if (moved) go(0); });
    // Gentle auto-advance, paused on hover, focus or reduced motion
    if (!reduced && quotes.length > 1) {
      let paused = false;
      ['pointerenter', 'focusin'].forEach(ev => voices.addEventListener(ev, () => { paused = true; }));
      ['pointerleave', 'focusout'].forEach(ev => voices.addEventListener(ev, () => { paused = false; }));
      setInterval(() => {
        if (paused || document.hidden) return;
        const max = track.scrollWidth - track.clientWidth;
        if (Math.abs(track.scrollLeft) >= max - 4) track.scrollTo({ left: 0, behavior: 'smooth' }); else go(1);
      }, 6500);
    }
  }

  /* ---------- Scroll-linked: work deck, system, timeline, CTA ---------- */
  const panels = $$('.panel');
  // each card gets a black layer for the "recede" darkening, and knows its own height so it can stick
  // only once it is fully on screen (styles.css: .panel top, .panel-dim)
  // Explicit stacking order: later cards always paint above earlier ones. Without it some Android GPUs
  // composited a receding (scaled) card above the next card's text while its image stayed on top,
  // so two cards' text showed through each other while scrolling. Desktop never showed it and the order costs
  // it frames, so styles.css applies it at <= 900px only.
  panels.forEach((p, i) => p.style.setProperty('--z', String(i + 1))); // used on phones only (styles.css)
  const dims = panels.map(p => {
    const d = document.createElement('span');
    d.className = 'panel-dim'; d.setAttribute('aria-hidden', 'true');
    p.appendChild(d);
    return d;
  });
  // Project images: lazy loading only starts them near the screen, so on mobile data a fast swipe could bring
  // a card in before its image arrived (a blank card). Once the page has loaded and the phone is idle, fetch
  // and decode them all (about 600 KB) so every card is ready before it slides in.
  const idle = window.requestIdleCallback ? cb => requestIdleCallback(cb, { timeout: 3000 }) : cb => setTimeout(cb, 1500);
  window.addEventListener('load', () => idle(() => {
    $$('.deck img').forEach(img => {
      if (img.loading === 'lazy') img.loading = 'eager';
      if (img.decode) img.decode().catch(() => {});
    });
  }));
  // Phones/tablets: the recede (and the touch tilt) run as scroll-driven CSS animations (styles.css "driven by the
  // browser's own scroll"), in step with the scroll in every browser, Instagram's included. Here we only measure,
  // when the layout changes, the scroll positions where each card's recede and each image's tilt start and end.
  const deckEl = $('.deck');
  const cssRecede = !reduced && !!deckEl && window.CSS && CSS.supports('animation-timeline: scroll()');
  const phoneMQ = window.matchMedia('(max-width: 900px)');
  const cssMode = () => cssRecede && phoneMQ.matches;
  const measureRecede = () => {
    if (!cssMode()) { if (deckEl) deckEl.classList.remove('is-css-recede', 'is-css-tilt'); return; }
    deckEl.classList.add('is-measuring');
    const y = window.scrollY, vh = window.innerHeight;
    const flow = panels.map(p => p.getBoundingClientRect().top + y);
    const tops = panels.map(p => parseFloat(getComputedStyle(p).top) || 0);
    const heights = panels.map(p => p.offsetHeight);
    const medias = panels.map(p => $('.panel-media', p)).map(m => m && { m, top: m.getBoundingClientRect().top + y, h: m.offsetHeight });
    deckEl.classList.remove('is-measuring');
    panels.forEach((p, i) => {
      if (i < panels.length - 1) {
        // same rule as the scroll handler: the recede runs while the next card's top travels the height of this card
        const r1 = flow[i + 1] - tops[i];
        p.style.setProperty('--r0', `${(r1 - heights[i]).toFixed(1)}px`);
        p.style.setProperty('--r1', `${r1.toFixed(1)}px`);
        // fully covered once the next card has reached this card's top and is at least as tall as this (scaled) card
        const covers = tops[i + 1] <= tops[i] + 1 && tops[i + 1] + heights[i + 1] >= tops[i] + heights[i] * 0.94 - 1;
        p.style.setProperty('--h0', covers ? `${(r1 + 2).toFixed(1)}px` : '99999px');
        p.style.setProperty('--h1', covers ? `${(r1 + 3).toFixed(1)}px` : '100000px');
      }
      const md = medias[i];
      if (md && !finePointer) {
        const t0 = md.top + md.h / 2 - vh;               // image centre at the bottom of the screen: full tilt
        const t1 = Math.max(t0 + 1, flow[i] - tops[i]);  // the card sticks: the tilt holds from here
        const d1 = Math.min(1, Math.max(-1, ((tops[i] + (md.top - flow[i]) + md.h / 2) / vh - 0.5) * 2));
        md.m.style.setProperty('--t0', `${t0.toFixed(1)}px`);
        md.m.style.setProperty('--t1', `${t1.toFixed(1)}px`);
        md.m.style.setProperty('--d1', d1.toFixed(3));
      }
    });
    deckEl.classList.add('is-css-recede');
    deckEl.classList.toggle('is-css-tilt', !finePointer);
    panels.forEach((p, i) => { p.style.transform = ''; dims[i].style.opacity = ''; p.classList.remove('is-covered'); });
  };
  const measureCards = () => { panels.forEach(p => p.style.setProperty('--card-h', `${p.offsetHeight}px`)); measureRecede(); };
  measureCards();
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measureCards); panels.forEach(p => ro.observe(p)); }
  window.addEventListener('load', measureCards);
  const system = $('[data-system]');
  const systemFill = $('.system-fill');
  const stages = $$('[data-stage]');
  const timeline = $('[data-timeline]');
  const steps = $$('.tl-step');
  const fill = $('.tl-fill');
  const ctaCore = $('.cta-core');
  const cta = $('.cta');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const vh = window.innerHeight;
    // Each project panel recedes as the next one slides over it
    const stacking = !reduced;
    const dimMax = doc.dataset.theme === 'light' ? 0.06 : 0.35;
    const css = cssMode();
    const rects = panels.map(p => p.getBoundingClientRect()); // read everything first, then write
    panels.forEach((p, i) => {
      const pr = rects[i], nr = rects[i + 1];
      if (css) { p.classList.toggle('is-current', pr.top < vh * 0.6 && pr.bottom > vh * 0.3); return; } // CSS runs the recede
      const s = stacking && nr ? Math.min(1, Math.max(0, 1 - (nr.top - pr.top) / pr.height)) : 0;
      p.style.transform = s ? `scale(${(1 - s * 0.06).toFixed(4)})` : '';
      dims[i].style.opacity = s ? (s * dimMax).toFixed(3) : '0';
      p.classList.toggle('is-current', pr.top < vh * 0.6 && pr.bottom > vh * 0.3);
      // A card that a later card covers completely is invisible: stop drawing it (phones were compositing
      // every card of the stack on every frame). A strip that still shows below a shorter card keeps it drawn.
      const covered = rects.some((r, k) => k > i && r.top <= pr.top + 1 && r.bottom >= pr.bottom - 1 && r.left <= pr.left + 1 && r.right >= pr.right - 1);
      if (covered !== p.classList.contains('is-covered')) p.classList.toggle('is-covered', covered);
    });
    if (system && systemFill) {
      const r = system.getBoundingClientRect();
      const p = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.25)));
      systemFill.style.setProperty('--p', p.toFixed(4));
      stages.forEach((s, i) => s.classList.toggle('is-on', reduced || p >= (i / (stages.length - 1)) * 0.92));
    }
    if (timeline && fill) {
      const r = timeline.getBoundingClientRect();
      const p = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.6 - r.top) / r.height));
      fill.parentElement.style.setProperty('--p', p.toFixed(4));
      fill.style.setProperty('--p', p.toFixed(4));
      const line = r.top + p * r.height;
      steps.forEach(s => {
        const sr = s.getBoundingClientRect();
        s.classList.toggle('is-active', reduced || sr.top + 40 <= line);
      });
    }
    if (cta && ctaCore && !reduced) {
      const r = cta.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.top + r.height / 2 - vh / 2) / vh));
      ctaCore.style.setProperty('--core', (0.5 + p * 0.9).toFixed(3));
    }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('resize', measureCards);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureCards);
  new MutationObserver(onScroll).observe(doc, { attributes: true, attributeFilter: ['data-theme'] }); // the dim strength differs per theme
  onScroll();

  /* ---------- Technology stack ---------- */
  const plates = $$('.plate');
  const rows = $$('[data-tech-list] > div');
  if (plates.length) {
    let current = 0, auto = null, userTouched = false;
    const activate = i => {
      current = i;
      plates.forEach(p => p.classList.toggle('is-active', Number(p.dataset.layer) === i));
      rows.forEach(r => r.classList.toggle('is-active', Number(r.dataset.layer) === i));
    };
    const stop = () => { userTouched = true; clearInterval(auto); };
    [...plates, ...rows].forEach(el => {
      el.addEventListener('pointerenter', () => { stop(); activate(Number(el.dataset.layer)); });
      el.addEventListener('click', () => { stop(); activate(Number(el.dataset.layer)); });
    });
    rows.forEach(r => { r.tabIndex = 0; r.addEventListener('focus', () => { stop(); activate(Number(r.dataset.layer)); }); });
    activate(0);
    if (!reduced) {
      const tio = new IntersectionObserver(([e]) => {
        clearInterval(auto);
        if (e.isIntersecting && !userTouched) auto = setInterval(() => activate((current + 1) % plates.length), 2200);
      }, { threshold: 0.3 });
      tio.observe($('.stack-viz'));
    }
  }

  /* ---------- Pricing → contact form preselect ---------- */
  $$('[data-plan]').forEach(a => a.addEventListener('click', () => {
    const sel = $('#f-type'); if (sel) sel.value = a.dataset.plan;
  }));

  /* ---------- Contact form ---------- */
  const form = $('[data-form]');
  if (form) {
    const status = $('.form-status', form);
    const required = ['name', 'email', 'type', 'details'];
    const validate = name => {
      const el = form.elements[name];
      const v = el.value.trim();
      const ok = name === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : v.length > 0;
      const field = el.closest('.field');
      field.classList.toggle('has-error', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      if (!ok) el.setAttribute('aria-describedby', `e-${name}`); else el.removeAttribute('aria-describedby');
      return ok;
    };
    required.forEach(n => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value) validate(n); }));
    required.forEach(n => form.elements[n].addEventListener('input', () => { if (form.elements[n].closest('.has-error')) validate(n); }));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const bad = required.filter(n => !validate(n));
      if (bad.length) { form.elements[bad[0]].focus(); status.textContent = t('Some details are missing. Check the highlighted fields.'); status.classList.remove('is-ok'); return; }
      const d = Object.fromEntries(new FormData(form));
      const lines = [
        'New project request',
        `Name: ${d.name}`,
        d.business ? `Business: ${d.business}` : null,
        `Email: ${d.email}`,
        d.phone ? `WhatsApp / phone: ${d.phone}` : null,
        `Project type: ${d.type}`,
        `Budget: ${d.budget || 'Not sure yet'}`,
        d.timeline ? `Timeline: ${d.timeline}` : null,
        '', d.details,
      ].filter(v => v !== null).join('\n');
      const btn = $('button[type="submit"]', form);

      if (cfg.formEndpoint) {
        btn.setAttribute('aria-disabled', 'true'); status.textContent = t('Sending your request…');
        try {
          const res = await fetch(cfg.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) });
          if (!res.ok) throw new Error();
          form.reset(); status.textContent = t("Project request sent. We'll reply by email or WhatsApp."); status.classList.add('is-ok');
        } catch {
          status.textContent = t('The request did not send. Check your connection and try again, or message us on WhatsApp.');
        } finally { btn.removeAttribute('aria-disabled'); }
      } else if (urls.whatsapp) {
        window.open(`https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lines)}`, '_blank', 'noopener');
        status.textContent = t('WhatsApp opened with your request written out. Press send there to deliver it.'); status.classList.add('is-ok');
      } else if (urls.email) {
        location.href = `mailto:${c.email}?subject=${encodeURIComponent('Project request: ' + d.type)}&body=${encodeURIComponent(lines)}`;
        status.textContent = t('Your email app opened with the request written out. Press send there to deliver it.'); status.classList.add('is-ok');
      } else {
        status.textContent = t('Sending is not set up yet. Please reach us through another channel.');
        console.warn('Orafdev: add a WhatsApp number, email or formEndpoint in assets/js/config.js to enable the contact form.');
      }
    });
  }

  /* ---------- Page transitions between pages ---------- */
  if (veil && !reduced) {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      if (url.pathname === location.pathname && !url.hash) return;
      e.preventDefault();
      try { sessionStorage.setItem('orafdev-nav', '1'); } catch (err) {}
      veil.classList.add('is-active');
      setTimeout(() => { location.href = url.href; }, 420);
    });
    window.addEventListener('pageshow', ev => { if (ev.persisted) veil.classList.remove('is-active'); });
  }

  /* ---------- WhatsApp float ---------- */
  const wa = $('.wa-float');
  if (wa) setTimeout(() => wa.classList.add('is-visible'), reduced ? 0 : 1600);

  /* ---------- Phone contact bar: after the hero, hidden while the form is on screen ---------- */
  const mcta = $('[data-mcta]');
  if (mcta) {
    const heroEl = $('.hero');
    const contactEl = $('#contact');
    let contactOnScreen = false;
    if (contactEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { contactOnScreen = e.isIntersecting; syncBar(); }, { threshold: 0.12 }).observe(contactEl);
    }
    // Shown once the visitor is past 55% of the hero (less than 45% of it still on screen), hidden over the
    // contact section. Both come from observers; reading scrollY and offsetHeight per scroll event forced layout.
    let heroPast = false;
    function syncBar() { mcta.classList.toggle('is-visible', heroPast && !contactOnScreen); }
    if (heroEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { heroPast = e.intersectionRatio < 0.45; syncBar(); }, { threshold: [0, 0.45] }).observe(heroEl);
    } else {
      const onScrollBar = () => { heroPast = window.scrollY > (heroEl ? heroEl.offsetHeight * 0.55 : 400); syncBar(); };
      window.addEventListener('scroll', onScrollBar, { passive: true });
      onScrollBar();
    }
  }

  /* ---------- Off-screen animations sleep ----------
     Endless CSS animations (button light, pulses, orbits, ribbon, hero glows) keep running in
     sections the visitor has already scrolled past, and while the 3D silk redraws every frame the
     browser restyles and repaints every one of them, every frame. That was most of the phone lag in
     the projects section. Pause the ones that are off screen and wake them a little before they
     scroll back in: whatever is on screen looks and moves exactly as before. */
  if ('IntersectionObserver' in window && document.getAnimations) {
    const watched = new WeakSet();
    const sleeper = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('fx-paused', !e.isIntersecting));
    }, { rootMargin: '30% 0px' });
    const scanAnimations = () => {
      document.getAnimations().forEach(a => {
        const el = a.effect && a.effect.target;
        if (!el || watched.has(el) || typeof CSSAnimation === 'undefined' || !(a instanceof CSSAnimation)) return;
        if (a.effect.getTiming().iterations !== Infinity) return; // one-off entrances are left alone
        watched.add(el);
        sleeper.observe(el);
      });
    };
    scanAnimations();
    window.addEventListener('load', () => setTimeout(scanAnimations, 800));
  }

  /* ---------- Initial language + theme state ---------- */
  if (doc.lang === 'ar') I18N.apply('ar');
  syncLangBtn();
  syncTheme();
})();
