const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Re-measure scroll positions after layout changes, but never in the middle of a menu glide:
// ScrollTrigger.refresh() briefly jumps to the top of the page, which would cut the glide short.
let gliding = false;
let pendingRefresh = false;
let refreshTimer;
function refreshSoon() {
  if (!hasGsap) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (gliding) pendingRefresh = true;
    else ScrollTrigger.refresh();
  }, 200);
}

/* Called by render.js once the page has been built from config.json */
function initSite(config) {
  splitChars();
  addDecor();
  updateDaysLeft(config);
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    setupHeroScroll();            // first, so its pinned space is counted before the sections below
    setupScrollAnimations();
  }
  startIntro();
  setupColorCopy();
  setupHashtagCopy();
  setupFaqSearch();
  // without motion the car simply waits at the reception; keep it on the road when the layout changes
  if (!hasGsap || reduceMotion) placeCar(1);
  addEventListener('resize', () => {
    const road = $('.journey__road');
    if (road) placeCar(+(road.dataset.progress || 1));
  });
  setupProgramClock(config);
  setupNavigation();
  setupPointerEffects();
  if (!reduceMotion) startPetals();
  setupRsvpConfetti();
  startCountdown(config);
  setupAddToCalendar(config);
  setupLightbox();
}

/* ---------- Split the hero names into animatable characters ---------- */
function splitChars() {
  $$('.split-chars:not([data-split])').forEach((el) => {
    el.dataset.split = '';
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((ch) => {
      const wrap = document.createElement('span');
      const char = document.createElement('span');
      wrap.className = 'char-wrap';
      char.className = 'char';
      char.textContent = ch === ' ' ? ' ' : ch;
      wrap.appendChild(char);
      el.appendChild(wrap);
    });
  });
}

/* ---------- Decorations from the logo: baby's-breath sprigs, rust dotted arcs, blush glows ---------- */
// Added to every content section; each piece drifts at its own speed as you scroll (parallax).
function sprigSvg() {
  const stems = 'M60 200C58 150 62 110 56 60M58 150C40 135 30 120 24 104M59 120C76 106 86 92 92 76M57 92C44 80 38 66 36 50M57 75C66 60 72 46 74 30M56 60C54 45 55 30 58 16';
  const blooms = [[24, 104], [16, 93], [31, 92], [92, 76], [101, 66], [86, 63], [36, 50], [27, 40], [43, 37], [74, 30], [83, 21], [68, 19], [58, 16], [50, 7], [65, 5]];
  return `<svg viewBox="0 0 120 210"><path class="sprig__stem" d="${stems}"/>${blooms.map(([x, y], i) =>
    `<circle class="sprig__bloom" cx="${x}" cy="${y}" r="${6 + (i % 3)}"/><circle class="sprig__dot" cx="${x + 0.6}" cy="${y + 0.8}" r="1.5"/>`).join('')}</svg>`;
}
function dotArcSvg() {
  let dots = '';
  [[84, 15], [68, 12]].forEach(([r, n], row) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      dots += `<circle cx="${(100 + Math.cos(a) * r).toFixed(1)}" cy="${(96 + Math.sin(a) * r).toFixed(1)}" r="${row ? 3.4 : 4}"/>`;
    }
  });
  return `<svg viewBox="0 0 200 104">${dots}</svg>`;
}
function addDecor() {
  $$('#main > .section').forEach((section, i) => {
    if ($('.deco', section)) return;
    const flip = i % 2 === 1;
    const deco = document.createElement('div');
    deco.className = `deco ${flip ? 'deco--b' : 'deco--a'}`;
    deco.setAttribute('aria-hidden', 'true');
    deco.innerHTML = `
      <span class="deco__glow" data-speed="-0.35"></span>
      <span class="deco__sprig deco__sprig--1" data-speed="0.3"><span class="sprig">${sprigSvg()}</span></span>
      <span class="deco__sprig deco__sprig--2" data-speed="0.55"><span class="sprig">${sprigSvg()}</span></span>
      <span class="deco__arc" data-speed="0.18">${dotArcSvg()}</span>`;
    section.prepend(deco);
  });
}

/* ---------- Opening: the envelope ---------- */
let heroIntroTimeline = null;
let markHeroReady;
const heroReady = new Promise((resolve) => { markHeroReady = resolve; });

// gold dust that drifts around the envelope, plus one-off bursts (wax crumbs, petals)
function introParticles(canvas) {
  const ctx = canvas.getContext('2d');
  const gold = ['#dfa98a', '#cc9173', '#f4d9c6'];
  const wax = ['#9a2f1c', '#b8432a', '#7d2414'];
  const petals = ['#f4d6c3', '#e8b7a0', '#f3d6c2', '#ffffff', '#d7c3aa'];
  const parts = [];
  let w = 0, h = 0, raf = 0, alive = true;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const dust = (anywhere) => ({
    kind: 'dust', x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
    r: 0.6 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.15, vy: -(0.15 + Math.random() * 0.45),
    t: Math.random() * 6.28, color: gold[(Math.random() * gold.length) | 0],
  });
  resize();
  addEventListener('resize', resize);
  for (let i = 0; i < 46; i++) parts.push(dust(true));

  function burst(x, y, type) {
    const isWax = type === 'wax';
    for (let i = 0; i < (isWax ? 26 : 70); i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = isWax ? 2 + Math.random() * 5 : 4 + Math.random() * 11;
      parts.push({
        kind: type, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - (isWax ? 2 : 0),
        r: isWax ? 1.5 + Math.random() * 3 : 5 + Math.random() * 7,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 0,
        max: isWax ? 70 : 90 + Math.random() * 40,
        color: (isWax ? wax : petals)[i % (isWax ? wax.length : petals.length)],
      });
    }
  }

  (function frame() {
    ctx.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.kind === 'dust') {
        p.t += 0.03; p.x += p.vx + Math.sin(p.t) * 0.2; p.y += p.vy;
        if (p.y < -10) Object.assign(p, dust(false));
        ctx.globalAlpha = Math.max(0, 0.35 + Math.sin(p.t * 2) * 0.3);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        continue;
      }
      if (++p.life > p.max) { parts.splice(i, 1); continue; }
      if (p.kind === 'wax') { p.vy += 0.35; p.vx *= 0.98; } else { p.vx *= 0.955; p.vy = p.vy * 0.955 + 0.08; }
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === 'wax') {
        ctx.moveTo(-p.r, -p.r * 0.6); ctx.lineTo(p.r, -p.r * 0.3); ctx.lineTo(p.r * 0.4, p.r);
      } else {
        ctx.moveTo(0, -p.r);
        ctx.bezierCurveTo(p.r, -p.r * 0.6, p.r * 0.7, p.r * 0.7, 0, p.r);
        ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r, -p.r * 0.6, 0, -p.r);
      }
      ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (alive) raf = requestAnimationFrame(frame);
  })();

  return { burst, stop() { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); } };
}

