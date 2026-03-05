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
    const words = sentence.split(/\s+/).filter(Boolean);
    quoteText.textContent = '';
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'quote-word';
      span.style.setProperty('--word-index', String(index));
      span.textContent = `${word}${index < words.length - 1 ? ' ' : ''}`;
      quoteText.appendChild(span);
    });
  }

  const revealItems = document.querySelectorAll('.reveal-on-scroll');
  if (reducedMotion) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    if (quoteText) quoteText.closest('.club-quote')?.classList.add('is-animated');
    return;
  }

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.id === 'citation-club') {
        entry.target.querySelector('.club-quote')?.classList.add('is-animated');
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });

  revealItems.forEach((item) => revealObserver.observe(item));
})();
