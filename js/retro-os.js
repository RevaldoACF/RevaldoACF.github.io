/**
 * Retro OS Window Manager & Desktop Simulation
 * Reconstructed & Cleaned from Neutomni OS Engine
 * 
 * Features:
 * - Window layering (z-index management & bring-to-front on focus)
 * - Multi-touch and mouse draggable window handles
 * - Viewport & navbar boundary clamping
 * - Smooth zoom / fly-to-icon minimization & restoration animations
 * - Responsive auto-scaling for Desktop CRT & Mobile frames
 * - Scroll-linked minimization state for pricing window
 */

(function (window, document) {
  'use strict';

  // Constants & Easing
  const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  const PRICING_SCALE = 0.45;

  // Global top z-index tracker
  window.topZ = window.topZ || 100000;

  /**
   * Brings an element to the front of the desktop
   * @param {HTMLElement} el 
   */
  function bringToFront(el) {
    if (!el) return;
    window.topZ += 1;
    el.style.zIndex = window.topZ;
  }

  /**
   * Calculates bottom position of the navigation bar to prevent dragging behind nav
   * @returns {number}
   */
  function getNavBottom() {
    const navEls = [
      document.querySelector('.nav_section'),
      document.querySelector('.navbar')
    ].filter(Boolean);

    let bottom = 0;
    for (const el of navEls) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom;
  }

  /**
   * Seeds the explicit left/top coordinates of a window based on initial layout
   * @param {string} selector 
   */
  function seedPosition(selector) {
    const el = document.querySelector(selector);
    if (!el || !el.parentElement) return;

    const hasLeft = el.style.left && el.style.left !== '';
    const hasTop = el.style.top && el.style.top !== '';
    if (hasLeft && hasTop) return;

    const parentRect = el.parentElement.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    if (!hasLeft) {
      el.style.left = (elRect.left - parentRect.left) + 'px';
    }
    if (!hasTop) {
      el.style.top = (elRect.top - parentRect.top) + 'px';
    }
  }

  /**
   * Makes a window panel draggable by its grab handle
   * @param {string} panelSelector 
   * @param {string} handleSelector 
   * @param {object} options 
   */
  function makeDraggable(panelSelector, handleSelector, options = {}) {
    const panel = document.querySelector(panelSelector);
    const handle = document.querySelector(handleSelector);
    if (!panel || !handle) return;

    const container = panel.parentElement;
    const clampToNav = options.clampToNav !== false;
    handle.style.touchAction = 'none';

    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let prevOverflow = null;
    let isDragging = false;

    function getCoords(e) {
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function onDragStart(e) {
      isDragging = true;
      panel.style.transition = 'none';
      bringToFront(panel);

      prevOverflow = panel.style.overflow;
      panel.style.overflow = 'hidden';

      const parentRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const hasLeft = panel.style.left && panel.style.left !== '';
      const hasTop = panel.style.top && panel.style.top !== '';

      initialLeft = hasLeft ? (parseInt(panel.style.left, 10) || 0) : (panelRect.left - parentRect.left);
      initialTop = hasTop ? (parseInt(panel.style.top, 10) || 0) : (panelRect.top - parentRect.top);

      panel.style.left = initialLeft + 'px';
      panel.style.top = initialTop + 'px';

      const coords = getCoords(e);
      startX = coords.x;
      startY = coords.y;

      document.body.style.userSelect = 'none';
    }

    function onDragMove(e) {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const coords = getCoords(e);
      let newLeft = initialLeft + (coords.x - startX);
      let newTop = initialTop + (coords.y - startY);

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';

      // Boundary clamping within parent desktop display
      const parentRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      if (panelRect.left < parentRect.left) {
        newLeft += (parentRect.left - panelRect.left);
      }
      if (panelRect.right > parentRect.right) {
        newLeft -= (panelRect.right - parentRect.right);
      }

      const topLimit = clampToNav ? Math.max(parentRect.top, getNavBottom()) : parentRect.top;
      if (panelRect.top < topLimit) {
        newTop += (topLimit - panelRect.top);
      }
      if (panelRect.bottom > parentRect.bottom) {
        newTop -= (panelRect.bottom - parentRect.bottom);
      }

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    }

    function onDragEnd() {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
        panel.style.overflow = prevOverflow || '';
        prevOverflow = null;
      }
    }

    handle.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    handle.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    document.addEventListener('touchcancel', onDragEnd);
  }

  /**
   * Sets up desktop icon and window opening/closing interactions
   * @param {string} iconSelector 
   * @param {string} panelSelector 
   * @param {string} closeSelector 
   * @param {object} options 
   */
  function setupPopup(iconSelector, panelSelector, closeSelector, options = {}) {
    const icon = document.querySelector(iconSelector);
    const panel = document.querySelector(panelSelector);
    const closeBtn = document.querySelector(closeSelector);

    if (!panel || !closeBtn) return;

    const openScale = options.openScale || 1;
    const startOpen = options.startOpen || false;
    const flyToIcon = options.flyToIcon || false;
    const scrollControlled = options.scrollControlled || false;
    const minScale = flyToIcon ? 0 : 0.05;

    function getTargetScale() {
      if (scrollControlled && window.pricingState) {
        return window.pricingState.isScaledDown ? PRICING_SCALE : 1;
      }
      return openScale;
    }

    // Set initial window state
    if (startOpen && !scrollControlled) {
      bringToFront(panel);
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
      panel.style.transform = `scale(${openScale})`;
      panel.style.transformOrigin = 'center center';
      panel.style.pointerEvents = 'all';
    } else if (!scrollControlled) {
      panel.style.visibility = 'hidden';
      panel.style.display = 'block';
      panel.style.pointerEvents = 'none';
      panel.style.opacity = '0';
    }

    // Open from Icon
    if (icon) {
      icon.addEventListener('click', function () {
        bringToFront(panel);

        if (flyToIcon) {
          const parentRect = panel.parentElement.getBoundingClientRect();
          const iconRect = icon.getBoundingClientRect();
          const iconCenterX = iconRect.left + iconRect.width / 2 - parentRect.left;
          const iconCenterY = iconRect.top + iconRect.height / 2 - parentRect.top;
          const scale = getTargetScale();

          let targetTranslateX, targetTranslateY, finalLeft, finalTop;
          if (scale === 1) {
            targetTranslateX = 0;
            targetTranslateY = 0;
            finalLeft = 0;
            finalTop = 0;
          } else {
            const padX = 20;
            const padY = panel.offsetHeight * (1 - scale) - 20;
            targetTranslateX = padX - (panel.offsetWidth / 2) * (1 - scale);
            targetTranslateY = padY - (panel.offsetHeight / 2) * (1 - scale);
            finalLeft = 20;
            finalTop = -20;
          }

          panel.style.transition = 'none';
          panel.style.left = '0px';
          panel.style.top = '0px';
          panel.style.transformOrigin = 'center center';
          panel.style.transform = `translate(${iconCenterX - panel.offsetWidth / 2}px, ${iconCenterY - panel.offsetHeight / 2}px) scale(0)`;
          panel.style.visibility = 'visible';
          void panel.offsetHeight; // force reflow

          panel.style.transition = `transform 0.5s ${EASE}, opacity 0.25s ease`;
          panel.style.opacity = '1';
          panel.style.transform = `translate(${targetTranslateX}px, ${targetTranslateY}px) scale(${scale})`;
          panel.style.pointerEvents = 'all';

          if (scrollControlled && window.pricingState) {
            window.pricingState.isMinimized = false;
          }

          function onTransitionEnd() {
            panel.removeEventListener('transitionend', onTransitionEnd);
            panel.style.transition = 'none';
            panel.style.transformOrigin = 'bottom left';
            panel.style.transform = `scale(${scale})`;
            panel.style.left = finalLeft + 'px';
            panel.style.top = finalTop + 'px';
          }
          panel.addEventListener('transitionend', onTransitionEnd);
        } else {
          panel.style.transition = 'none';
          panel.style.transform = `scale(${openScale})`;
          panel.style.visibility = 'hidden';
          panel.style.opacity = '0';
          void panel.offsetHeight;

          const iconRect = icon.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          const originX = iconRect.left + iconRect.width / 2 - panelRect.left;
          const originY = iconRect.top + iconRect.height / 2 - panelRect.top;

          panel.style.transformOrigin = `${originX}px ${originY}px`;
          panel.style.transform = `scale(${minScale})`;
          panel.style.visibility = 'visible';
          void panel.offsetHeight;

          panel.style.transition = `transform 0.4s ${EASE}, opacity 0.25s ease`;
          panel.style.transform = `scale(${openScale})`;
          panel.style.opacity = '1';
          panel.style.pointerEvents = 'all';
        }

        seedPosition(panelSelector);
      });
    }

    // Close / Minimize Window
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();

      if (flyToIcon && icon) {
        const panelRect = panel.getBoundingClientRect();
        const parentRect = panel.parentElement.getBoundingClientRect();
        const currentLeft = panelRect.left - parentRect.left;
        const currentTop = panelRect.top - parentRect.top;
        const scale = getTargetScale();

        const curTranslateX = currentLeft - (panel.offsetWidth / 2) * (1 - scale);
        const curTranslateY = currentTop - (panel.offsetHeight / 2) * (1 - scale);

        const iconRect = icon.getBoundingClientRect();
        const iconCenterX = iconRect.left + iconRect.width / 2 - parentRect.left;
        const iconCenterY = iconRect.top + iconRect.height / 2 - parentRect.top;

        panel.style.transition = 'none';
        panel.style.left = '0px';
        panel.style.top = '0px';
        panel.style.transformOrigin = 'center center';
        panel.style.transform = `translate(${curTranslateX}px, ${curTranslateY}px) scale(${scale})`;
        void panel.offsetHeight;

        panel.style.transition = `transform 0.5s ${EASE}, opacity 0.2s ease`;
        panel.style.transform = `translate(${iconCenterX - panel.offsetWidth / 2}px, ${iconCenterY - panel.offsetHeight / 2}px) scale(0)`;
        panel.style.pointerEvents = 'none';

        if (scrollControlled && window.pricingState) {
          window.pricingState.isMinimized = true;
        }
      } else {
        let originStr = '50% 50%';
        if (icon) {
          const iconRect = icon.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          originStr = `${iconRect.left + iconRect.width / 2 - panelRect.left}px ${iconRect.top + iconRect.height / 2 - panelRect.top}px`;
        }

        panel.style.transformOrigin = originStr;
        panel.style.transition = `transform 0.3s ${EASE}, opacity 0.2s ease`;
        panel.style.transform = `scale(${minScale})`;
        panel.style.opacity = '0';
        panel.style.pointerEvents = 'none';
      }
    });

    // Bring to front on click anywhere on window
    panel.addEventListener('mousedown', function () {
      bringToFront(panel);
    });
    panel.addEventListener('touchstart', function () {
      bringToFront(panel);
    }, { passive: true });
  }

  // Initialize Desktop OS System on DOM ready
  function initRetroOS() {
    const windows = [
      '.faq_wrapper',
      '.testimonial_wrapper',
      '.natalia_wrapper',
      '.andrii_wrapper',
      '.zefir_wrapper'
    ];

    windows.forEach(seedPosition);

    // Bind Draggables
    makeDraggable('.faq_wrapper', '.faq_grabb');
    makeDraggable('.testimonial_wrapper', '.testimonial_grabb');
    makeDraggable('.natalia_wrapper', '.natalia_grabb');
    makeDraggable('.andrii_wrapper', '.andrii_grabb');
    makeDraggable('.zefir_wrapper', '.zefir_grabb');
    makeDraggable('.pricing_wrapper', '.pricing_grabb');

    // Sticky wrapper & Pricing Scroll Scaling
    const stickyWrapper = document.querySelector('.sticky_blur_wrapper');
    const pricingWrapper = document.querySelector('.pricing_wrapper');
    const pricingGrabb = document.querySelector('.pricing_grabb');
    const pricingBorders = document.querySelectorAll('.pricing_border');

    if (stickyWrapper && pricingWrapper) {
      if (pricingGrabb) pricingGrabb.style.opacity = '0';
      pricingBorders.forEach(b => b.style.opacity = '0');

      window.pricingState = {
        isMinimized: false,
        isScaledDown: false
      };

      let isScaled = false;
      let scrollTicking = false;

      function setBadgeOpacity(opacity) {
        if (pricingGrabb) {
          pricingGrabb.style.transition = `opacity 0.5s ${EASE}`;
          pricingGrabb.style.opacity = opacity;
        }
        pricingBorders.forEach(b => {
          b.style.transition = `opacity 0.5s ${EASE}`;
          b.style.opacity = opacity;
        });
      }

      function updatePricing() {
        const rect = stickyWrapper.getBoundingClientRect();
        const scrollDistance = stickyWrapper.offsetHeight - window.innerHeight;
        const progress = scrollDistance > 0 ? (-rect.top / scrollDistance) : 0;
        const shouldScale = progress >= 0.7;

        if (shouldScale !== isScaled) {
          isScaled = shouldScale;
          window.pricingState.isScaledDown = shouldScale;

          if (shouldScale) {
            if (!window.pricingState.isMinimized) {
              pricingWrapper.style.transition = `transform 0.5s ${EASE}, left 0.5s ${EASE}, top 0.5s ${EASE}`;
              pricingWrapper.style.transformOrigin = 'bottom left';
              pricingWrapper.style.transform = `scale(${PRICING_SCALE})`;
              pricingWrapper.style.left = '20px';
              pricingWrapper.style.top = '-20px';
              pricingWrapper.style.pointerEvents = 'all';
              setBadgeOpacity('1');
            }
          } else {
            window.pricingState.isMinimized = false;
            bringToFront(pricingWrapper);
            setBadgeOpacity('0');

            if (pricingWrapper.style.visibility === 'hidden' || pricingWrapper.style.transform.includes('scale(0)')) {
              pricingWrapper.style.transition = 'none';
              pricingWrapper.style.left = '20px';
              pricingWrapper.style.top = '-20px';
              pricingWrapper.style.visibility = 'visible';
              pricingWrapper.style.transformOrigin = 'bottom left';
              pricingWrapper.style.transform = `scale(${PRICING_SCALE})`;
              pricingWrapper.style.pointerEvents = 'all';
              void pricingWrapper.offsetHeight;

              pricingWrapper.style.transition = `transform 0.5s ${EASE}, left 0.5s ${EASE}, top 0.5s ${EASE}`;
              pricingWrapper.style.transform = 'scale(1)';
              pricingWrapper.style.left = '0px';
              pricingWrapper.style.top = '0px';
            } else {
              const pRect = pricingWrapper.getBoundingClientRect();
              const parentRect = pricingWrapper.parentElement.getBoundingClientRect();
              const curLeft = pRect.left - parentRect.left;
              const curTop = pRect.top - parentRect.top;
              const diff = 1 - PRICING_SCALE;
              const origX = curLeft / diff;
              const origY = curTop / diff;

              pricingWrapper.style.transition = 'none';
              pricingWrapper.style.left = '0px';
              pricingWrapper.style.top = '0px';
              pricingWrapper.style.transformOrigin = `${origX}px ${origY}px`;
              pricingWrapper.style.transform = `scale(${PRICING_SCALE})`;
              void pricingWrapper.offsetHeight;

              pricingWrapper.style.transition = `transform 0.5s ${EASE}`;
              pricingWrapper.style.transform = 'scale(1)';
            }
            pricingWrapper.style.pointerEvents = 'all';
          }
        }
      }

      window.addEventListener('scroll', function () {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(function () {
            updatePricing();
            scrollTicking = false;
          });
        }
      }, { passive: true });
    }

    // Bind Popups to Desktop Icons & Close Buttons
    setupPopup('.faq_icon', '.faq_wrapper', '.faq_close');
    setupPopup('.testimonial_icon', '.testimonial_wrapper', '.testimonial_close');
    setupPopup('.zefir_icon', '.zefir_wrapper', '.zefir_close');
    setupPopup('.natalia_icon', '.natalia_wrapper', '.natalia_close');
    setupPopup('.andrii_icon', '.andrii_wrapper', '.andrii_close');
    setupPopup('.pricing_icon', '.pricing_wrapper', '.pricing_close', {
      openScale: PRICING_SCALE,
      flyToIcon: true,
      scrollControlled: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRetroOS);
  } else {
    initRetroOS();
  }

})(window, document);