
// State
let currentEmail = '';

// Check Auth on Load
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for authManager to init (it's deferred)
    setTimeout(() => {
        if (!window.authManager || !window.authManager.user) {
            // Uncomment to force login, but for now let's see if we can do it public or notify user?
            // Edge Function REQUIRED auth. So we must redirect.
            window.location.href = 'login.html?redirect=verify.html';
        }
    }, 1000);
});

async function handleEmailSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-1');
    const input = document.getElementById('edu-email');
    const errorBox = document.getElementById('error-1');

    const email = input.value.trim();
    if (!email.endsWith('.edu.tr')) {
        showError(errorBox, 'Lütfen geçerli bir .edu.tr uzantılı e-posta adresi girin.');
        return;
    }

    setLoading(btn, true);
    errorBox.style.display = 'none';

    try {
        const { data, error } = await window.authManager.supabase.functions.invoke('campus-gateway', {
            body: { action: 'send-email-otp', email }
        });

        if (error || (data && !data.success)) {
            throw new Error(error?.message || data?.error || 'Bir hata oluştu.');
        }

        // Success
        currentEmail = email;
        document.getElementById('display-email').textContent = email;
        goToStep(2);

    } catch (err) {
        showError(errorBox, err.message);
    } finally {
        setLoading(btn, false);
    }
}

async function handleOtpSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-2');
    const input = document.getElementById('otp-code');
    const errorBox = document.getElementById('error-2');

    const code = input.value.trim();
    if (code.length !== 6) {
        showError(errorBox, 'Lütfen 6 haneli kodu girin.');
        return;
    }

    setLoading(btn, true);
    errorBox.style.display = 'none';

    try {
        // 1. Verify OTP
        const { data: verifyData, error: verifyError } = await window.authManager.supabase.functions.invoke('campus-gateway', {
            body: { action: 'verify-email-otp', email: currentEmail, code }
        });

        if (verifyError || !verifyData.success) {
            throw new Error(verifyError?.message || verifyData?.error || 'Kod hatalı veya süresi dolmuş.');
        }

        // 2. Generate Permanent Access Code
        // NOTE: We need a valid campus_id. 
        // Logic gap: The user just entered an email. We don't know which 'campus_id' corresponds to 'aybu.edu.tr' in the frontend map *unless* we hardcode it or the edge function derives it.
        // The Edge Function 'send-email-otp' doesn't return campus info.
        // Ideally, 'verify-email-otp' should probably tell us the campus or we need to pass it?
        // Looking at Edge Function 'generate-code': requires campus_id.

        // TEMPORARY FIX: For AYBÜ Restoration, hardcode AYBÜ UUID if email contains 'aybu.edu.tr'
        let campusId = '';
        let uniName = 'Bilinmeyen Üniversite';

        if (currentEmail.includes('aybu.edu.tr') || currentEmail.includes('ybu.edu.tr')) {
            campusId = '76886037-c82c-4f68-b1c9-1655bdf19171'; // AYBÜ UUID from earlier
            uniName = 'Ankara Yıldırım Beyazıt Üniversitesi';
        } else {
            throw new Error('Bu üniversite henüz sistemimizde tanımlı değil.');
        }

        const { data: genData, error: genError } = await window.authManager.supabase.functions.invoke('campus-gateway', {
            body: {
                action: 'generate-code',
                campus_id: campusId,
                university_name: uniName,
                department: 'Öğrenci', // Default
                student_class: 1, // Default
                student_no: currentEmail.split('@')[0]
            }
        });

        if (genError || !genData.success) {
            throw new Error(genError?.message || genData?.error || 'Kod üretilemedi.');
        }

        // Success
        document.getElementById('final-code').textContent = genData.code;
        goToStep(3);

    } catch (err) {
        showError(errorBox, err.message);
    } finally {
        setLoading(btn, false);
    }
}

// UI Helpers
function goToStep(step) {
    document.querySelectorAll('[id^="step-"]').forEach(el => el.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';

    document.querySelectorAll('.step-dot').forEach(el => el.classList.remove('active'));
    document.getElementById(`dot-${step}`).classList.add('active');
}

function showError(el, msg) {
    el.style.display = 'block';
    el.textContent = msg;
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'İşleniyor...';
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Devam Et';
    }
}

function resetFlow() {
    goToStep(1);
    currentEmail = '';
    document.getElementById('edu-email').value = '';
    document.getElementById('otp-code').value = '';
    document.getElementById('error-1').style.display = 'none';
    document.getElementById('error-2').style.display = 'none';
}
