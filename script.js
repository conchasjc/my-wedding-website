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
  updateDaysLeft(config);
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    setupHeroScroll();            // first, so its pinned space is counted before the sections below
    setupScrollAnimations();
  } else {
    $('.timeline').style.setProperty('--p', 1);
  }
  startIntro();
  if (reduceMotion) $('.timeline').style.setProperty('--p', 1);
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

/* ---------- Opening: the envelope ---------- */
let heroIntroTimeline = null;
let markHeroReady;
const heroReady = new Promise((resolve) => { markHeroReady = resolve; });

function startIntro() {
  const intro = $('.intro');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    document.documentElement.classList.remove('is-loading');
    intro.remove();
  };

  if (!hasGsap || reduceMotion) {
    finish();
    playHeroIntro();
    return;
  }

  const envelope = $('.envelope', intro);
  const card = $('.envelope__card', intro);
  const flap = $('.envelope__flap', intro);
  const body = $$('.envelope__back, .envelope__pocket, .envelope__flap', intro);
  const cardBox = () => card.getBoundingClientRect();

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } })
    .from(envelope, { y: 70, scale: 0.9, opacity: 0, duration: 0.7, ease: 'expo.out' })
    // the wax seal cracks in two and falls away
    .to('.seal-half--left', { x: -16, y: 50, rotate: -28, opacity: 0, duration: 0.6, ease: 'power2.in' }, '+=0.25')
    .to('.seal-half--right', { x: 16, y: 56, rotate: 26, opacity: 0, duration: 0.6, ease: 'power2.in' }, '<')
    // the flap swings open and tucks behind the card
    .to(flap, { rotateX: 180, duration: 0.7 }, '-=0.3')
    .set(flap, { zIndex: 0 }, '-=0.35')
    // the card rises out of the envelope…
    .to(card, { yPercent: -58, duration: 0.65 }, '-=0.15')
    .set(card, { zIndex: 6 })
    // …and grows until it becomes the page
    .to(body, { y: 160, opacity: 0, duration: 0.6, ease: 'power2.in' })
    .to(card.children, { opacity: 0, duration: 0.25 }, '<')
    .to(card, {
      x: () => innerWidth / 2 - (cardBox().left + cardBox().width / 2),
      y: () => innerHeight / 2 - (cardBox().top + cardBox().height / 2),
      scale: () => Math.max(innerWidth / cardBox().width, innerHeight / cardBox().height) * 1.1,
      borderRadius: 0,
      duration: 0.8,
      ease: 'power3.in',
    }, '-=0.35')
    .add(playHeroIntro, '-=0.1')
    .to(intro, { opacity: 0, duration: 0.45, onComplete: finish });

  // start once the fonts are in (so the names don't change typeface mid-animation)
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 2500))]).then(() => tl.play());

  // impatient guests can tap to hurry it along
  const hurry = () => tl.timeScale(3.5);
  intro.addEventListener('pointerdown', hurry);
  addEventListener('keydown', hurry, { once: true });

  // never leave anyone stuck behind the envelope
  setTimeout(() => { if (!finished) { tl.progress(1); finish(); } }, 10000);
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
  const el = $('[data-days-left]');
  if (!el) return;
  const text = config.hero.countdown || {};
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(new Date(config.wedding.dateTime)) - day(new Date())) / 86400000);
  el.textContent = days > 1 ? (text.days || '{days} days to go').replace('{days}', days)
    : days === 1 ? text.oneDay : days === 0 ? text.today : text.after;
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
    const ORIGIN_Y = 0.58;
    const setOrigin = () => {
      gsap.set(arch, { transformOrigin: `${win.offsetLeft + win.offsetWidth / 2}px ${win.offsetTop + win.offsetHeight * ORIGIN_Y}px` });
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

    gsap.timeline({
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

    $$('[data-stagger]').forEach((group) => {
      gsap.from(group.children, {
        y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      });
    });

    // Entourage: heading lines grow outward from the title
    $$('[data-ent-heading]').forEach((heading) => {
      gsap.timeline({ scrollTrigger: { trigger: heading, start: 'top 88%', once: true } })
        .from($$('.ent-heading__line', heading), { scaleX: 0, duration: 1.4, ease: 'expo.out' }, 0)
        .from($('.ent-heading__text', heading), { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.1);
    });

    // Entourage: parents' cards glide in from either side, the "&" pops between them
    $$('[data-ent-pair]').forEach((pair) => {
      gsap.timeline({ scrollTrigger: { trigger: pair, start: 'top 85%', once: true }, defaults: { duration: 1.2, ease: 'expo.out' } })
        .from($('.ent-card--left', pair), { x: -70, rotate: -3, opacity: 0 }, 0)
        .from($('.ent-card--right', pair), { x: 70, rotate: 3, opacity: 0 }, 0)
        .from($('.ent-pair__amp', pair), { scale: 0, rotate: -40, opacity: 0, ease: 'back.out(2.2)' }, 0.35);
    });

    // Entourage: the centre line draws down while each pair of names slides in from both sides
    $$('[data-ent-mirror]').forEach((mirror) => {
      const rows = $$('.ent-row', mirror);
      const titles = $$('.ent-mirror__titles h4', mirror);
      const tl = gsap.timeline({ scrollTrigger: { trigger: mirror, start: 'top 82%', once: true } })
        .fromTo(mirror, { '--line': 0 }, { '--line': 1, duration: 0.3 + rows.length * 0.18, ease: 'power2.inOut' }, 0);
      if (titles.length) tl.from(titles, { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12 }, 0);
      tl.from(rows.map((r) => $('.ent-row__name--left', r)), { x: -50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 }, 0.15)
        .from(rows.map((r) => $('.ent-row__name--right', r)), { x: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 }, 0.15)
        .from(rows.map((r) => $('.ent-row__mark', r)), { scale: 0, duration: 0.7, ease: 'back.out(3)', stagger: 0.12 }, 0.3);
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

    // Photo band grows from a rounded card to full bleed
    gsap.fromTo('.photo-band__clip',
      { clipPath: 'inset(6% 14% 6% 14% round 32px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: '.photo-band', start: 'top 90%', end: 'center 55%', scrub: true } });
    gsap.fromTo('.photo-band__clip img', { scale: 1.3 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.photo-band', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from('.photo-band__caption > *', {
      y: 60, opacity: 0, duration: 1.3, stagger: 0.15, ease: 'expo.out',
      scrollTrigger: { trigger: '.photo-band', start: 'center 75%', once: true },
    });

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

    // Program timeline draws itself as you scroll
    const timeline = $('.timeline');
    ScrollTrigger.create({
      trigger: timeline, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (self) => timeline.style.setProperty('--p', self.progress.toFixed(3)),
    });
    gsap.from('.stop', {
      y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: timeline, start: 'top 82%', once: true },
    });

    // Save-the-date cards fan out from a stack toward the middle card
    const cards = $$('.sd-card');
    const mid = (cards.length - 1) / 2;
    gsap.fromTo(cards,
      { xPercent: (i) => (mid - i) * 105, y: (i) => (i === mid ? 50 : -60), rotate: (i) => (i - mid) * 12 },
      { xPercent: 0, y: 0, rotate: (i) => (i - mid) * 3, ease: 'power2.out',
        scrollTrigger: { trigger: '.sd-cards', start: 'top 92%', end: 'top 35%', scrub: 1 } });

    gsap.from('.palette li', {
      scale: 0, duration: 1.2, stagger: 0.1, ease: 'elastic.out(1, 0.5)',
      scrollTrigger: { trigger: '.palette', start: 'top 92%', once: true },
    });

    gsap.fromTo('.photo-guide__mock', { y: 80, rotate: 4 }, {
      y: -40, rotate: -2, ease: 'none',
      scrollTrigger: { trigger: '.photo-guide', start: 'top bottom', end: 'bottom top', scrub: true },
    });

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

  $$('.menu__links a').forEach((a, i) => a.style.setProperty('--i', i));

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
    lastY = y;
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Highlight the nav link for the section in view
  const navLinks = $$('.nav__links a');
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
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

/* ---------- Gallery (built after render.js finds the photos) ---------- */
function initGallery(config) {
  const gallery = $('#gallery');
  const grid = $('.pgrid', gallery);
  const items = $$('.pgrid__item', gallery);

  splitChars();
  makeLightboxFocusable();

  // each tile takes its photo's shape (within reason) once the photo has loaded
  items.forEach((item) => {
    const img = $('img', item);
    const fit = () => {
      if (!img.naturalWidth) return;
      const ratio = Math.min(1.5, Math.max(0.7, img.naturalWidth / img.naturalHeight));
      item.style.setProperty('--ar', ratio.toFixed(3));
      refreshSoon();
    };
    if (img.complete) fit(); else img.addEventListener('load', fit, { once: true });
  });
  $$('.zoom img', gallery).forEach((img) => { if (!img.complete) img.addEventListener('load', refreshSoon, { once: true }); });

  // spread the tiles over 3 columns (2 on phones); the columns drift at different speeds
  function layoutColumns(count) {
    const ordered = items.slice().sort((a, b) => a.dataset.index - b.dataset.index);
    grid.replaceChildren();
    const columns = Array.from({ length: count }, () => {
      const col = document.createElement('div');
      col.className = 'pgrid__col';
      grid.appendChild(col);
      return col;
    });
    ordered.forEach((item, i) => columns[i % count].appendChild(item));
    return columns;
  }

  if (!hasGsap) {
    const wide = matchMedia('(min-width: 900px)');
    const apply = () => layoutColumns(wide.matches ? 3 : 2);
    wide.addEventListener('change', apply);
    apply();
    return;
  }

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 900px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const { wide, motion } = ctx.conditions;
    const columns = layoutColumns(wide ? 3 : 2);
    if (!motion) return;

    // 1. Zoom scene: the centre photo grows to fill the screen while the others fly outward
    const scales = [4, 5, 6, 5, 6, 8, 9];
    const zoom = gsap.timeline({
      scrollTrigger: { trigger: '.zoom', start: 'top top', end: 'bottom bottom', scrub: true },
    });
    $$('.zoom__item', gallery).forEach((item, i) => {
      zoom.fromTo(item, { scale: 1 }, { scale: scales[i], ease: 'none', duration: 1 }, 0);
    });
    zoom.fromTo('.zoom__shade', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.72)
      .fromTo('.zoom__caption > *', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, stagger: 0.06 }, 0.78)
      .to({}, { duration: 0.25 }); // hold the finished frame for a moment

    // 2. Photo count ticks up
    const counter = $('.pgrid__count', gallery);
    const total = +counter.dataset.count;
    const tally = { n: 0 };
    gsap.to(tally, {
      n: total, duration: 1.6, ease: 'power2.out',
      onUpdate: () => { counter.textContent = Math.round(tally.n); },
      scrollTrigger: { trigger: counter, start: 'top 90%', once: true },
    });

    // 3. Tiles unveil from the bottom as they arrive
    gsap.set(items, { clipPath: 'inset(100% 0% 0% 0% round 18px)' });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.3, ease: 'expo.out', stagger: 0.12 });
        gsap.fromTo(batch.map((el) => $('img', el)), { scale: 1.35 }, { scale: 1, duration: 1.6, ease: 'expo.out', stagger: 0.12, clearProps: 'transform' });
      },
    });

    // 4. Columns drift at different speeds (parallax)
    const drift = wide ? [[0, -6], [12, -16], [0, -6]] : [[0, -4], [8, -10]];
    columns.forEach((col, i) => {
      gsap.fromTo(col, { yPercent: drift[i][0] }, {
        yPercent: drift[i][1], ease: 'none',
        scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // 5. Closing date rises letter by letter
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
