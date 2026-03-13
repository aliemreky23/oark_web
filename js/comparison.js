/**
 * Image Comparison Slider
 * Uses requestAnimationFrame for smooth, lag-free dragging.
 */
(function () {
  'use strict';

  function initComparisonSliders() {
    const sliders = document.querySelectorAll('.comparison-slider');

    sliders.forEach(slider => {
      const lightImg = slider.querySelector('.comparison-light');
      const divider = slider.querySelector('.comparison-divider');
      const handle = slider.querySelector('.comparison-handle');

      if (!lightImg || !divider || !handle) return;

      let isDragging = false;
      let pendingPercent = null;
      let rafId = null;

      function applyPosition(percent) {
        lightImg.style.clipPath = 'inset(0 ' + (100 - percent) + '% 0 0)';
        divider.style.left = percent + '%';
        handle.style.left = percent + '%';
      }

      function updateOnRAF() {
        if (pendingPercent !== null) {
          applyPosition(pendingPercent);
          pendingPercent = null;
        }
        if (isDragging) {
          rafId = requestAnimationFrame(updateOnRAF);
        }
      }

      function setPosition(percent) {
        pendingPercent = Math.max(2, Math.min(98, percent));
        if (!rafId && isDragging) {
          rafId = requestAnimationFrame(updateOnRAF);
        }
      }

      function getPercent(clientX) {
        const rect = slider.getBoundingClientRect();
        return ((clientX - rect.left) / rect.width) * 100;
      }

      // Mouse events
      slider.addEventListener('mousedown', function (e) {
        e.preventDefault();
        isDragging = true;
        slider.classList.add('dragging');
        pendingPercent = Math.max(2, Math.min(98, getPercent(e.clientX)));
        applyPosition(pendingPercent);
        pendingPercent = null;
        rafId = requestAnimationFrame(updateOnRAF);
      });

      document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        e.preventDefault();
        setPosition(getPercent(e.clientX));
      });

      document.addEventListener('mouseup', function () {
        if (isDragging) {
          isDragging = false;
          slider.classList.remove('dragging');
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          // Apply any remaining pending update
          if (pendingPercent !== null) {
            applyPosition(pendingPercent);
            pendingPercent = null;
          }
        }
      });

      // Touch events
      slider.addEventListener('touchstart', function (e) {
        isDragging = true;
        slider.classList.add('dragging');
        pendingPercent = Math.max(2, Math.min(98, getPercent(e.touches[0].clientX)));
        applyPosition(pendingPercent);
        pendingPercent = null;
        rafId = requestAnimationFrame(updateOnRAF);
      }, { passive: true });

      document.addEventListener('touchmove', function (e) {
        if (!isDragging) return;
        setPosition(getPercent(e.touches[0].clientX));
      }, { passive: true });

      document.addEventListener('touchend', function () {
        if (isDragging) {
          isDragging = false;
          slider.classList.remove('dragging');
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (pendingPercent !== null) {
            applyPosition(pendingPercent);
            pendingPercent = null;
          }
        }
      });

      // Initialize at 50%
      applyPosition(50);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComparisonSliders);
  } else {
    initComparisonSliders();
  }
})();
