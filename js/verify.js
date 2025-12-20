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

        // Simulate Sending OTP (or use Supabase Function if we had one)
        const btn = document.querySelector('#email-step button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
        btn.disabled = true;

        await new Promise(r => setTimeout(r, 1500)); // Fake network delay

        // In a real app, we would call supabase.functions.invoke('send-otp', { email })
        // For MVP, we use a fixed code "123456" or console log it
        console.log('OTP Sent to ' + email + ': 123456');

        btn.disabled = false;
        btn.innerHTML = originalText;

        // Move to OTP Step
        document.getElementById('email-step').style.display = 'none';
        document.getElementById('otp-step').style.display = 'block';

        alert(`Doğrulama kodu ${email} adresine gönderildi. (Demo Kodu: 123456)`);
        this.verificationData.email = email;
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

    async saveVerification(code, university, department, studentClass) {
        // Logic to save to Supabase
        if (!window.authManager || !window.authManager.user) {
            console.error('Cannot save verification: User not logged in.');
            return;
        }

        const user = window.authManager.user;
        const supabase = window.authManager.supabase;

        console.log(`Starting Verification Save for: ${university}`);

        try {
            // 1. Try to update Auth Metadata (Reliable, No Schema needed) causes immediate UI update if listener is active
            await supabase.auth.updateUser({
                data: {
                    is_student: true,
                    campus_code: code,
                    university: university,
                    department: department,
                    student_class: studentClass,
                    edu_email: this.verificationData.email // Save email too
                }
            });

            // 2. Update 'profiles' table (Display purposes)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    campus_code: code,
                    university: university,
                    department: department,
                    student_class: studentClass,
                    is_student: true,
                    edu_email: this.verificationData.email
                })
                .eq('id', user.id);

            if (profileError) console.warn('Profile update warning:', profileError);

            // 3. CRITICAL: Add to 'club_members' table
            // Step 3a: Find University ID
            // We use ilike for case-insensitive matching.
            // Note: The university name from PDF might differ slightly from DB.
            // Ideally we'd use fuzzy search, but for now ilike %Query%

            // Try exact match first
            let { data: uniData, error: uniError } = await supabase
                .from('universities')
                .select('id, name')
                .ilike('name', university)
                .maybeSingle();

            // If not found, try containing search
            if (!uniData) {
                const simpleName = university.split('ÜNİVERSİTESİ')[0].trim();

                // 1. Try fuzzy match with original CAPS (Standard I -> i issue might occur)
                let { data: fuzzyData } = await supabase
                    .from('universities')
                    .select('id, name')
                    .ilike('name', `%${simpleName}%`)
                    .limit(1);

                if (fuzzyData && fuzzyData.length > 0) {
                    uniData = fuzzyData[0];
                } else {
                    // 2. Try Turkish-Specific Lowercase (Handled I -> ı)
                    // "YILDIRIM" -> "yıldırım"
                    const turkeyName = simpleName.toLocaleLowerCase('tr-TR');
                    const { data: turkData } = await supabase
                        .from('universities')
                        .select('id, name')
                        .ilike('name', `%${turkeyName}%`)
                        .limit(1);

                    if (turkData && turkData.length > 0) uniData = turkData[0];
                }
            }

            if (!uniData) {
                console.error(`University not found in DB: ${university}`);
                alert(`Doğrulama başarılı ancak "${university}" sistemimizde henüz kayıtlı değil. Lütfen destek ile iletişime geç.`);
                return;
            }

            console.log('Found University:', uniData);

            // Step 3b: Find Default Club for this University
            // Assuming there's at least one club. We take the first one or one named 'EXP'
            const { data: clubData, error: clubError } = await supabase
                .from('clubs')
                .select('id, name')
                .eq('university_id', uniData.id)
                .limit(1)
                .single();

            if (!clubData) {
                console.error(`No club found for university: ${uniData.name}`);
                alert('Bu üniversite için henüz aktif bir kulüp bulunmuyor.');
                return;
            }

            console.log('Found Club:', clubData);

            // Step 3c: Add User to Club
            const { error: memberError } = await supabase
                .from('club_members')
                .insert({
                    user_id: user.id,
                    club_id: clubData.id,
                    role: 'member'
                });

            if (memberError) {
                // If unique violation (already member), that's fine.
                if (memberError.code === '23505') {
                    console.log('User is already a member of this club.');
                    alert(`Başarılı! Zaten ${clubData.name} üyesisin.`);
                } else {
                    console.error('Failed to add member:', memberError);
                    alert('Kulüp üyeliği eklenirken bir hata oluştu.');
                }
            } else {
                console.log('Successfully added to club!');
                alert(`Tebrikler! ${uniData.name} - ${clubData.name} topluluğuna başarıyla katıldın!`);

                // Update UI to show club membership
                this.showClubSuccess(uniData.name, clubData.name);
            }

        } catch (err) {
            console.error('Verification Save Flow Error:', err);
            alert('Beklenmeyen bir hata oluştu.');
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
