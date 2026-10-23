/* Builds the page from config.json, then hands off to script.js (initSite) for the motion. */

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Light formatting for longer text: **bold**, *italic*, [link](url) and \n line breaks
function rich(value) {
  return esc(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text, url) => {
      if (!/^(https?:|mailto:|tel:|#)/i.test(url)) return text;
      const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${url}"${external}>${text}</a>`;
    })
    .replace(/\n/g, '<br>');
}

const list = (items, fn) => (items || []).map(fn).join('');

// "JC & J" -> JC<span>&</span>J for the nav brand
const brand = (text) => esc(text).replace(/\s*&amp;\s*/, '<span>&amp;</span>');

const ICONS = {
  bell: '<path d="M12 3v1.5M6.5 10a5.5 5.5 0 0 1 11 0v4.5l1.8 2.5H4.7l1.8-2.5zM10 19.5a2 2 0 0 0 4 0M3 7.5a8 8 0 0 1 2.2-3.3M21 7.5a8 8 0 0 0-2.2-3.3"/>',
  rings: '<circle cx="9" cy="14.5" r="5"/><circle cx="15" cy="14.5" r="5"/><path d="M7.5 6.5 9 4h3l1.5 2.5L10.5 9z"/>',
  camera: '<path d="M3.5 8h3.5l1.8-2.5h6.4L17 8h3.5v11h-17z"/><circle cx="12" cy="13.3" r="3.4"/>',
  cocktail: '<path d="M4.5 5h13L11 12.5zM11 12.5V20M7.5 20.5h7"/><circle cx="18" cy="5.5" r="2.5"/>',
  dinner: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2.6"/><path d="M3 4v4.5a1.5 1.5 0 0 0 3 0V4M4.5 9.5V20M21 4c-1.8.8-2.5 3.5-2.5 7.5H21M21 4v16"/>',
  car: '<path d="M3 17v-3.5l2.3-5h13.4l2.3 5V17zM3 13.5h18M8 8.5l1-3h6l1 3"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  church: '<path d="M12 2v4M10 4h4M6 21V11l6-5 6 5v10zM10 21v-4a2 2 0 0 1 4 0v4M3 21h18"/>',
  cake: '<path d="M4 20h16v-7H4zM4 15.5c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M8 13V9.5M12 13V9.5M16 13V9.5M8 7.5v-1M12 7.5v-1M16 7.5v-1"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  envelope: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  gift: '<path d="M3.5 10h17v10.5h-17zM2.5 6.5h19V10h-19zM12 6.5v14M12 6.5C10.5 3 6.5 3 7 5.5c.3 1.3 2.8 1 5 1m0 0c1.5-3.5 5.5-3.5 5-1-.3 1.3-2.8 1-5 1"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M16 5.5a3 3 0 0 1 0 5.6M17.5 13.8c2 .6 3.2 2.5 3.2 5.2"/>',
  dress: '<path d="M9.5 3h5l-1 4 4.2 13.5H6.3L10.5 7z"/><path d="M10.5 7h3"/>',
  bowtie: '<path d="M12 12L4 7.5v9zM12 12l8-4.5v9z"/><rect x="10.3" y="10.3" width="3.4" height="3.4" rx="1"/>',
  bouquet: '<circle cx="12" cy="7" r="2.6"/><circle cx="8.2" cy="9.6" r="2.4"/><circle cx="15.8" cy="9.6" r="2.4"/><path d="M9.5 12.5L12 21l2.5-8.5M10 16.5h4"/>',
  candle: '<path d="M9.5 10h5v10.5h-5zM12 10V8M12 3.5c1.4 1.6 1.8 2.7.9 3.6-.6.6-1.6.6-2-.2-.4-.9.1-2 1.1-3.4zM7.5 20.5h9"/>',
  veil: '<path d="M8.5 4.5c2.3-1.4 4.7-1.4 7 0L21 20H3z"/><path d="M12 4v16M7.5 12.5c2.6 1 6.4 1 9 0"/>',
  cord: '<path d="M4 8c3 0 4 8 8 8s5-8 8-8M4 16c3 0 4-8 8-8s5 8 8 8"/>',
  book: '<path d="M4 5.5c3-1 5.5-.8 8 .8 2.5-1.6 5-1.8 8-.8v13c-3-1-5.5-.8-8 .8-2.5-1.6-5-1.8-8-.8z"/><path d="M12 6.3v13M7.5 9.5h2M14.5 9.5h2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9v6M10.5 10.2h2.3a1.2 1.2 0 0 1 0 2.4h-1.6a1.2 1.2 0 0 0 0 2.4h2.3"/>',
  sign: '<path d="M4 6.5h16v8H4z"/><path d="M8 14.5V21M16 14.5V21M7 10.5h10"/>',
  flower: '<circle cx="12" cy="9" r="2"/><path d="M12 5.2c1.4-2.4 4.4-1 3.4 1.6 2.6-.8 3.7 2.4 1.2 3.3 2.2 1.6.3 4.4-1.9 3.2.2 2.7-3.3 3-3.7.4-.4 2.6-3.9 2.3-3.7-.4-2.2 1.2-4.1-1.6-1.9-3.2-2.5-.9-1.4-4.1 1.2-3.3-1-2.6 2-4 3.4-1.6zM12 15v6.5M12 19c-1.5-1.6-3.2-1.8-4.5-1.2"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M6.5 6.5h1v1h-1zM16.5 6.5h1v1h-1zM6.5 16.5h1v1h-1zM14 14h2.5v2.5H14zM18.5 14H20M14 19.5V20h2M18.5 18.5H20V20h-1.5z"/>',
  screen: '<path d="M3 4.5h18v11.5H3zM8.5 20h7M12 16v4"/><path d="M8.5 10.5l2.3 2.3 4.7-4.6"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2.1 0 3.9 1.2 5.1 3 1.2-1.8 3-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
};

const eyebrow = (text, extra = '') => text ? `<p class="eyebrow ${extra}" data-reveal>${esc(text)}</p>` : '';
const pairTitle = (script, bold, extra = '', id = '') =>
  `<h2 class="title ${extra}"${id ? ` id="${id}"` : ''} data-reveal="title"><span class="title__script">${esc(script)}</span> <span class="title__bold">${esc(bold)}</span></h2>`;
// fine gold ornament under titles: two hairlines that draw outward from a small diamond
const divider = `<div class="divider" aria-hidden="true" data-ornament>
  <svg viewBox="0 0 260 20">
    <path class="divider__line" d="M110 10H4" pathLength="1"/><path class="divider__line" d="M150 10H256" pathLength="1"/>
    <circle class="divider__dot" cx="118" cy="10" r="1.7"/><circle class="divider__dot" cx="142" cy="10" r="1.7"/>
    <g class="divider__gem"><ellipse cx="125.5" cy="10.5" rx="6.2" ry="5.2"/><ellipse cx="134.5" cy="10.5" rx="6.2" ry="5.2"/></g>
  </svg>
</div>`;

// premium script heading with a gold hairline echo and a faint chapter number behind it
// (the number is taken from the section's label, e.g. "01 — How it began")
function chapterTitle(text, label) {
  const num = (/^\s*(\d{1,2})/.exec(label || '') || [])[1];
  return `<h2 class="chapter-title" data-reveal="title">
    ${num ? `<span class="chapter-title__num" aria-hidden="true">${esc(num)}</span>` : ''}
    <span class="chapter-title__echo" aria-hidden="true">${esc(text)}</span>
    <span class="chapter-title__text">${esc(text)}</span>
  </h2>`;
}

function circleText(id, text) {
  return `<svg viewBox="0 0 200 200">
    <defs><path id="${id}" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0"/></defs>
    <text><textPath href="#${id}" textLength="474">${esc(text)}</textPath></text>
  </svg>`;
}

/* ---------- Sections ---------- */

function renderChrome(c) {
  $('.envelope__kicker').textContent = c.intro.kicker;
  $('.envelope__names').textContent = c.couple.names;
  $('.envelope__date').textContent = c.wedding.shortDate;
  $('.envelope__monogram').innerHTML = c.couple.logo ? `<img src="${esc(c.couple.logo)}" alt="">` : esc(c.intro.seal);
  $('.envelope__to').textContent = c.intro.addressee || '';
  $('.intro__hint').textContent = c.intro.hint || '';
  $$('.seal-half').forEach((half) => { half.dataset.text = c.intro.seal; });

  $('.nav').innerHTML = `
    <a href="#home" class="nav__brand" aria-label="${esc(c.couple.names)}, back to top">
      <span class="nav__seal" aria-hidden="true"><img src="${esc(c.couple.logoMark || '')}" alt=""></span>
      <span class="nav__brand-text">
        <span class="nav__names">${esc(c.couple.first)}<i>&amp;</i>${esc(c.couple.second)}</span>
        <span class="nav__date">${esc(c.wedding.shortDate)}</span>
      </span>
    </a>
    <ul class="nav__links">
      <span class="nav__glide" aria-hidden="true"></span>
      ${list(c.nav.links, (l) => `<li><a href="#${esc(l.target)}">${esc(l.label)}</a></li>`)}
    </ul>
    <span class="nav__days" aria-hidden="true"><span data-days-left></span></span>
    <a href="#rsvp" class="nav__rsvp magnetic"><span>${esc(c.nav.rsvpLabel)}</span></a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
      <span></span><span></span>
    </button>`;

  // the full-screen phone menu: numbered links on gold hairlines, and a little card with the date and RSVP
  const menuItems = [{ target: 'home', label: c.nav.homeLabel }].concat(
    c.nav.links.map((l) => ({ target: l.target, label: l.menuLabel || l.label })),
    [{ target: 'rsvp', label: c.nav.rsvpLabel }]);
  const arrow = '<svg class="menu__arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  $('#menu').innerHTML = `
    <div class="menu__bg" aria-hidden="true">
      <span class="menu__glow"></span>
      <span class="menu__mark" style="--logo: url('${esc(c.couple.logoMark || '')}')"></span>
    </div>
    <div class="menu__inner">
      <p class="menu__title">${esc(c.nav.menuTitle || 'Menu')}</p>
      <ul class="menu__links">
        ${list(menuItems, (m, i) => `<li style="--i:${i}"><a href="#${esc(m.target)}">
          <span class="menu__num">${String(i).padStart(2, '0')}</span>
          <span class="menu__mask"><span class="menu__label">${esc(m.label)}</span></span>
          ${arrow}
        </a></li>`)}
      </ul>
      <div class="menu__card">
        ${c.nav.menuPhoto ? `<span class="menu__photo"><img src="${esc(c.nav.menuPhoto)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></span>` : ''}
        <div class="menu__when">
          <p class="menu__date">${esc(c.hero.dateLine || c.wedding.shortDate)}</p>
          <p class="menu__days"><span data-days-left></span></p>
          ${c.hero.place ? `<p class="menu__place">${esc(c.hero.place)}</p>` : ''}
        </div>
        <a class="menu__rsvp" href="#rsvp">${esc(c.nav.rsvpLabel)}</a>
      </div>
    </div>`;
}

function renderHero(c) {
  const h = c.hero;
  const arrow = (extra = '') => `<svg class="hero__arrow${extra}" viewBox="0 0 60 60" aria-hidden="true"><path d="M18 4c-8 10-14 24-2 28 10 4 8-12-2-8C2 28 18 48 46 50m0 0-8-6m8 6-9 4"/></svg>`;
  return `
  <section class="hero" id="home">
    <div class="hero__blob hero__blob--1" aria-hidden="true"></div>
    <div class="hero__blob hero__blob--2" aria-hidden="true"></div>
    <canvas class="hero__petals" aria-hidden="true"></canvas>

    <div class="hero__stage">
      <h1 class="sr-only">${esc(c.couple.names)}</h1>
      <p class="hero__welcome">${esc(h.welcome)}</p>
      <span class="hero__name hero__name--first" aria-hidden="true"><span class="split-chars">${esc(c.couple.first)}</span></span>
      <span class="hero__amp" aria-hidden="true">&amp;</span>
      <span class="hero__name hero__name--second" aria-hidden="true"><span class="split-chars">${esc(c.couple.second)}</span></span>

      <div class="arch">
        <img class="arch__sketch" src="${esc(h.sketch)}" alt="${esc(h.illustrationAlt)}">
        <div class="arch__window">
          <div class="arch__kb">
            <img class="arch__still" alt="" hidden>
            <canvas class="arch__ink" aria-hidden="true"></canvas>
          </div>
        </div>
        <svg class="arch__line" viewBox="0 0 593 690" aria-hidden="true">
          <path d="M67.5 614V274A231.5 234 0 0 1 530.5 274V614Z" pathLength="1"/>
        </svg>
        <img class="arch__decor" src="${esc(h.decor)}" alt="">
      </div>

      <p class="hero__date"><span class="hero__rule" aria-hidden="true"></span><span>${esc(h.dateLine)}</span><span class="hero__rule" aria-hidden="true"></span></p>
      <p class="hero__countdown"><strong data-days-left></strong> · ${esc(h.place)}</p>
      <div class="hero__cta">
        ${arrow()}
        <a href="#rsvp" class="btn-rsvp magnetic">${esc(h.rsvpLabel)}</a>
        ${arrow(' hero__arrow--flip')}
      </div>
    </div>

    <a href="#story" class="scroll-cue" aria-label="Scroll down"><span></span></a>

    <!-- details that appear while the arch zooms: light streaks, petals flying past, a light leak,
         viewfinder corners and a title card on the full-screen photo -->
    <div class="fly" aria-hidden="true">
      <span class="fly__leak"></span>
      <div class="fly__burst">
        ${Array.from({ length: 18 }, (_, i) => `<span class="fly__streak" data-angle="${i * 20 + ((i * 7) % 11)}" style="--len:${60 + ((i * 13) % 50)}px"></span>`).join('')}
        ${Array.from({ length: 14 }, (_, i) => `<span class="fly__petal" data-angle="${i * 26 + 8}" data-dist="${0.8 + ((i * 5) % 7) / 10}" data-spin="${(i % 2 ? 1 : -1) * (120 + i * 15)}"></span>`).join('')}
      </div>
      <span class="fly__corner fly__corner--tl"></span><span class="fly__corner fly__corner--tr"></span>
      <span class="fly__corner fly__corner--bl"></span><span class="fly__corner fly__corner--br"></span>
      <div class="fly__card">
        <p class="fly__kicker">${esc(c.intro && c.intro.kicker)}</p>
        <p class="fly__names">${esc(c.couple.names)}</p>
        <span class="fly__rule"></span>
        <p class="fly__date">${esc(c.wedding.shortDate)}</p>
      </div>
    </div>
  </section>`;
}

function renderStory(c) {
  const s = c.story;
  return `
  <section class="section story" id="story">
    <p class="ghost-text" aria-hidden="true" data-drift>${esc(s.backgroundText)}</p>
    <div class="container split">
      <figure class="framed" data-reveal>
        <div class="parallax-img"><img src="${esc(s.image)}" alt="${esc(s.imageAlt)}" loading="lazy" data-lightbox="story"></div>
      </figure>
      <div>
        ${eyebrow(s.eyebrow)}
        ${chapterTitle(s.title, s.eyebrow)}
        ${divider}
        <div class="prose" data-stagger>${list(s.paragraphs, (p) => `<p>${rich(p)}</p>`)}</div>
      </div>
    </div>
  </section>`;
}

function renderPhotoBand(c) {
  const b = c.photoBand;
  return `
  <div class="photo-band" data-band>
    <div class="photo-band__clip">
      <img src="${esc(b.image)}" alt="${esc(b.imageAlt)}" loading="lazy">
      <span class="photo-band__shade" aria-hidden="true"></span>
      <span class="photo-band__sweep" aria-hidden="true"></span>
      ${Array.from({ length: 7 }, (_, i) => `<span class="photo-band__petal" aria-hidden="true" style="--x:${10 + i * 13}%; --d:${9 + (i % 3) * 3}s; --delay:${-i * 2.3}s; --s:${0.7 + (i % 3) * 0.25}"></span>`).join('')}
      <span class="photo-band__corner photo-band__corner--tl" aria-hidden="true"></span><span class="photo-band__corner photo-band__corner--tr" aria-hidden="true"></span>
      <span class="photo-band__corner photo-band__corner--bl" aria-hidden="true"></span><span class="photo-band__corner photo-band__corner--br" aria-hidden="true"></span>
      <div class="photo-band__caption">
        <p class="photo-band__kicker"><i aria-hidden="true"></i><span>${esc(b.kicker)}</span></p>
        <p class="photo-band__script">
          <span class="photo-band__outline" aria-hidden="true">${esc(b.script)}</span>
          <span class="photo-band__fill">${esc(b.script)}</span>
        </p>
        ${b.meta ? `<p class="photo-band__meta">${esc(b.meta)}</p>` : ''}
      </div>
    </div>
  </div>`;
}

function renderProposal(c) {
  const p = c.proposal;
  return `
  <section class="section proposal" id="proposal">
    <div class="container split">
      <div>
        ${eyebrow(p.eyebrow)}
        ${chapterTitle(p.title, p.eyebrow)}
        ${divider}
        <div class="prose" data-stagger>${list(p.paragraphs, (t) => `<p>${rich(t)}</p>`)}</div>
      </div>
      <figure class="proposal__art">
        <img class="proposal__img" src="${esc(p.image)}" alt="${esc(p.imageAlt)}" loading="lazy" data-lightbox="proposal">
        ${p.tag ? `<span class="proposal__tag">${esc(p.tag)} <em>${esc(p.tagScript)}</em></span>` : ''}
      </figure>
    </div>
  </section>`;
}

function renderMarquee(c) {
  const run = list(c.marquee, (m) => (m.style === 'script' ? `<em>${esc(m.text)}</em>` : `<span>${esc(m.text)}</span>`) + '<i>✦</i>');
  // the run is repeated so the loop is seamless
  return `
  <div class="marquee-wrap" aria-hidden="true">
    <div class="marquee"><div class="marquee__track">${run}${run}${run}${run}</div></div>
  </div>`;
}

function renderDetails(c) {
  const d = c.details;
  // the calendar page is worked out from the wedding date itself
  const [year, month, day] = c.wedding.dateTime.slice(0, 10).split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = first.toLocaleString('en-US', { month: 'long' });
  const weekday = new Date(year, month - 1, day).toLocaleString('en-US', { weekday: 'long' });

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<span class="cal__day cal__day--blank"></span>');
  for (let n = 1; n <= daysInMonth; n++) {
    const dow = (first.getDay() + n - 1) % 7;
    const cls = ['cal__day', dow === 0 || dow === 6 ? 'cal__day--weekend' : '', n === day ? 'cal__day--wedding' : ''].join(' ').trim();
    cells.push(n === day
      ? `<span class="${cls}"><span class="cal__num">${n}</span>
           <svg class="cal__ring" viewBox="0 0 64 52"><path d="M36 6C19 3 5 11 5 26s13 22 28 21 26-9 26-22S45 2 26 7" pathLength="1"/></svg>
           <svg class="cal__heart" viewBox="0 0 24 24">${ICONS.heart}</svg></span>`
      : `<span class="${cls}"><span class="cal__num">${n}</span></span>`);
  }

  const button = (btn) => {
    if (!btn) return '';
    if (btn.action === 'addToCalendar') return `<button class="btn" type="button" data-action="add-to-calendar">${esc(btn.label)}</button>`;
    return `<a class="btn" href="${esc(btn.url)}" target="_blank" rel="noopener">${esc(btn.label)}</a>`;
  };
  const venue = (v, side) => `
    <article class="venue venue--${side}">
      <div class="venue__card tilt">
        <div class="venue__art"><img src="${esc(v.image)}" alt="" loading="lazy"></div>
        ${v.time ? `<p class="venue__time">${esc(v.time)}</p>` : ''}
        <h3 class="venue__label">${esc(v.label)}</h3>
        <p class="venue__info">${(v.lines || []).map(esc).join('<br>')}</p>
        ${button(v.button)}
      </div>
    </article>`;
  const [from, to] = d.venues || [];

  return `
  <section class="section details" id="details">
    <div class="container">
      ${eyebrow(d.eyebrow, 'eyebrow--center')}
      ${chapterTitle(d.title, d.eyebrow)}
      ${divider}

      <div class="when-wrap">
        <div class="when" data-when>
          <p class="when__label">${esc(d.date.label)}</p>
          <p class="when__day" aria-hidden="true"><span data-count-to="${day}">${day}</span></p>
          <p class="when__weekday">${esc(weekday)}</p>
          <p class="when__month">${esc(monthName)} ${year}${d.date.time ? ` · ${esc(d.date.time)}` : ''}</p>
          ${button(d.date.button)}
        </div>
        <div class="cal" data-cal aria-hidden="true">
          <div class="cal__rings">${'<i></i>'.repeat(7)}</div>
          <p class="cal__month">${esc(monthName)} <span>${year}</span></p>
          <div class="cal__grid">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => `<span class="cal__dow">${w}</span>`).join('')}
            ${cells.join('')}
          </div>
        </div>
      </div>

      ${from ? `<div class="journey" data-journey>
        ${venue(from, 'from')}
        ${to ? `<div class="journey__road" aria-hidden="true">
          <svg class="journey__svg journey__svg--across" viewBox="0 0 240 160">
            <path class="journey__track" d="M8 92C46 14 96 150 128 84S196 26 232 72"/>
            <path class="journey__trail" d="M8 92C46 14 96 150 128 84S196 26 232 72" pathLength="1"/>
          </svg>
          <svg class="journey__svg journey__svg--down" viewBox="0 0 160 200">
            <path class="journey__track" d="M80 6C14 44 148 84 82 116S22 168 80 194"/>
            <path class="journey__trail" d="M80 6C14 44 148 84 82 116S22 168 80 194" pathLength="1"/>
          </svg>
          <span class="journey__car"><svg viewBox="0 0 24 24">${ICONS.car}</svg></span>
          ${d.journeyLabel ? `<p class="journey__label">${esc(d.journeyLabel)}</p>` : ''}
        </div>
        ${venue(to, 'to')}` : ''}
      </div>` : ''}
    </div>
  </section>`;
}

// "04:30 PM" -> minutes after midnight (used to set the clock hands)
function toMinutes(time) {
  const m = /(\d{1,2})[:.](\d{2})\s*([ap])?/i.exec(time || '');
  if (!m) return 0;
  let h = +m[1] % 12;
  if (m[3] && m[3].toLowerCase() === 'p') h += 12;
  return h * 60 + +m[2];
}

function renderProgram(c) {
  const p = c.program;
  const items = p.items || [];
  const split = (time) => {
    const m = /^\s*(\d{1,2}[:.]\d{2})\s*(.*)$/.exec(time || '');
    return m ? [m[1], m[2]] : [time, ''];
  };
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0;
    return `<line x1="150" y1="${major ? 30 : 33}" x2="150" y2="40" transform="rotate(${i * 6} 150 150)" class="${major ? 'clock__tick clock__tick--major' : 'clock__tick'}"/>`;
  }).join('');
  const numerals = ['XII', 'III', 'VI', 'IX'].map((n, i) => {
    const a = (i * 90 - 90) * Math.PI / 180;
    return `<text x="${(150 + Math.cos(a) * 92).toFixed(1)}" y="${(150 + Math.sin(a) * 92 + 6).toFixed(1)}" class="clock__numeral">${n}</text>`;
  }).join('');

  return `
  <section class="section program" aria-label="${esc(`${p.titleScript || ''} ${p.titleBold || ''}`.trim())}">
    <div class="container">
      ${chapterTitle(`${p.titleScript || ''} ${p.titleBold || ''}`.trim(), '')}
      ${p.subtitle ? `<p class="program__subtitle" data-reveal>${esc(p.subtitle)}</p>` : ''}
      ${divider}

      <div class="day">
        <div class="day__clock-wrap">
          <div class="clock" data-clock aria-hidden="true">
            <svg class="clock__face" viewBox="0 0 300 300">
              <defs>
                <linearGradient id="clock-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bottom)"/>
                </linearGradient>
              </defs>
              <circle cx="150" cy="150" r="146" class="clock__sky"/>
              <circle cx="150" cy="150" r="128" class="clock__dial"/>
              <circle cx="150" cy="150" r="121" class="clock__ring"/>
              ${ticks}
              ${numerals}
              <g class="clock__hand clock__hand--hour"><path d="M150 158V92" /><circle cx="150" cy="96" r="5"/></g>
              <g class="clock__hand clock__hand--minute"><path d="M150 162V52" /><path d="M150 52l-4 10h8z" class="clock__tip"/></g>
              <circle cx="150" cy="150" r="7" class="clock__pin"/>
            </svg>
            <div class="clock__now">
              <span class="clock__icon"><svg viewBox="0 0 24 24">${ICONS[items[0] && items[0].icon] || ICONS.heart}</svg></span>
            </div>
          </div>
          <p class="clock__caption"><span class="clock__time">${esc(items[0] ? items[0].time : '')}</span><span class="clock__name">${esc(items[0] ? items[0].name : '')}</span></p>
          <p class="clock__steps" aria-hidden="true">${items.map((_, i) => `<i${i === 0 ? ' class="is-on"' : ''}></i>`).join('')}</p>
        </div>

        <div class="day__track">
          <span class="day__line" aria-hidden="true"><span class="day__fill"></span></span>
          <ol class="day__list">
          ${list(items, (item, i) => {
            const [hm, ampm] = split(item.time);
            return `
          <li class="moment${i === 0 ? ' is-active' : ''}" data-moment data-minutes="${toMinutes(item.time)}" data-icon="${esc(item.icon || 'heart')}" data-time="${esc(item.time)}" data-name="${esc(item.name)}">
            <span class="moment__dot" aria-hidden="true"></span>
            <p class="moment__time"><span class="moment__hm">${esc(hm)}</span><span class="moment__ampm">${esc(ampm)}</span></p>
            <div class="moment__body">
              <h3 class="moment__name">${esc(item.name)}</h3>
              ${item.note ? `<p class="moment__note">${esc(item.note)}</p>` : ''}
            </div>
            <span class="moment__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[item.icon] || ICONS.heart}</svg></span>
          </li>`;
          })}
          </ol>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSaveTheDate(c) {
  const s = c.saveTheDate;
  const labels = s.countdownLabels || {};
  const middle = Math.floor((s.cards || []).length / 2);
  return `
  <section class="section save-date" aria-label="Save the date">
    <div class="container">
      <div class="sd-cards">
        ${list(s.cards, (card, i) => `
        <div class="sd-card${i === middle ? ' sd-card--middle' : ''}">
          <div class="sd-card__photo">
            <img src="${esc(card.image)}" alt="${esc(card.alt)}" loading="lazy">
            ${card.number ? `<span class="sd-card__num" aria-hidden="true">${esc(card.number)}</span>` : ''}
          </div>
        </div>`)}
      </div>
      <p class="save-date__text" data-reveal>${esc(s.text)}</p>
      <div class="countdown" id="countdown" data-stagger>
        ${['days', 'hours', 'minutes', 'seconds'].map((u) => `<div class="countdown__item"><span class="flip" data-unit="${u}">--</span><small>${esc(labels[u] || u)}</small></div>`).join('')}
      </div>
    </div>
  </section>`;
}

