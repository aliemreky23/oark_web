// ========================================
// OARK - Configuration
// ========================================

window.CONFIG = {
    SUPABASE_URL: 'https://hxwlwnlfnnsflbkkbbea.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4d2x3bmxmbm5zZmxia2tiYmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTc4NTQsImV4cCI6MjA4ODc3Nzg1NH0.Lvq-eVl1MOvYGpS3k6sjGej2LZT15EiGPf0XiO0BaqM',
    API_BASE_URL: 'https://oark-api.vercel.app'
};

// Üretim (Production) ortamında console loglarını kapat (Veri Sızıntısını Önleme)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
}
