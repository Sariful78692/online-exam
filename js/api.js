const API_URL = "https://script.google.com/macros/s/AKfycbzS5achJPytNdRiVk2ZPpODfQwWxUV8DaPnzTcwLgzAQe4Fcw0nGVlPLtsulzUlLj-N/exec";
const API_CACHE_PREFIX = 'online-exam-api-cache:';
const API_CACHE_TTL = 120000;
const API_INFLIGHT = new Map();
const API_MAX_CONCURRENT = 2;
let apiActiveRequests = 0;

async function fetchData(sheetName) {
    const cacheKey = `${API_CACHE_PREFIX}${sheetName}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (_) { }
    if (cached && Object.prototype.hasOwnProperty.call(cached, 'data') && Date.now() - cached.savedAt < API_CACHE_TTL) return cached.data;
    if (API_INFLIGHT.has(sheetName)) return API_INFLIGHT.get(sheetName);

    const request = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            while (apiActiveRequests >= API_MAX_CONCURRENT) await new Promise(resolve => setTimeout(resolve, 40));
            apiActiveRequests++;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
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
    try {
        const response = await fetch(API_URL, {
            method: "POST",
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
    }
}
