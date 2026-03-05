(function () {
  const experience = document.getElementById('experience');
  if (!experience) return;

  const slides = Array.from(experience.querySelectorAll('.slide'));
  const copy = document.querySelector('.propeller-copy');
  const rotor = document.getElementById('propeller-rotor');
  const arrowBtn = document.querySelector('.propeller-arrow');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  if (!slides.length || !copy || !arrowBtn) return;

  let activeIndex = 0;
  let rotation = 0;
  let coolingDown = false;

  const zoneTargets = {
    top: copy.querySelector('.zone-top'),
    left: copy.querySelector('.zone-left'),
    right: copy.querySelector('.zone-right'),
    bottom: copy.querySelector('.zone-bottom')
  };

  function setArrowState() {
    const isLast = activeIndex === slides.length - 1;
    arrowBtn.textContent = isLast ? '↑' : '↓';
    arrowBtn.setAttribute('aria-label', isLast ? 'Remonter à la slide précédente' : 'Aller à la slide suivante');
  }

  function getSlideZone(slide, name) {
    const node = slide.querySelector(`.slide-zones .zone-${name}`);
    return node ? node.innerHTML : '';
  }

  function injectSlideContent(index) {
    const slide = slides[index];
    zoneTargets.top.innerHTML = getSlideZone(slide, 'top');
    zoneTargets.left.innerHTML = getSlideZone(slide, 'left');
    zoneTargets.right.innerHTML = getSlideZone(slide, 'right');
    zoneTargets.bottom.innerHTML = getSlideZone(slide, 'bottom');
  }

  function animateTo(index) {
    if (index === activeIndex || coolingDown) return;
    coolingDown = true;
    copy.classList.add('is-leaving');

    window.setTimeout(function () {
      if (!reducedMotion && rotor) {
        rotation += 120;
        rotor.style.transform = `rotate(${rotation}deg)`;
      }

      window.setTimeout(function () {
        injectSlideContent(index);
        activeIndex = index;
        setArrowState();
        copy.classList.remove('is-leaving');
        copy.classList.add('is-entering');

        window.setTimeout(function () {
          copy.classList.remove('is-entering');
          coolingDown = false;
        }, reducedMotion ? 300 : 320);
      }, reducedMotion ? 40 : 800);
    }, 300);
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
      const next = Number(entry.target.dataset.slide || 0);
      animateTo(next);
    });
  }, {
    threshold: [0.6]
  });

  slides.forEach(function (slide) { observer.observe(slide); });

  arrowBtn.addEventListener('click', function () {
    const isLast = activeIndex === slides.length - 1;
    const targetIndex = isLast ? Math.max(0, activeIndex - 1) : Math.min(slides.length - 1, activeIndex + 1);
    slides[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const targetIndex = Math.min(slides.length - 1, Math.max(0, activeIndex + delta));
    if (targetIndex !== activeIndex) {
      slides[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  injectSlideContent(0);
  setArrowState();
})();
