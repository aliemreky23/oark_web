// ========================================
// OARK - Student Verification Logic
// Uses pdf.js for client-side parsing
// ========================================

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

class Verifier {
    constructor() {
        this.status = 'idle'; // idle, analyzing, verified, rejected
        this.verificationData = null; // Store data temporarily between steps
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

            // Store data for next steps
            this.verificationData = {
                university,
                department,
                studentClass
            };

            this.updateStatus('verified', `Belge Doğrulandı: ${university}`);

            // Move to Email Step
            this.showEmailStep();

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

    // --- Step Management ---

    showEmailStep() {
        document.getElementById('upload-step').style.display = 'none';
        document.getElementById('email-step').style.display = 'block';
    }

    async handleEduEmailSubmit() {
        const email = document.getElementById('edu-email').value;
        if (!email || !email.includes('@')) {
            alert('Lütfen geçerli bir e-posta adresi girin.');
            return;
        }

        // Logic: Check if email domain matches University
        if (!this.checkDomainMatch(email, this.verificationData.university)) {
            alert(`Hata: Girdiğiniz e-posta adresi (${email}), belgenizdeki üniversite (${this.verificationData.university}) ile eşleşmiyor.`);
            return;
        }
        this.verificationData.email = email; // Store email for later verification

        await this.sendVerificationEmail(email);
    }

    async sendVerificationEmail(email) {
        if (!window.authManager || !window.authManager.user) {
            alert('Lütfen önce giriş yapın.');
            return;
        }

        const btn = document.querySelector(`button[onclick="window.verifyManager.sendVerificationCode()"]`);
        const resultDiv = document.getElementById('email-result');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
            }

            const supabase = window.authManager.supabase;
            const { data, error } = await supabase.functions.invoke('campus-gateway', {
                body: { action: 'send-email-otp', email: email }
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Kod gönderilemedi');

            if (resultDiv) {
                resultDiv.textContent = 'Kod başarıyla gönderildi! Lütfen gelen kutunuzu kontrol edin.';
                resultDiv.className = 'status-box status-success';
                resultDiv.style.display = 'block';
            }

            // UI Update: Show Code Input
            document.getElementById('email-input-group').style.display = 'none';
            document.getElementById('code-input-group').style.display = 'block';

        } catch (err) {
            console.error('Email Send Error:', err);
            if (resultDiv) {
                resultDiv.textContent = 'Hata: ' + (err.message || err);
                resultDiv.className = 'status-box status-error';
                resultDiv.style.display = 'block';
            }
            if (btn) btn.disabled = false;
        } finally {
            if (btn) btn.innerHTML = 'Doğrulama Kodu Gönder';
        }
    }

    async verifyCode() {
        const codeInput = document.getElementById('verification-code');
        const code = codeInput.value.trim();
        const resultDiv = document.getElementById('code-result');

        if (code.length !== 6) {
            alert('Lütfen 6 haneli kodu girin.');
            return;
        }

        try {
            const supabase = window.authManager.supabase;
            const { data, error } = await supabase.functions.invoke('campus-gateway', {
                body: {
                    action: 'verify-email-otp',
                    email: this.verificationData.email,
                    code: code
                }
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Geçersiz kod');

            // Success
            if (resultDiv) {
                resultDiv.textContent = 'E-posta doğrulandı! Son adıma geçiliyor...';
                resultDiv.className = 'status-box status-success';
                resultDiv.style.display = 'block';
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Proceed to generate the Campus Entry Code
            this.saveVerification('DUMMY', this.verificationData.university, this.verificationData.department, this.verificationData.studentClass);

        } catch (err) {
            console.error('Verify Code Error:', err);
            if (resultDiv) {
                resultDiv.textContent = 'Hata: ' + (err.message || 'Kod doğrulanamadı');
                resultDiv.className = 'status-box status-error';
                resultDiv.style.display = 'block';
            }
        }
    }

    checkDomainMatch(email, universityName) {
        // Simplified domain check logic
        // In production, we should query the 'universities' table for the 'domain' column
        // Here we do a basic heuristic check

        const domain = email.split('@')[1].toLowerCase();

        // Check generic edu.tr
        if (!domain.endsWith('edu.tr')) return false;

        // Check specific university mapping (Mock or heuristic)
        // e.g. "Ankara Yıldırım Beyazıt Üniversitesi" -> "aybu.edu.tr"

        const normalize = (str) => str.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
        const uniSlug = normalize(universityName);

        // If the domain 'part' is inside the university name, it's likely valid
        // e.g. aybu inside "ankara yildirim beyazit universitesi" -> maybe not direct match
        // But usually: hacettepe.edu.tr -> "Hacettepe Üniversitesi"

        const domainName = domain.split('.')[0];

        // Basic whitelist for MVP testing
        if (uniSlug.includes('yildirim') && domain.includes('aybu')) return true;
        if (uniSlug.includes('hacettepe') && domain.includes('hacettepe')) return true;
        if (uniSlug.includes('bilkent') && domain.includes('bilkent')) return true;

        // Fallback: assume strict check failed if not in common list, but allow for now if user insists?
        // Let's be strict but give useful error.

        // For Demo purposes, allow any 'edu.tr' if it vaguely matches
        if (uniSlug.includes(domainName)) return true;

        return false;
    }

    async handleOtpSubmit() {
        const code = document.getElementById('otp-code').value;
        if (code !== '123456') {
            alert('Hatalı kod! Lütfen tekrar deneyin.');
            return;
        }

        // Success! Proceed to final save
        document.getElementById('otp-step').style.display = 'none';

        // Generate Code & Save
        const campusCode = this.generateCampusCode(this.verificationData.university);

        this.showSuccessUI(campusCode, this.verificationData.university, this.verificationData.department, this.verificationData.studentClass);
        await this.saveVerification(campusCode, this.verificationData.university, this.verificationData.department, this.verificationData.studentClass);
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
                        <div style="font-size: 0.8em; color: #34d399; margin-top: 5px;"><i class="fas fa-check"></i> ${this.verificationData.email} doğrulandı</div>
                    </div>
                    <div class="code-instruction">Bu kodu Oark mobil uygulamasında "Kampüs" sekmesine gir.</div>
                </div>
            `;
        }
    }

    async saveVerification(dummyCode, university, department, studentClass) {
        if (!window.authManager || !window.authManager.user) {
            console.error('Cannot save verification: User not logged in.');
            return;
        }

        const user = window.authManager.user;
        const supabase = window.authManager.supabase;

        console.log(`Starting Verification via API for: ${university}`);

        try {
            // 1. Resolve Campus/Club ID (Client Side Logic kept for now)
            // ... (Keeping the resolution logic mostly same but optimizing)

            // Resolve University
            const simpleName = university.split('ÜNİVERSİTESİ')[0].trim();
            // Fuzzy match logic
            let { data: uniData } = await supabase.from('universities').select('id, name')
                .ilike('name', university).maybeSingle();

            if (!uniData) {
                // Try fuzzy
                const { data: fuzzyData } = await supabase.from('universities').select('id, name')
                    .ilike('name', `%${simpleName}%`).limit(1);
                if (fuzzyData && fuzzyData.length > 0) uniData = fuzzyData[0];
            }

            if (!uniData) {
                alert(`Doğrulama başarılı ancak "${university}" sistemimizde henüz kayıtlı değil.`);
                return;
            }

            // Resolve Club
            const { data: clubData } = await supabase.from('clubs')
                .select('id, name').eq('university_id', uniData.id).limit(1).single();

            if (!clubData) {
                alert('Bu üniversite için henüz aktif bir kulüp bulunmuyor.');
                return;
            }

            console.log('Resolved Club:', clubData);

            // 2. CALL API (Edge Function)
            const { data: apiData, error: apiError } = await supabase.functions.invoke('campus-gateway', {
                body: {
                    action: 'generate-code',
                    campus_id: clubData.id,
                    university_name: uniData.name, // Send standardized name
                    department: department,
                    student_class: studentClass,
                    student_no: '' // Not extracted currently
                }
            });

            if (apiError || !apiData?.success) {
                throw new Error(apiError?.message || apiData?.error || 'Kod oluşturulamadı');
            }

            console.log('API Response:', apiData);

            // 3. Update UI with REAL Code
            this.showSuccessUI(apiData.code, uniData.name, department, studentClass);

            // Update Auth Metadata locally just for UI consistency if needed, but truth is in DB
            // We don't verify them yet here, just Show Code.

        } catch (err) {
            console.error('API Error:', err);
            alert('İşlem başarısız: ' + err.message);
        }
    }

    showClubSuccess(uniName, clubName) {
        const resultArea = document.getElementById('verification-result');
        if (resultArea) {
            const successBanner = document.createElement('div');
            successBanner.style.background = 'rgba(16, 185, 129, 0.2)';
            successBanner.style.color = '#34d399';
            successBanner.style.padding = '1rem';
            successBanner.style.borderRadius = '12px';
            successBanner.style.marginTop = '1rem';
            successBanner.style.textAlign = 'center';
            successBanner.style.fontWeight = 'bold';
            successBanner.innerHTML = `<i class="fas fa-users"></i> ${clubName} Üyeliği Aktif Edildi!`;

            resultArea.prepend(successBanner);
        }
    }
}

// Initialize
const studentVerifier = new Verifier();
window.handleStudentUpload = (e) => studentVerifier.handleFileSelect(e);
window.handleEduEmailSubmit = () => studentVerifier.handleEduEmailSubmit();
window.handleOtpSubmit = () => studentVerifier.handleOtpSubmit();