// initials for the little name medallions ("Mr. Johnny Romera" -> "JR")
function initialsOf(name) {
  const words = String(name).replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '').split(/\s+/).filter((w) => /^[a-z]/i.test(w));
  if (!words.length) return '';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
const ringSvg = '<svg class="ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" pathLength="1"/></svg>';
const avatar = (name) => `<span class="ent-av" aria-hidden="true">${ringSvg}<span>${esc(initialsOf(name))}</span></span>`;

// an icon for each role card, picked from its title unless the config names one
function roleIcon(role) {
  if (role.icon && ICONS[role.icon]) return role.icon;
  const t = (role.title || '').toLowerCase();
  const guess = [['best man', 'bowtie'], ['maid', 'bouquet'], ['light', 'candle'], ['clothe', 'veil'], ['veil', 'veil'],
    ['bind', 'cord'], ['cord', 'cord'], ['ring', 'rings'], ['bible', 'book'], ['coin', 'coin'], ['arrha', 'coin'],
    ['bride', 'sign'], ['flower', 'flower']].find(([k]) => t.includes(k));
  return guess ? guess[1] : 'heart';
}

function renderEntourage(c) {
  const e = c.entourage;
  const blocks = e.blocks || [];
  const namesIn = (b) => {
    if (b.type === 'pair') return b.lists.flatMap((l) => l.names);
    if (b.type === 'mirror') return [...((b.left || {}).names || []), ...((b.right || {}).names || [])];
    if (b.type === 'roles') return b.roles.flatMap((r) => r.names);
    if (b.type === 'center') return b.names || [];
    if (b.type === 'columns') return b.roles.flatMap((r) => r.names);
    return [];
  };
  const total = blocks.reduce((n, b) => n + namesIn(b).length, 0);

  const family = (r, side) => {
    const first = r.names[0] || '';
    const surname = first.split(/\s+/).pop();
    return `
    <article class="fam fam--${side}">
      <span class="fam__mono" aria-hidden="true">${ringSvg}<span>${esc(surname[0] || '')}</span></span>
      ${r.title ? `<h4 class="fam__role">${esc(r.title)}</h4>` : ''}
      <p class="fam__family">The ${esc(surname)}</p>
      <ul class="fam__names">${list(r.names, (n) => `<li>${esc(n)}</li>`)}</ul>
    </article>`;
  };
  const roleCard = (r) => `
    <article class="erole">
      <span class="erole__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[roleIcon(r)]}</svg></span>
      ${r.title ? `<h4 class="erole__title">${esc(r.title)}</h4>` : ''}
      <ul class="erole__names">${list(r.names, (n) => `<li>${esc(n)}</li>`)}</ul>
    </article>`;

  const block = (b, i) => {
    switch (b.type) {
      case 'heading': {
        // how many people are in this group (until the next heading)
        let count = 0;
        for (let j = i + 1; j < blocks.length && blocks[j].type !== 'heading'; j++) count += namesIn(blocks[j]).length;
        return `<h3 class="ent-heading" data-ent-heading>
          <span class="ent-heading__line" aria-hidden="true"></span>
          <span class="ent-heading__text">${esc(b.text)}${count ? `<small class="ent-heading__count">${count} ${esc(e.groupCountLabel || '')}</small>` : ''}</span>
          <span class="ent-heading__line" aria-hidden="true"></span>
        </h3>`;
      }
      case 'pair':
        return `<div class="fams" data-fams>
          ${family(b.lists[0], 'left')}
          <span class="fams__amp" aria-hidden="true">&amp;</span>
          ${family(b.lists[1], 'right')}
        </div>`;
      case 'mirror': {
        // one row per pair, joined by a gold line and a heart
        const left = b.left || { names: [] };
        const right = b.right || { names: [] };
        const rows = Math.max(left.names.length, right.names.length);
        const label = [left.title, right.title].filter(Boolean).join(' and ');
        return `<div class="duos" data-duos>
          ${left.title || right.title ? `<div class="duos__titles" aria-hidden="true"><h4>${esc(left.title || '')}</h4><h4>${esc(right.title || '')}</h4></div>` : ''}
          <ul class="duos__list"${label ? ` aria-label="${esc(label)}"` : ''}>
            ${Array.from({ length: rows }, (_, k) => {
              const l = left.names[k] || '', r = right.names[k] || '';
              return `<li class="duo">
                <span class="duo__side duo__side--l">${l ? avatar(l) : ''}<span class="duo__name">${esc(l)}</span></span>
                <span class="duo__link" aria-hidden="true"><i class="duo__line"></i><svg class="duo__heart" viewBox="0 0 24 24">${ICONS.heart}</svg><i class="duo__line"></i></span>
                <span class="duo__side duo__side--r"><span class="duo__name">${esc(r)}</span>${r ? avatar(r) : ''}</span>
              </li>`;
            }).join('')}
          </ul>
        </div>`;
      }
      case 'roles':
        return `<div class="eroles${b.featured ? ' eroles--featured' : ''}" data-eroles>${list(b.roles, roleCard)}</div>`;
      // older config formats still work
      case 'center':
        return block({ type: 'roles', roles: [b] }, i);
      case 'columns':
        if (b.size === 'lg' && b.roles.length === 2) return block({ type: 'pair', lists: b.roles }, i);
        if (b.roles.length === 2 && b.roles.every((r) => !r.title)) return block({ type: 'mirror', left: b.roles[0], right: b.roles[1] }, i);
        return block({ type: 'roles', roles: b.roles }, i);
      default:
        return '';
    }
  };

  return `
  <section class="section entourage" id="entourage">
    <div class="entourage__glow" aria-hidden="true"></div>
    ${e.backgroundText ? `<p class="ent__ghost" aria-hidden="true" data-ent-drift>${esc(e.backgroundText)} · ${esc(e.backgroundText)}</p>` : ''}
    <div class="container ent">
      ${eyebrow(e.eyebrow, 'eyebrow--center')}
      ${chapterTitle(`${e.titleScript || ''} ${e.titleBold || ''}`.trim(), e.eyebrow)}
      ${divider}
      ${e.countLabel ? `<p class="ent__count" data-ent-count><strong data-count-to-ent="${total}">${total}</strong> ${esc(e.countLabel)}</p>` : ''}
      ${list(blocks, block)}
    </div>
  </section>`;
}

