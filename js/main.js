// ========================================
// OARK - Main JavaScript (Cleaned v19)
// ========================================


document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initDropdown();
  initSmoothScroll();
  initScrollReveal();
  initStatsCounter();
  
  // Handle hash on initial load
  handleInitialHash();
});

// ========== Navbar Scroll Effect ==========
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// ========== Mobile Menu Toggle ==========
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');


  if (!hamburger || !overlay) {
    console.error('Mobile menu elements not found in DOM');
    return;
  }

  function toggleMenu() {
    hamburger.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
  }

  // Remove existing listeners if any (though usually not an issue with fresh load)
  hamburger.onclick = (e) => {
    e.preventDefault();
    toggleMenu();
  };

  // Close menu when clicking on a link
  mobileLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Don't close menu if it's the accordion toggle
      if (link.classList.contains('accordion-toggle')) return;
      
      hamburger.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('no-scroll');
    });
  });

  // Close menu when clicking on the overlay background (not content)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      toggleMenu();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      toggleMenu();
    }
  });

  // Mobile Accordion Logic
  const accordionToggle = document.querySelector('.accordion-toggle');
  const mobileAccordion = document.querySelector('.mobile-accordion');
  if (accordionToggle && mobileAccordion) {
    accordionToggle.addEventListener('click', (e) => {
      e.preventDefault();
      mobileAccordion.classList.toggle('active');
    });
  }
}

// ========== Dropdown Logic (Desktop) ==========
function initDropdown() {
  const dropdown = document.querySelector('.nav-item.dropdown');
  const toggle = document.querySelector('.dropdown-toggle');
  
  if (!dropdown || !toggle) return;

  // Toggle on click for desktop (in addition to hover via CSS)
  toggle.addEventListener('click', (e) => {
    if (window.innerWidth > 991) {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('active');
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });
}

// ========== Scroll Configuration ==========
// Bu değerleri değiştirerek navbarda tıklandığında ekranın duracağı yeri ayarlayabilirsiniz.
// Navbar yüksekliği (headerOffset) varsayılan olarak 92px'dir.
const SECTION_OFFSETS = {
  '#features': 10,      // Özellikler bölümü için offset
  '#showcase-row-1': 33, // Keşfet bölümü için offset
  '#university': 40,     // Kampüs bölümü için offset
  'default': 50          // Diğer tüm bölümler için varsayılan offset
};

// ========== Smooth Scroll ==========
function initSmoothScroll() {
  document.querySelectorAll('a[href*="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '') return;

      const url = new URL(href, window.location.origin);
      const isInternal = url.pathname === window.location.pathname || url.pathname === '/' + window.location.pathname.split('/').pop();
      const hasHash = url.hash !== '';

      if (isInternal && hasHash) {
        const targetId = url.hash;
        
        // Allow native CSS scroll-margin to handle the layout for this anchor
        if (targetId === '#sorumluluk-reddi') return;

        const target = document.querySelector(targetId);

        if (target) {
          e.preventDefault();
          scrollToTarget(target, targetId);
        }
      }
    });
  });
}

function handleInitialHash() {
  if (window.location.hash) {
    const targetId = window.location.hash;
    
    // Allow native CSS scroll-margin to handle the layout for this anchor
    if (targetId === '#sorumluluk-reddi') return;

    const target = document.querySelector(targetId);
    if (target) {
      // Small delay to ensure all layouts/images are ready
      setTimeout(() => {
        scrollToTarget(target, targetId);
      }, 300);
    }
  }
}

function scrollToTarget(target, targetId) {
  const headerOffset = SECTION_OFFSETS[targetId] || SECTION_OFFSETS['default'];
  const elementPosition = target.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
}

