const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const switchButton = document.getElementById('auth-switch-btn');
let showingRegister = false;

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
        const students = await fetchData('Students');
        let student = students.find(item => String(item.Student_ID || '').trim() === enteredId && String(item.Password || '') === enteredPassword);
        // Repair accounts registered while the Students sheet columns were written in the wrong order.
        const legacyIndex = students.findIndex(item => String(item.Student_ID || '').trim() === enteredId && !item.Password && String(item.Email || '').trim().toLowerCase() === 'active' && String(item.Status || '') === enteredPassword);
        if (!student && legacyIndex >= 0) {
            const legacy = students[legacyIndex];
            const repaired = { ...legacy, Password: enteredPassword, Status: 'Active', Email: '' };
            const repairResponse = await saveData('Students', [repaired.Student_ID, repaired.Name, repaired.Phone, repaired.Password, repaired.Status, repaired.Email], 'update', legacyIndex + 2);
            if (repairResponse.status === 'success') student = repaired;
        }
        if (!student) {
            message.style.color = 'red';
            message.textContent = 'Incorrect Student ID or password.';
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
        const students = await fetchData('Students');
        const duplicate = students.some(student => String(student.Student_ID || '').trim().replace(/[\s()-]/g, '') === mobile);
        if (duplicate) {
            message.style.color = 'red';
            message.textContent = 'This mobile number is already registered.';
            return;
        }

        // Students sheet headers: Student_ID, Name, Phone, Password, Status, Email.
        const response = await saveData('Students', [mobile, name, mobile, password, 'Active', ''], 'add');
        if (response.status !== 'success') {
            message.style.color = 'red';
            message.textContent = 'Registration failed. Please try again.';
            return;
        }

        registerForm.reset();
        document.getElementById('login_id').value = mobile;
        const newStudent = { Student_ID: mobile, Name: name, Phone: mobile, Email: '', Password: password, Status: 'Active' };
        sessionStorage.setItem('loggedInStudent', JSON.stringify(newStudent));
        message.style.color = 'green';
        message.textContent = 'Registration successful! Opening your dashboard...';
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (_) {
        message.style.color = 'red';
        message.textContent = 'Could not connect to the server. Please try again.';
    } finally {
        button.disabled = false;
        button.textContent = 'Create Account';
    }
});
