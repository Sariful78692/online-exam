const ADMIN_CONTACT_KEY = 'Admin_Contact';
const ADMIN_PHONE_KEY = 'Admin_Phone';
const ADMIN_EMAIL_KEY = 'Admin_Email';

function readContactValue(rows) {
    const combined = [...rows].reverse().find(row => row.Setting_Name === ADMIN_CONTACT_KEY)?.Setting_Value;
    if (combined) {
        try { return JSON.parse(combined); } catch (_) { }
    }
    return {
        phone: [...rows].reverse().find(row => row.Setting_Name === ADMIN_PHONE_KEY)?.Setting_Value || '',
        email: [...rows].reverse().find(row => row.Setting_Name === ADMIN_EMAIL_KEY)?.Setting_Value || ''
    };
}

window.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('admin-contact-form');
    const phoneInput = document.getElementById('admin-contact-phone');
    const emailInput = document.getElementById('admin-contact-email');
    try {
        const data = await fetchData('Settings');
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const contact = readContactValue(rows);
        const hasCombinedContact = rows.some(row => row.Setting_Name === ADMIN_CONTACT_KEY);
        phoneInput.value = hasCombinedContact ? String(contact.phone || '') : String(contact.phone || localStorage.getItem(ADMIN_PHONE_KEY) || '');
        emailInput.value = hasCombinedContact ? String(contact.email || '') : String(contact.email || localStorage.getItem(ADMIN_EMAIL_KEY) || '');
        localStorage.setItem(ADMIN_PHONE_KEY, phoneInput.value);
        localStorage.setItem(ADMIN_EMAIL_KEY, emailInput.value);
        localStorage.setItem('Admin_Contact_SavedAt', String(Date.now()));
    } catch (error) {
        phoneInput.value = localStorage.getItem(ADMIN_PHONE_KEY) || '';
        emailInput.value = localStorage.getItem(ADMIN_EMAIL_KEY) || '';
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('admin-contact-save-btn');
        const message = document.getElementById('admin-contact-message');
        const phone = phoneInput.value.trim();
        const email = emailInput.value.trim();
        button.disabled = true;
        button.textContent = 'Saving...';
        message.textContent = '';
        try {
            const contactJson = JSON.stringify({ phone, email });
            const result = await saveSetting(ADMIN_CONTACT_KEY, contactJson);
            if (result.status !== 'success') throw new Error('Contact save was not confirmed by the Settings database');
            localStorage.setItem(ADMIN_PHONE_KEY, phone);
            localStorage.setItem(ADMIN_EMAIL_KEY, email);
            localStorage.setItem('Admin_Contact_SavedAt', String(Date.now()));
            message.style.color = '#059669';
            message.textContent = 'Admin phone and email saved.';
        } catch (_) {
            message.style.color = '#dc2626';
            message.textContent = 'Could not save admin contact. Please try again.';
        } finally {
            button.disabled = false;
            button.textContent = 'Save Admin Contact';
        }
    });
});
