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
    // Initialize Supabase
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this.initSupabaseSession();
    } else {
      console.error("Supabase client not loaded!");
      this.updateUI();
    }
  }

  async initSupabaseSession() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.user = session.user;
        await this.fetchProfile();
        this.handleRedirects();
      } else {
        this.updateUI();
      }
    } catch (err) {
      console.error('Supabase session check failed:', err);
      this.updateUI();
    }

    // Listen for Auth callbacks
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        this.user = session.user;
        await this.fetchProfile();

        // Redirect if on login page
        if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
          window.location.href = 'profile.html';
        }
      } else if (event === 'SIGNED_OUT') {
        this.clearSession();
      }
    });
  }

  clearSession() {
    this.user = null;
    this.profile = null;
    this.updateUI();
  }

  handleRedirects() {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html') || path.includes('register.html');
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
    const statusContainer = document.getElementById('student-status-container');
    if (!statusContainer || !profile) return;

    if (profile.is_student === true) {
      // User is a verified student
      let deptInfo = profile.department || '';
      if (profile.department && profile.class_grade) deptInfo += ` - ${profile.class_grade}. Sınıf`;

      statusContainer.innerHTML = `
        <div style="width: 100%; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15)); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; gap: 1.5rem; animation: fadeUp 0.5s ease;">
            <div style="width: 50px; height: 50px; background: rgba(16, 185, 129, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #10b981; font-size: 1.5rem; flex-shrink: 0;">
                <i class="fas fa-graduation-cap"></i>
            </div>
            <div>
                <h3 style="color: #10b981; margin-bottom: 0.25rem; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-check-circle"></i> Doğrulanmış Öğrenci
                </h3>
                <div style="color: rgba(255, 255, 255, 0.9); font-weight: 500; font-size: 1.05rem;">${profile.university || 'Üniversite Bilgisi Bekleniyor'}</div>
                <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.9rem; margin-top: 0.25rem;">${deptInfo}</div>
            </div>
        </div>
      `;
    } else {
      // User is NOT a verified student
      statusContainer.innerHTML = `
        <div style="width: 100%; background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05)); border: 1px solid rgba(255, 255, 255, 0.2); padding: 2rem; border-radius: 16px; text-align: center; backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); animation: fadeUp 0.5s ease;">
            <div style="width: 64px; height: 64px; background: rgba(139, 92, 246, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8b5cf6; font-size: 2rem; margin: 0 auto 1.25rem auto;">
                <i class="fas fa-mobile-alt"></i>
            </div>
            <h3 style="color: white; font-size: 1.3rem; margin-bottom: 0.75rem;">Öğrenci Doğrulaması Uygulamada</h3>
            <p style="font-size: 0.95rem; color: rgba(255,255,255,0.8); max-width: 80%; margin: 0 auto; line-height: 1.6;">
                OARK'ın kampüs özelliklerini kullanabilmek için lütfen <strong style="color: #8b5cf6;">OARK Mobil Uygulamasını</strong> indirerek öğrenci belgenizi onaylatın.
            </p>
        </div>
      `;
    }
  }

  // ========================================
  // Auth Methods (Now using API)
  // ========================================

  async register(username, email, password, fullName) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            full_name: fullName
          }
        }
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  async login(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      this.user = data.user;
      await this.fetchProfile();
      this.updateUI();
      return { data, error: null };
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
    if (!this.user) return;
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .single();

      if (error) throw error;
      this.profile = data;
      this.updateProfileDisplay();
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

  // Update profile via Supabase
  try {
    const { error } = await authManager.supabase
      .from('profiles')
      .update({
        is_student: false,
        campus_code: null,
        university: null,
        department: null,
        class_grade: null
      })
      .eq('id', authManager.user.id);
    if (error) throw error;
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

// Password Change Modal Handlers
window.openPasswordModal = (e) => {
  e.preventDefault();
  if (!window.authManager.user) {
    alert("Oturum açmanız gerekiyor.");
    return;
  }
  document.getElementById('password-modal').style.display = 'flex';
  document.getElementById('pw-step-1').style.display = 'block';
  document.getElementById('pw-step-2').style.display = 'none';
  document.getElementById('pw-step-3').style.display = 'none';
  document.getElementById('pw-error-1').style.display = 'none';
  document.getElementById('pw-error-2').style.display = 'none';
  document.getElementById('pw-otp').value = '';
  document.getElementById('pw-new').value = '';
};

window.closePasswordModal = () => {
  document.getElementById('password-modal').style.display = 'none';
};

window.sendPasswordResetOtp = async () => {
  const errorEl = document.getElementById('pw-error-1');
  const btn = document.getElementById('btn-send-otp');
  errorEl.style.display = 'none';

  if (!window.authManager.user?.email) {
    errorEl.textContent = "Kullanıcı e-postası bulunamadı!";
    errorEl.style.display = 'block';
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="margin-right: 8px;"></span> Gönderiliyor...';

    const { error } = await window.authManager.supabase.auth.resetPasswordForEmail(
      window.authManager.user.email
    );

    if (error) throw error;

    document.getElementById('pw-step-1').style.display = 'none';
    document.getElementById('pw-step-2').style.display = 'block';

  } catch (err) {
    errorEl.textContent = err.message || "Bir hata oluştu.";
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Kodu Gönder <i class="fas fa-paper-plane"></i>';
  }
};

window.verifyPasswordResetOtp = async () => {
  const otp = document.getElementById('pw-otp').value;
  const newPassword = document.getElementById('pw-new').value;
  const errorEl = document.getElementById('pw-error-2');
  const btn = document.getElementById('btn-verify-otp');

  errorEl.style.display = 'none';

  if (!otp || otp.length !== 8) {
    errorEl.textContent = "Lütfen 8 haneli kodu eksiksiz girin.";
    errorEl.style.display = 'block';
    return;
  }

  if (!newPassword || newPassword.length < 6) {
    errorEl.textContent = "Yeni şifre en az 6 karakter olmalıdır.";
    errorEl.style.display = 'block';
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="margin-right: 8px;"></span> Doğrulanıyor...';

    // 1. Doğrulama Kodunu (OTP) onayla
    const { error: verifyError } = await window.authManager.supabase.auth.verifyOtp({
      email: window.authManager.user.email,
      token: otp,
      type: 'recovery'
    });

    if (verifyError) throw verifyError;

    // 2. Yeni şifreyle güncelle
    const { error: updateError } = await window.authManager.supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) throw updateError;

    document.getElementById('pw-step-2').style.display = 'none';
    document.getElementById('pw-step-3').style.display = 'block';

  } catch (err) {
    errorEl.textContent = err.message === "Token has expired or is invalid"
      ? "Geçersiz veya süresi dolmuş onay kodu."
      : err.message || "Bir hata oluştu.";
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Şifreyi Güncelle';
  }
};
