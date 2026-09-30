const API_URL = "https://script.google.com/macros/s/AKfycbzS5achJPytNdRiVk2ZPpODfQwWxUV8DaPnzTcwLgzAQe4Fcw0nGVlPLtsulzUlLj-N/exec";
const API_CACHE_PREFIX = 'online-exam-api-cache:';
const API_CACHE_TTL = 120000;
const API_INFLIGHT = new Map();
const API_MAX_CONCURRENT = 2;
let apiActiveRequests = 0;

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

async function saveData(sheetName, data, action = "add", rowIndex = null) {
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
            return JSON.parse(responseText);
        } catch (parseError) {
            console.error('API returned non-JSON response:', responseText.slice(0, 200));
            return { status: 'error', message: `API error (${response.status})` };
        }
    } catch (error) {
        console.error("Save error:", error);
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
            ? await saveData('Settings', [key, settingValue], 'update', latest.rowIndex)
            : await saveData('Settings', [key, settingValue], 'add');

        if (result.status !== 'success') {
            const verifyData = await fetchData('Settings', { forceRefresh: true });
            const verifyRows = Array.isArray(verifyData) ? verifyData : (Array.isArray(verifyData?.value) ? verifyData.value : []);
            const saved = [...verifyRows].reverse().find(row => String(row.Setting_Name || '').trim() === key);
            if (String(saved?.Setting_Value ?? '') !== String(settingValue ?? '')) return result;
            result = { status: 'success' };
        }

        // Clean older duplicate rows for this key so the Settings sheet stays unique.
        for (const duplicate of matches.slice(0, -1).sort((a, b) => b.rowIndex - a.rowIndex)) {
            await saveData('Settings', [], 'delete', duplicate.rowIndex);
        }
        return result;
    } catch (error) {
        console.error(`Could not save setting ${key}:`, error);
        return { status: 'error', message: error.message };
    }
}
