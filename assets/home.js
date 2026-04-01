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

  const revealQuote = () => {
    if (!quoteText) return;
    quoteText.classList.add('is-typing');
    quoteText.closest('.club-quote')?.classList.add('is-animated');
  };

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
        node.textContent = formatCounterValue(target * eased, suffix);
      });

      if (progress < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  };

  const revealItems = Array.from(document.querySelectorAll('.reveal-on-scroll [data-reveal-item]'));
  revealItems.forEach((item, index) => item.style.setProperty('--reveal-order', String(index % 8)));

  const sections = Array.from(document.querySelectorAll('.reveal-on-scroll'));
  const revealSection = (section) => {
    section.classList.add('is-visible');
    section.querySelectorAll('[data-reveal-item]').forEach((item) => item.classList.add('is-revealed'));
  };

  if (reducedMotion) {
    sections.forEach(revealSection);
    revealQuote();
    runCounters();
    return;
  }

  if (!('IntersectionObserver' in window)) {
    sections.forEach(revealSection);
    revealQuote();
    runCounters();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const section = entry.target.closest('.reveal-on-scroll');
      entry.target.classList.add('is-revealed');
      if (section) section.classList.add('is-visible');

      if (section?.id === 'citation-club') revealQuote();
      if (section?.id === 'chiffres-club') runCounters();

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -8% 0px'
  });

  revealItems.forEach((item) => observer.observe(item));

})();