function renderFinerDetails(c) {
  const f = c.finerDetails;
  const colors = f.palette.colors || [];
  const mid = (colors.length - 1) / 2;
  return `
  <section class="section finer" id="finer-details">
    ${f.backgroundText ? `<p class="finer__ghost" aria-hidden="true" data-finer-drift>${esc(f.backgroundText)} · ${esc(f.backgroundText)}</p>` : ''}
    <div class="container">
      ${eyebrow(f.eyebrow, 'eyebrow--center eyebrow--light')}
      ${pairTitle(f.titleScript, f.titleBold, 'title--light')}

      <h3 class="finer__heading" data-reveal>${esc(f.attire.heading)}</h3>
      <p class="finer__lead" data-reveal>${rich(f.attire.lead)}</p>
      <div class="attire" data-attire>
        ${list(f.attire.items, (a, i) => `
        <article class="attire-card">
          <span class="attire-card__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <div class="attire-card__art"><img src="${esc(a.image)}" alt="${esc(a.alt)}" loading="lazy"></div>
          <h4 class="attire-card__title">${esc(a.title)}</h4>
          <p class="attire-card__text">${rich(a.text)}</p>
          ${(a.tags || []).length ? `<ul class="attire-card__tags">${list(a.tags, (t) => `<li>${esc(t)}</li>`)}</ul>` : ''}
        </article>`)}
      </div>

      <h3 class="finer__heading" data-reveal>${esc(f.palette.heading)}</h3>
      <p class="finer__lead finer__lead--wide" data-reveal>${rich(f.palette.lead)}</p>
      <div class="fan" data-fan>
        <ul class="fan__chips" aria-label="Wedding color palette">
          ${list(colors, (col, i) => `
          <li class="chip" style="--swatch:${esc(col.hex)}; --i:${(i - mid).toFixed(2)}">
            <button class="chip__card" type="button" data-copy="${esc(col.hex)}" aria-label="${esc(col.name)}, ${esc(col.hex)}. Copy colour code">
              <span class="chip__color"></span>
              <span class="chip__name">${esc(col.name)}</span>
              <span class="chip__hex">${esc(col.hex)}</span>
            </button>
          </li>`)}
        </ul>
        <span class="fan__pin" aria-hidden="true"></span>
      </div>
      ${f.palette.hint ? `<p class="fan__hint" data-reveal><span class="fan__status" aria-live="polite"></span><span class="fan__hint-text">${esc(f.palette.hint)}</span></p>` : ''}
    </div>
  </section>`;
}

