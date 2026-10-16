/**
 * Clock & Time Synchronizer
 * Handles:
 * 1. Live Warsaw Poland studio time in Europe/Warsaw timezone
 * 2. Retro OS desktop menu bar date and time
 */

(function (window, document) {
  'use strict';

  function updatePolandTime() {
    const now = new Date();

    const time = now.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    const gmt = tzPart ? tzPart.value.replace('UTC', 'GMT') : 'GMT+1';
    const content = 'my local time<br>' + time + ' (' + gmt + ')';

    const el1 = document.getElementById('local-time');
    const el2 = document.getElementById('timezone');
    const el3 = document.getElementById('nav_time');

    if (el1) el1.innerHTML = content;
    if (el2) el2.innerHTML = content;
    if (el3) el3.innerHTML = content;

    // Also update all .timezone elements
    document.querySelectorAll('.timezone').forEach(el => {
      el.innerHTML = content;
    });
  }

  function updateDesktopDateTime() {
    const dateEl = document.querySelector('.date');
    const timeEl = document.querySelector('.time');
    if (!dateEl || !timeEl) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    dateEl.textContent = dateStr;
    timeEl.textContent = timeStr;
  }

  function initClocks() {
    updatePolandTime();
    updateDesktopDateTime();

    setInterval(function () {
      updatePolandTime();
      updateDesktopDateTime();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClocks);
  } else {
    initClocks();
  }

})(window, document);