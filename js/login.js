const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const switchButton = document.getElementById('auth-switch-btn');
let showingRegister = false;

function escapeLoginHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function normalizeStudentPhone(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return digits;
}

function generateStudentId(students) {
    const usedIds = new Set();
    let highestNumber = 100;
    (Array.isArray(students) ? students : []).forEach(student => {
        const id = String(student.Student_ID || '').trim().toUpperCase();
        const match = id.match(/^IM(\d+)$/);
        if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
        usedIds.add(id);
    });

    let nextNumber = highestNumber + 1;
    let candidate = `IM${nextNumber}`;
    while (usedIds.has(candidate)) candidate = `IM${++nextNumber}`;
    return candidate;
}

async function showAdminContacts(message, prefix) {
    let phone = localStorage.getItem('Admin_Phone') || '';
    let email = localStorage.getItem('Admin_Email') || '';
    const contactCacheAge = Date.now() - Number(localStorage.getItem('Admin_Contact_SavedAt') || 0);
    if (localStorage.getItem('Admin_Phone') === null || localStorage.getItem('Admin_Email') === null || contactCacheAge > 120000) {
        try {
            const data = await fetchData('Settings');
            const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
            const combinedSetting = [...rows].reverse().find(row => row.Setting_Name === 'Admin_Contact');
            let combinedContact = null;
            if (combinedSetting?.Setting_Value) {
                try { combinedContact = JSON.parse(combinedSetting.Setting_Value); } catch (_) { }
            }
            const phoneSetting = [...rows].reverse().find(row => row.Setting_Name === 'Admin_Phone');
            const emailSetting = [...rows].reverse().find(row => row.Setting_Name === 'Admin_Email');
            if (combinedContact) {
                phone = String(combinedContact.phone || '');
                email = String(combinedContact.email || '');
            } else {
                if (phoneSetting) phone = String(phoneSetting.Setting_Value || '');
                if (emailSetting) email = String(emailSetting.Setting_Value || '');
            }
            localStorage.setItem('Admin_Phone', phone);
            localStorage.setItem('Admin_Email', email);
            localStorage.setItem('Admin_Contact_SavedAt', String(Date.now()));
        } catch (_) { }
    }

    const contacts = [];
    if (phone) {
        let whatsappNumber = phone.replace(/\D/g, '');
        if (whatsappNumber.length === 10) whatsappNumber = `91${whatsappNumber}`;
        contacts.push(`<a href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${escapeLoginHtml(phone)}</a>`);
    }
    if (email) contacts.push(`<a href="mailto:${encodeURIComponent(email)}"><i class="fa-regular fa-envelope" aria-hidden="true"></i> ${escapeLoginHtml(email)}</a>`);
    message.innerHTML = `${prefix}<br>${contacts.length ? contacts.join(' &nbsp; · &nbsp; ') : 'Please contact admin.'}`;
}