function renderPhotoGuide(c) {
  const p = c.photoGuide;
  const steps = p.steps || [];
  return `
  <section class="section photo-guide" id="photo-guide">
    <div class="container">
      ${eyebrow(p.eyebrow, 'eyebrow--center')}
      ${chapterTitle(`${p.titleScript || ''} ${p.titleBold || ''}`.trim(), p.eyebrow)}
      ${divider}
      <p class="pg__intro" data-reveal>${rich(p.intro)}</p>

      <div class="pg">
        <ol class="pg__steps" data-pg-steps>
          ${list(steps, (st, i) => `
          <li class="pg-step${i === 0 ? ' pg-step--main' : ''}">
            <span class="pg-step__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <span class="pg-step__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[st.icon] || ICONS.heart}</svg></span>
            <div class="pg-step__body">
              <h3 class="pg-step__title">${esc(st.title)}</h3>
              <p class="pg-step__text">${rich(st.text)}</p>
              ${i === 0 ? `
              <div class="pg-app">
                <span class="pg-app__qr"><img src="${esc(p.qrImage)}" alt="QR code linking to the wedding photo app" loading="lazy"></span>
                <div class="pg-app__go">
                  <p class="pg-app__url">${esc(p.appUrlLabel)}</p>
                  <a class="pg-btn" href="${esc(p.appUrl)}" target="_blank" rel="noopener">${esc(p.appButtonLabel)}</a>
                </div>
              </div>` : ''}
            </div>
          </li>`)}
        </ol>

        <div class="pg__phone-wrap" data-pg-phone aria-hidden="true">
          <div class="phone">
            <span class="phone__notch"></span>
            <div class="phone__screen">
              <p class="live__bar"><span class="live__dot"></span>${esc(p.liveLabel || 'Live')}<span class="live__title">${esc(p.wallTitle || '')}</span></p>
              <div class="live__feed" data-live-feed></div>
              <p class="live__tag">${esc(p.hashtag)}</p>
            </div>
          </div>
          ${Array.from({ length: 6 }, (_, i) => `<span class="phone__heart" style="--d:${i * 0.9}s; --x:${(i % 3) * 14 - 14}px"><svg viewBox="0 0 24 24">${ICONS.heart}</svg></span>`).join('')}
        </div>
      </div>

      <div class="pg-tag" data-reveal>
        <p class="pg-tag__intro">${rich(p.hashtagIntro)}</p>
        <div class="pg-tag__row">
          <p class="pg-tag__value">${esc(p.hashtag)}</p>
          <button class="pg-tag__copy" type="button" data-copy-tag="${esc(p.hashtag)}" data-copied="${esc(p.copiedLabel || 'Copied!')}">${esc(p.copyLabel || 'Copy')}</button>
        </div>
      </div>

      <div class="pg-notice" data-reveal>
        <span class="pg-notice__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5zM11 17.5h2"/><path d="M4 4l16 16"/></svg></span>
        <div>
          ${p.noticeTitle ? `<p class="pg-notice__title">${esc(p.noticeTitle)}</p>` : ''}
          <p class="pg-notice__text">${rich(p.notice)}</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderGifts(c) {
  const g = c.gifts;
  return `
  <section class="section gifts" id="gifts">
    <div class="container container--narrow">
      ${eyebrow(g.eyebrow, 'eyebrow--center')}
      ${chapterTitle(`${g.titleScript || ''} ${g.titleBold || ''}`.trim(), g.eyebrow)}
      ${divider}
      ${g.lead ? `<p class="gifts__lead" data-reveal>${esc(g.lead)}</p>` : ''}

      <div class="genv" data-genv>
        <span class="genv__back" aria-hidden="true"></span>
        <span class="genv__flap" aria-hidden="true"></span>
        <div class="genv__slot">
          <div class="gcard">
            <span class="gcard__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS.gift}</svg></span>
            <p class="gcard__text">${rich(g.text)}</p>
            ${g.signature ? `<p class="gcard__sign">${esc(g.signature)}</p>` : ''}
          </div>
        </div>
        <span class="genv__pocket" aria-hidden="true"></span>
        ${c.couple.logoMark ? `<span class="genv__seal" aria-hidden="true"><img src="${esc(c.couple.logoMark)}" alt=""></span>` : ''}
      </div>
      ${(g.ways || []).length ? `<ul class="gifts__ways" data-reveal>${list(g.ways, (w) => `<li>${rich(w)}</li>`)}</ul>` : ''}
      ${(g.accounts || []).length ? `
      <div class="gpay">
        ${g.accountsTitle ? `<h3 class="gpay__title" data-reveal>${esc(g.accountsTitle)}</h3>` : ''}
        ${g.accountsNote ? `<p class="gpay__note" data-reveal>${esc(g.accountsNote)}</p>` : ''}
        <div class="gpay__cards" data-gpay>
          ${list(g.accounts, (a) => `
          <article class="gpay-card">
            ${a.sample ? '<span class="gpay-card__sample">Sample</span>' : ''}
            <p class="gpay-card__label">${esc(a.label)}</p>
            <span class="gpay-card__qr"><img src="${esc(a.qr)}" alt="${esc(a.label)} QR code${a.sample ? ' (sample)' : ''}" loading="lazy" data-lightbox="gifts" data-caption="${esc(a.label)}${a.sample ? ' (sample)' : ''}"></span>
            <p class="gpay-card__name">${esc(a.name)}</p>
            <p class="gpay-card__number">${esc(a.number)}</p>
            <button class="gpay-card__copy" type="button" data-copy-tag="${esc(String(a.number).replace(/\s+/g, ''))}" data-copied="Copied!">Copy</button>
          </article>`)}
        </div>
      </div>` : ''}
    </div>
  </section>`;
}

function renderGallery(c) {
  const g = c.gallery;
  return `
  <section class="gallery" id="gallery">
    <div class="container gallery__head">
      ${eyebrow(g.eyebrow, 'eyebrow--center')}
      ${pairTitle(g.titleScript, g.titleBold)}
      ${divider}
      ${g.intro ? `<p class="gallery__intro" data-reveal>${rich(g.intro)}</p>` : ''}
    </div>
    <div class="gallery__body" aria-busy="true"></div>
  </section>`;
}

/* ---------- Gallery photos (images/gallery/1.jpg, 2.jpg, … or a list in config.json) ---------- */

// Finds photos either from an explicit list, or ("auto") by looking for 1.jpg, 2.jpg, … in the folder
async function findPhotos({ folder, photos, captions = {}, extensions, maxPhotos }, describe) {
  folder = (folder || '').replace(/\/?$/, '/');

  if (Array.isArray(photos)) {
    return photos.map((entry, i) => {
      const item = typeof entry === 'string' ? { file: entry } : entry;
      const src = /^(https?:)?\/\//.test(item.file) || item.file.includes('/') ? item.file : folder + item.file;
      return { src, caption: item.caption || '', alt: item.alt || describe(item.caption, i + 1) };
    });
  }

  const exts = extensions || ['jpg', 'jpeg', 'png', 'webp', 'JPG'];
  const max = maxPhotos || 100;
  const exists = (url) => fetch(url, { method: 'HEAD', cache: 'no-cache' }).then((r) => r.ok).catch(() => false);
  const find = async (n) => {
    for (const ext of exts) {
      const url = `${folder}${n}.${ext}`;
      if (await exists(url)) return url;
    }
    return null;
  };

  // a missing number or two (a deleted photo) is skipped; three in a row means the end of the set
  const found = [];
  const batchSize = 6;
  let misses = 0;
  for (let first = 1; first <= max; first += batchSize) {
    const numbers = Array.from({ length: Math.min(batchSize, max - first + 1) }, (_, i) => first + i);
    const urls = await Promise.all(numbers.map(find));
    for (let i = 0; i < urls.length; i++) {
      if (!urls[i]) {
        if (++misses >= 3) return found;
        continue;
      }
      misses = 0;
      const caption = captions[numbers[i]] || '';
      found.push({ src: urls[i], caption, alt: describe(caption, numbers[i]) });
    }
  }
  return found;
}

function loadGalleryPhotos(c) {
  const g = c.gallery;
  return findPhotos({ ...g, folder: g.folder || 'images/gallery/' },
    (caption, n) => caption || `${c.couple.names}, photo ${n}`);
}

function loadHeroPhotos(c) {
  const h = c.hero;
  return findPhotos({ folder: h.photosFolder || 'images/hero-photos/', photos: h.photos },
    (caption, n) => `${c.couple.names}, photo ${n}`);
}

const ZOOM_SLOTS = 7;

// "44 moments & counting": a dark cinematic panel with a gold odometer number, a ring of text,
// polaroids orbiting the number, a row of live counters and a film reel
function momentsBlock(g, photos) {
  const digits = String(photos.length).split('');
  const odometer = digits.map((d) => `
    <span class="odo__col" data-digit="${d}" style="--odo:-${(10 + +d) * 5}%">
      <span class="odo__strip">${Array.from({ length: 20 }, (_, i) => `<span class="odo__digit">${i % 10}</span>`).join('')}</span>
    </span>`).join('');
  // thumbnails live in a "thumbs" folder next to the photos; if one is missing the full photo is used
  const thumb = (src) => src.replace(/([^/]+)$/, 'thumbs/$1');
  const img = (p) => `<img src="${esc(thumb(p.src))}" data-full="${esc(p.src)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=this.dataset.full">`;
  const frames = (list) => list.map((p) => `<span class="reel__frame" data-open="${photos.indexOf(p)}">${img(p)}</span>`).join('');
  const half = Math.ceil(photos.length / 2);
  const rowA = photos.slice(0, half);
  const rowB = photos.slice(half).reverse();

  // polaroids for the orbit, spread evenly through the collection
  const orbitCount = Math.min(10, photos.length);
  const orbit = Array.from({ length: orbitCount }, (_, i) => photos[Math.floor((i * photos.length) / orbitCount)]);

  const ringText = `${g.countWord || ''} ${g.countScript || ''}`.trim().toUpperCase();
  const ring = Array.from({ length: 3 }, () => `${esc(ringText)} ✦ `).join('');

  const day = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stats = (g.stats || []).map((st) => {
    let value = st.value;
    if (st.type === 'photos') value = photos.length;
    if (st.type === 'since') value = Math.max(0, Math.round((today - day(st.date)) / 86400000));
    if (st.type === 'until') value = Math.max(0, Math.round((day(st.date) - today) / 86400000));
    const numeric = typeof value === 'number';
    return `<li class="mstat">
      <span class="mstat__value"${numeric ? ` data-count-up="${value}"` : ''}>${esc(numeric ? value.toLocaleString('en-US') : value)}</span>
      <span class="mstat__label">${esc(st.label)}</span>
    </li>`;
  }).join('<li class="mstat__sep" aria-hidden="true">✦</li>');

  return `
    <div class="moments" data-moments>
      <div class="moments__panel">
        <div class="moments__glow" aria-hidden="true"></div>
        <div class="moments__stage" data-orbit-stage>
          <svg class="moments__ring" viewBox="0 0 400 400" aria-hidden="true">
            <defs><path id="moments-ring" d="M200,200 m-176,0 a176,176 0 1,1 352,0 a176,176 0 1,1 -352,0"/></defs>
            <text><textPath href="#moments-ring" textLength="1100">${ring}</textPath></text>
          </svg>
          <div class="orbit" aria-hidden="true">
            ${orbit.map((p, i) => `<span class="orbit__item" data-open="${photos.indexOf(p)}" style="--tilt:${((i % 3) - 1) * 6}deg"><span class="orbit__photo">${img(p)}</span></span>`).join('')}
          </div>
          <div class="moments__center">
            <p class="moments__word" aria-hidden="true">${esc(g.countWord || '')}</p>
            <p class="moments__count" aria-label="${photos.length} ${esc(g.countLabel || '')}">
              <span class="odo" aria-hidden="true">${odometer}<span class="odo__sheen"></span></span><span class="moments__plus" aria-hidden="true">+</span>
            </p>
            <p class="moments__script" aria-hidden="true">${esc(g.countScript || '')}</p>
          </div>
        </div>
        ${g.countNote ? `<p class="moments__note">${esc(g.countNote)}</p>` : ''}
        ${stats ? `<ul class="mstats">${stats}</ul>` : ''}
        <div class="reel" aria-hidden="true">
          <div class="reel__row"><div class="reel__track">${frames(rowA)}${frames(rowA)}</div></div>
          ${rowB.length ? `<div class="reel__row reel__row--back"><div class="reel__track">${frames(rowB)}${frames(rowB)}</div></div>` : ''}
        </div>
      </div>
    </div>`;
}

// Editorial grid on 12 columns: a repeating pattern of feature, portrait and panorama tiles
// ([columns, rows] per photo), with endings that leave no gaps whatever the photo count
const GRID_PATTERN = [[7, 2], [5, 1], [5, 1], [4, 2], [4, 1], [4, 1], [8, 1]];
const GRID_ENDINGS = {
  1: [[12, 2]], 2: [[6, 2], [6, 2]], 3: [[4, 2], [4, 2], [4, 2]], 4: [[7, 2], [5, 1], [5, 1], [12, 1]],
  5: [[7, 2], [5, 1], [5, 1], [6, 1], [6, 1]], 6: [[7, 2], [5, 1], [5, 1], [4, 2], [8, 1], [8, 1]],
};
function gridSpans(n) {
  const full = Math.floor(n / GRID_PATTERN.length) * GRID_PATTERN.length;
  return Array.from({ length: full }, (_, i) => GRID_PATTERN[i % GRID_PATTERN.length]).concat(GRID_ENDINGS[n - full] || []);
}

function galleryBody(c, photos) {
  const g = c.gallery;
  const zoomPhotos = photos.slice(0, ZOOM_SLOTS);
  const img = (p, extra = '') => `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async"${extra}>`;
  const spans = gridSpans(photos.length);
  const first = photos.length > (g.showFirst || 14) + 4 ? (g.showFirst || 14) : photos.length;
  const viewAll = (g.viewAllLabel || 'View all {count}').replace('{count}', photos.length);
  return `
    <div class="zoom">
      <div class="zoom__sticky">
        ${g.zoomWord ? `<p class="zoom__word" aria-hidden="true">${esc(g.zoomWord)}</p>` : ''}
        ${zoomPhotos.map((p, i) => `<div class="zoom__item zoom__item--${i}"><div class="zoom__frame">${img(p)}</div></div>`).join('')}
        <div class="zoom__shade" aria-hidden="true"></div>
        <div class="zoom__caption">
          ${g.zoomKicker ? `<p class="zoom__kicker">${esc(g.zoomKicker)}</p>` : ''}
          <p class="zoom__tagline">${rich(g.zoomTagline)}</p>
          <span class="zoom__rule" aria-hidden="true"></span>
        </div>
      </div>
    </div>

    ${momentsBlock(g, photos)}
    <div class="pgrid">
      ${photos.map((p, i) => `
      <figure class="pgrid__item${i % 5 === 0 ? ' pgrid__item--m-wide' : ''}" data-index="${i}" style="--c:${spans[i][0]}; --r:${spans[i][1]}"${i >= first ? ' hidden' : ''}>
        <div class="pgrid__media">${img(p, ` data-lightbox="gallery"${p.caption ? ` data-caption="${esc(p.caption)}"` : ''}`)}</div>
        <figcaption class="pgrid__plate" aria-hidden="true">
          <span class="pgrid__num">Nº ${String(i + 1).padStart(2, '0')}</span>
          ${p.caption ? `<span class="pgrid__caption">${esc(p.caption)}</span>` : ''}
        </figcaption>
      </figure>`).join('')}
    </div>
    ${first < photos.length ? `<div class="pgrid__more"><button class="pgrid__more-btn" type="button" data-show-all>
      <span>${esc(viewAll)}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button></div>` : ''}

    <div class="gallery__outro">
      <p class="gallery__outro-kicker" data-reveal>${esc(g.outroKicker)}</p>
      <p class="gallery__outro-text"><span class="split-chars">${esc(g.outroText)}</span></p>
    </div>`;
}

