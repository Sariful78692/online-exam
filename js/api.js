const API_URL = "https://script.google.com/macros/s/AKfycbzS5achJPytNdRiVk2ZPpODfQwWxUV8DaPnzTcwLgzAQe4Fcw0nGVlPLtsulzUlLj-N/exec";

async function fetchData(sheetName) {
    try {
        const response = await fetch(`${API_URL}?sheet=${sheetName}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
        return [];
    }
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
