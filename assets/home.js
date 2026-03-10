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


  document.querySelectorAll('.reveal-track').forEach((track) => {
    Array.from(track.querySelectorAll('[data-reveal-item]')).forEach((item, index) => {
      item.style.setProperty('--reveal-index', String(index));
    });
  });

  const progressSections = Array.from(document.querySelectorAll('.home-section, .final-cta'));
  const updateSectionProgress = () => {
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    progressSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const total = viewport + rect.height;
      const raw = (viewport - rect.top) / total;
      const progress = Math.max(0, Math.min(1, raw));
      section.style.setProperty('--section-progress', progress.toFixed(3));
    });
  };

  updateSectionProgress();
  window.addEventListener('scroll', () => window.requestAnimationFrame(updateSectionProgress), { passive: true });
  window.addEventListener('resize', updateSectionProgress);

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

  const revealItems = document.querySelectorAll('.reveal-on-scroll');
  if (reducedMotion) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    revealQuote();
    runCounters();
    return;
  }

  let quoteRevealed = false;
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.28;
      entry.target.classList.toggle('is-visible', isVisible);

      if (!isVisible) return;

      if (entry.target.id === 'citation-club' && !quoteRevealed) {
        quoteRevealed = true;
        revealQuote();
      }

      if (entry.target.id === 'chiffres-club') {
        runCounters();
      }
    });
  }, {
    threshold: [0, 0.2, 0.28, 0.45],
    rootMargin: '0px 0px -14% 0px'
  });

  revealItems.forEach((item) => revealObserver.observe(item));
})();
