const adminLoginForm = document.getElementById('admin-login-form');
const adminPasswordInput = document.getElementById('admin-password');

document.getElementById('toggle-password').addEventListener('click', event => {
    const button = event.currentTarget;
    const showing = adminPasswordInput.type === 'text';
    adminPasswordInput.type = showing ? 'password' : 'text';
    button.innerHTML = `<i class="fa-regular ${showing ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

adminLoginForm.addEventListener('submit', event => {
    event.preventDefault();
    const id = document.getElementById('admin-id').value.trim();
    const password = adminPasswordInput.value;
    const message = document.getElementById('admin-login-message');
    const button = document.getElementById('admin-login-button');

    if (id !== 'admin' || password !== 'admin123') {
        message.style.color = '#dc2626';
        message.textContent = 'Admin ID or password is incorrect.';
        adminLoginForm.classList.remove('shake');
        void adminLoginForm.offsetWidth;
        adminLoginForm.classList.add('shake');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Signing in...</span>';
    message.style.color = '#059669';
    message.textContent = 'Login successful. Opening dashboard...';
    sessionStorage.setItem('adminAuthenticated', 'true');
    setTimeout(() => { window.location.href = 'index.html'; }, 450);
});