function startIntro() {
  const intro = $('.intro');
  let finished = false;
  let particles = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (particles) particles.stop();
    document.documentElement.classList.remove('is-loading');
    intro.remove();
  };

  if (!hasGsap || reduceMotion) {
    finish();
    playHeroIntro();
    return;
  }

  const stage = $('.intro__stage', intro);
  const envelope = $('.envelope', intro);
  const card = $('.envelope__card', intro);
  const flap = $('.envelope__flap', intro);
  const seal = $('.envelope__seal', intro);
  const body = $$('.envelope__back, .envelope__pocket, .envelope__flap, .envelope__shadow', intro);
  const cardBox = () => card.getBoundingClientRect();
  const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  particles = introParticles($('.intro__particles', intro));

  // the envelope leans gently toward the mouse
  let tilting = finePointer;
  if (tilting) {
    const turnY = gsap.quickTo(stage, 'rotationY', { duration: 0.9, ease: 'power3' });
    const turnX = gsap.quickTo(stage, 'rotationX', { duration: 0.9, ease: 'power3' });
    intro.addEventListener('pointermove', (e) => {
      if (!tilting) return;
      turnY((e.clientX / innerWidth - 0.5) * 18);
      turnX((e.clientY / innerHeight - 0.5) * -12);
    });
  }

  // 1. it arrives: floats in, the seal is stamped down, the address writes itself
  const arrive = gsap.timeline({ paused: true })
    .from(envelope, { y: 160, rotationX: 45, scale: 0.8, opacity: 0, duration: 1.2, ease: 'expo.out' })
    .from(seal, { scale: 2.4, opacity: 0, duration: 0.45, ease: 'power4.in' }, 0.5)
    .from('.envelope__flower', { scale: 0, rotate: -90, duration: 0.7, ease: 'back.out(2)' }, 0.9)
    .from('.envelope__to', { clipPath: 'inset(-30% 100% -30% 0)', duration: 1, ease: 'power2.inOut' }, 0.75)
    .from('.intro__hint', { opacity: 0, y: 12, duration: 0.5 }, 1.2);
  const bob = gsap.to(envelope, { y: -10, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });

  // 2. it opens: the seal glows and cracks, the flap swings back, the card rises and becomes the page
  const open = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } })
    .add(() => { bob.kill(); tilting = false; })
    .to(stage, { rotationX: 0, rotationY: 0, duration: 0.6, ease: 'power2.out' }, 0)
    .to(envelope, { y: 0, duration: 0.3, ease: 'power2.out' }, 0)
    .to('.intro__hint', { opacity: 0, y: 10, duration: 0.3 }, 0)
    .to(seal, { scale: 1.14, filter: 'drop-shadow(0 0 18px rgba(255, 196, 140, .95))', duration: 0.3, ease: 'power2.out' }, 0)
    .add(() => particles.burst(...centre(seal), 'wax'), 0.32)
    .to('.seal-half--left', { x: -18, y: 70, rotate: -32, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.32)
    .to('.seal-half--right', { x: 18, y: 78, rotate: 30, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.32)
    .to('.envelope__flower', { x: -30, y: 110, rotate: -80, opacity: 0, duration: 0.9, ease: 'power2.in' }, 0.32)
    // the flap swings up in two halves; at the halfway point (edge-on) it turns to show its liner
    .set(flap, { transformPerspective: 900 }, 0)
    .to(flap, { rotationX: 90, duration: 0.45, ease: 'power2.in' }, 0.6)
    .set('.envelope__flap-face--out', { visibility: 'hidden' }, 1.05)
    .set('.envelope__flap-face--in', { visibility: 'visible' }, 1.05)
    .set(flap, { zIndex: 0 }, 1.05)
    .to(flap, { rotationX: 180, duration: 0.45, ease: 'power2.out' }, 1.05)
    .to(envelope, { rotationX: 8, duration: 0.9 }, 0.6)
    .to(card, { yPercent: -62, duration: 0.85, ease: 'power3.out' }, 1.35)
    .to(envelope, { rotationX: 0, duration: 0.6 }, 1.35)
    .set(card, { zIndex: 6 }, 2.1)
    .to(body, { y: 240, opacity: 0, duration: 0.6, ease: 'power2.in' }, 2.2)
    .to(card, {
      x: () => innerWidth / 2 - (cardBox().left + cardBox().width / 2),
      y: () => innerHeight / 2 - (cardBox().top + cardBox().height / 2),
      scale: () => Math.max(innerWidth / cardBox().width, innerHeight / cardBox().height) * 1.1,
      borderRadius: 0,
      duration: 0.9,
      ease: 'power3.in',
    }, 2.3)
    .to('.envelope__card-inner', { opacity: 0, duration: 0.3 }, 2.45)
    .add(() => particles.burst(innerWidth / 2, innerHeight / 2, 'petals'), 2.95)
    .add(playHeroIntro, 3.05)
    .to(intro, { opacity: 0, duration: 0.6, onComplete: finish }, 3.2);

  let opened = false;
  let autoOpen = null;
  const openNow = () => {
    clearTimeout(autoOpen);
    if (opened) {                                    // a later tap hurries it along (not one that lands as it starts)
      if (open.time() > 0.8) open.timeScale(2.2);
      return;
    }
    opened = true;
    if (arrive.isActive()) arrive.progress(1);
    open.play();
  };
  arrive.eventCallback('onComplete', () => {
    if (opened) return;
    bob.play();
    autoOpen = setTimeout(openNow, 1200);          // opens by itself if nobody taps
  });
  intro.addEventListener('pointerdown', openNow);
  addEventListener('keydown', openNow, { once: true });

  // start once the fonts are in, so the card's lettering is right from the first frame
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 2500))]).then(() => arrive.play());

  // never leave anyone stuck behind the envelope
  setTimeout(() => { if (!finished) { open.progress(1); finish(); } }, 14000);
}

/* ---------- Program: the clock follows the moment in the middle of the screen ---------- */
function setupProgramClock() {
  const clock = $('[data-clock]');
  const moments = $$('[data-moment]');
  if (!clock || !moments.length) return;
  const hour = $('.clock__hand--hour', clock);
  const minute = $('.clock__hand--minute', clock);
  const icon = $('.clock__icon svg', clock);
  const caption = $('.clock__caption');
  const program = $('.program');
  const first = +moments[0].dataset.minutes;
  // sky colours from midday to golden evening
  const skies = [['#9cc6d8', '#f3e2c4'], ['#a9c9d2', '#f5dcb8'], ['#c9b8a6', '#f6c99a'], ['#e0a27a', '#f3b27e'], ['#c97a5e', '#e8a074']];
  let current = -1;

  function show(i) {
    if (i === current) return;
    current = i;
    const m = moments[i];
    const mins = +m.dataset.minutes;
    // angles keep counting up from the first event, so the minute hand sweeps forward round the dial
    const elapsed = mins - first;
    const startHour = (first / 60) % 12;
    hour.style.transform = `rotate(${(startHour * 30) + elapsed * 0.5}deg)`;
    minute.style.transform = `rotate(${(first % 60) * 6 + elapsed * 6}deg)`;
    icon.innerHTML = ICONS[m.dataset.icon] || ICONS.heart;
    $('.clock__time', caption).textContent = m.dataset.time;
    $('.clock__name', caption).textContent = m.dataset.name;
    caption.classList.remove('is-changing'); void caption.offsetWidth; caption.classList.add('is-changing');
    const sky = skies[Math.min(skies.length - 1, Math.max(0, Math.floor((mins - 12 * 60) / 60)))];
    clock.style.setProperty('--sky-top', sky[0]);
    clock.style.setProperty('--sky-bottom', sky[1]);
    moments.forEach((el, j) => el.classList.toggle('is-active', j === i));
    $$('.clock__steps i').forEach((dot, j) => { dot.classList.toggle('is-on', j === i); dot.classList.toggle('is-done', j < i); });
  }

  show(0);
  // whichever moment crosses the middle of the screen becomes the current one
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) show(moments.indexOf(e.target)); });
  }, { rootMargin: '-48% 0px -48% 0px' });
  moments.forEach((m) => watcher.observe(m));
}

/* ---------- FAQ: live search that filters the questions and highlights the words ---------- */
function setupFaqSearch() {
  const input = $('[data-faq-search]');
  if (!input) return;
  const items = $$('.qa');
  const empty = $('.faq__empty');
  const plain = items.map((qa) => $('.qa__text', qa).textContent);
  const answers = items.map((qa) => $('.qa__a', qa).textContent.toLowerCase());
  const escHtml = (t) => t.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  input.addEventListener('input', () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((qa, i) => {
      const text = plain[i];
      const hay = text.toLowerCase() + ' ' + answers[i];
      const match = words.every((w) => hay.includes(w));
      qa.hidden = !match;
      if (match) shown++;
      const label = $('.qa__text', qa);
      label.innerHTML = words.length
        ? escHtml(text).replace(new RegExp(`(${words.map((w) => escRe(escHtml(w))).join('|')})`, 'gi'), '<mark>$1</mark>')
        : escHtml(text);
    });
    empty.hidden = shown > 0;
    // with a single match, open it straight away
    const visible = items.filter((qa) => !qa.hidden);
    if (words.length && visible.length === 1) visible[0].open = true;
  });
}

/* ---------- Photo guide: copy the hashtag, and a live photo wall on the phone ---------- */
function setupHashtagCopy() {
  $$('[data-copy-tag]').forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copyTag); btn.textContent = btn.dataset.copied; }
      catch (e) { btn.textContent = btn.dataset.copyTag; }
      setTimeout(() => { btn.textContent = label; }, 2000);
    });
  });
}

function startLiveFeed(sources) {
  const feed = $('[data-live-feed]');
  if (!feed || !sources.length) return;
  const thumb = (src) => src.replace(/([^/]+)$/, 'thumbs/$1');
  const tile = (src, isNew) => {
    const t = document.createElement('span');
    t.className = 'live__tile' + (isNew ? ' is-new' : '');
    const img = new Image();
    img.alt = ''; img.loading = 'lazy'; img.src = thumb(src);
    img.onerror = () => { img.onerror = null; img.src = src; };
    t.appendChild(img);
    return t;
  };
  let next = 0;
  for (let i = 0; i < 7; i++) feed.appendChild(tile(sources[next++ % sources.length], false));
  if (reduceMotion) return;
  let timer = null;
  const tick = () => {
    feed.prepend(tile(sources[next++ % sources.length], true));
    while (feed.children.length > 7) feed.lastElementChild.remove();
  };
  new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    if (entry.isIntersecting) timer = setInterval(tick, 2600);
  }).observe(feed);
}

