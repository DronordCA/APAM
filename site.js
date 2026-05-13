/* APAM · site.js — comportement partagé (nav, curseur, reveals, drawer, progress) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const onScroll = (fn) => { let raf; window.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { fn(); raf = null; }); }, { passive: true }); };

  /* ── Cursor ── */
  const cd = $('#cur-dot'), cr = $('#cur-ring');
  if (cd && cr && !matchMedia('(hover:none)').matches) {
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; cd.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`; });
    (function tick() { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; cr.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(tick); })();
  }

  /* ── Nav scroll state + progress bar ── */
  const nav = $('#nav'), pgb = $('#pg-bar');
  const updateScroll = () => {
    if (nav) nav.classList.toggle('s', scrollY > 24);
    if (pgb) {
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? (scrollY / max) * 100 : 0;
      pgb.style.width = pct + '%';
    }
  };
  updateScroll();
  onScroll(updateScroll);

  /* ── Mobile drawer ── */
  const burger = $('#burger'), drawer = $('#drawer'), mClose = $('#m-close');
  const setDrawer = (open) => {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger?.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  mClose?.addEventListener('click', () => setDrawer(false));
  $$('.m-nav a').forEach(a => a.addEventListener('click', () => setDrawer(false)));

  /* ── Reveal on scroll ── */
  const targets = $$('[data-r]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { rootMargin: '-8% 0% -8% 0%', threshold: 0.12 });
    targets.forEach(t => io.observe(t));
  } else { targets.forEach(t => t.classList.add('on')); }

  /* ── Counters ── */
  $$('[data-cnt]').forEach(el => {
    const target = +el.dataset.cnt;
    let started = false;
    const start = () => {
      if (started) return; started = true;
      const dur = 1600, t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased).toLocaleString('fr-FR');
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    };
    new IntersectionObserver((entries) => { entries.forEach(e => e.isIntersecting && start()); }, { threshold: 0.4 }).observe(el);
  });

  /* ── Smooth anchor offset for nav height ── */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const t = id && document.getElementById(id);
      if (t) {
        e.preventDefault();
        const y = t.getBoundingClientRect().top + scrollY - 88;
        scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
})();