switchButton.addEventListener('click', () => {
    showingRegister = !showingRegister;
    loginForm.style.display = showingRegister ? 'none' : 'block';
    registerForm.style.display = showingRegister ? 'block' : 'none';
    document.querySelector('.login-container > h2').textContent = showingRegister ? 'Student Registration' : 'Student login';
    document.getElementById('auth-switch-prompt').textContent = showingRegister ? 'Already registered?' : 'New student?';
    switchButton.textContent = showingRegister ? 'Login here' : 'Register here';
    document.getElementById('login-msg').textContent = '';
    document.getElementById('register-msg').textContent = '';
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('login-btn');
    const message = document.getElementById('login-msg');
    const enteredId = document.getElementById('login_id').value.trim();
    const enteredPassword = document.getElementById('login_pass').value;
    button.disabled = true;
    button.textContent = 'Checking...';
    message.textContent = '';

    try {
        const students = await fetchData('Students', { forceRefresh: true });
        const studentIdExists = students.some(item => String(item.Student_ID || '').trim() === enteredId);
        let student = students.find(item => String(item.Student_ID || '').trim() === enteredId && String(item.Password || '') === enteredPassword);
        // Repair accounts registered while the Students sheet columns were written in the wrong order.
        const legacyIndex = students.findIndex(item => String(item.Student_ID || '').trim() === enteredId && !item.Password && String(item.Email || '').trim().toLowerCase() === 'active' && String(item.Status || '') === enteredPassword);
        if (!student && legacyIndex >= 0) {
            const legacy = students[legacyIndex];
            const repaired = { ...legacy, Password: enteredPassword, Status: 'Pending', Email: '' };
            const repairResponse = await saveData('Students', [repaired.Student_ID, repaired.Name, repaired.Phone, repaired.Password, repaired.Status, repaired.Email], 'update', legacyIndex + 2);
            if (repairResponse.status === 'success') student = repaired;
        }
        if (!student && !studentIdExists) {
            message.style.color = '#b45309';
            await showAdminContacts(message, 'Student ID not found. Please register first. For help, contact admin:');
        } else if (!student) {
            message.style.color = 'red';
            message.textContent = 'Incorrect password. Please try again.';
        } else if (String(student.Status || '').trim().toLowerCase() === 'pending') {
            message.style.color = '#b45309';
            await showAdminContacts(message, 'Your ID is pending approval. Please contact admin:');
        } else if (String(student.Status || '').trim().toLowerCase() !== 'active') {
            message.style.color = 'red';
            message.textContent = 'অ্যাকাউন্টটি Deactive করা আছে। Active করার জন্য Institution-এ যোগাযোগ করো।';
        } else {
            message.style.color = 'green';
            message.textContent = 'Login successful. Opening your dashboard...';
            sessionStorage.setItem('loggedInStudent', JSON.stringify(student));
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
        }
    } catch (_) {
        message.style.color = 'red';
        message.textContent = 'Could not connect to the server. Please try again.';
    } finally {
        button.disabled = false;
        button.textContent = 'Login Here';
    }
});

registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('register-btn');
    const message = document.getElementById('register-msg');
    const name = document.getElementById('register-name').value.trim();
    const mobileInput = document.getElementById('register-mobile').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const mobile = mobileInput.replace(/[\s()-]/g, '');
    const digits = mobile.replace(/^\+/, '');

    if (!/^\+?\d{10,15}$/.test(mobile) || digits.length < 10 || digits.length > 15) {
        message.style.color = 'red';
        message.textContent = 'Enter a valid mobile number (10 to 15 digits).';
        return;
    }

    button.disabled = true;
    button.textContent = 'Creating account...';
    message.textContent = '';
    try {
        const students = await fetchData('Students', { forceRefresh: true });
        const duplicate = students.some(student =>
            normalizeStudentPhone(student.Student_ID) === digits || normalizeStudentPhone(student.Phone) === digits
        );
        if (duplicate) {
            message.style.color = 'red';
            message.textContent = 'This mobile number is already registered. Please login instead.';
            return;
        }

        const studentId = generateStudentId(students);
        // Students sheet headers: Student_ID, Name, Phone, Password, Status, Email.
        const response = await saveData('Students', [studentId, name, mobile, password, 'Pending', email], 'add');
        if (response.status !== 'success') {
            message.style.color = 'red';
            message.textContent = 'Registration failed. Please try again.';
            return;
        }

        registerForm.reset();
        message.style.color = '#166534';
        message.innerHTML = `<strong>Registration successful!</strong><br>Your account is pending admin approval.<div class="registration-credentials"><span>Student ID</span><strong>${escapeLoginHtml(studentId)}</strong><span>Password</span><strong>${escapeLoginHtml(password)}</strong></div>`;
    } catch (_) {
        message.style.color = 'red';
        message.textContent = 'Could not connect to the server. Please try again.';
    } finally {
        button.disabled = false;
        button.textContent = 'Create Account';
    }
});
