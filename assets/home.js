(() => {
  const CONFIG = {
    MEMBERS_COUNT_FALLBACK: 120,
    MEMBERS_COUNT_URL: "",
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

  const revealItems = document.querySelectorAll('.reveal-on-scroll');
  if (reducedMotion) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const countEls = document.querySelectorAll('.js-count[data-target]');

  function formatCount(value) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(value));
  }

  function animateCount(el, { duration = 1800 } = {}) {
    const target = Number(el.dataset.target || 0);
    if (!Number.isFinite(target)) return;
    if (reducedMotion) {
      el.textContent = `${formatCount(target)}${el.dataset.suffix || ''}`;
      return;
    }

    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = `${formatCount(current)}${el.dataset.suffix || ''}`;
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  function updateMembersCount() {
    const membersEl = document.querySelector('.js-count[data-count-type="members"]');
    if (!membersEl) return Promise.resolve();
    membersEl.dataset.target = String(CONFIG.MEMBERS_COUNT_FALLBACK);

    if (!CONFIG.MEMBERS_COUNT_URL) return Promise.resolve();

    return fetch(CONFIG.MEMBERS_COUNT_URL)
      .then((response) => {
        if (!response.ok) throw new Error('members count fetch failed');
        return response.json();
      })
      .then((payload) => {
        const parsed = Number(payload.count ?? payload.members ?? payload.value);
        if (Number.isFinite(parsed) && parsed > 0) {
          membersEl.dataset.target = String(parsed);
        }
      })
      .catch(() => {
        membersEl.dataset.target = String(CONFIG.MEMBERS_COUNT_FALLBACK);
      });
  }

  updateMembersCount().finally(() => {
    const numbersSection = document.getElementById('chiffres-club');
    if (!numbersSection) return;

    const membersEl = document.querySelector('.js-count[data-count-type="members"]');
    const heroCountEls = numbersSection.querySelectorAll('.js-count-hero[data-counter-key]');
    if (membersEl) {
      const memberHero = numbersSection.querySelector('.js-count-hero[data-counter-key="members"]');
      if (memberHero) {
        memberHero.dataset.target = membersEl.dataset.target || String(CONFIG.MEMBERS_COUNT_FALLBACK);
        memberHero.dataset.suffix = membersEl.dataset.suffix || '+';
      }
    }

    heroCountEls.forEach((heroEl) => {
      const key = heroEl.dataset.counterKey;
      const matchingCounter = key ? numbersSection.querySelector(`.js-count[data-counter-key="${key}"]`) : null;
      if (matchingCounter) {
        heroEl.dataset.target = matchingCounter.dataset.target || '0';
        heroEl.dataset.suffix = matchingCounter.dataset.suffix || '';
      }
      heroEl.textContent = `${formatCount(Number(heroEl.dataset.target || 0))}${heroEl.dataset.suffix || ''}`;
    });

    const runCounters = () => {
      countEls.forEach((el) => animateCount(el));
    };

    const runNumbersExperience = () => {
      heroCountEls.forEach((heroEl) => animateCount(heroEl, { duration: 2300 }));

      if (reducedMotion) {
        numbersSection.classList.add('is-compact');
        runCounters();
        return;
      }

      window.setTimeout(() => {
        numbersSection.classList.add('is-compact');
      }, 500);

      window.setTimeout(() => {
        runCounters();
      }, 820);
    };

    if (reducedMotion) {
      runNumbersExperience();
      return;
    }

    const countObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runNumbersExperience();
        observer.disconnect();
      });
    }, { threshold: 0.35 });

    countObserver.observe(numbersSection);
  });
})();
