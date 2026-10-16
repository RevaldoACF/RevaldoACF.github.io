/**
 * Interactive SVG Morph Track with Checkpoints & Motion Trails
 * Reconstructed & Cleaned from Neutomni Interactive Shape Engine
 * 
 * Features:
 * - GSAP MorphSVG rotational shape morphing across keyframes
 * - Responsive breakpoints: Desktop (hover mousemove), Mobile & Tablet (touch/drag)
 * - Motion trail echoes: temporary clone paths dynamically appended and faded
 * - Dynamic shape sizing and centered label tracking ("< DRAG ME >")
 */

(function (window, document) {
  'use strict';

  function initMorphTrack() {
    if (typeof gsap === 'undefined' || typeof MorphSVGPlugin === 'undefined') {
      console.warn('GSAP or MorphSVGPlugin not loaded for MorphTrack');
      return;
    }

    gsap.registerPlugin(MorphSVGPlugin);

    const TABLET_BP = 991;
    const MOBILE_BP = 767;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let activeKey = null;
    let cleanupHandler = null;
    let savedProgress = 0;

    function getViewportConfig() {
      const width = window.innerWidth;
      if (width <= MOBILE_BP) {
        return {
          key: 'mobile',
          interaction: 'drag',
          svgSelector: '#morphSvgMobile',
          otherSvgSelector: '#morphSvg',
          labelSelector: '#morphLabelMobile',
          otherLabelSelector: '#morphLabel',
          shapeSuffix: '-mobile',
          viewBox: '0 0 120 120',
          svgOrigin: '60 60',
          intrinsicSize: 120,
          checkpoints: [
            { progress: 0, baseId: 'first', rotation: 0 },
            { progress: 1 / 3, baseId: 'second', rotation: 90 },
            { progress: 2 / 3, baseId: 'third', rotation: 180 },
            { progress: 1, baseId: 'fourth', rotation: 270 }
          ]
        };
      } else if (width <= TABLET_BP) {
        return {
          key: 'tablet',
          interaction: 'drag',
          svgSelector: '#morphSvg',
          otherSvgSelector: '#morphSvgMobile',
          labelSelector: '#morphLabelMobile',
          otherLabelSelector: '#morphLabel',
          shapeSuffix: '',
          viewBox: '0 0 220 220',
          svgOrigin: '110 110',
          intrinsicSize: 220,
          checkpoints: [
            { progress: 0, baseId: 'first', rotation: 0 },
            { progress: 0.2, baseId: 'second', rotation: 90 },
            { progress: 0.4, baseId: 'third', rotation: 180 },
            { progress: 0.6, baseId: 'fourth', rotation: 270 },
            { progress: 0.8, baseId: 'fifth', rotation: 360 },
            { progress: 1, baseId: 'sixth', rotation: 450 }
          ]
        };
      } else {
        return {
          key: 'desktop',
          interaction: 'hover',
          svgSelector: '#morphSvg',
          otherSvgSelector: '#morphSvgMobile',
          labelSelector: '#morphLabel',
          otherLabelSelector: '#morphLabelMobile',
          shapeSuffix: '',
          viewBox: '0 0 220 220',
          svgOrigin: '110 110',
          intrinsicSize: 220,
          checkpoints: [
            { progress: 0, baseId: 'first', rotation: 0 },
            { progress: 0.2, baseId: 'second', rotation: 90 },
            { progress: 0.4, baseId: 'third', rotation: 180 },
            { progress: 0.6, baseId: 'fourth', rotation: 270 },
            { progress: 0.8, baseId: 'fifth', rotation: 360 },
            { progress: 1, baseId: 'sixth', rotation: 450 }
          ]
        };
      }
    }

    function ensureStyles() {
      if (document.querySelector('#morph-mode-styles')) return;
      const style = document.createElement('style');
      style.id = 'morph-mode-styles';
      style.textContent = `
        #morphSvg, #morphSvgMobile, #morphLabel, #morphLabelMobile {
          will-change: transform;
        }
        #morphLabel {
          pointer-events: auto;
          position: relative;
          z-index: 3;
        }
        #morphSvg {
          position: relative;
          z-index: 1;
        }
        #morphLabelMobile {
          pointer-events: none;
        }
        .trail-clone {
          will-change: opacity;
          z-index: 0;
        }
      `;
      document.head.appendChild(style);
    }

    function setVisibility(el, displayType) {
      if (!el) return;
      el.hidden = false;
      el.removeAttribute('hidden');
      el.style.setProperty('display', displayType, 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
    }

    function hideElement(el) {
      if (!el) return;
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
    }

    function setupLabelStyles(label) {
      if (!label) return;
      label.style.setProperty('display', 'inline-flex', 'important');
      label.style.setProperty('align-items', 'center', 'important');
      label.style.setProperty('justify-content', 'center', 'important');
      label.style.setProperty('width', 'max-content', 'important');
      label.style.setProperty('max-width', 'none', 'important');
      label.style.setProperty('white-space', 'nowrap', 'important');
      label.style.setProperty('margin', '0', 'important');
    }

    function configureElements(cfg) {
      const activeSvg = document.querySelector(cfg.svgSelector);
      const inactiveSvg = document.querySelector(cfg.otherSvgSelector);
      const activeLabel = document.querySelector(cfg.labelSelector);
      const inactiveLabel = document.querySelector(cfg.otherLabelSelector);

      setVisibility(activeSvg, 'block');
      hideElement(inactiveSvg);

      if (activeLabel) {
        setVisibility(activeLabel, 'inline-flex');
        setupLabelStyles(activeLabel);
      }
      if (inactiveLabel) {
        hideElement(inactiveLabel);
      }
    }

    function mountTrack() {
      ensureStyles();
      const cfg = getViewportConfig();
      activeKey = cfg.key;
      configureElements(cfg);

      const P = {
        trailFadeBase: 0.3,
        trailFadeIncrement: 0.4,
        checkpoints: cfg.checkpoints.map(cp => ({
          ...cp,
          shapeId: cp.baseId + cfg.shapeSuffix
        }))
      };

      const trackEl = document.querySelector('.track');
      const svgEl = document.querySelector(cfg.svgSelector);
      const baseShape = svgEl && svgEl.querySelector('#first' + cfg.shapeSuffix);
      const labelEl = document.querySelector(cfg.labelSelector);
      const hoverSection = document.querySelector('.section.light.hover');

      if (!trackEl || !svgEl || !baseShape) {
        cleanupHandler = null;
        return;
      }

      const state = {
        timeline: null,
        currentProgress: savedProgress,
        previousProgress: savedProgress,
        shapeSize: cfg.intrinsicSize,
        trails: new Map(),
        originalPaths: {},
        labelOffsetX: 0,
        labelOffsetY: 0,
        isDragging: false,
        dragOffsetX: 0
      };

      let dragRemover = null;

      P.checkpoints.forEach(cp => {
        const pathEl = document.querySelector('#' + cp.shapeId);
        if (pathEl) {
          state.originalPaths[cp.shapeId] = pathEl.getAttribute('d');
        }
      });

      function buildTimeline() {
        const tl = gsap.timeline({ paused: true });
        tl.set(baseShape, { rotation: 0 }, 0);

        for (let i = 1; i < P.checkpoints.length; i++) {
          const prev = P.checkpoints[i - 1];
          const curr = P.checkpoints[i];
          tl.to(baseShape, {
            morphSVG: {
              shape: '#' + curr.shapeId,
              type: 'rotational',
              origin: '50% 50%'
            },
            rotation: curr.rotation,
            transformOrigin: '50% 50%',
            svgOrigin: cfg.svgOrigin,
            duration: curr.progress - prev.progress,
            ease: 'linear'
          }, prev.progress);
        }
        return tl;
      }

      function updateShapeSize() {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width > 0) {
          state.shapeSize = rect.width;
        }
      }

      function updateLabelOffset() {
        if (!labelEl) {
          state.labelOffsetX = 0;
          state.labelOffsetY = 0;
          return;
        }
        setupLabelStyles(labelEl);
        gsap.set(svgEl, { x: 0, y: 0 });
        gsap.set(labelEl, { x: 0, y: 0 });

        const sRect = svgEl.getBoundingClientRect();
        const lRect = labelEl.getBoundingClientRect();
        const sCenterX = sRect.left + sRect.width / 2;
        const sCenterY = sRect.top + sRect.height / 2;
        const lCenterX = lRect.left + lRect.width / 2;
        const lCenterY = lRect.top + lRect.height / 2;

        state.labelOffsetX = sCenterX - lCenterX;
        state.labelOffsetY = sCenterY - lCenterY;
      }

      function getProgressFromClientX(clientX) {
        const tRect = trackEl.getBoundingClientRect();
        const half = state.shapeSize / 2;
        let x = clientX - tRect.left;
        x = Math.max(half, Math.min(tRect.width - half, x));
        const span = tRect.width - state.shapeSize;
        const p = span > 0 ? (x - half) / span : 0;
        return {
          progress: Math.max(0, Math.min(1, p)),
          centerX: x,
          leftX: x - half
        };
      }

      function getXFromProgress(p) {
        const tRect = trackEl.getBoundingClientRect();
        const half = state.shapeSize / 2;
        return half + p * (tRect.width - state.shapeSize) - half;
      }

      function spawnTrailClone(checkpointIndex) {
        const cp = P.checkpoints[checkpointIndex];
        const leftX = getXFromProgress(cp.progress);
        const pathData = state.originalPaths[cp.shapeId];
        if (!pathData) return null;

        const cloneSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        cloneSvg.setAttribute('width', state.shapeSize);
        cloneSvg.setAttribute('height', state.shapeSize);
        cloneSvg.setAttribute('viewBox', cfg.viewBox);
        cloneSvg.setAttribute('class', 'trail-clone');

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', pathData);
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', 'currentColor');
        pathEl.setAttribute('stroke-width', '1');
        cloneSvg.appendChild(pathEl);

        cloneSvg.style.position = 'absolute';
        cloneSvg.style.left = leftX + 'px';
        cloneSvg.style.top = '0';
        cloneSvg.style.pointerEvents = 'none';
        cloneSvg.style.transformOrigin = '50% 50%';
        cloneSvg.style.transform = `rotate(${cp.rotation}deg)`;
        cloneSvg.style.zIndex = '0';

        trackEl.appendChild(cloneSvg);

        gsap.to(cloneSvg, {
          opacity: 0,
          duration: P.trailFadeBase + state.trails.size * P.trailFadeIncrement,
          ease: 'power2.out',
          onComplete: () => {
            if (cloneSvg.parentNode) cloneSvg.parentNode.removeChild(cloneSvg);
          }
        });

        return cloneSvg;
      }

      function removeTrail(cloneEl) {
        if (cloneEl && cloneEl.parentNode) {
          gsap.killTweensOf(cloneEl);
          cloneEl.parentNode.removeChild(cloneEl);
        }
      }

      function clearTrails() {
        state.trails.forEach(removeTrail);
        state.trails.clear();
      }

      function checkCheckpointTrails(prevP, currP) {
        const EPS = 0.001;
        const forward = currP > prevP;
        P.checkpoints.forEach((cp, idx) => {
          const p = cp.progress;
          if ((forward && prevP < p + EPS && currP >= p + EPS) ||
              (!forward && prevP > p - EPS && currP <= p - EPS)) {
            if (state.trails.has(idx)) {
              removeTrail(state.trails.get(idx));
            }
            const clone = spawnTrailClone(idx);
            if (clone) state.trails.set(idx, clone);
          }
        });
      }

      function applyPositions(leftX, animate) {
        if (animate) {
          gsap.to(svgEl, { x: leftX, duration: 0.1, ease: 'none', overwrite: 'auto' });
          if (labelEl) {
            gsap.to(labelEl, { x: leftX + state.labelOffsetX, y: state.labelOffsetY, duration: 0.1, ease: 'none', overwrite: 'auto' });
          }
        } else {
          gsap.set(svgEl, { x: leftX });
          if (labelEl) {
            gsap.set(labelEl, { x: leftX + state.labelOffsetX, y: state.labelOffsetY });
          }
        }
      }

      function setProgress(res, animate) {
        const prevP = state.currentProgress;
        state.currentProgress = res.progress;
        savedProgress = res.progress;

        if (state.timeline) {
          state.timeline.progress(res.progress);
        }
        applyPositions(res.leftX, animate);
        checkCheckpointTrails(prevP, state.currentProgress);
        state.previousProgress = state.currentProgress;
      }

      function onMouseMove(e) {
        setProgress(getProgressFromClientX(e.clientX), true);
      }

      function onTouchStart(e) {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = svgEl.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          state.isDragging = true;
          state.dragOffsetX = touch.clientX - rect.left;
          if (e.cancelable) e.preventDefault();
        }
      }

      function onTouchMove(e) {
        if (!state.isDragging) return;
        const touch = e.touches[0];
        if (!touch) return;
        const tRect = trackEl.getBoundingClientRect();
        const x = touch.clientX - tRect.left - state.dragOffsetX;
        setProgress(getProgressFromClientX(tRect.left + x + state.shapeSize / 2), false);
        if (e.cancelable) e.preventDefault();
      }

      function onTouchEnd() {
        state.isDragging = false;
      }

      function onMouseDown(e) {
        if (e.button !== 0) return;
        const rect = svgEl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          state.isDragging = true;
          state.dragOffsetX = e.clientX - rect.left;
          if (e.cancelable) e.preventDefault();

          function onDocMouseMove(moveEvent) {
            if (!state.isDragging) return;
            const tRect = trackEl.getBoundingClientRect();
            const x = moveEvent.clientX - tRect.left - state.dragOffsetX;
            setProgress(getProgressFromClientX(tRect.left + x + state.shapeSize / 2), false);
          }

          function onDocMouseUp() {
            state.isDragging = false;
            document.removeEventListener('mousemove', onDocMouseMove);
            document.removeEventListener('mouseup', onDocMouseUp);
            dragRemover = null;
          }

          document.addEventListener('mousemove', onDocMouseMove);
          document.addEventListener('mouseup', onDocMouseUp);
          dragRemover = function () {
            document.removeEventListener('mousemove', onDocMouseMove);
            document.removeEventListener('mouseup', onDocMouseUp);
          };
        }
      }

      function onResize() {
        if (getViewportConfig().key !== activeKey) {
          if (cleanupHandler) cleanupHandler();
          mountTrack();
          return;
        }
        updateShapeSize();
        updateLabelOffset();
        applyPositions(getXFromProgress(state.currentProgress), false);
        if (state.timeline) state.timeline.progress(state.currentProgress);
      }

      state.timeline = buildTimeline();
      gsap.set(svgEl, { x: 0, y: 0, transformOrigin: '50% 50%' });
      if (labelEl) gsap.set(labelEl, { x: 0, y: 0 });

      state.timeline.progress(savedProgress);
      updateShapeSize();
      updateLabelOffset();
      applyPositions(getXFromProgress(state.currentProgress), false);

      if (cfg.interaction === 'hover') {
        if (hoverSection) hoverSection.addEventListener('mousemove', onMouseMove);
      } else {
        trackEl.addEventListener('touchstart', onTouchStart, { passive: false });
        trackEl.addEventListener('touchmove', onTouchMove, { passive: false });
        trackEl.addEventListener('touchend', onTouchEnd);
        trackEl.addEventListener('touchcancel', onTouchEnd);
        if (canHover) trackEl.addEventListener('mousedown', onMouseDown);
      }

      window.addEventListener('resize', onResize);

      cleanupHandler = function () {
        if (hoverSection) hoverSection.removeEventListener('mousemove', onMouseMove);
        trackEl.removeEventListener('touchstart', onTouchStart);
        trackEl.removeEventListener('touchmove', onTouchMove);
        trackEl.removeEventListener('touchend', onTouchEnd);
        trackEl.removeEventListener('touchcancel', onTouchEnd);
        trackEl.removeEventListener('mousedown', onMouseDown);
        if (dragRemover) dragRemover();
        window.removeEventListener('resize', onResize);
        clearTrails();
        if (state.timeline) state.timeline.kill();
        gsap.killTweensOf(svgEl);
        if (labelEl) gsap.killTweensOf(labelEl);
      };
    }

    mountTrack();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMorphTrack);
  } else {
    initMorphTrack();
  }

})(window, document);