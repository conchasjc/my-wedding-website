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
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2.1 0 3.9 1.2 5.1 3 1.2-1.8 3-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
};

const eyebrow = (text, extra = '') => text ? `<p class="eyebrow ${extra}" data-reveal>${esc(text)}</p>` : '';
const pairTitle = (script, bold, extra = '', id = '') =>
  `<h2 class="title ${extra}"${id ? ` id="${id}"` : ''} data-reveal="title"><span class="title__script">${esc(script)}</span> <span class="title__bold">${esc(bold)}</span></h2>`;
const divider = '<div class="divider" aria-hidden="true" data-reveal><i></i></div>';

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
  $('.envelope__monogram').textContent = c.intro.seal;
  $('.envelope__to').textContent = c.intro.addressee || '';
  $('.intro__hint').textContent = c.intro.hint || '';
  $$('.seal-half').forEach((half) => { half.dataset.text = c.intro.seal; });

  $('.nav').innerHTML = `
    <a href="#home" class="nav__brand" aria-label="${esc(c.couple.names)}, back to top">${brand(c.couple.brand)}</a>
    <ul class="nav__links">
      ${list(c.nav.links, (l) => `<li><a href="#${esc(l.target)}">${esc(l.label)}</a></li>`)}
    </ul>
    <a href="#rsvp" class="nav__rsvp magnetic">${esc(c.nav.rsvpLabel)}</a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
      <span></span><span></span>
    </button>`;

  $('#menu').innerHTML = `
    <ul class="menu__links">
      <li><a href="#home">${esc(c.nav.homeLabel)}</a></li>
      ${list(c.nav.links, (l) => `<li><a href="#${esc(l.target)}">${esc(l.menuLabel || l.label)}</a></li>`)}
      <li><a href="#rsvp">${esc(c.nav.rsvpLabel)}</a></li>
    </ul>
    <p class="menu__foot">${esc(c.nav.menuFooter)}</p>`;
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
        <h2 class="title-outline" data-reveal="title">${esc(s.title)}</h2>
        ${divider}
        <div class="prose" data-stagger>${list(s.paragraphs, (p) => `<p>${rich(p)}</p>`)}</div>
      </div>
    </div>
  </section>`;
}

function renderPhotoBand(c) {
  const b = c.photoBand;
  return `
  <div class="photo-band">
    <div class="photo-band__clip">
      <img src="${esc(b.image)}" alt="${esc(b.imageAlt)}" loading="lazy">
      <p class="photo-band__caption"><span>${esc(b.kicker)}</span><em>${esc(b.script)}</em></p>
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
        <h2 class="title-outline" data-reveal="title">${esc(p.title)}</h2>
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
      <h2 class="title-outline" data-reveal="title">${esc(d.title)}</h2>
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

function renderProgram(c) {
  const p = c.program;
  return `
  <section class="section program" aria-labelledby="program-title">
    <div class="container">
      ${pairTitle(p.titleScript, p.titleBold, '', 'program-title')}
      <div class="timeline" style="--count:${(p.items || []).length}">
        <div class="timeline__line" aria-hidden="true"><span class="timeline__fill"></span></div>
        <ol class="timeline__list">
          ${list(p.items, (item) => `
          <li class="stop">
            <div class="stop__icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[item.icon] || ICONS.heart}</svg></div>
            <div><span class="stop__time">${esc(item.time)}</span><span class="stop__name">${esc(item.name)}</span></div>
          </li>`)}
        </ol>
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
        ${list(s.cards, (card, i) => `<div class="sd-card${i === middle ? ' sd-card--middle' : ''}"><img src="${esc(card.image)}" alt="${esc(card.alt)}" loading="lazy"></div>`)}
      </div>
      <p class="save-date__text" data-reveal>${esc(s.text)}</p>
      <div class="countdown" id="countdown" data-stagger>
        ${['days', 'hours', 'minutes', 'seconds'].map((u) => `<div class="countdown__item"><span class="flip" data-unit="${u}">--</span><small>${esc(labels[u] || u)}</small></div>`).join('')}
      </div>
    </div>
  </section>`;
}

