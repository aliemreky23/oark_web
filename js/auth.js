// ========================================
// OARK - Authentication Logic (API Version)
// ========================================

// Supabase is still needed for OAuth and Realtime
const SUPABASE_URL = 'https://hxwlwnlfnnsflbkkbbea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4d2x3bmxmbm5zZmxia2tiYmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODg0NTgsImV4cCI6MjA3ODI2NDQ1OH0.h2HbS9OIQLgh7M0DpwtUfKhgAMYXryv9H9tjK4brzaI';

class AuthManager {
  constructor() {
    this.supabase = null;
    this.user = null;
    this.profile = null;
    this.init();
  }

  init() {
    // Initialize Supabase for OAuth only
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Check if we have tokens stored
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      this.checkCurrentUser();
    } else if (this.supabase) {
      // Check Supabase session (for OAuth users)
      this.initSupabaseSession();
    } else {
      this.updateUI();
    }
  }

  async initSupabaseSession() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        // Migrate Supabase session to API tokens
        window.oarkAPI.setTokens(session.access_token, session.refresh_token);
        await this.checkCurrentUser();
      } else {
        this.updateUI();
      }
    } catch (err) {
      console.error('Supabase session check failed:', err);
      this.updateUI();
    }

    // Listen for OAuth callbacks
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.oarkAPI.setTokens(session.access_token, session.refresh_token);
        await this.checkCurrentUser();

        // Redirect if on login page
        if (window.location.pathname.includes('login.html')) {
          window.location.href = 'profile.html';
        }
      }
    });
  }

  async checkCurrentUser() {
    try {
      const response = await window.oarkAPI.getCurrentUser();
      if (response.success) {
        this.user = response.data;
        this.profile = response.data;
        this.updateUI();
        this.handleRedirects();
      } else {
        this.clearSession();
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      this.clearSession();
    }
  }

  clearSession() {
    this.user = null;
    this.profile = null;
    window.oarkAPI.clearTokens();
    this.updateUI();
  }

  handleRedirects() {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isProfilePage = path.includes('profile.html');
    const hasAuthParams = window.location.hash.includes('access_token') ||
      window.location.search.includes('code');

    if (this.user && isLoginPage) {
      window.location.href = 'profile.html';
    } else if (!this.user && isProfilePage && !hasAuthParams) {
      window.location.href = 'login.html';
    }
  }

  updateUI() {
    const loginBtns = document.querySelectorAll('.auth-login-btn');
    const profileBtns = document.querySelectorAll('.auth-profile-btn');
    const userProfileNavs = document.querySelectorAll('.nav-user-profile');

    if (this.user) {
      loginBtns.forEach(btn => btn.style.display = 'none');
      profileBtns.forEach(btn => btn.style.display = 'none');
      userProfileNavs.forEach(nav => nav.style.display = 'inline-flex');

      this.updateProfileDisplay();
    } else {
      loginBtns.forEach(btn => btn.style.display = 'inline-flex');
      profileBtns.forEach(btn => btn.style.display = 'none');
      userProfileNavs.forEach(nav => nav.style.display = 'none');
    }

    if (document.getElementById('user-email')) {
      document.getElementById('user-email').textContent = this.user?.email || '';
    }
  }

  updateProfileDisplay() {
    const profile = this.profile || this.user;
    if (!profile) return;

    const displayName = profile.username || profile.full_name || profile.email?.split('@')[0] || 'Kullanıcı';
    const avatarUrl = profile.avatar_url;

    // Update navbar
    const navNames = document.querySelectorAll('.nav-user-name');
    const navAvatars = document.querySelectorAll('.nav-user-avatar');

    navNames.forEach(el => el.textContent = displayName);

    if (avatarUrl) {
      navAvatars.forEach(el => {
        if (el.tagName === 'IMG') {
          el.src = avatarUrl;
        } else {
          el.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        }
      });
    } else {
      const initial = displayName.charAt(0).toUpperCase();
      navAvatars.forEach(el => {
        if (!el.querySelector('img')) el.textContent = initial;
      });
    }

    // Update profile page elements
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = displayName;

    const mainAvatar = document.querySelector('.profile-avatar');
    if (mainAvatar) {
      if (avatarUrl) {
        mainAvatar.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        mainAvatar.style.background = 'transparent';
      } else {
        mainAvatar.innerHTML = displayName.charAt(0).toUpperCase();
      }
    }

    // Student verification status
    this.updateStudentStatus();
  }

  updateStudentStatus() {
    const profile = this.profile;
    if (!profile?.is_student || !profile?.campus_code) return;

    const fileInputCtx = document.getElementById('student-file-input');
    const resultArea = document.getElementById('verification-result');
    const verifyMsg = document.getElementById('verify-status');

    if (fileInputCtx?.parentElement) {
      fileInputCtx.parentElement.style.display = 'none';
    }

    if (verifyMsg) {
      verifyMsg.style.display = 'block';
      verifyMsg.className = 'verify-status-box status-success';
      verifyMsg.innerHTML = '<i class="fas fa-check-circle"></i> Doğrulanmış Öğrenci Hesabı';
    }

    if (resultArea) {
      resultArea.style.display = 'block';
      let deptInfo = profile.department || '';
      if (profile.department && profile.class_grade) deptInfo += ` - ${profile.class_grade}. Sınıf`;

      resultArea.innerHTML = `
        <div class="code-display">
          <div class="code-label">Kampüs Giriş Kodun:</div>
          <div class="campus-code">${profile.campus_code}</div>
          <div class="code-info">
            <div>${profile.university || 'Kampüs'}</div>
            <div style="font-size: 0.9em; opacity: 0.8; margin-top: 0.3rem;">${deptInfo}</div>
          </div>
        </div>
      `;
    }
  }

  // ========================================
  // Auth Methods (Now using API)
  // ========================================

  async register(username, email, password, fullName) {
    try {
      const response = await window.oarkAPI.register(email, password, username, fullName);
      if (response.success) {
        return { data: response.data, error: null };
      }
      return { data: null, error: { message: response.error?.message || 'Kayıt başarısız' } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  async login(email, password) {
    try {
      const response = await window.oarkAPI.login(email, password);
      if (response.success) {
        this.user = response.data.user;
        this.profile = response.data.user;
        this.updateUI();
        return { data: response.data, error: null };
      }
      return { data: null, error: { message: response.error?.message || 'Giriş başarısız' } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  async loginWithGoogle() {
    if (!this.supabase) return { error: { message: 'Supabase not initialized' } };

    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/profile.html'
      }
    });
  }

  async resetPassword(email) {
    if (!this.supabase) return { error: { message: 'Supabase not initialized' } };
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login.html?reset=true'
    });
  }

  async logout() {
    try {
      await window.oarkAPI.logout();

      // Also sign out from Supabase (for OAuth sessions)
      if (this.supabase) {
        await this.supabase.auth.signOut();
      }

      this.user = null;
      this.profile = null;
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Logout error:', err);
      // Force clear anyway
      this.clearSession();
      window.location.href = 'index.html';
    }
  }

  async fetchProfile() {
    try {
      const response = await window.oarkAPI.getProfile();
      if (response.success) {
        this.profile = response.data;
        this.updateProfileDisplay();
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    }
  }
}

// Global instance
let authManager;

document.addEventListener('DOMContentLoaded', () => {
  authManager = new AuthManager();
  window.authManager = authManager;
});

// --- Helper Functions ---

window.resetVerification = async () => {
  if (!confirm('Mevcut doğrulamanı silip yeni belge yüklemek istiyor musun?')) return;

  document.getElementById('verification-result').style.display = 'none';
  const fileInputCtx = document.getElementById('student-file-input');
  if (fileInputCtx?.parentElement) {
    fileInputCtx.parentElement.style.display = 'flex';
    fileInputCtx.disabled = false;
    fileInputCtx.value = '';
  }
  const verifyMsg = document.getElementById('verify-status');
  if (verifyMsg) verifyMsg.style.display = 'none';

  // Update profile via API
  try {
    await window.oarkAPI.updateProfile({
      is_student: false,
      campus_code: null,
      university: null,
      department: null,
      class_grade: null
    });
    window.location.reload();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
};

window.handleRegister = async (e) => {
  e.preventDefault();
  const fullName = document.getElementById('fullname')?.value || '';
  const username = document.getElementById('username')?.value;
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  const btn = e.target.querySelector('button');
  const originalText = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const { data, error } = await authManager.register(username, email, password, fullName);

    if (error) {
      alert('Kayıt başarısız: ' + error.message);
    } else {
      alert('Kayıt başarılı! Lütfen e-posta adresini onayla.');
      window.location.href = 'login.html';
    }
  } catch (err) {
    alert('Bir hata oluştu: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

window.handleResetPassword = async () => {
  const email = prompt("Şifre sıfırlama bağlantısı gönderilecek E-posta adresini girin:");
  if (!email) return;

  try {
    const { error } = await authManager.resetPassword(email);
    if (error) alert('Hata: ' + error.message);
    else alert('Şifre sıfırlama bağlantısı e-posta adresine gönderildi.');
  } catch (e) {
    alert('Hata: ' + e.message);
  }
};

window.handleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = e.target.querySelector('button');
  const originalText = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const { data, error } = await authManager.login(email, password);

    if (error) {
      alert('Giriş başarısız: ' + error.message);
    } else {
      window.location.href = 'profile.html';
    }
  } catch (err) {
    alert('Bir hata oluştu: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

window.handleGoogleLogin = async () => {
  const { error } = await authManager.loginWithGoogle();
  if (error) alert('Google girişi hatası: ' + error.message);
};

window.handleLogout = async () => {
  await authManager.logout();
};

// Initialize Global Auth Manager
window.authManager = new AuthManager();
