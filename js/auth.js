// ========================================
// OARK - Authentication Logic
// ========================================

const SUPABASE_URL = 'https://hxwlwnlfnnsflbkkbbea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4d2x3bmxmbm5zZmxia2tiYmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODg0NTgsImV4cCI6MjA3ODI2NDQ1OH0.h2HbS9OIQLgh7M0DpwtUfKhgAMYXryv9H9tjK4brzaI';

class AuthManager {
  constructor() {
    this.supabase = null;
    this.user = null;
    this.init();
  }

  init() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this.initSessionListener();
    } else {
      console.error('Supabase SDK not loaded.');
    }
  }

  async initSessionListener() {
    console.log('Auth: initSessionListener started');
    // Check initial session
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) console.error('Auth: getSession error', error);
      console.log('Auth: Initial session', session);
      this.handleSessionUpdate(session);
    } catch (err) {
      console.error('Auth: Unexpected error in init', err);
    }

    // Listen for changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth: onAuthStateChange', _event, session);
      this.handleSessionUpdate(session);
    });
  }

  handleSessionUpdate(session) {
    this.user = session?.user ?? null;
    console.log('Auth: handleSessionUpdate, user:', this.user);
    this.updateUI();

    // Redirect logic if needed
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isProfilePage = path.includes('profile.html');

    // Check if we are potentially handling an OAuth redirect
    // If so, we shouldn't redirect away, because Supabase needs to process the hash/query
    const hasAuthParams = window.location.hash.includes('access_token') ||
      window.location.hash.includes('error') ||
      window.location.search.includes('code');

    if (this.user && isLoginPage) {
      window.location.href = 'profile.html';
    } else if (!this.user && isProfilePage && !hasAuthParams) {
      window.location.href = 'login.html';
    }
  }

  updateUI() {
    console.log('Auth: updateUI called, user present:', !!this.user);
    // Update navigation items based on auth state
    const loginBtns = document.querySelectorAll('.auth-login-btn');
    const profileBtns = document.querySelectorAll('.auth-profile-btn');
    const userProfileNavs = document.querySelectorAll('.nav-user-profile');

    console.log(`Auth: Found ${loginBtns.length} login btns, ${userProfileNavs.length} profile navs`);

    if (this.user) {
      loginBtns.forEach(btn => btn.style.display = 'none');
      profileBtns.forEach(btn => btn.style.display = 'none'); // Hide generic profile button
      userProfileNavs.forEach(nav => {
        nav.style.display = 'inline-flex';
        console.log('Auth: Showing profile nav');
      }); // Show specific user nav

      // Trigger profile fetch to populate data
      this.fetchProfile();
    } else {
      loginBtns.forEach(btn => btn.style.display = 'inline-flex');
      profileBtns.forEach(btn => btn.style.display = 'none');
      userProfileNavs.forEach(nav => nav.style.display = 'none');
    }

    // Update profile info if on profile page (dashboard)
    if (document.getElementById('user-email')) {
      document.getElementById('user-email').textContent = this.user?.email || '';
    }
  }

  async fetchProfile() {
    if (!this.user) return;

    // Fast Fallback: Use Metadata immediately
    const meta = this.user.user_metadata || {};
    const fallbackName = meta.username || meta.full_name || this.user.email.split('@')[0];

    // Update Navbar immediately with fallback
    const navNames = document.querySelectorAll('.nav-user-name');
    const navAvatars = document.querySelectorAll('.nav-user-avatar');

    navNames.forEach(el => el.textContent = fallbackName);
    navAvatars.forEach(el => el.textContent = fallbackName.charAt(0).toUpperCase());

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'

      if (data) {
        const displayName = data.username || data.full_name || fallbackName;
        const avatarUrl = data.avatar_url;

        // Update Dashboard Name
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = displayName;

        // Update Navbar Name (Final)
        navNames.forEach(el => el.textContent = displayName);

        if (avatarUrl) {
          // Update Navbar Avatars with Image
          navAvatars.forEach(el => {
            if (el.tagName === 'IMG') {
              el.src = avatarUrl;
            } else {
              el.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
          });

          // Update Main Profile Dashboard Avatar
          const mainProfileAvatar = document.querySelector('.profile-avatar');
          if (mainProfileAvatar) {
            mainProfileAvatar.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            mainProfileAvatar.style.background = 'transparent';
            mainProfileAvatar.style.border = 'none';
          }
        } else {
          // Re-render initial just in case
          const initial = displayName.charAt(0).toUpperCase();
          navAvatars.forEach(el => {
            if (!el.querySelector('img')) el.textContent = initial;
          });

          const mainProfileAvatar = document.querySelector('.profile-avatar');
          if (mainProfileAvatar && !mainProfileAvatar.querySelector('img')) {
            mainProfileAvatar.innerHTML = initial;
          }
        }

        // Check Student Verification Status
        const isStudent = meta.is_student || data.is_student;
        const campusCode = meta.campus_code || data.campus_code;
        const university = meta.university || data.university;
        const department = meta.department || data.department;
        const studentClass = meta.student_class || data.student_class;

        if (isStudent && campusCode) {
          const fileInputCtx = document.getElementById('student-file-input');
          const resultArea = document.getElementById('verification-result');
          const verifyMsg = document.getElementById('verify-status');

          if (fileInputCtx && fileInputCtx.parentElement) {
            fileInputCtx.parentElement.style.display = 'none';
          }

          if (verifyMsg) {
            verifyMsg.style.display = 'block';
            verifyMsg.className = 'verify-status-box status-success';
            verifyMsg.style.background = 'rgba(16, 185, 129, 0.1)';
            verifyMsg.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            verifyMsg.style.color = '#34d399';
            verifyMsg.innerHTML = '<i class="fas fa-check-circle"></i> Doğrulanmış Öğrenci Hesabı';
          }

          if (resultArea) {
            resultArea.style.display = 'block';

            let deptInfo = department ? `${department}` : '';
            if (department && studentClass) deptInfo += ` - ${studentClass}. Sınıf`;

            resultArea.innerHTML = `
                    <div class="code-display">
                        <div class="code-label">Kampüs Giriş Kodun:</div>
                        <div class="campus-code">${campusCode}</div>
                        <div class="code-info">
                            <div>${university || 'Kampüs'}</div>
                            <div style="font-size: 0.9em; opacity: 0.8; margin-top: 0.3rem;">${deptInfo}</div>
                        </div>
                        <div class="code-instruction">Bu kodu Oark mobil uygulamasında "Kampüs" sekmesine gir.</div>
                        <button onclick="window.resetVerification()" style="margin-top: 1.5rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); padding: 0.5rem 1rem; border-radius: 99px; cursor: pointer; font-size: 0.8rem;">
                            <i class="fas fa-redo"></i> Bilgileri Güncelle / Yeniden Yükle
                        </button>
                    </div>
                `;
          }
        }
      } else {
        // PROFILE NOT FOUND -> Auto-Create
        console.log('Profile missing for user, attempting to create...');
        await this.createProfileIfNotExists();
        return this.fetchProfile(); // Retry fetch
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  }

  async createProfileIfNotExists() {
    if (!this.user) return;

    const meta = this.user.user_metadata || {};
    const username = meta.username || this.user.email.split('@')[0];
    const fullName = meta.full_name || username;

    // Try insert
    const { error } = await this.supabase
      .from('profiles')
      .insert({
        id: this.user.id,
        email: this.user.email,
        username: username,
        full_name: fullName,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to auto-create profile:', error);
      // If error is duplicate key, it exists, so ignore.
      if (error.code !== '23505') return;
    }

    console.log('Profile auto-created successfully.');
  }

  async register(username, email, password) {
    if (!this.supabase) return { error: 'Supabase not initialized' };

    // 1. Sign Up
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          full_name: username
        }
      }
    });

    // 2. Client-Side Profile Creation (Fallback if Trigger fails)
    if (data && data.user && !error) {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email,
          username: username,
          full_name: username,
          created_at: new Date().toISOString()
        });

      if (profileError) {
        console.warn('Client-side profile creation failed (Trigger might have handled it or RLS issue):', profileError);
      } else {
        console.log('Client-side profile creation success.');
      }
    }

    return { data, error };
  }

  async resetPassword(email) {
    if (!this.supabase) return { error: 'Supabase not initialized' };
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login.html?reset=true'
    });
  }

  async login(email, password) {
    if (!this.supabase) return { error: 'Supabase not initialized' };

    return await this.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  async loginWithGoogle() {
    if (!this.supabase) return { error: 'Supabase not initialized' };

    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/profile.html'
      }
    });
  }

  async logout() {
    if (!this.supabase) return;
    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      window.location.href = 'index.html';
    }
    return { error };
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

  // Clear display
  document.getElementById('verification-result').style.display = 'none';
  const fileInputCtx = document.getElementById('student-file-input');
  if (fileInputCtx && fileInputCtx.parentElement) {
    fileInputCtx.parentElement.style.display = 'flex';
    fileInputCtx.disabled = false;
    fileInputCtx.value = '';
  }
  const verifyMsg = document.getElementById('verify-status');
  if (verifyMsg) verifyMsg.style.display = 'none';

  // Clear Auth Metadata (via empty strings or null)
  if (window.authManager) {
    await window.authManager.supabase.auth.updateUser({
      data: {
        is_student: false,
        campus_code: null,
        university: null,
        department: null,
        student_class: null
      }
    });
    // Reload page to reflect fresh state
    window.location.reload();
  }
};

window.handleRegister = async (e) => {
  e.preventDefault();
  const username = document.getElementById('username')?.value;
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  const btn = e.target.querySelector('button');
  const originalText = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const { data, error } = await authManager.register(username, email, password);

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
      // Redirect handled by session listener
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
