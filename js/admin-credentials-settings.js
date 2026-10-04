const ADMIN_ID_KEY = 'Admin_ID';
const ADMIN_PASSWORD_KEY = 'Admin_Password';
const DEFAULT_ADMIN_CREDENTIALS = { id: 'admin', password: 'admin123' };

function setCredentialMessage(message, color) {
    const element = document.getElementById('admin-credentials-message');
    element.textContent = message;
    element.style.color = color;
}

(async () => {
    try {
        const data = await fetchData('Settings');
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const savedId = [...rows].reverse().find(row => String(row.Setting_Name || '').trim() === ADMIN_ID_KEY)?.Setting_Value;
        document.getElementById('new-admin-id').value = String(savedId || DEFAULT_ADMIN_CREDENTIALS.id).trim();
    } catch (_) {
        document.getElementById('new-admin-id').value = DEFAULT_ADMIN_CREDENTIALS.id;
    }
})();

document.getElementById('admin-credentials-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const newId = String(values.get('adminId') || '').trim();
    const currentPassword = String(values.get('currentPassword') || '');
    const newPassword = String(values.get('newPassword') || '');
    const confirmPassword = String(values.get('confirmPassword') || '');
    const button = document.getElementById('admin-credentials-save-btn');

    if (newPassword !== confirmPassword) {
        setCredentialMessage('New password and confirmation do not match.', '#dc2626');
        return;
    }

    button.disabled = true;
    button.textContent = 'Updating...';
    try {
        const data = await fetchData('Settings', { forceRefresh: true });
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const storedPassword = [...rows].reverse().find(row => String(row.Setting_Name || '').trim() === ADMIN_PASSWORD_KEY)?.Setting_Value;
        const activePassword = storedPassword ? String(storedPassword) : DEFAULT_ADMIN_CREDENTIALS.password;

        if (currentPassword !== activePassword) {
            setCredentialMessage('Current password is incorrect.', '#dc2626');
            return;
        }

        const [idResult, passwordResult] = await Promise.all([
            saveSetting(ADMIN_ID_KEY, newId),
            saveSetting(ADMIN_PASSWORD_KEY, newPassword)
        ]);
        if (idResult.status !== 'success' || passwordResult.status !== 'success') throw new Error('Credential update failed');
        form.reset();
        setCredentialMessage('Admin ID and password updated successfully.', '#059669');
    } catch (_) {
        setCredentialMessage('Could not update login credentials. Please try again.', '#dc2626');
    } finally {
        button.disabled = false;
        button.textContent = 'Update Login Credentials';
    }
});