function renderEntourage(c) {
  const e = c.entourage;
  const nameList = (names, cls) => `<ul class="${cls}">${list(names, (n) => `<li>${esc(n)}</li>`)}</ul>`;
  const tile = (r) => `
    <article class="ent-role">
      ${r.title ? `<h4 class="ent-role__title">${esc(r.title)}</h4>` : ''}
      ${nameList(r.names, 'ent-role__names')}
    </article>`;
  const card = (r, side) => `
    <article class="ent-card ent-card--${side}">
      ${r.title ? `<h4 class="ent-card__role">${esc(r.title)}</h4>` : ''}
      ${nameList(r.names, 'ent-card__names')}
    </article>`;

  const block = (b) => {
    switch (b.type) {
      case 'heading':
        return `<h3 class="ent-heading" data-ent-heading>
          <span class="ent-heading__line" aria-hidden="true"></span>
          <span class="ent-heading__text">${esc(b.text)}</span>
          <span class="ent-heading__line" aria-hidden="true"></span>
        </h3>`;
      case 'pair':
        return `<div class="ent-pair" data-ent-pair>
          ${card(b.lists[0], 'left')}
          <span class="ent-pair__amp" aria-hidden="true">&amp;</span>
          ${card(b.lists[1], 'right')}
        </div>`;
      case 'mirror': {
        // two lists side by side, read as pairs (sponsor couples, groomsman + bridesmaid)
        const left = b.left || { names: [] };
        const right = b.right || { names: [] };
        const rows = Math.max(left.names.length, right.names.length);
        const label = [left.title, right.title].filter(Boolean).join(' and ');
        return `<div class="ent-mirror" data-ent-mirror>
          ${left.title || right.title ? `<div class="ent-mirror__titles" aria-hidden="true">
            <h4>${esc(left.title || '')}</h4><i></i><h4>${esc(right.title || '')}</h4>
          </div>` : ''}
          <ul class="ent-mirror__rows"${label ? ` aria-label="${esc(label)}"` : ''}>
            ${Array.from({ length: rows }, (_, i) => `
            <li class="ent-row">
              <span class="ent-row__name ent-row__name--left">${esc(left.names[i] || '')}</span>
              <i class="ent-row__mark" aria-hidden="true"></i>
              <span class="ent-row__name ent-row__name--right">${esc(right.names[i] || '')}</span>
            </li>`).join('')}
          </ul>
        </div>`;
      }
      case 'roles':
        return `<div class="ent-roles${b.featured ? ' ent-roles--featured' : ''}" data-stagger>${list(b.roles, tile)}</div>`;
      // older config formats still work
      case 'center':
        return block({ type: 'roles', roles: [b] });
      case 'columns':
        if (b.size === 'lg' && b.roles.length === 2) return block({ type: 'pair', lists: b.roles });
        if (b.roles.length === 2 && b.roles.every((r) => !r.title)) return block({ type: 'mirror', left: b.roles[0], right: b.roles[1] });
        return block({ type: 'roles', roles: b.roles });
      default:
        return '';
    }
  };

  return `
  <section class="section entourage" id="entourage">
    <div class="entourage__glow" aria-hidden="true"></div>
    <div class="container ent">
      ${eyebrow(e.eyebrow, 'eyebrow--center')}
      ${pairTitle(e.titleScript, e.titleBold)}
      ${e.monogram ? `<img class="entourage__monogram" src="${esc(e.monogram)}" alt="${esc(c.couple.names)} monogram" loading="lazy" data-reveal>` : ''}
      ${list(e.blocks, block)}
    </div>
  </section>`;
}

function renderFinerDetails(c) {
  const f = c.finerDetails;
  return `
  <section class="section finer" id="finer-details">
    <div class="container">
      ${eyebrow(f.eyebrow, 'eyebrow--center eyebrow--light')}
      ${pairTitle(f.titleScript, f.titleBold, 'title--light')}

      <h3 class="finer__heading" data-reveal>${esc(f.attire.heading)}</h3>
      <p class="finer__lead" data-reveal>${rich(f.attire.lead)}</p>
      <div class="attire" data-stagger>
        ${list(f.attire.items, (a) => `
        <article class="attire__item">
          <div class="attire__img"><img src="${esc(a.image)}" alt="${esc(a.alt)}" loading="lazy"></div>
          <h4>${esc(a.title)}</h4>
          <p>${rich(a.text)}</p>
        </article>`)}
      </div>

      <h3 class="finer__heading" data-reveal>${esc(f.palette.heading)}</h3>
      <p class="finer__lead finer__lead--wide" data-reveal>${rich(f.palette.lead)}</p>
      <ul class="palette" aria-label="Wedding color palette">
        ${list(f.palette.colors, (col, i) => `<li style="--swatch:${esc(col.hex)}; --d:${-i * 1.5}s" title="${esc(col.hex)}"><span>${esc(col.name)}</span></li>`)}
      </ul>
    </div>
  </section>`;
}