function buildGallery(c, photos) {
  const body = $('.gallery__body');
  if (!photos.length) {
    // nothing in images/gallery yet: hide the section and its menu links
    console.warn(`No gallery photos found in ${c.gallery.folder}. Add 1.jpg, 2.jpg, … to show the gallery.`);
    $('#gallery').remove();
    $$('a[href="#gallery"]').forEach((a) => a.closest('li').remove());
    return;
  }
  body.innerHTML = galleryBody(c, photos);
  body.removeAttribute('aria-busy');
  initGallery(c);
}

function renderFaq(c) {
  const f = c.faq;
  const help = f.help;
  return `
  <section class="section faq" id="faq">
    <div class="container faq__layout">
      <aside class="faq__side">
        ${eyebrow(f.eyebrow)}
        <h2 class="title faq__title" data-reveal="title"><span class="title__script">${esc(f.titleScript)}</span> <span class="title__bold">${esc(f.titleBold)}</span></h2>
        <p class="faq__intro" data-reveal>${rich(f.intro)}</p>
        <label class="faq__search" data-reveal>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
          <input type="search" placeholder="${esc(f.searchPlaceholder || 'Search…')}" aria-label="${esc(f.searchPlaceholder || 'Search questions')}" data-faq-search>
        </label>
        ${help ? `<div class="faq__help" data-reveal>
          <span class="faq__mark" aria-hidden="true">?</span>
          <p class="faq__help-title">${esc(help.title)}</p>
          <p class="faq__help-text">${rich(help.text)}</p>
          ${help.url ? `<a class="btn" href="${esc(help.url)}">${esc(help.label)}</a>` : ''}
        </div>` : ''}
      </aside>

      <div class="faq__list" data-faq-list>
        ${list(f.items, (item, i) => `
        <details class="qa" name="faq"${i === 0 ? ' open' : ''}>
          <summary class="qa__q">
            <span class="qa__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[item.icon] || ICONS.heart}</svg></span>
            <span class="qa__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <span class="qa__text">${esc(item.question)}</span>
            <span class="qa__toggle" aria-hidden="true"></span>
          </summary>
          <div class="qa__a">${list([].concat(item.answer), (p) => `<p>${rich(p)}</p>`)}</div>
        </details>`)}
        <p class="faq__empty" hidden>${esc(f.noResults || 'No matches.')}</p>
      </div>
    </div>
  </section>`;
}

