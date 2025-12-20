// ========================================
// OARK - Main JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initSmoothScroll();
  initScrollReveal();
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
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    hamburger.classList.toggle('active');

    // Simple rotation animation for hamburger icon (optional)
    if (navLinks.classList.contains('active')) {
      hamburger.style.transform = 'rotate(90deg)';
    } else {
      hamburger.style.transform = 'rotate(0deg)';
    }
  });

  // Close menu when clicking on a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      hamburger.classList.remove('active');
      hamburger.style.transform = 'rotate(0deg)';
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('active')) {
      navLinks.classList.remove('active');
      hamburger.classList.remove('active');
      hamburger.style.transform = 'rotate(0deg)';
    }
  });
}

// ========== Smooth Scroll ==========
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '') return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
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

// Supabase Configuration
const SUPABASE_URL = 'https://hxwlwnlfnnsflbkkbbea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4d2x3bmxmbm5zZmxia2tiYmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODg0NTgsImV4cCI6MjA3ODI2NDQ1OH0.h2HbS9OIQLgh7M0DpwtUfKhgAMYXryv9H9tjK4brzaI';

class DeleteAccountForm {
  constructor() {
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
      this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
      const response = await fetch(`${SUPABASE_URL}/functions/v1/web-delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
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

    const message = document.createElement('div');
    message.className = `message ${type}`;
    // Inline styles for message to match new design without relying on styles.css for everything instantly
    message.style.padding = '1rem';
    message.style.borderRadius = '8px';
    message.style.marginBottom = '1.5rem';
    message.style.fontSize = '0.9rem';
    message.style.textAlign = 'center';

    if (type === 'error') {
      message.style.background = 'rgba(239, 68, 68, 0.15)';
      message.style.color = '#fca5a5';
      message.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    } else {
      message.style.background = 'rgba(16, 185, 129, 0.15)';
      message.style.color = '#6ee7b7';
      message.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }

    message.textContent = text;

    const form = step.querySelector('form') || step;
    form.insertBefore(message, form.firstChild);

    setTimeout(() => {
      message.remove();
    }, 5000);
  }

  setLoading(btn, isLoading) {
    if (!btn) return;

    if (isLoading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Yükleniyor...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || 'Gönder';
    }
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
}

if (document.getElementById('deleteAccountForm')) {
  new DeleteAccountForm();
}
