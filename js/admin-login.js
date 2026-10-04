const adminLoginForm = document.getElementById('admin-login-form');
const adminPasswordInput = document.getElementById('admin-password');

document.getElementById('toggle-password').addEventListener('click', event => {
    const button = event.currentTarget;
    const showing = adminPasswordInput.type === 'text';
    adminPasswordInput.type = showing ? 'password' : 'text';
    button.innerHTML = `<i class="fa-regular ${showing ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

adminLoginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const id = document.getElementById('admin-id').value.trim();
    const password = adminPasswordInput.value;
    const message = document.getElementById('admin-login-message');
    const button = document.getElementById('admin-login-button');

    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Signing in...</span>';

    let credentials = { id: 'admin', password: 'admin123' };
    try {
        const data = await fetchData('Settings', { forceRefresh: true });
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const savedId = [...rows].reverse().find(row => String(row.Setting_Name || '').trim() === 'Admin_ID')?.Setting_Value;
        const savedPassword = [...rows].reverse().find(row => String(row.Setting_Name || '').trim() === 'Admin_Password')?.Setting_Value;
        if (savedId && savedPassword) credentials = { id: String(savedId).trim(), password: String(savedPassword) };
    } catch (_) {
        message.style.color = '#dc2626';
        message.textContent = 'Could not verify login details. Please check your connection and try again.';
        button.disabled = false;
        button.innerHTML = '<span>Sign in to dashboard</span><i class="fa-solid fa-arrow-right"></i>';
        return;
    }

    if (id !== credentials.id || password !== credentials.password) {
        message.style.color = '#dc2626';
        message.textContent = 'Admin ID or password is incorrect.';
        adminLoginForm.classList.remove('shake');
        void adminLoginForm.offsetWidth;
        adminLoginForm.classList.add('shake');
        button.disabled = false;
        button.innerHTML = '<span>Sign in to dashboard</span><i class="fa-solid fa-arrow-right"></i>';
        return;
    }

    message.style.color = '#059669';
    message.textContent = 'Login successful. Opening dashboard...';
    sessionStorage.setItem('adminAuthenticated', 'true');
    setTimeout(() => { window.location.href = 'index.html'; }, 450);
});
