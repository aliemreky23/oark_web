/**
 * OARK - Refined Premium Smooth Scroll Handler
 * Re-architected for bidirectional reliability and better scroll-snap sync.
 */

class PremiumScroll {
  constructor() {
    this.sections = [];
    this.isScrolling = false;
    this.currentSectionIndex = 0;
    this.touchStartY = 0;
    this.wheelAccumulator = 0;
    this.wheelThreshold = 80; // Slightly lower for better responsiveness
    this.scrollTimeout = null;
    this.init();
  }

  init() {
    this.collectSections();
    this.handleEvents();
    this.updateCurrentIndex();
    
    // Use IntersectionObserver to keep index in sync during manual scrolls
    this.initObserver();
  }

  collectSections() {
    const snappedElements = document.querySelectorAll('.hero, .features-section, .partners-section, .showcase-row, #university, .cta-section, footer');
    this.sections = Array.from(snappedElements);
  }

  initObserver() {
    const options = {
      root: null,
      rootMargin: '-40% 0px -40% 0px', // Center-heavy detection
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      if (this.isScrolling) return;
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = this.sections.indexOf(entry.target);
          if (index !== -1) {
            this.currentSectionIndex = index;
          }
        }
      });
    }, options);

    this.sections.forEach(section => observer.observe(section));
  }

  handleEvents() {
    window.addEventListener('wheel', (e) => {
      if (this.isScrolling) return;

      this.wheelAccumulator += e.deltaY;

      // Immediate trigger when threshold reached, instead of timeout
      if (Math.abs(this.wheelAccumulator) >= this.wheelThreshold) {
        const direction = this.wheelAccumulator > 0 ? 1 : -1;
        this.scrollToNextSection(direction);
        this.wheelAccumulator = 0;
      } else {
        // Clear accumulator if user stops scrolling for a bit
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
          this.wheelAccumulator = 0;
        }, 150);
      }

      e.preventDefault();
    }, { passive: false });

    // Touch support (Bidirectional)
    window.addEventListener('touchstart', (e) => {
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isScrolling) return;
      
      const touchEndY = e.touches[0].clientY;
      const diff = this.touchStartY - touchEndY;

      if (Math.abs(diff) > 80) { // Touch sensitivity threshold
        const direction = diff > 0 ? 1 : -1;
        this.scrollToNextSection(direction);
        this.touchStartY = touchEndY; // Reset for next segment if long swipe
      }
    }, { passive: true });
  }

  updateCurrentIndex() {
    const scrollPos = window.scrollY + window.innerHeight / 2;
    let closestIndex = 0;
    let minDiff = Infinity;

    this.sections.forEach((section, index) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + window.scrollY + rect.height / 2;
      const diff = Math.abs(scrollPos - sectionCenter);

      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    this.currentSectionIndex = closestIndex;
  }

  scrollToNextSection(direction) {
    const nextIndex = this.currentSectionIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < this.sections.length) {
      this.isScrolling = true;
      const target = this.sections[nextIndex];
      
      // Calculate centering position
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = target.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      
      // Special case for footer or small sections
      let offsetPosition;
      if (target.offsetHeight < window.innerHeight) {
        offsetPosition = elementPosition - (window.innerHeight - target.offsetHeight) / 2;
      } else {
        offsetPosition = elementPosition; // Align top if larger than viewport
      }

      // Respect Navbar
      offsetPosition -= 10; // Extra bit of breathing room

      this.smoothScrollTo(offsetPosition, 300); // 300ms = Snappy fast transition
      this.currentSectionIndex = nextIndex;
    }
  }

  smoothScrollTo(targetY, duration) {
    const startY = window.scrollY;
    const diff = targetY - startY;
    let startTime = null;

    const animation = (currentTime) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Snappy cubic ease out
      const ease = 1 - Math.pow(1 - progress, 3);

      window.scrollTo(0, startY + diff * ease);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        setTimeout(() => {
          this.isScrolling = false;
        }, 50); // Minimal buffer to allow quick subsequent scrolls
      }
    };

    requestAnimationFrame(animation);
  }
}

// Ensure it initializes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.premiumScroll = new PremiumScroll(); });
} else {
  window.premiumScroll = new PremiumScroll();
}
