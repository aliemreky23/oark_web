// ========================================
// OARK - Student Verification Logic
// Uses pdf.js for client-side parsing
// ========================================

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

class Verifier {
    constructor() {
        this.status = 'idle'; // idle, analyzing, verified, rejected
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Lütfen sadece PDF formatında dosya yükleyin.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Dosya boyutu çok büyük (Max 5MB).');
            return;
        }

        this.updateStatus('analyzing', 'Belge Taranıyor...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            // 1. Metadata Check (Anti-Forgery)
            const metadata = await pdf.getMetadata();
            if (!this.checkMetadata(metadata)) {
                this.updateStatus('rejected', 'Sahte Belge Tespit Edildi! (Metadata Uyuşmazlığı)');
                return;
            }

            // 2. Text Content Check
            const page = await pdf.getPage(1);
            const textContent = await page.getTextContent();
            const fullText = textContent.items.map(item => item.str).join(' ');

            if (!this.checkContent(fullText)) {
                this.updateStatus('rejected', 'Belge doğrulanamadı. "Öğrenci Belgesi" veya "Aktif" ibaresi bulunamadı.');
                return;
            }

            // 3. Extract Info
            const university = this.extractUniversity(fullText);
            const department = this.extractDepartment(fullText);
            const studentClass = this.extractClass(fullText);

            // 4. Success -> Generate Code
            const code = this.generateCampusCode(university);

            this.updateStatus('verified', `Doğrulama Başarılı: ${university}`);
            this.showSuccessUI(code, university, department, studentClass);

            // Optional: Save to Supabase
            this.saveVerification(code, university, department, studentClass);

        } catch (error) {
            console.error('PDF Error:', error);
            this.updateStatus('rejected', 'Belge okunamadı. Lütfen geçerli bir e-Devlet belgesi yükleyin.');
        }
    }

    checkMetadata(data) {
        console.log('Metadata:', data);
        if (!data || !data.info) return true; // Some valid docs might lack info, but suspicious. Strict mode: return false.

        const producer = (data.info.Producer || '').toLowerCase();
        const creator = (data.info.Creator || '').toLowerCase();

        const forbidden = ['photoshop', 'illustrator', 'canva', 'gimp', 'paint'];

        if (forbidden.some(tool => producer.includes(tool) || creator.includes(tool))) {
            console.warn('Forgery detected: Forbidden producer/creator');
            return false;
        }

        return true;
    }

    checkContent(text) {
        console.log('Extracted Text:', text.substring(0, 100) + '...');

        // Key phrases in e-Devlet Application
        const requiredPhrases = [
            'Öğrenci Belgesi',
            'Sorgulama Kodu', // or 'Barkod'
            // 'Aktif' // Sometimes 'Aktif' might be 'Okuyor' etc, keep logic loose for MVP
        ];

        // Check verification link domain availability in text is also a good check
        const hasTurkiyeGov = text.includes('turkiye.gov.tr');

        const hasKeywords = requiredPhrases.every(phrase => text.includes(phrase)) || text.includes('YÖK') || hasTurkiyeGov;

        return hasKeywords;
    }

    extractUniversity(text) {
        try {
            // Match "X ÜNİVERSİTESİ"
            // Use a specific regex that limits the prefix length to avoid capturing previous fields like "SINIF Program"
            // We look for a block of capital letters ending in ÜNİVERSİTESİ, max 60 chars.
            const match = text.match(/\b([A-ZĞÜŞİÖÇ\s]{3,60}ÜNİVERSİTESİ)/);

            if (match) {
                let uni = match[0].trim();
                // Clean up common prefixes if still captured
                const prefixes = ['PROGRAM', 'SINIF', 'DÖNEM', 'MÜHENDİSLİĞİ', 'FAKÜLTESİ'];
                prefixes.forEach(p => {
                    if (uni.includes(p)) {
                        uni = uni.split(p).pop().trim();
                    }
                });
                return uni;
            }
            return 'Bilinmeyen Üniversite';
        } catch (e) {
            return 'Üniversite';
        }
    }

    extractDepartment(text) {
        try {
            // E-Devlet pattern: "Programı : X MÜHENDİSLİĞİ" or "Program : X"
            // We look for "Program" keyword and take the rest of the line or next words
            // Regex: Program[ı|i]?\s*[:]\s*([A-ZĞÜŞİÖÇ\s]+)
            const match = text.match(/Program[ı|i]?\s*[:]\s*([a-zA-ZğüşıöçĞÜŞİÖÇ\s]+)/);
            if (match && match[1]) {
                // Cleanup: remove standard suffixes if captured accidentally
                return match[1].split('Sınıf')[0].trim();
            }

            // Fallback: look for generic "MÜHENDİSLİĞİ" or "FAKÜLTESİ" lines if specific label missing
            const deptMatch = text.match(/([a-zA-ZğüşıöçĞÜŞİÖÇ\s]+(MÜHENDİSLİĞİ|ÖĞRETMENLİĞİ|FAKÜLTESİ))/);
            if (deptMatch) return deptMatch[0].trim();

            return 'Bilinmeyen Bölüm';
        } catch (e) {
            return '';
        }
    }

    extractClass(text) {
        try {
            // E-Devlet pattern: "Sınıfı : 4" or "Sınıf : 1"
            const match = text.match(/Sınıf[ı|i]?\s*[:]\s*(\d+)/);
            if (match && match[1]) return match[1];

            // Or "Dönemi" if class not found? For now stick to generic
            return '?';
        } catch (e) {
            return '';
        }
    }

    generateCampusCode(university) {
        // Generate a 6-char code: 4 letters from Uni + 4 random digits
        // For MVP: simple random code
        const prefix = university.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'UNI');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${randomNum}`;
    }

    updateStatus(state, message) {
        this.status = state;
        const statusEl = document.getElementById('verify-status');
        const statusText = document.getElementById('verify-message');

        if (statusEl && statusText) {
            statusText.textContent = message;

            statusEl.className = 'verify-status-box'; // reset
            if (state === 'analyzing') statusEl.classList.add('status-loading');
            if (state === 'verified') statusEl.classList.add('status-success');
            if (state === 'rejected') statusEl.classList.add('status-error');

            statusEl.style.display = 'block';
        }
    }

    showSuccessUI(code, university, department, studentClass) {
        const fileInput = document.getElementById('student-file-input');
        if (fileInput) fileInput.disabled = true;

        const resultArea = document.getElementById('verification-result');
        if (resultArea) {
            resultArea.style.display = 'block';
            let deptInfo = department ? `${department}` : '';
            if (department && studentClass) deptInfo += ` - ${studentClass}. Sınıf`;

            resultArea.innerHTML = `
                <div class="code-display">
                    <div class="code-label">Kampüs Giriş Kodun:</div>
                    <div class="campus-code">${code}</div>
                    <div class="code-info">
                        <div>${university}</div>
                        <div style="font-size: 0.9em; opacity: 0.8; margin-top: 0.3rem;">${deptInfo}</div>
                    </div>
                    <div class="code-instruction">Bu kodu Oark mobil uygulamasında "Kampüs" sekmesine gir.</div>
                </div>
            `;
        }
    }

    async saveVerification(code, university, department, studentClass) {
        // Logic to save to Supabase
        if (window.authManager && window.authManager.user) {
            // 1. Try to update Auth Metadata (Reliable, No Schema needed)
            const { data: authData, error: authError } = await window.authManager.supabase.auth.updateUser({
                data: {
                    is_student: true,
                    campus_code: code,
                    university: university,
                    department: department,
                    student_class: studentClass
                }
            });

            if (authError) {
                console.error('Auth Metadata Save Error:', authError);
                alert('Kaydetme hatası: ' + authError.message);
            } else {
                console.log('Saved to Auth Metadata:', authData);
            }

            // 2. Also try profiles table (Best effort)
            const { error: dbError } = await window.authManager.supabase
                .from('profiles')
                .update({
                    campus_code: code,
                    university: university,
                    department: department,
                    student_class: studentClass,
                    is_student: true
                })
                .eq('id', window.authManager.user.id);

            if (dbError) console.warn('Profiles DB Save Error (Likely missing columns):', dbError);
        }
    }
}

// Initialize
const studentVerifier = new Verifier();
window.handleStudentUpload = (e) => studentVerifier.handleFileSelect(e);
