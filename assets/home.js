(() => {
  const CONFIG = {
    LOCATION: {
      lat: 48.761111,
      lng: 0.655556
    }
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollIndicator = document.querySelector('.hero-scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
      const targetSelector = scrollIndicator.getAttribute('data-scroll-target');
      const target = targetSelector ? document.querySelector(targetSelector) : null;
      if (!target) return;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  const locationString = `${CONFIG.LOCATION.lat},${CONFIG.LOCATION.lng}`;
  const links = {
    'plan-link': `https://maps.apple.com/?daddr=${locationString}`,
    'google-link': `https://www.google.com/maps/dir/?api=1&destination=${locationString}`,
    'waze-link': `https://waze.com/ul?ll=${locationString}&navigate=yes`
  };

  Object.entries(links).forEach(([id, href]) => {
    const element = document.getElementById(id);
    if (element) element.setAttribute('href', href);
  });



  const runwayStage = document.querySelector('[data-runway-stage]');
  const setRunwayProgress = () => {
    if (!runwayStage) return;
    const rect = runwayStage.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const start = viewportHeight * 0.92;
    const end = -rect.height * 0.15;
    const rawProgress = (start - rect.top) / (start - end);
    const progress = Math.min(1, Math.max(0, rawProgress));
    runwayStage.style.setProperty('--runway-progress', progress.toFixed(3));
  };

  const quoteText = document.querySelector('[data-quote-typing]');
  const revealQuote = () => {
    if (!quoteText) return;
    quoteText.classList.add('is-typing');
    quoteText.closest('.club-quote')?.classList.add('is-animated');
  };

  if (quoteText) {
    const sentence = (quoteText.textContent || '').trim();
    const chars = Array.from(sentence);
    quoteText.textContent = '';
    chars.forEach((char, index) => {
      const span = document.createElement('span');
      span.className = 'quote-word';
      span.style.setProperty('--word-index', String(index));
      span.textContent = char;
      quoteText.appendChild(span);
    });
  }

  const counterNodes = Array.from(document.querySelectorAll('[data-counter-target]'));
  let countersStarted = false;

  const formatCounterValue = (value, suffix = '') => {
    const rounded = Math.round(value);
    return `${rounded.toLocaleString('fr-FR')}${suffix}`;
  };

  const runCounters = () => {
    if (countersStarted) return;
    countersStarted = true;

    const duration = reducedMotion ? 0 : 2100;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = duration === 0 ? 1 : Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      counterNodes.forEach((node) => {
        const target = Number(node.getAttribute('data-counter-target') || 0);
        const suffix = node.getAttribute('data-counter-suffix') || '';
        const current = target * eased;
        node.textContent = formatCounterValue(current, suffix);
      });

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    window.requestAnimationFrame(tick);
  };

  const bidirectionalSections = [
    document.getElementById('histoire'),
    document.getElementById('localisation')
  ].filter(Boolean);

  if (reducedMotion) {
    bidirectionalSections.forEach((section) => section.classList.add('is-visible'));
    revealQuote();
    runCounters();
    if (runwayStage) runwayStage.style.setProperty('--runway-progress', '1');
    return;
  }

  let quoteRevealed = false;
  const quoteSection = document.getElementById('citation-club');
  const chiffreSection = document.getElementById('chiffres-club');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.id === 'histoire' || entry.target.id === 'localisation') {
        entry.target.classList.toggle('is-visible', entry.isIntersecting && entry.intersectionRatio >= 0.55);
        return;
      }

      if (entry.target.id === 'citation-club' && entry.isIntersecting && entry.intersectionRatio >= 0.6 && !quoteRevealed) {
        quoteRevealed = true;
        revealQuote();
      }

      if (entry.target.id === 'chiffres-club' && entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        runCounters();
      }
    });
  }, {
    threshold: [0, 0.35, 0.55, 0.6],
    rootMargin: '0px 0px -12% 0px'
  });

  bidirectionalSections.forEach((section) => observer.observe(section));
  if (quoteSection) observer.observe(quoteSection);
  if (chiffreSection) observer.observe(chiffreSection);

  let runwayTicking = false;
  const requestRunwayUpdate = () => {
    if (runwayTicking) return;
    runwayTicking = true;
    window.requestAnimationFrame(() => {
      setRunwayProgress();
      runwayTicking = false;
    });
  };

  setRunwayProgress();
  window.addEventListener('scroll', requestRunwayUpdate, { passive: true });
  window.addEventListener('resize', requestRunwayUpdate);
})();