/* ---------- Finer details: tap a paint chip to copy its colour code ---------- */
function setupColorCopy() {
  const status = $('.fan__status');
  let timer;
  $$('[data-copy]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const hex = chip.dataset.copy;
      try {
        await navigator.clipboard.writeText(hex);
        if (status) status.textContent = `${hex} copied`;
      } catch (e) {
        if (status) status.textContent = hex;       // clipboard blocked: at least show the code
      }
      clearTimeout(timer);
      timer = setTimeout(() => { if (status) status.textContent = ''; }, 2200);
      if (!reduceMotion && hasGsap) gsap.fromTo(chip, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', clearProps: 'transform' });
    });
  });
}

/* ---------- Details: put the little car on the road between the venues ---------- */
// progress 0 = at the ceremony, 1 = arrived at the reception
function placeCar(progress) {
  const road = $('.journey__road');
  if (!road) return;
  road.dataset.progress = progress;
  const svg = $$('.journey__svg', road).find((s) => s.getBoundingClientRect().width > 0);   // the across or down version
  if (!svg) return;
  const path = $('.journey__trail', svg);
  const length = path.getTotalLength();
  const ctm = svg.getScreenCTM();
  const box = road.getBoundingClientRect();
  const at = (l) => {
    const pt = path.getPointAtLength(Math.max(0, Math.min(length, l))).matrixTransform(ctm);
    return [pt.x - box.left, pt.y - box.top];
  };
  const [x, y] = at(length * progress);
  const [x0, y0] = at(length * progress - 2);
  const [x1, y1] = at(length * progress + 2);
  let angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  if (svg.classList.contains('journey__svg--down')) angle -= 90;          // keep the car upright on the vertical road
  angle = Math.max(-30, Math.min(30, angle));
  $('.journey__car', road).style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
  $$('.journey__trail', road).forEach((trail) => { trail.style.strokeDashoffset = 1 - progress; });
}

/* ---------- The hero draws itself in ---------- */
function playHeroIntro() {
  if (!hasGsap || reduceMotion) { markHeroReady(); return; }
  heroIntroTimeline = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: markHeroReady })
    .fromTo('.arch__line path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, 0)
    .from('.arch__sketch', { opacity: 0, filter: 'blur(8px)', duration: 1.8, ease: 'power2.out', clearProps: 'filter' }, 0.5)
    .from('.arch__decor', { opacity: 0, scale: 0.96, duration: 1.6 }, 0.9)
    .from('.hero__welcome', { y: 20, opacity: 0, duration: 1 }, 0.3)
    .from('.hero__name--first .char', { yPercent: 115, duration: 1.2, stagger: 0.07 }, 0.5)
    .from('.hero__name--second .char', { yPercent: 115, duration: 1.2, stagger: 0.07 }, 0.65)
    .from('.hero__amp', { scale: 0.4, rotate: -14, opacity: 0, duration: 1.4, ease: 'elastic.out(1, 0.6)' }, 1)
    .from('.hero__date, .hero__countdown, .hero__cta', { y: 24, opacity: 0, duration: 1, stagger: 0.12 }, 1.2)
    .fromTo('.hero__arrow path', { strokeDashoffset: 160 }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }, 1.7)
    .from('.scroll-cue', { opacity: 0, duration: 1 }, 1.9);
}

/* ---------- "203 days to go" ---------- */
function updateDaysLeft(config) {
  const text = config.hero.countdown || {};
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(new Date(config.wedding.dateTime)) - day(new Date())) / 86400000);
  const label = days > 1 ? (text.days || '{days} days to go').replace('{days}', days)
    : days === 1 ? text.oneDay : days === 0 ? text.today : text.after;
  // the hero and the phone menu both show it
  $$('[data-days-left]').forEach((el) => { el.textContent = label; });
}

/* ---------- Photos inside the arch, revealed like ink spreading through paper ---------- */
let archShow = null;

function startArchPhotos(config, photos) {
  if (!photos.length) return;            // no photos: the sketch simply stays
  archShow = createArchSlideshow(photos.map((p) => p.src), config.hero.secondsPerPhoto || 5);
  heroReady.then(() => (reduceMotion ? archShow.showNow(0) : archShow.start()));
}

// A soft cloudy noise field (0..1); thresholding it over time looks like ink bleeding outward
function cloudNoise(w, h) {
  const out = new Float32Array(w * h);
  let amp = 1;
  for (const cells of [3, 6, 12, 24]) {
    const gw = cells + 2;
    const gh = Math.ceil((cells * h) / w) + 2;
    const grid = Float32Array.from({ length: gw * gh }, () => Math.random());
    const at = (i, j) => grid[j * gw + i];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * cells;
        const gy = (y / w) * cells;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * w + x] += (top + (bottom - top) * sy) * amp;
      }
    }
    amp *= 0.5;
  }
  let min = Infinity, max = -Infinity;
  for (const v of out) { if (v < min) min = v; if (v > max) max = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
  return out;
}

function createArchSlideshow(sources, seconds) {
  const win = $('.arch__window');
  const still = $('.arch__still', win);
  const canvas = $('.arch__ink', win);
  const ctx = canvas.getContext('2d');
  const images = sources.map((src) => Object.assign(new Image(), { decoding: 'async', src }));

  const MW = 72, MH = 90;                       // the mask is tiny; scaling it up softens the edges
  const mask = Object.assign(document.createElement('canvas'), { width: MW, height: MH });
  const mctx = mask.getContext('2d');
  const maskData = mctx.createImageData(MW, MH);
  const noise = cloudNoise(MW, MH);

  let index = -1;
  let timer = null;
  let paused = false;

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(win.offsetWidth * dpr);
    canvas.height = Math.round(win.offsetHeight * dpr);
  }

  function drawCover(img) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function paintMask(t, field) {
    const soft = 0.22;
    const edge = t * (1 + soft);
    const d = maskData.data;
    for (let i = 0; i < field.length; i++) {
      d[i * 4 + 3] = Math.min(1, Math.max(0, (edge - field[i]) / soft)) * 255;
    }
    mctx.putImageData(maskData, 0, 0);
  }

  async function show(next) {
    const img = images[next];
    try { await img.decode(); } catch (e) { /* a broken photo is skipped */ }
    if (!img.naturalWidth) { index = next; schedule(); return; }
    fit();

    // each change blooms from a different spot
    const cx = 0.25 + Math.random() * 0.5, cy = 0.3 + Math.random() * 0.45;
    const field = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const dist = Math.min(1, Math.hypot(x / MW - cx, (y / MH - cy) * 1.25) / 0.75);
        field[y * MW + x] = noise[y * MW + x] * 0.55 + dist * 0.45;
      }
    }

    const duration = 2200;
    const start = performance.now();
    await new Promise((resolve) => {
      requestAnimationFrame(function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const t = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        paintMask(t, field);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(img);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      });
    });

    // hand the finished picture to a plain <img> (stays sharp when the arch zooms) and clear the canvas
    still.src = img.src;
    still.hidden = false;
    try { await still.decode(); } catch (e) { /* already shown */ }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    index = next;
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (index >= 0 && images.length < 2) return;      // a single photo just stays
    timer = setTimeout(() => {
      if (paused || document.hidden) { schedule(); return; }
      show((index + 1) % images.length);
    }, index < 0 ? 1400 : seconds * 1000);
  }

  return {
    start: schedule,
    pause() { paused = true; },
    resume() { paused = false; },
    // used when there is no time for the ink effect (reduced motion, or scrolling away early)
    showNow(i = 0) {
      if (index >= 0) return;
      clearTimeout(timer);
      still.src = images[i].src;
      still.hidden = false;
      index = i;
      schedule();
    },
  };
}

