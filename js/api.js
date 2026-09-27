const API_URL = "https://script.google.com/macros/s/AKfycbwG6J-UTD24ZwW0l7_VEQucJUj5a4jrXCI0UHTiRQX8zXNOKM531d6_xjRSWGe07mIy/exec";

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
        return await response.json();
    } catch (error) {
        console.error("Save error:", error);
        return { status: "error" };
    }
}