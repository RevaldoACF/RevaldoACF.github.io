/**
 * Preloader & Hero Entrance Animation
 * Coordinates SVG logo stagger drop and hero typography blur reveal
 */

(function (window, document) {
  'use strict';

  function initPreloader() {
    if (typeof gsap === 'undefined') return;

    const isMobile = window.innerWidth <= 768;
    const loaderDelay = isMobile ? 1 : 2.5; // Optimized entrance delay

    const logoPaths = Array.from(document.querySelectorAll('.loader_logo path, .loader_logo text'));
    const flexEl = document.querySelector('.flex-container');

    let animationStarted = false;
    let animationPrepared = false;
    let h1Split = null;

    if (logoPaths.length) {
      gsap.set(logoPaths, { y: -300 });
    }

    if (flexEl) {
      gsap.set(flexEl, { scale: 0 });
    }

    gsap.set('.timezone, .hero_button_wrapper', { y: 30, opacity: 0 });
    gsap.set('.nav_menu', { y: 20, opacity: 0 });
    gsap.set('.h1', { visibility: 'hidden' });

    if (logoPaths.length) {
      gsap.to(logoPaths, {
        y: 0,
        duration: 1.5,
        ease: 'power1.out',
        stagger: { each: 0.05, from: 'center' }
      });
    }

    function prepareAnimation() {
      if (animationPrepared) return;
      animationPrepared = true;

      requestAnimationFrame(function () {
        if (typeof SplitType !== 'undefined') {
          h1Split = new SplitType('.h1', {
            types: 'lines',
            lineClass: 'line'
          });
        }

        if (h1Split && h1Split.lines && h1Split.lines.length) {
          gsap.set(h1Split.lines, {
            opacity: 0,
            filter: 'blur(10px)',
            y: 15
          });
        }

        gsap.set('.h1', { visibility: 'visible' });
      });
    }

    function runHeroReveal() {
      if (animationStarted) return;
      animationStarted = true;

      requestAnimationFrame(function () {
        if (!animationPrepared) prepareAnimation();

        const lines = h1Split && h1Split.lines ? h1Split.lines : [];
        const tl = gsap.timeline();

        tl.to('.nav_menu', {
          y: 0,
          opacity: 1,
          duration: isMobile ? 0.6 : 0.3,
          ease: 'power1.out',
          clearProps: 'transform'
        }, 0);

        if (lines.length) {
          tl.to(lines, {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            duration: 0.6,
            ease: isMobile ? 'power3.out' : 'power1.out',
            stagger: { each: 0.10, from: 'start' }
          }, isMobile ? 0 : 0.2);
        } else {
          gsap.to('.h1', { opacity: 1, duration: 0.6 });
        }

        if (flexEl) {
          tl.to(flexEl, {
            scale: 1,
            duration: 0.8,
            ease: 'power1.out'
          }, isMobile ? 0 : 0.4);
        }

        tl.to('.timezone, .hero_button_wrapper', {
          y: 0,
          opacity: 1,
          duration: isMobile ? 0.5 : 0.6,
          ease: 'power1.out'
        }, isMobile ? 0 : 0.8);
      });
    }

    const startDelay = loaderDelay * 1000;
    const fallbackTimer = setTimeout(function () {
      prepareAnimation();
      setTimeout(runHeroReveal, startDelay);
    }, 150);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        clearTimeout(fallbackTimer);
        prepareAnimation();
        setTimeout(runHeroReveal, startDelay);
      }).catch(function () {
        clearTimeout(fallbackTimer);
        prepareAnimation();
        setTimeout(runHeroReveal, startDelay);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreloader);
  } else {
    initPreloader();
  }

})(window, document);