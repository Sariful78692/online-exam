const BRAND_SETTING_KEY = 'Brand_Name';
let brandingSettings = [];

function applyPanelBrand(name) {
    const brand = String(name || '').trim();
    if (!brand) return;
    document.querySelectorAll('.logo-area,.logo').forEach(element => {
        const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = ` ${brand}`;
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    const data = await fetchData('Settings');
    brandingSettings = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
    const brandSetting = [...brandingSettings].reverse().find(setting => setting.Setting_Name === BRAND_SETTING_KEY);
    const currentName = brandSetting?.Setting_Value || localStorage.getItem('Brand_Name') || 'ILHAAM MISSION';
    document.getElementById('brand-name').value = currentName;
    localStorage.setItem('Brand_Name', currentName);
    applyPanelBrand(currentName);
});

document.getElementById('brand-settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('brand-name');
    const button = document.getElementById('brand-save-btn');
    const message = document.getElementById('brand-settings-message');
    const name = input.value.trim();
    if (!name) return;
    localStorage.setItem('Brand_Name', name);
    applyPanelBrand(name);
    button.disabled = true;
    button.textContent = 'Saving...';
    message.textContent = '';
    try {
        // Settings are stored as append-only rows in this app; readers use the newest matching value.
        const result = await saveData('Settings', [BRAND_SETTING_KEY, name], 'add');
        if (result.status !== 'success') {
            const latestData = await fetchData('Settings');
            const latestSettings = Array.isArray(latestData) ? latestData : (Array.isArray(latestData?.value) ? latestData.value : []);
            const latestName = [...latestSettings].reverse().find(setting => setting.Setting_Name === BRAND_SETTING_KEY)?.Setting_Value;
            if (latestName !== name) throw new Error('Save was not confirmed by the database');
        }
        message.style.color = '#059669';
        message.textContent = 'Panel name saved. Student panel will use this name when it opens.';
        const data = await fetchData('Settings');
        brandingSettings = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
    } catch (_) {
        message.style.color = '#dc2626';
        message.textContent = 'Could not save panel name. Please try again.';
    } finally {
        button.disabled = false;
        button.textContent = 'Save Panel Name';
    }
});