function renderRsvp(c) {
  const r = c.rsvp;
  return `
  <section class="rsvp" id="rsvp">
    <div class="rsvp__badge" aria-hidden="true">${circleText('rsvp-circle', r.badgeText)}</div>
    <div class="container container--narrow">
      <p class="rsvp__kicker" data-reveal>${esc(r.kicker)}</p>
      <h2 class="rsvp__title" data-reveal="title">${esc(r.title)}</h2>
      <a class="btn-rsvp btn-rsvp--light magnetic" id="rsvp-button" href="${esc(r.url)}" target="_blank" rel="noopener" data-reveal>${esc(r.buttonLabel)}</a>
    </div>
  </section>`;
}

function renderFooter(c) {
  const f = c.footer;
  $('.site-footer').innerHTML = `
    ${c.couple.logo ? `<img class="site-footer__logo" src="${esc(c.couple.logo)}" alt="${esc(c.couple.names)} logo" loading="lazy" data-reveal>` : ''}
    <p class="site-footer__kicker">${esc(f.kicker)}</p>
    <p class="site-footer__names">${esc(c.couple.names)}</p>
    <p class="site-footer__date">${esc(f.date)}</p>
    <p class="site-footer__tag">${esc(f.hashtag)}</p>
    <a href="#home" class="site-footer__top">${esc(f.backToTop)}</a>`;
}