// ========== Scroll Reveal Animations ==========
function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // Animate once
      }
    });
  }, observerOptions);

  // Target elements to animate
  // Automatically add fade-up class to major elements if they don't have it
  const sections = document.querySelectorAll('section h2, section p, .glass-card, .showcase-visual, .cta-content, .hero-content');

  sections.forEach(el => {
    if (!el.classList.contains('fade-up') && !el.classList.contains('fade-in')) {
      el.classList.add('fade-up');
    }
  });

  const elements = document.querySelectorAll('.fade-up, .fade-in');

  elements.forEach((el, index) => {
    // Add delay for grid items automatically based on index
    if (el.classList.contains('glass-card')) {
      // Reset index logic for each group of cards would be complex, 
      // but a simple modulo gives a nice staggering effect regardless of total count
      const delay = (index % 3) * 0.15;
      el.style.transitionDelay = `${delay}s`;
    }

    observer.observe(el);
  });

  // Helper class for visible state
  const style = document.createElement('style');
  style.textContent = `
    .visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
}

// ========== Delete Account Form Handler ==========
// This will be used in delete-account.html

// Supabase config is handled within DeleteAccountForm to avoid conflicts with auth.js

class DeleteAccountForm {
  constructor() {
    this.SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
    this.SUPABASE_ANON_KEY = window.CONFIG?.SUPABASE_ANON_KEY;
    this.currentStep = 1;
    this.email = '';
    this.verificationCode = '';
    this.accessToken = null;
    this.supabase = null;
    this.init();
  }

  init() {
    this.form = document.getElementById('deleteAccountForm');
    if (!this.form) return;

    // Initialize Supabase client
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase SDK yüklenemedi');
    }

    this.steps = this.form.querySelectorAll('.form-step');
    this.stepDots = this.form.querySelectorAll('.step-dot');

    this.bindEvents();
  }

  bindEvents() {
    // Step 1: Email submission
    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleEmailSubmit();
      });
    }

    // Step 2: Code verification
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
      verifyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleVerifySubmit();
      });
    }

    // Step 3: Final confirmation
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.handleFinalConfirm();
      });
    }

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.goToStep(this.currentStep - 1);
      });
    });
  }

  async handleEmailSubmit() {
    const emailInput = document.getElementById('email');
    const btn = document.querySelector('#emailForm .btn-danger');

    this.email = emailInput.value.trim();

    if (!this.email || !this.validateEmail(this.email)) {
      this.showMessage('Lütfen geçerli bir e-posta adresi girin.', 'error');
      return;
    }

    this.setLoading(btn, true);

    try {
      // Send OTP to email using Supabase Auth
      const response = await this.sendVerificationCode(this.email);

      if (response.success) {
        this.goToStep(2);
        this.showMessage('Doğrulama kodu e-posta adresinize gönderildi.', 'success', 'step2');
      } else {
        this.showMessage(response.error || 'Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }
    } catch (error) {
      console.error('Email submit error:', error);
      this.showMessage('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    } finally {
      this.setLoading(btn, false);
    }
  }

  async handleVerifySubmit() {
    const codeInput = document.getElementById('verificationCode');
    const btn = document.querySelector('#verifyForm .btn-danger');

    this.verificationCode = codeInput.value.trim();

    if (!this.verificationCode || this.verificationCode.length < 6) {
      this.showMessage('Lütfen geçerli bir doğrulama kodu girin.', 'error', 'step2');
      return;
    }

    this.setLoading(btn, true);

    try {
      const response = await this.verifyCode(this.email, this.verificationCode);

      if (response.success) {
        this.goToStep(3);
      } else {
        this.showMessage(response.error || 'Geçersiz doğrulama kodu.', 'error', 'step2');
      }
    } catch (error) {
      console.error('Verify submit error:', error);
      this.showMessage('Bir hata oluştu. Lütfen tekrar deneyin.', 'error', 'step2');
    } finally {
      this.setLoading(btn, false);
    }
  }

  async handleFinalConfirm() {
    const btn = document.getElementById('confirmDeleteBtn');

    this.setLoading(btn, true);

    try {
      const response = await this.deleteAccount(this.email, this.accessToken);

      if (response.success) {
        this.goToStep(4);
      } else {
        this.showMessage(response.error || 'Hesap silinirken bir hata oluştu.', 'error', 'step3');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      this.showMessage('Hesap silinirken bir hata oluştu.', 'error', 'step3');
    } finally {
      this.setLoading(btn, false);
    }
  }

  // API Methods - Supabase Integration
  async sendVerificationCode(email) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase bağlantısı kurulamadı' };
    }

    try {
      const { data, error } = await this.supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        console.error('OTP send error:', error);
        if (error.message.includes('not allowed') || error.message.includes('Signups not allowed')) {
          return { success: false, error: 'Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.' };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('OTP send exception:', err);
      return { success: false, error: 'E-posta gönderilirken bir hata oluştu.' };
    }
  }

  async verifyCode(email, code) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase bağlantısı kurulamadı' };
    }

    try {
      const { data, error } = await this.supabase.auth.verifyOtp({
        email: email,
        token: code,
        type: 'email'
      });

      if (error) {
        console.error('OTP verify error:', error);
        return { success: false, error: 'Geçersiz veya süresi dolmuş doğrulama kodu.' };
      }

      if (data?.session?.access_token) {
        this.accessToken = data.session.access_token;
        return { success: true };
      }

      return { success: false, error: 'Oturum oluşturulamadı.' };
    } catch (err) {
      console.error('OTP verify exception:', err);
      return { success: false, error: 'Doğrulama sırasında bir hata oluştu.' };
    }
  }

  async deleteAccount(email, accessToken) {
    if (!accessToken) {
      return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar deneyin.' };
    }

    try {
      const response = await fetch(`${this.SUPABASE_URL}/functions/v1/web-delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: email,
          accessToken: accessToken
        })
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Hesap silinirken bir hata oluştu.' };
      }

      if (this.supabase) {
        await this.supabase.auth.signOut();
      }

      return { success: true };
    } catch (err) {
      console.error('Delete account exception:', err);
      return { success: false, error: 'Hesap silinirken bir hata oluştu.' };
    }
  }

  // Helper Methods
  goToStep(step) {
    if (step < 1 || step > 4) return;

    this.currentStep = step;

    this.steps.forEach((s, i) => {
      s.classList.toggle('active', i + 1 === step);
    });

    this.stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i + 1 === step) {
        dot.classList.add('active');
      } else if (i + 1 < step) {
        dot.classList.add('completed');
      }
    });
  }

  showMessage(text, type, stepId = 'step1') {
    const step = document.getElementById(stepId);
    if (!step) return;

    const existing = step.querySelector('.message');
    if (existing) existing.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;

    const formContent = step.querySelector('.form-content');
    if (formContent) {
      formContent.prepend(messageDiv);
    } else {
      step.prepend(messageDiv);
    }

    // Auto-hide success messages after a few seconds
    if (type === 'success') {
      setTimeout(() => {
        messageDiv.remove();
      }, 5000);
    }
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Yükleniyor...';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.originalText || 'Gönder';
      btn.disabled = false;
    }
  }
}

