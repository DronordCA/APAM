(function () {
  "use strict";

  var SESSION_KEY = "hangarIntroSeen";
  var overlayEl = null;
  var cleanupHandlers = [];
  var siblingState = [];
  var running = false;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function hasForceParam() {
    return new URLSearchParams(window.location.search).get("intro") === "1";
  }

  function shouldRun() {
    if (hasForceParam()) return true;
    return !sessionStorage.getItem(SESSION_KEY);
  }

  function on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    cleanupHandlers.push(function () {
      target.removeEventListener(event, handler, options);
    });
  }

  function buildOverlay() {
    var container = document.createElement("div");
    container.id = "hangarIntro";
    container.className = "hangar-intro";
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("aria-label", "Animation d'introduction du hangar");
    container.setAttribute("aria-hidden", "false");

    container.innerHTML =
      '<div class="hangar-intro__scene" aria-live="off">' +
      '  <button type="button" class="hangar-intro__skip" aria-label="Passer l\'animation">Passer</button>' +
      '  <div class="hangar-intro__inside" aria-hidden="true">' +
      '    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" role="presentation">' +
      '      <defs>' +
      '        <linearGradient id="hangarFloor" x1="0" x2="0" y1="0" y2="1">' +
      '          <stop offset="0%" stop-color="#2a3039"/>' +
      '          <stop offset="100%" stop-color="#13171d"/>' +
      '        </linearGradient>' +
      '      </defs>' +
      '      <rect x="0" y="0" width="1600" height="900" fill="url(#hangarFloor)" />' +
      '      <g opacity="0.45">' +
      '        <path d="M560 650 L1040 650 L1130 735 L470 735 Z" fill="#9da7b6"/>' +
      '        <path d="M700 650 L900 650 L930 594 L670 594 Z" fill="#c5ccd7"/>' +
      '        <circle cx="655" cy="700" r="34" fill="#181c22"/>' +
      '        <circle cx="945" cy="700" r="34" fill="#181c22"/>' +
      '      </g>' +
      '      <line x1="0" y1="740" x2="1600" y2="740" stroke="#4a525e" stroke-width="4" opacity="0.5" />' +
      '    </svg>' +
      '  </div>' +
      '  <svg class="hangar-intro__facade" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">' +
      '    <rect x="60" y="70" width="1480" height="760" fill="none" stroke="var(--hangar-frame)" stroke-width="24" />' +
      '    <rect x="72" y="82" width="1456" height="736" fill="none" stroke="var(--hangar-frame-dark)" stroke-width="2" />' +
      '    <line x1="800" y1="82" x2="800" y2="818" stroke="rgba(255,255,255,0.08)" stroke-width="2" />' +
      '  </svg>' +
      '  <div class="hangar-intro__doors" aria-hidden="true">' +
      '    <div class="hangar-intro__door hangar-intro__door--left"></div>' +
      '    <div class="hangar-intro__door hangar-intro__door--right"></div>' +
      '  </div>' +
      '</div>';

    return container;
  }

  function lockBackground(overlay) {
    document.body.classList.add("hangar-intro-lock");
    siblingState = [];

    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === overlay) return;

      siblingState.push({
        node: child,
        ariaHidden: child.getAttribute("aria-hidden"),
        inert: child.inert,
      });

      child.setAttribute("aria-hidden", "true");
      child.inert = true;
    });
  }

  function unlockBackground() {
    document.body.classList.remove("hangar-intro-lock");

    siblingState.forEach(function (entry) {
      if (entry.ariaHidden === null) {
        entry.node.removeAttribute("aria-hidden");
      } else {
        entry.node.setAttribute("aria-hidden", entry.ariaHidden);
      }
      entry.node.inert = entry.inert;
    });

    siblingState = [];
  }

  function trapTab(event) {
    if (event.key !== "Tab" || !overlayEl) return;

    var focusables = overlayEl.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusables.length) {
      event.preventDefault();
      return;
    }

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeOverlay(markSeen) {
    if (!overlayEl) return;

    overlayEl.setAttribute("aria-hidden", "true");

    window.setTimeout(function () {
      cleanupHandlers.forEach(function (fn) {
        fn();
      });
      cleanupHandlers = [];

      unlockBackground();

      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }

      overlayEl = null;
      running = false;

      if (markSeen) {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    }, 340);
  }

  function finishNow() {
    if (!overlayEl) return;
    overlayEl.classList.add("hangar-intro--opening");
    closeOverlay(true);
  }

  function runHangarIntro() {
    if (running) return;
    if (!shouldRun()) return;

    running = true;
    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
    lockBackground(overlayEl);

    var skipBtn = overlayEl.querySelector(".hangar-intro__skip");
    var rightDoor = overlayEl.querySelector(".hangar-intro__door--right");
    var completed = false;

    function completeSequence() {
      if (completed) return;
      completed = true;
      closeOverlay(true);
    }

    on(skipBtn, "click", finishNow);
    on(window, "keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishNow();
      } else {
        trapTab(event);
      }
    });

    window.requestAnimationFrame(function () {
      if (!overlayEl) return;
      skipBtn.focus();

      if (prefersReducedMotion()) {
        window.setTimeout(completeSequence, 120);
        return;
      }

      overlayEl.classList.add("hangar-intro--opening");
      on(rightDoor, "transitionend", completeSequence, { once: true });
      window.setTimeout(completeSequence, 1900);
    });
  }

  window.runHangarIntro = runHangarIntro;

  document.addEventListener("DOMContentLoaded", function () {
    if (shouldRun()) {
      runHangarIntro();
    }
  });
})();