function applyTheme(c) {
  const root = document.documentElement.style;
  Object.entries((c.theme && c.theme.colors) || {}).forEach(([name, value]) => root.setProperty(`--${name}`, value));
  // Browsers pick these up live from config.json. Messenger/Instagram previews read the copy that
  // update-share-preview.py writes into index.html, because those apps don't run JavaScript.
  const headTag = (selector, create) => document.head.querySelector(selector) || document.head.appendChild(create());
  const meta = (name) => headTag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }));
  const link = (rel) => headTag(`link[rel="${rel}"]`, () => Object.assign(document.createElement('link'), { rel }));

  document.title = c.site.title;
  meta('description').content = c.site.description || '';
  if (c.theme && c.theme.colors && c.theme.colors.rust) meta('theme-color').content = c.theme.colors.rust;
  if (c.site.tabIcon) link('icon').href = c.site.tabIcon;
  if (c.site.appleTouchIcon) link('apple-touch-icon').href = c.site.appleTouchIcon;
}

function renderSite(c) {
  applyTheme(c);
  renderChrome(c);
  $('#main').innerHTML = [
    renderHero, renderStory, renderPhotoBand, renderProposal, renderMarquee, renderDetails,
    renderProgram, renderSaveTheDate, renderEntourage, renderFinerDetails, renderPhotoGuide,
    renderGifts, renderGallery, renderFaq, renderRsvp,
  ].map((section) => section(c)).join('');
  renderFooter(c);
}