function renderPhotoGuide(c) {
  const p = c.photoGuide;
  return `
  <section class="section photo-guide" id="photo-guide">
    <div class="container split">
      <div class="photo-guide__copy">
        ${eyebrow(p.eyebrow, 'eyebrow--center')}
        ${pairTitle(p.titleScript, p.titleBold)}
        ${divider}
        <p class="prose prose--center" data-reveal>${rich(p.intro)}</p>
        <div class="photo-app" data-reveal>
          <div class="photo-app__qr"><img src="${esc(p.qrImage)}" alt="QR code linking to the wedding photo app" loading="lazy"></div>
          <div>
            <p class="photo-app__url">${esc(p.appUrlLabel)}</p>
            <a class="btn btn--block" href="${esc(p.appUrl)}" target="_blank" rel="noopener">${esc(p.appButtonLabel)}</a>
          </div>
        </div>
        <p class="prose prose--center" data-reveal>${rich(p.hashtagIntro)}</p>
        <p class="hashtag" data-reveal>${esc(p.hashtag)}</p>
      </div>
      <figure class="photo-guide__mock"><img src="${esc(p.mockupImage)}" alt="${esc(p.mockupAlt)}" loading="lazy"></figure>
    </div>
    <div class="container"><p class="notice" data-reveal>${rich(p.notice)}</p></div>
  </section>`;
}

function renderGifts(c) {
  const g = c.gifts;
  return `
  <section class="section gifts" id="gifts">
    <div class="container container--narrow">
      ${pairTitle(g.titleScript, g.titleBold)}
      ${divider}
      <div class="gift-card" data-reveal>
        <svg class="gift-card__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10h17v10.5h-17zM2.5 6.5h19V10h-19zM12 6.5v14M12 6.5C10.5 3 6.5 3 7 5.5c.3 1.3 2.8 1 5 1m0 0c1.5-3.5 5.5-3.5 5-1-.3 1.3-2.8 1-5 1"/></svg>
        <p>${rich(g.text)}</p>
      </div>
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

  const found = [];
  const batchSize = 6;
  for (let first = 1; first <= max; first += batchSize) {
    const numbers = Array.from({ length: Math.min(batchSize, max - first + 1) }, (_, i) => first + i);
    const urls = await Promise.all(numbers.map(find));
    for (let i = 0; i < urls.length; i++) {
      if (!urls[i]) return found;
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

function galleryBody(c, photos) {
  const g = c.gallery;
  const zoomPhotos = photos.slice(0, ZOOM_SLOTS);
  const img = (p, extra = '') => `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async"${extra}>`;
  return `
    <div class="zoom">
      <div class="zoom__sticky">
        ${zoomPhotos.map((p, i) => `<div class="zoom__item zoom__item--${i}"><div class="zoom__frame">${img(p)}</div></div>`).join('')}
        <div class="zoom__shade" aria-hidden="true"></div>
        <div class="zoom__caption">
          ${g.zoomKicker ? `<p class="zoom__kicker">${esc(g.zoomKicker)}</p>` : ''}
          <p class="zoom__tagline">${rich(g.zoomTagline)}</p>
        </div>
      </div>
    </div>

    <p class="pgrid__meta" data-reveal><span class="pgrid__count" data-count="${photos.length}">${photos.length}</span><span>${esc(g.countLabel)}</span></p>
    <div class="pgrid">
      ${photos.map((p, i) => `
      <figure class="pgrid__item" data-index="${i}">
        ${img(p, ` data-lightbox="gallery"${p.caption ? ` data-caption="${esc(p.caption)}"` : ''}`)}
        <figcaption class="pgrid__overlay" aria-hidden="true">
          <span class="pgrid__num">${String(i + 1).padStart(2, '0')}</span>
          ${p.caption ? `<span class="pgrid__caption">${esc(p.caption)}</span>` : ''}
        </figcaption>
      </figure>`).join('')}
    </div>

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
  return `
  <section class="section faq" id="faq">
    <div class="container container--narrow">
      ${eyebrow(f.eyebrow, 'eyebrow--center')}
      ${pairTitle(f.titleScript, f.titleBold)}
      ${divider}
      <p class="faq__intro" data-reveal>${rich(f.intro)}</p>
      <div class="faq__list" data-stagger>
        ${list(f.items, (item, i) => `
        <details${i === 0 ? ' open' : ''}>
          <summary><span class="faq__num">${String(i + 1).padStart(2, '0')}</span>${esc(item.question)}</summary>
          <div class="faq__answer">${list([].concat(item.answer), (p) => `<p>${rich(p)}</p>`)}</div>
        </details>`)}
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
  document.documentElement.classList.remove('is-loading');
  $('.intro').remove();
  $('.nav-wrap').remove();
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