/* ---------- Scroll: fly through the arch into the next section ---------- */
function setupHeroScroll() {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const hero = $('.hero');
    const arch = $('.arch');
    const win = $('.arch__window');

    // zoom around a point inside the window, low enough that the curved top clears the screen corners
    const ORIGIN_Y = 0.4;           // higher up the photo, where faces usually are
    const fly = $('.fly', hero);
    const setOrigin = () => {
      gsap.set(arch, { transformOrigin: `${win.offsetLeft + win.offsetWidth / 2}px ${win.offsetTop + win.offsetHeight * ORIGIN_Y}px` });
      // the streaks and petals burst from the same point the arch zooms into
      if (fly) {
        const stage = arch.offsetParent;
        fly.style.setProperty('--ox', `${stage.offsetLeft + arch.offsetLeft + win.offsetLeft + win.offsetWidth / 2}px`);
        fly.style.setProperty('--oy', `${stage.offsetTop + arch.offsetTop + win.offsetTop + win.offsetHeight * ORIGIN_Y}px`);
      }
    };
    setOrigin();
    ScrollTrigger.addEventListener('refreshInit', setOrigin);

    // the smallest zoom at which the arch window covers the whole screen (so the photo isn't over-enlarged)
    const zoom = () => {
      const w = win.offsetWidth, h = win.offsetHeight;
      const stage = arch.offsetParent;
      // where the zoom origin sits on screen while the hero is pinned (layout positions ignore transforms)
      const X0 = stage.offsetLeft + arch.offsetLeft + win.offsetLeft + w / 2;
      const Y0 = stage.offsetTop + arch.offsetTop + win.offsetTop + h * ORIGIN_Y;
      const oy = h * ORIGIN_Y, rx = w / 2, ry = h * 0.40669;   // the dome's radii (see .arch__window)
      const covers = (s) => {
        const left = X0 / s, right = (innerWidth - X0) / s, up = Y0 / s, down = (innerHeight - Y0) / s;
        if (left > rx || right > rx || down > h - oy || up > oy) return false;
        const top = oy - up;
        if (top >= ry) return true;
        const dx = Math.max(left, right), dy = ry - top;
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
      };
      let s = 1;
      while (!covers(s) && s < 40) s *= 1.02;
      return s * 1.04;
    };

    const main = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=100%',
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (self.progress > 0.02) {
            if (heroIntroTimeline && heroIntroTimeline.isActive()) heroIntroTimeline.progress(1);
            if (archShow) { archShow.showNow(0); archShow.pause(); }
          } else if (archShow) {
            archShow.resume();
          }
        },
      },
    })
      .to('.hero__name--first', { xPercent: -70, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0)
      .to('.hero__name--second', { xPercent: 70, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0)
      .to('.hero__welcome, .hero__amp, .hero__date, .hero__countdown, .hero__cta, .scroll-cue, .hero__petals',
        { y: -50, opacity: 0, duration: 0.35, stagger: 0.03, ease: 'power2.in' }, 0)
      .to('.arch__decor, .arch__line', { opacity: 0, duration: 0.3 }, 0.15)
      .to(arch, { scale: zoom, duration: 1, ease: 'power2.in' }, 0);

    // the small details while flying through the arch (same scroll range as the zoom)
    if (fly) {
      const reach = () => Math.hypot(innerWidth, innerHeight) * 0.6;
      // added to the zoom's own timeline: a second trigger on the pinned hero would start after the pin
      const tl = main;
      // gold light streaks stretch outward, like passing through at speed
      // (each streak is turned to its angle and slides outward along it)
      $$('.fly__streak', fly).forEach((el, i) => {
        const deg = +el.dataset.angle;
        const cos = Math.cos((deg * Math.PI) / 180), sin = Math.sin((deg * Math.PI) / 180);
        tl.fromTo(el, { rotation: deg, x: cos * 30, y: sin * 30, scaleX: 0.2, opacity: 0 },
          { x: () => cos * reach() * 0.35, y: () => sin * reach() * 0.35, scaleX: 1.6, opacity: 1, duration: 0.22, ease: 'power1.in' }, 0.12 + (i % 6) * 0.04)
          .to(el, { x: () => cos * reach(), y: () => sin * reach(), scaleX: 2.6, opacity: 0, duration: 0.3, ease: 'power1.in' }, '>');
      });
      // petals fly past the camera on every side
      $$('.fly__petal', fly).forEach((el, i) => {
        const a = (+el.dataset.angle * Math.PI) / 180;
        const d = +el.dataset.dist;
        tl.fromTo(el, { x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 },
          { x: () => Math.cos(a) * reach() * 0.25 * d, y: () => Math.sin(a) * reach() * 0.25 * d, scale: 0.9, opacity: 1, duration: 0.28, ease: 'power1.in' }, 0.05 + (i % 7) * 0.05)
          .to(el, { x: () => Math.cos(a) * reach() * 1.1 * d, y: () => Math.sin(a) * reach() * 1.1 * d, scale: 3.2, rotate: +el.dataset.spin, opacity: 0, duration: 0.35, ease: 'power1.in' }, '>');
      });
      // a warm light leak sweeps across, then gold viewfinder corners close in
      // and a title card settles on the full-screen photo
      tl.fromTo('.fly__leak', { xPercent: 0, opacity: 0 }, { xPercent: 120, opacity: 0.9, duration: 0.3, ease: 'none' }, 0.3)
        .to('.fly__leak', { xPercent: 260, opacity: 0, duration: 0.3, ease: 'none' }, 0.6)
        .fromTo('.fly__corner', { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out' }, 0.78)
        .fromTo('.fly__card', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.82)
        .fromTo('.fly__card > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.14, stagger: 0.03 }, 0.84)
        .fromTo('.fly__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.12 }, 0.9);
    }

    return () => ScrollTrigger.removeEventListener('refreshInit', setOrigin);
  });
}

/* ---------- Scroll choreography (GSAP + ScrollTrigger) ---------- */
function setupScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Generic reveals
    $$('[data-reveal]').forEach((el) => {
      const scrollTrigger = { trigger: el, start: 'top 88%', once: true };
      if (el.dataset.reveal === 'title') {
        // handwriting-style wipe, with room for script swashes
        gsap.fromTo(el,
          { clipPath: 'inset(-40% 100% -40% -10%)' },
          { clipPath: 'inset(-40% -10% -40% -10%)', duration: 1.6, ease: 'power3.inOut', clearProps: 'clipPath', scrollTrigger });
      } else {
        gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger });
      }
    });

    // Parallax: decorations drift at their own speeds; photos shift inside their frames;
    // big chapter numbers float behind their titles
    $$('.deco [data-speed]').forEach((el) => {
      const speed = +el.dataset.speed;
      const section = el.closest('.section');
      gsap.fromTo(el, { y: () => -speed * innerHeight * 0.6 }, {
        y: () => speed * innerHeight * 0.6, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    });
    $$('.sd-card__photo img, .venue__art, .menu__photo img').forEach((el) => {
      gsap.fromTo(el, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    $$('.chapter-title__num, .ent-heading__count').forEach((el) => {
      gsap.fromTo(el, { yPercent: 30 }, {
        yPercent: -30, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // gold ornaments: hairlines draw outward from the diamond, which spins in
    $$('[data-ornament]').forEach((orn) => {
      gsap.timeline({ scrollTrigger: { trigger: orn, start: 'top 90%', once: true } })
        .fromTo($$('.divider__line', orn), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power3.inOut' }, 0.15)
        .from($$('.divider__gem', orn), { scale: 0, rotate: -90, duration: 0.9, ease: 'back.out(2.2)' }, 0)
        .from($$('.divider__dot', orn), { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(3)', stagger: 0.1 }, 0.5);
    });

    // chapter numbers rise softly behind their titles
    $$('.chapter-title__num').forEach((num) => {
      gsap.from(num, { yPercent: 18, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: num.parentElement, start: 'top 88%', once: true } });
    });

    $$('[data-stagger]').forEach((group) => {
      gsap.from(group.children, {
        y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      });
    });

    // Details: the calendar page flips down, days cascade in, a ring is drawn around the day, a heart pops
    const cal = $('[data-cal]');
    if (cal) {
      // the perspective is set once, up front: if it were part of the tween it would shrink along with
      // the rotation and squash the page into a trapezoid before snapping flat
      gsap.set(cal, { transformPerspective: 1200, transformOrigin: '50% 0%' });
      gsap.timeline({ scrollTrigger: { trigger: cal, start: 'top 80%', once: true } })
        .from(cal, { rotationX: -75, opacity: 0, duration: 1.3, ease: 'back.out(1.3)', clearProps: 'transform' })
        .from($$('.cal__dow, .cal__day:not(.cal__day--blank)', cal), { scale: 0.3, opacity: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.012 }, 0.35)
        .fromTo($('.cal__ring path', cal), { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.1, ease: 'power2.inOut' }, '-=0.2')
        .from($('.cal__heart', cal), { scale: 0, rotate: -30, duration: 0.8, ease: 'back.out(3)' }, '-=0.3');
    }
    const bigDay = $('[data-count-to]');
    if (bigDay) {
      const tally = { n: 1 };
      gsap.to(tally, {
        n: +bigDay.dataset.countTo, duration: 1.8, ease: 'power3.out',
        onUpdate: () => { bigDay.textContent = Math.round(tally.n); },
        scrollTrigger: { trigger: bigDay, start: 'top 85%', once: true },
      });
      gsap.from('.when > *', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.when', start: 'top 85%', once: true } });
    }

    // Details: the venue cards arrive from either side, their sketches draw in, and a car drives the road between them
    const journey = $('[data-journey]');
    if (journey) {
      const enter = { trigger: journey, start: 'top 80%', once: true };
      gsap.from('.venue--from', { x: -70, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: enter });
      gsap.from('.venue--to', { x: 70, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { ...enter, start: 'top 70%' } });
      $$('.venue__art img', journey).forEach((img) => {
        gsap.fromTo(img, { clipPath: 'inset(0% 100% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'power2.inOut',
          scrollTrigger: { trigger: img, start: 'top 85%', once: true },
        });
      });
      gsap.from('.venue__time', { scale: 0, duration: 0.7, ease: 'back.out(3)', stagger: 0.3, scrollTrigger: { ...enter, start: 'top 70%' } });
      if ($('.journey__road', journey)) {
        const trip = { p: 0 };
        placeCar(0);
        gsap.to(trip, {
          p: 1, ease: 'none',
          onUpdate: () => placeCar(trip.p),
          scrollTrigger: { trigger: '.journey__road', start: 'top 75%', end: 'bottom 40%', scrub: 0.8 },
        });
        ScrollTrigger.addEventListener('refresh', () => placeCar(trip.p));
      }
    }

    // Entourage: big outlined word drifts behind; the people count rolls up
    if ($('[data-ent-drift]')) {
      gsap.fromTo('[data-ent-drift]', { xPercent: 0 }, {
        xPercent: -30, ease: 'none',
        scrollTrigger: { trigger: '.entourage', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
    const entCount = $('[data-count-to-ent]');
    if (entCount) {
      const tally = { n: 0 };
      gsap.to(tally, {
        n: +entCount.dataset.countToEnt, duration: 2, ease: 'power3.out',
        onUpdate: () => { entCount.textContent = Math.round(tally.n); },
        scrollTrigger: { trigger: entCount, start: 'top 90%', once: true },
      });
    }

    // Entourage: heading lines grow outward from the title
    $$('[data-ent-heading]').forEach((heading) => {
      gsap.timeline({ scrollTrigger: { trigger: heading, start: 'top 88%', once: true } })
        .from($$('.ent-heading__line', heading), { scaleX: 0, duration: 1.4, ease: 'expo.out' }, 0)
        .from($('.ent-heading__text', heading), { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.1);
    });

    // Entourage: the family cards swing in from either side, their monogram rings draw, the "&" pops
    $$('[data-fams]').forEach((fams) => {
      gsap.timeline({ scrollTrigger: { trigger: fams, start: 'top 82%', once: true }, defaults: { duration: 1.3, ease: 'expo.out' } })
        .from($('.fam--left', fams), { x: -80, rotationY: 35, opacity: 0, clearProps: 'transform' }, 0)
        .from($('.fam--right', fams), { x: 80, rotationY: -35, opacity: 0, clearProps: 'transform' }, 0)
        .fromTo($$('.fam__mono .ring circle', fams), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.3)
        .from($$('.fam__mono > span', fams), { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(2.4)' }, 0.7)
        .from($('.fams__amp', fams), { scale: 0, rotate: -40, opacity: 0, ease: 'back.out(2.2)' }, 0.5);
    });

    // Entourage: each pair slides together from both sides, the gold line draws in and the heart pops
    $$('[data-duos]').forEach((duos) => {
      const titles = $$('.duos__titles h4', duos);
      if (titles.length) gsap.from(titles, { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: duos, start: 'top 85%', once: true } });
      ScrollTrigger.batch($$('.duo', duos), {
        start: 'top 92%',
        once: true,
        onEnter: (rows) => {
          const tl = gsap.timeline();
          rows.forEach((row, k) => {
            const t = k * 0.09;
            tl.from($('.duo__side--l', row), { x: -60, opacity: 0, duration: 1, ease: 'expo.out' }, t)
              .from($('.duo__side--r', row), { x: 60, opacity: 0, duration: 1, ease: 'expo.out' }, t)
              .from($$('.duo__line', row), { scaleX: 0, duration: 0.7, ease: 'power2.out' }, t + 0.25)
              .from($('.duo__heart', row), { scale: 0, rotate: -45, duration: 0.6, ease: 'back.out(3)' }, t + 0.55)
              .fromTo($$('.ent-av .ring circle', row), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, t + 0.2);
          });
        },
      });
    });

    // Entourage: role cards flip up in 3D, their icons spin in
    $$('[data-eroles]').forEach((group) => {
      gsap.timeline({ scrollTrigger: { trigger: group, start: 'top 86%', once: true } })
        .from($$('.erole', group), { rotationX: -70, y: 40, opacity: 0, transformOrigin: '50% 100%', duration: 1.1, ease: 'expo.out', stagger: 0.1, clearProps: 'transform' }, 0)
        .from($$('.erole__icon', group), { scale: 0, rotate: -120, duration: 0.9, ease: 'back.out(2)', stagger: 0.1 }, 0.25);
    });

    // Parallax inside framed photos
    $$('.parallax-img img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Giant outline words drifting behind the story
    gsap.fromTo('[data-drift]', { xPercent: 5 }, {
      xPercent: -35, ease: 'none',
      scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Photo band: opens from a rounded card to a full-bleed cinematic frame; as it settles, gold
    // corners close in, a warm light sweeps across and "one forever" fills from outline to solid
    if ($('[data-band]')) {
      gsap.fromTo('.photo-band__clip',
        { clipPath: 'inset(7% 12% 7% 12% round 36px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: '.photo-band', start: 'top 92%', end: 'top 20%', scrub: true } });
      gsap.fromTo('.photo-band__clip img', { scale: 1.28, yPercent: -4 }, {
        scale: 1.02, yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: '.photo-band', start: 'top bottom', end: 'bottom top', scrub: true },
      });
      gsap.timeline({ scrollTrigger: { trigger: '.photo-band', start: 'top 55%', end: 'center 35%', scrub: 0.8 } })
        .fromTo('.photo-band__corner', { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
        .fromTo('.photo-band__sweep', { xPercent: 0, opacity: 0 }, { xPercent: 450, opacity: 1, duration: 0.6, ease: 'none' }, 0.05)
        .to('.photo-band__sweep', { opacity: 0, duration: 0.15 }, 0.55)
        .fromTo('.photo-band__kicker i', { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, 0.1)
        .fromTo('.photo-band__kicker span', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3 }, 0.15)
        .fromTo('.photo-band__outline', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, 0.2)
        .fromTo('.photo-band__fill', { clipPath: 'inset(-30% 110% -30% -10%)' }, { clipPath: 'inset(-30% -10% -30% -10%)', duration: 0.6, ease: 'power1.inOut' }, 0.35)
        .fromTo('.photo-band__meta', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.25 }, 0.75);
    }

    // Proposal photos swing into place
    gsap.fromTo('.proposal__img', { rotate: 6, y: 80 }, {
      rotate: -2, y: -20, ease: 'none',
      scrollTrigger: { trigger: '.proposal', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    if ($('.proposal__tag')) {
      gsap.from('.proposal__tag', {
        scale: 0, duration: 1, ease: 'back.out(2.2)',
        scrollTrigger: { trigger: '.proposal__art', start: 'top 70%', once: true },
      });
    }

    // Program: the gold line fills as you scroll; the clock arrives with a little spin
    const program = $('.program');
    if (program) {
      ScrollTrigger.create({
        trigger: '.day__track', start: 'top 55%', end: 'bottom 55%', scrub: true,
        onUpdate: (self) => program.style.setProperty('--day', self.progress.toFixed(3)),
      });
      gsap.from('[data-clock]', {
        scale: 0.6, rotate: -40, opacity: 0, duration: 1.4, ease: 'back.out(1.4)',
        scrollTrigger: { trigger: '.day', start: 'top 80%', once: true },
      });
      gsap.from('.moment', {
        x: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: '.day__track', start: 'top 85%', once: true },
        clearProps: 'transform,opacity',
      });
    }

    // Save-the-date cards fan out from a stack toward the middle card
    const cards = $$('.sd-card');
    const mid = (cards.length - 1) / 2;
    gsap.fromTo(cards,
      { xPercent: (i) => (mid - i) * 105, y: (i) => (i === mid ? 50 : -60), rotate: (i) => (i - mid) * 12 },
      { xPercent: 0, y: 0, rotate: (i) => (i - mid) * 3, ease: 'power2.out',
        scrollTrigger: { trigger: '.sd-cards', start: 'top 92%', end: 'top 35%', scrub: 1 } });

    // FAQ: question cards slide in one by one; the help card rises with its question mark
    if ($('.faq__list')) {
      gsap.from('.qa', {
        x: 70, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.09, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '.faq__list', start: 'top 85%', once: true },
      });
      gsap.from('.qa__icon', {
        scale: 0, rotate: -90, duration: 0.8, ease: 'back.out(2.2)', stagger: 0.09, clearProps: 'transform,scale,rotate',
        scrollTrigger: { trigger: '.faq__list', start: 'top 85%', once: true },
      });
      // (the mark's float is a CSS animation that owns its transform, so it just fades in)
      gsap.from('.faq__mark', {
        opacity: 0, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: '.faq__help', start: 'top 90%', once: true },
      });
    }

    // Finer details: outlined words drift behind the band
    gsap.fromTo('[data-finer-drift]', { xPercent: 0 }, {
      xPercent: -30, ease: 'none',
      scrollTrigger: { trigger: '.finer', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Finer details: the attire cards rise out of a fanned stack, then their pieces settle in
    const attire = $('[data-attire]');
    if (attire) {
      const cards = $$('.attire-card', attire);
      const mid = (cards.length - 1) / 2;
      gsap.timeline({ scrollTrigger: { trigger: attire, start: 'top 82%', once: true } })
        .from(cards, {
          y: 120, opacity: 0, rotate: (i) => (i - mid) * 10, xPercent: (i) => (mid - i) * 40,
          duration: 1.3, ease: 'expo.out', stagger: 0.12, clearProps: 'transform',
        })
        .from($$('.attire-card__art img', attire), { scale: 0.8, opacity: 0, duration: 1.1, ease: 'back.out(1.6)', stagger: 0.12, clearProps: 'transform' }, 0.35)
        .from($$('.attire-card__num', attire), { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12 }, 0.5)
        .from($$('.attire-card__tags li', attire), { y: 12, opacity: 0, scale: 0.8, duration: 0.6, ease: 'back.out(2)', stagger: 0.05 }, 0.8);
    }

    // Finer details: the paint chips fan open from the gold pin as you scroll
    const fan = $('[data-fan]');
    if (fan) {
      gsap.fromTo(fan, { '--fan': 0 }, {
        '--fan': 1, ease: 'power2.out',
        scrollTrigger: { trigger: fan, start: 'top 90%', end: 'top 45%', scrub: 0.8 },
      });
      // animate the inner card, so the chip's own rotation (driven by --fan in CSS) is never overwritten
      gsap.from($$('.chip__card', fan), {
        y: 60, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, clearProps: 'transform',
        scrollTrigger: { trigger: fan, start: 'top 92%', once: true },
      });
    }

    // Photo guide: steps slide in, the phone rises and tilts with scroll
    if ($('[data-pg-steps]')) {
      gsap.from('.pg-step', {
        x: -60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: '[data-pg-steps]', start: 'top 82%', once: true },
      });
      gsap.from('.pg-step__icon', { scale: 0, rotate: -90, duration: 0.8, ease: 'back.out(2.2)', stagger: 0.12, scrollTrigger: { trigger: '[data-pg-steps]', start: 'top 82%', once: true } });
      gsap.fromTo('.phone', { y: 90, rotate: 6 }, {
        y: -40, rotate: -3, ease: 'none',
        scrollTrigger: { trigger: '.pg', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }

    // Gift QR cards flip up one after another
    if ($('[data-gpay]')) {
      gsap.from('.gpay-card', {
        rotationX: -70, y: 50, opacity: 0, transformOrigin: '50% 100%', duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'transform',
        scrollTrigger: { trigger: '[data-gpay]', start: 'top 86%', once: true },
      });
    }

    // Gift guide: the seal is stamped, cracks, the flap swings open and the note slides out
    const genv = $('[data-genv]');
    if (genv) {
      const flap = $('.genv__flap', genv);
      gsap.set(flap, { transformPerspective: 1200, rotationX: 0, zIndex: 3 });   // sealed over the card
      gsap.set('.gcard', { yPercent: 100 });
      gsap.set('.genv__seal', { opacity: 1 });
      gsap.timeline({ scrollTrigger: { trigger: genv, start: 'top 72%', once: true } })
        .from('.genv__seal', { scale: 2.2, opacity: 0, duration: 0.45, ease: 'power4.in' })
        .to('.genv__seal', { scale: 1.15, duration: 0.25, ease: 'power2.out' }, '+=0.35')
        .to('.genv__seal', { scale: 0.4, opacity: 0, rotate: 25, y: 30, duration: 0.5, ease: 'power2.in' })
        .to(flap, { rotationX: 90, duration: 0.45, ease: 'power2.in' }, '-=0.25')
        .set(flap, { zIndex: 0 })
        .to(flap, { rotationX: 180, duration: 0.45, ease: 'power2.out' })
        .to('.gcard', { yPercent: 0, duration: 1.2, ease: 'power3.out' }, '-=0.2')
        .from('.gcard > *', { y: 20, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.1 }, '-=0.6');
    }

    ScrollTrigger.create({
      trigger: '.rsvp', start: 'top 60%', once: true,
      onEnter: () => { const r = $('#rsvp-button').getBoundingClientRect(); confetti(r.left + r.width / 2, r.top); },
    });
  });

  // Lazy images and late fonts change the page height; re-measure trigger positions when they do
  new ResizeObserver(refreshSoon).observe(document.body);
  $$('#main img').forEach((img) => { if (!img.complete) img.addEventListener('load', refreshSoon, { once: true }); });
}

/* ---------- Navigation ---------- */
function setupNavigation() {
  const navWrap = $('.nav-wrap');
  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  const progressBar = $('.progress span');


  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // In-page links glide to their section. The destination is re-measured on every frame, so photos
  // loading along the way (which push the page down) can't make the glide stop short or overshoot.
  function glideTo(target) {
    const destination = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const top = target.id === 'home' ? 0 : target.getBoundingClientRect().top + scrollY - 90;
      return Math.max(0, Math.min(top, max));
    };
    if (reduceMotion) { scrollTo(0, destination()); return; }

    const from = scrollY;
    const duration = Math.min(1700, 650 + Math.abs(destination() - from) * 0.1);
    const start = performance.now();
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    // a new touch or wheel from the visitor takes back control
    addEventListener('wheel', cancel, { passive: true });
    addEventListener('touchstart', cancel, { passive: true });
    gliding = true;
    navWrap.classList.remove('is-hidden');

    requestAnimationFrame(function step(now) {
      if (cancelled) return finish();
      const p = Math.min(1, (now - start) / duration);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      scrollTo(0, from + (destination() - from) * eased);
      if (p < 1) requestAnimationFrame(step);
      else finish();
    });

    function finish() {
      removeEventListener('wheel', cancel);
      removeEventListener('touchstart', cancel);
      gliding = false;
      lastY = scrollY;
      if (pendingRefresh) {
        pendingRefresh = false;
        ScrollTrigger.refresh();
        if (!cancelled) scrollTo(0, destination());
      }
    }
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    glideTo(target);
    history.replaceState(null, '', link.getAttribute('href'));
    if (target.id === 'main') target.focus({ preventScroll: true });
  });

  // Hide the nav while scrolling down, bring it back on scroll up; update progress bar
  let lastY = scrollY;
  let ticking = false;
  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    const menuOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (!gliding) navWrap.classList.toggle('is-hidden', !menuOpen && y > lastY && y > 240);
    navWrap.classList.toggle('is-compact', y > innerHeight * 0.8);
    lastY = y;
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Highlight the nav link for the section in view
  const navLinks = $$('.nav__links a, .menu__links a');   // the phone menu marks the current section too
  // a gold pill glides behind the hovered link, and rests on the section you're in
  const glide = $('.nav__glide');
  const barLinks = $$('.nav__links a');
  let hovered = null;
  function moveGlide() {
    if (!glide) return;
    const target = hovered || barLinks.find((a) => a.classList.contains('is-active'));
    barLinks.forEach((a) => a.classList.toggle('is-glided', a === target));
    if (!target || !target.offsetWidth) { glide.style.opacity = 0; return; }
    glide.style.opacity = 1;
    glide.style.width = `${target.offsetWidth}px`;
    glide.style.transform = `translateX(${target.parentElement.offsetLeft}px)`;
  }
  barLinks.forEach((a) => {
    a.addEventListener('pointerenter', () => { hovered = a; moveGlide(); });
    a.addEventListener('focus', () => { hovered = a; moveGlide(); });
    a.addEventListener('blur', () => { hovered = null; moveGlide(); });
  });
  const linkList = $('.nav__links');
  if (linkList) linkList.addEventListener('pointerleave', () => { hovered = null; moveGlide(); });
  addEventListener('resize', moveGlide);
  if (document.fonts) document.fonts.ready.then(moveGlide);

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
      moveGlide();
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => {
    const section = document.getElementById(a.getAttribute('href').slice(1));
    if (section) navObserver.observe(section);
  });
}

/* ---------- Pointer effects (desktop only) ---------- */
function setupPointerEffects() {
  if (!finePointer || reduceMotion) return;
  const hero = $('.hero');

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', (((e.clientX - r.left) / r.width) - 0.5) * 2);
    hero.style.setProperty('--my', (((e.clientY - r.top) / r.height) - 0.5) * 2);
  });

  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.3}px ${(e.clientY - r.top - r.height / 2) * 0.4}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });

  $$('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(((e.clientY - r.top) / r.height) - 0.5) * -10}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ---------- Falling petals in the hero ---------- */
function startPetals() {
  const hero = $('.hero');
  const canvas = $('.hero__petals');
  const ctx = canvas.getContext('2d');
  const colors = [cssVar('--blush'), cssVar('--sand'), cssVar('--tan'), '#e8b7a0', '#f6e3d6'];
  let w, h, frame;
  let running = true;
  const petals = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePetal(anywhere) {
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : -20,
      r: 5 + Math.random() * 7, vx: -0.2 + Math.random() * 0.4, vy: 0.35 + Math.random() * 0.8,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.03, sway: Math.random() * Math.PI * 2,
      color: colors[(Math.random() * colors.length) | 0], alpha: 0.45 + Math.random() * 0.4,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of petals) {
      p.sway += 0.02;
      p.x += p.vx + Math.sin(p.sway) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > h + 20) Object.assign(p, makePetal(false));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.bezierCurveTo(p.r, -p.r * 0.6, p.r * 0.7, p.r * 0.7, 0, p.r);
      ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r, -p.r * 0.6, 0, -p.r);
      ctx.fill();
      ctx.restore();
    }
    frame = requestAnimationFrame(draw);
  }

  resize();
  for (let i = 0; i < (w < 600 ? 16 : 30); i++) petals.push(makePetal(true));
  draw();
  addEventListener('resize', resize);

  // Only animate while the hero is on screen
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; draw(); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(frame); }
  }).observe(hero);
}

/* ---------- Confetti ---------- */
function confetti(x, y) {
  if (reduceMotion) return;
  const canvas = $('.confetti');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['--rust', '--terracotta', '--tan', '--sand', '--butter'].map(cssVar).concat('#ffffff');
  const pieces = Array.from({ length: 160 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      color: colors[(Math.random() * colors.length) | 0],
    };
  });

  const duration = 2600;
  const start = performance.now();
  requestAnimationFrame(function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  });
}

function setupRsvpConfetti() {
  $('#rsvp-button').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
  });
}

/* ---------- Countdown with flip animation ---------- */
function startCountdown(config) {
  const weddingDate = new Date(config.wedding.dateTime);
  const countdown = $('#countdown');
  const units = {
    days: $('[data-unit="days"]', countdown),
    hours: $('[data-unit="hours"]', countdown),
    minutes: $('[data-unit="minutes"]', countdown),
    seconds: $('[data-unit="seconds"]', countdown),
  };

  function setUnit(el, value) {
    if (el.textContent === value) return;
    el.textContent = value;
    if (reduceMotion) return;
    el.classList.remove('is-flipping');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-flipping');
  }

  function update() {
    const diff = weddingDate - new Date();
    if (diff <= 0) {
      const message = document.createElement('p');
      message.className = 'save-date__text';
      message.textContent = config.saveTheDate.afterWeddingMessage;
      countdown.replaceChildren(message);
      clearInterval(timer);
      return;
    }
    const s = Math.floor(diff / 1000);
    setUnit(units.days, String(Math.floor(s / 86400)));
    setUnit(units.hours, String(Math.floor((s % 86400) / 3600)).padStart(2, '0'));
    setUnit(units.minutes, String(Math.floor((s % 3600) / 60)).padStart(2, '0'));
    setUnit(units.seconds, String(s % 60).padStart(2, '0'));
  }
  const timer = setInterval(update, 1000);
  update();
}

/* ---------- Add to Calendar (.ics works with Google, Apple and Outlook) ---------- */
function setupAddToCalendar(config) {
  const cal = config.wedding.calendar;
  const icsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const icsText = (text) => String(text).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

  $$('[data-action="add-to-calendar"]').forEach((button) => {
    button.addEventListener('click', () => {
      const start = new Date(config.wedding.dateTime);
      const end = new Date(start.getTime() + (cal.durationHours || 6) * 3600000);
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Wedding Website//EN',
        'BEGIN:VEVENT',
        `UID:wedding-${icsDate(start)}@wedding-website`,
        'DTSTAMP:' + icsDate(new Date()),
        'DTSTART:' + icsDate(start),
        'DTEND:' + icsDate(end),
        'SUMMARY:' + icsText(cal.title),
        'LOCATION:' + icsText(cal.location),
        'DESCRIPTION:' + icsText(cal.description),
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: cal.fileName || 'wedding.ics' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  });
}

/* ---------- Lightbox ---------- */
function makeLightboxFocusable() {
  $$('[data-lightbox]:not([tabindex])').forEach((img) => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
  });
}

function setupLightbox() {
  const box = $('#lightbox');
  const img = $('.lightbox__img', box);
  const caption = $('.lightbox__caption', box);
  const count = $('.lightbox__count', box);
  let group = [];
  let index = 0;

  function show(i, direction = 0) {
    index = (i + group.length) % group.length;
    const source = group[index];
    img.src = source.currentSrc || source.src;
    img.alt = source.alt;
    caption.textContent = source.dataset.caption || '';
    count.textContent = group.length > 1 ? `${index + 1} / ${group.length}` : '';
    box.classList.toggle('is-single', group.length < 2);
    if (direction && !reduceMotion) {
      img.animate(
        [{ opacity: 0, transform: `translateX(${direction * 60}px) scale(.97)` }, { opacity: 1, transform: 'none' }],
        { duration: 450, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    }
    // warm up the neighbours so next/previous feel instant
    [index + 1, index - 1].forEach((j) => {
      const next = group[(j + group.length) % group.length];
      if (next) new Image().src = next.currentSrc || next.src;
    });
  }

  function open(source) {
    group = $$(`[data-lightbox="${source.dataset.lightbox}"]`);
    show(group.indexOf(source));
    box.showModal();
  }

  // delegated, so photos added later (the gallery) work too
  document.addEventListener('click', (e) => {
    const source = e.target.closest('[data-lightbox]');
    if (source) open(source);
  });
  document.addEventListener('keydown', (e) => {
    const source = e.target.closest && e.target.closest('[data-lightbox]');
    if (source && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(source); }
  });

  $('.lightbox__close', box).addEventListener('click', () => box.close());
  $('.lightbox__prev', box).addEventListener('click', () => show(index - 1, -1));
  $('.lightbox__next', box).addEventListener('click', () => show(index + 1, 1));
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1, -1);
    if (e.key === 'ArrowRight') show(index + 1, 1);
  });

  // swipe left/right on phones
  let startX = null;
  box.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  box.addEventListener('pointerup', (e) => {
    if (startX === null || group.length < 2) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  makeLightboxFocusable();
}

/* ---------- Moments: polaroids orbiting the big number on a tilted ellipse ---------- */
// Returns an object whose "spread" (0..1) GSAP can animate; null when there is nothing to orbit.
function startOrbit(scope) {
  const stage = $('[data-orbit-stage]', scope);
  const items = stage ? $$('.orbit__item', stage) : [];
  if (!items.length) return null;
  const control = { spread: reduceMotion || !hasGsap ? 1 : 0 };
  let angle = 0, raf = 0, running = false, paused = false, last = 0;

  function place() {
    const w = stage.offsetWidth;
    const rx = w * (innerWidth < 640 ? 0.47 : 0.66) * control.spread;
    const ry = w * 0.2 * control.spread;
    const drop = w * 0.14;          // the orbit sits low: front photos pass under the words, back ones behind the number
    items.forEach((item, i) => {
      const a = angle + (i / items.length) * Math.PI * 2;
      const depth = (Math.sin(a) + 1) / 2;             // 0 = behind the number, 1 = in front
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry + drop * control.spread;
      const scale = (0.55 + depth * 0.6) * (0.4 + control.spread * 0.6);
      item.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      item.style.zIndex = depth > 0.5 ? 6 : 2;
      item.style.opacity = (control.spread * (0.4 + depth * 0.6)).toFixed(3);
      item.style.filter = `blur(${((1 - depth) * 2.2).toFixed(2)}px)`;
    });
  }
  function frame(now) {
    if (!paused && !reduceMotion) angle += Math.min(50, now - (last || now)) * 0.00012;
    last = now;
    place();
    raf = requestAnimationFrame(frame);
  }
  stage.addEventListener('pointerenter', () => { paused = true; });
  stage.addEventListener('pointerleave', () => { paused = false; });
  // only animate while the panel is on screen
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
  }).observe(stage);
  place();
  return control;
}

/* ---------- Gallery (built after render.js finds the photos) ---------- */
// wrap each word of an element in a mask, so lines can rise into view word by word
function splitWords(el) {
  if (!el || el.dataset.words) return [];
  el.dataset.words = '';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'zw';
      inner.className = 'zw__i';
      inner.textContent = part;
      outer.appendChild(inner);
      frag.appendChild(outer);
    });
    node.replaceWith(frag);
  });
  return $$('.zw__i', el);
}

function initGallery(config) {
  const gallery = $('#gallery');
  const grid = $('.pgrid', gallery);
  const items = $$('.pgrid__item', gallery);

  splitChars();
  makeLightboxFocusable();

  // a frame in the film reel or an orbiting polaroid opens the matching photo in the viewer
  $$('.reel__frame, .orbit__item', gallery).forEach((frame) => {
    frame.addEventListener('click', () => {
      const tile = $(`.pgrid__item[data-index="${frame.dataset.open}"]`, gallery);
      if (tile) { tile.hidden = false; fillLastRow(); $('img', tile).click(); }
    });
  });
  $$('.zoom img, .pgrid img', gallery).forEach((img) => { if (!img.complete) img.addEventListener('load', refreshSoon, { once: true }); });

  // on phones (2 columns) the last visible photo spans the full width if it would otherwise sit alone
  function fillLastRow() {
    const visible = items.filter((item) => !item.hidden);
    visible.forEach((item) => item.classList.remove('pgrid__item--m-fill'));
    const cells = visible.reduce((sum, item) => sum + (item.classList.contains('pgrid__item--m-wide') ? 2 : 1), 0);
    if (cells % 2) visible[visible.length - 1].classList.add('pgrid__item--m-fill');
  }
  fillLastRow();

  // "View all 44 moments": reveal the rest of the photos
  const more = $('[data-show-all]', gallery);
  if (more) {
    more.addEventListener('click', () => {
      const hidden = items.filter((item) => item.hidden);
      hidden.forEach((item) => { item.hidden = false; });
      more.parentElement.remove();
      fillLastRow();
      if (hasGsap && !reduceMotion) {
        gsap.fromTo(hidden.slice(0, 12), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity' });
      }
      refreshSoon();
    });
  }

  startLiveFeed(items.map((item) => $('img', item).getAttribute('src')));
  const orbitControl = startOrbit(gallery);
  if (!hasGsap) return;

  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    if (!ctx.conditions.motion) return;

    // 1. Zoom scene. The collage drifts in, then (scrubbed by scroll) the arch-shaped centre photo opens
    //    into a full-screen picture while its image counter-zooms; the other photos fly past at different
    //    depths, tilting and blurring; the big word behind swells away; the tagline rises word by word.
    const zoomItems = $$('.zoom__item', gallery);
    gsap.from(zoomItems.map((item) => $('.zoom__frame', item)), {
      y: 90, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.zoom', start: 'top 75%', once: true },
    });
    const words = splitWords($('.zoom__tagline', gallery));
    const scales = [1, 4.5, 5.5, 6.5, 5, 6, 8.5];
    const tilts = [0, -9, 7, 11, -7, 8, -12];
    const zoom = gsap.timeline({
      scrollTrigger: { trigger: '.zoom', start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true },
    });
    zoomItems.forEach((item, i) => {
      const frame = $('.zoom__frame', item);
      if (i === 0) {
        // the centre photo really grows (instead of being scaled up), so it stays sharp at full screen
        zoom.fromTo(frame,
          { width: frame.offsetWidth, height: frame.offsetHeight, borderRadius: '50% 50% 12px 12px / 38% 38% 12px 12px' },
          { width: '100%', height: '100%', borderRadius: '0% 0% 0px 0px / 0% 0% 0px 0px', boxShadow: '0 0 0 0px rgba(0,0,0,0)', ease: 'power2.inOut', duration: 1 }, 0)
          .fromTo($('img', frame), { scale: 1.35 }, { scale: 1, ease: 'power1.out', duration: 1.2 }, 0);
      } else {
        zoom.fromTo(item, { scale: 1, rotate: 0, filter: 'blur(0px)' },
          { scale: scales[i], rotate: tilts[i], filter: 'blur(6px)', ease: 'power1.in', duration: 1 }, 0)
          .to(item, { opacity: 0, duration: 0.3, ease: 'none' }, 0.65);
      }
    });
    if ($('.zoom__word', gallery)) {
      zoom.fromTo('.zoom__word', { scale: 1, opacity: 1 }, { scale: 3.2, opacity: 0, ease: 'power2.in', duration: 0.6 }, 0);
    }
    zoom.to('.zoom__shade', { opacity: 1, duration: 0.25 }, 0.75)
      .fromTo('.zoom__kicker', { opacity: 0, letterSpacing: '1.1em' }, { opacity: 1, letterSpacing: '0.45em', duration: 0.25 }, 0.8)
      .fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 0.18, stagger: 0.03, ease: 'power3.out' }, 0.84)
      .fromTo('.zoom__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.2 }, 0.98)
      .to({}, { duration: 0.3 }); // hold the finished frame for a moment

    // 2. Moments panel: opens from a rounded card to full width, the number rolls up like an odometer,
    //    the polaroids spiral out of it and the counters count up
    const moments = $('[data-moments]', gallery);
    if (moments) {
      gsap.fromTo($('.moments__panel', moments), { clipPath: 'inset(4% 7% 4% 7% round 40px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: moments, start: 'top 95%', end: 'top 25%', scrub: true },
      });
      const cols = $$('.odo__col', moments);
      const intro = gsap.timeline({ scrollTrigger: { trigger: '.moments__stage', start: 'top 80%', once: true } })
        .from('.moments__ring', { scale: 0.6, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0)
        // y: 0 stops GSAP from adding the CSS starting offset on top of the roll
        .fromTo(cols.map((col) => $('.odo__strip', col)), { y: 0, yPercent: 0 }, {
          y: 0, yPercent: (i) => -(10 + +cols[i].dataset.digit) * 5,
          duration: (i) => 2 + (cols.length - 1 - i) * 0.4, ease: 'power3.inOut',
        }, 0.1)
        .from('.moments__word, .moments__script', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.15 }, 0.4)
        .from('.moments__plus', { scale: 0, rotate: -180, duration: 0.8, ease: 'back.out(2.4)' }, 1.9)
        .from('.moments__note', { opacity: 0, y: 16, duration: 1 }, 1.4);
      if (orbitControl) intro.to(orbitControl, { spread: 1, duration: 2.2, ease: 'expo.out' }, 0.5);

      $$('[data-count-up]', moments).forEach((el, i) => {
        const end = +el.dataset.countUp;
        const tally = { n: 0 };
        gsap.to(tally, {
          n: end, duration: 2, delay: i * 0.15, ease: 'power3.out',
          onUpdate: () => { el.textContent = Math.round(tally.n).toLocaleString('en-US'); },
          scrollTrigger: { trigger: '.mstats', start: 'top 92%', once: true },
        });
      });
      gsap.from('.mstat, .mstat__sep', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.mstats', start: 'top 92%', once: true } });
      gsap.from('.reel__row', { xPercent: (i) => (i ? 30 : -30), opacity: 0, duration: 1.6, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.reel', start: 'top 92%', once: true } });
    }

    // 3. Tiles open like curtains as they arrive (feature tiles from the side, others from below),
    //    their photos settling from a slow zoom
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => {
        batch.forEach((tile, k) => {
          const wide = +tile.style.getPropertyValue('--r') > 1;
          gsap.fromTo(tile,
            { clipPath: wide ? 'inset(0% 100% 0% 0% round 16px)' : 'inset(100% 0% 0% 0% round 16px)' },
            { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1.4, ease: 'expo.inOut', delay: k * 0.1, clearProps: 'clipPath' });
          gsap.fromTo($('.pgrid__media', tile), { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'expo.out', delay: k * 0.1, clearProps: 'transform' });
        });
      },
    });
    // gentle parallax inside each tile
    items.forEach((tile) => {
      gsap.fromTo($('img', tile), { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // 4. Closing date rises letter by letter
    gsap.from('.gallery__outro .char', {
      yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: '.gallery__outro', start: 'top 85%', once: true },
    });
  });

  // a "View" bubble follows the pointer over the photos (mouse/trackpad only)
  if (finePointer && !reduceMotion) {
    const bubble = document.createElement('div');
    bubble.className = 'cursor-view';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.textContent = config.gallery.viewLabel || 'View';
    document.body.appendChild(bubble);
    const toX = gsap.quickTo(bubble, 'x', { duration: 0.5, ease: 'power3' });
    const toY = gsap.quickTo(bubble, 'y', { duration: 0.5, ease: 'power3' });
    addEventListener('pointermove', (e) => { toX(e.clientX); toY(e.clientY); }, { passive: true });
    grid.addEventListener('pointerover', (e) => bubble.classList.toggle('is-active', !!e.target.closest('.pgrid__item')));
    grid.addEventListener('pointerleave', () => bubble.classList.remove('is-active'));
  }

  ScrollTrigger.refresh();
}