// Initialize the form handler if on the delete account page
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('deleteAccountForm')) {
    new DeleteAccountForm();
  }
});


// ========== Stats Counter & Dynamic Data ==========
function initStatsCounter() {
  // Manual Mode Active - No fetch needed

  // 2. Observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        // If it's the dynamic ID, we might wait for data, 
        // but the animation function handles current innerText/target
        const target = parseInt(element.getAttribute('data-target') || element.innerText.replace(/[^0-9]/g, ''));
        if (target > 0) {
          animateValue(element, 0, target, 2000);
        }
        observer.unobserve(element);
      }
    });
  }, { threshold: 0.1 }); // Lower threshold to ensure trigger

  // Observe all stat numbers
  document.querySelectorAll('.stat-number').forEach(el => observer.observe(el));
}

async function fetchTotalUsers() {
  // Access global authManager if available
  if (window.authManager && window.authManager.supabase) {
    try {
      // Get count using Secure RPC function
      const { data, error } = await authManager.supabase.rpc('get_user_count');

      if (error) {
        console.warn("Supabase RPC error:", error);
      }

      if (!error && data !== null) {
        const count = data; // RPC returns the number directly as data
        const playerEl = document.getElementById('stat-player-count');
        if (playerEl) {
          // Update data-target so animation can pick it up if not already run
          // Or if run, update text directly but usually we want to animate TO this new number
          playerEl.setAttribute('data-target', count);

          // If element is already in view (animation finished or running), re-animate?
          // For simplicity, let's just animate from 0 to actual count
          animateValue(playerEl, 0, count, 2000);
        }
      }
    } catch (e) {
      console.error("Error fetching user count:", e);
      // Fallback is 0 or whatever is in HTML
    }
  }
}

function animateValue(obj, start, end, duration) {
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // Easing (easeOutExpo)
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    let value = Math.floor(easeProgress * (end - start) + start);

    // Format if large number (e.g. 1000 -> 1K logic if needed, but request asked for raw numbers from 0)
    // User asked for "0dan başlayarak sayılar artmaya başlayacak".
    obj.innerHTML = value + (obj.dataset.suffix || ""); // Add suffix if needed, e.g. "+"

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end + (obj.dataset.suffix || "");
    }
  };
  window.requestAnimationFrame(step);
}