function showLoadError(error) {
  // self-contained: this must work even if script.js failed to load
  const $ = (sel) => document.querySelector(sel);
  document.documentElement.classList.remove('is-loading');
  $('.intro') && $('.intro').remove();
  $('.nav-wrap') && $('.nav-wrap').remove();
  const fileProtocol = location.protocol === 'file:';
  $('#main').innerHTML = `
    <section class="load-error">
      <h1>The page content couldn't be loaded</h1>
      ${fileProtocol
        ? `<p>This site reads its text and photos from <code>config.json</code>. Browsers block that when <code>index.html</code> is opened straight from a folder.</p>
           <p>Preview it through a local web server instead, for example:</p>
           <ul>
             <li>VS Code: install the <strong>Live Server</strong> extension, then right-click <code>index.html</code> → <em>Open with Live Server</em>.</li>
             <li>Or in a terminal in this folder run <code>python -m http.server</code> and open <a href="http://localhost:8000">http://localhost:8000</a>.</li>
           </ul>
           <p>Once the site is uploaded to a web host this works automatically.</p>`
        : `<p>There may be a typo in <code>config.json</code> (for example a missing comma or quote).</p>
           <p class="load-error__detail">${esc(error && error.message)}</p>`}
    </section>`;
}

fetch('config.json', { cache: 'no-cache' })
  .then((response) => {
    if (!response.ok) throw new Error(`config.json: ${response.status} ${response.statusText}`);
    return response.json();
  })
  .then((config) => {
    renderSite(config);
    initSite(config);
    // photos fill in on their own, so a photo problem never takes the rest of the page down
    loadHeroPhotos(config)
      .then((photos) => startArchPhotos(config, photos))
      .catch((error) => console.error('Hero photos:', error));
    loadGalleryPhotos(config)
      .then((photos) => buildGallery(config, photos))
      .catch((error) => console.error('Gallery:', error));
  })
  .catch((error) => {
    console.error(error);
    showLoadError(error);
  });
