const API_URL = "https://script.google.com/macros/s/AKfycbzS5achJPytNdRiVk2ZPpODfQwWxUV8DaPnzTcwLgzAQe4Fcw0nGVlPLtsulzUlLj-N/exec";
const API_CACHE_PREFIX = 'online-exam-api-cache:';
const API_CACHE_TTL = 120000;
const API_INFLIGHT = new Map();
const API_MAX_CONCURRENT = 2;
let apiActiveRequests = 0;

function showAppToast(message, type = 'success') {
    if (!document.body) return;
    let host = document.getElementById('app-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'app-toast-host';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-atomic', 'false');
        Object.assign(host.style, { position: 'fixed', top: '20px', right: '20px', zIndex: '100000', display: 'grid', gap: '10px', width: 'min(360px, calc(100vw - 32px))', pointerEvents: 'none' });
        document.body.appendChild(host);
    }
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, { padding: '13px 16px', borderRadius: '12px', color: '#fff', background: type === 'error' ? '#dc2626' : '#15803d', boxShadow: '0 10px 28px rgba(15,23,42,.2)', font: '600 14px/1.45 system-ui, sans-serif', opacity: '0', transform: 'translateY(-8px)', transition: 'opacity .2s ease, transform .2s ease', pointerEvents: 'auto' });
    host.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 220);
    }, 3200);
}

async function fetchData(sheetName, options = {}) {
    const cacheKey = `${API_CACHE_PREFIX}${sheetName}`;
    const forceRefresh = options.forceRefresh === true;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (_) { }
    if (!forceRefresh && cached && Object.prototype.hasOwnProperty.call(cached, 'data') && Date.now() - cached.savedAt < API_CACHE_TTL) return cached.data;
    if (API_INFLIGHT.has(sheetName)) return API_INFLIGHT.get(sheetName);

    const request = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            while (apiActiveRequests >= API_MAX_CONCURRENT) await new Promise(resolve => setTimeout(resolve, 40));
            apiActiveRequests++;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            try {
                const retryToken = attempt ? `&_retry=${Date.now()}` : '';
                const response = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheetName)}${retryToken}`, {
                    cache: "no-store", redirect: "follow", signal: controller.signal
                });
                const responseText = await response.text();
                if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
                const data = JSON.parse(responseText);
                try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) { }
                return data;
            } catch (error) {
                if (attempt === 0 && /HTTP 404/.test(String(error.message))) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }
                if (forceRefresh) {
                    try { localStorage.removeItem(cacheKey); } catch (_) { }
                    console.error(`Could not refresh ${sheetName}:`, error);
                    throw error;
                }
                if (cached && Object.prototype.hasOwnProperty.call(cached, 'data')) {
                    console.warn(`Using the last saved ${sheetName} data because the server is unavailable.`);
                    return cached.data;
                }
                console.error(`Could not load ${sheetName}:`, error);
                return [];
            } finally {
                clearTimeout(timeout);
                apiActiveRequests--;
            }
        }
        return cached?.data ?? [];
    })();
    API_INFLIGHT.set(sheetName, request);
    try { return await request; }
    finally { API_INFLIGHT.delete(sheetName); }
}

async function saveData(sheetName, data, action = "add", rowIndex = null, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({ 
                sheet: sheetName, 
                data: data, 
                action: action, 
                rowIndex: rowIndex 
            })
        });
        const responseText = await response.text();
        // A write can change the sheet, so do not serve its previous cached contents.
        try { localStorage.removeItem(`${API_CACHE_PREFIX}${sheetName}`); } catch (_) { }
        try {
            const result = JSON.parse(responseText);
            if (!options.silent) {
                const verb = action === 'delete' ? 'deleted' : action === 'update' ? 'updated' : 'saved';
                showAppToast(result.status === 'success' ? `${sheetName} ${verb} successfully.` : (result.message || `Could not save ${sheetName.toLowerCase()}.`), result.status === 'success' ? 'success' : 'error');
            }
            return result;
        } catch (parseError) {
            console.error('API returned non-JSON response:', responseText.slice(0, 200));
            if (!options.silent) showAppToast(`Could not save ${sheetName.toLowerCase()}. Please try again.`, 'error');
            return { status: 'error', message: `API error (${response.status})` };
        }
    } catch (error) {
        console.error("Save error:", error);
        if (!options.silent) showAppToast(`Could not save ${sheetName.toLowerCase()}. Check your connection and try again.`, 'error');
        return { status: "error" };
    } finally {
        clearTimeout(timeout);
        try { localStorage.removeItem(`${API_CACHE_PREFIX}${sheetName}`); } catch (_) { }
    }
}

async function saveSetting(settingName, settingValue) {
    const key = String(settingName || '').trim();
    if (!key) return { status: 'error', message: 'Setting name is required.' };
    try {
        const data = await fetchData('Settings', { forceRefresh: true });
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const matches = rows.map((row, index) => ({ row, index, rowIndex: Number(row._rowIndex) || index + 2 }))
            .filter(item => String(item.row.Setting_Name || '').trim() === key)
            .sort((a, b) => a.rowIndex - b.rowIndex);
        const latest = matches[matches.length - 1];
        let result = latest
            ? await saveData('Settings', [key, settingValue], 'update', latest.rowIndex, { silent: true })
            : await saveData('Settings', [key, settingValue], 'add', null, { silent: true });

        if (result.status !== 'success') {
            const verifyData = await fetchData('Settings', { forceRefresh: true });
            const verifyRows = Array.isArray(verifyData) ? verifyData : (Array.isArray(verifyData?.value) ? verifyData.value : []);
            const saved = [...verifyRows].reverse().find(row => String(row.Setting_Name || '').trim() === key);
            if (String(saved?.Setting_Value ?? '') !== String(settingValue ?? '')) {
                showAppToast(`Could not save ${key.replaceAll('_', ' ').toLowerCase()}. Please try again.`, 'error');
                return result;
            }
            result = { status: 'success' };
        }

        // Clean older duplicate rows for this key so the Settings sheet stays unique.
        for (const duplicate of matches.slice(0, -1).sort((a, b) => b.rowIndex - a.rowIndex)) {
            await saveData('Settings', [], 'delete', duplicate.rowIndex, { silent: true });
        }
        showAppToast(`${key.replaceAll('_', ' ')} saved successfully.`);
        return result;
    } catch (error) {
        console.error(`Could not save setting ${key}:`, error);
        showAppToast(`Could not save ${key.replaceAll('_', ' ').toLowerCase()}. Please try again.`, 'error');
        return { status: 'error', message: error.message };
    }
}
