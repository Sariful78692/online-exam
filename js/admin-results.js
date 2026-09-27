let allResults = [];

window.onload = async () => {
    await loadResultsTable();
};

async function loadResultsTable() {
    const tbody = document.getElementById("results-table-body");
    
    // যদি tbody না পাওয়া যায়, তবে ফাংশনটি এখানেই থেমে যাবে (এরর এড়ানোর জন্য)
    if (!tbody) return; 

    try {
        allResults = await fetchData("Results");
        tbody.innerHTML = "";

        if (!allResults || allResults.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #6b7280;">No exam results found.</td></tr>`;
            return;
        }

        // সর্বশেষ পরীক্ষাগুলো আগে দেখানোর জন্য রিভার্স করা হলো
        const reversedResults = [...allResults].reverse();

        reversedResults.forEach((result, index) => {
            // আসল অ্যারে থেকে ডিলিট করার জন্য সঠিক ইনডেক্স বের করা
            const originalIndex = allResults.length - 1 - index;
            const sheetRowIndex = originalIndex + 2; 

            // স্কোরের ওপর ভিত্তি করে ব্যাজ কালার
            const scoreValue = parseFloat(result.Score) || 0;
            const scoreClass = scoreValue > 0 ? "score-good" : "score-bad";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary);">${result.Student_ID || '-'}</td>
                <td style="font-weight: 500;">${result.Subject || result.Exam_Title || '-'}</td>
                <td>${result.Total_Questions || '-'}</td>
                <td style="color: #10b981; font-weight: bold;">${result.Right_Answers || '0'}</td>
                <td style="color: #ef4444; font-weight: bold;">${result.Wrong_Answers || '0'}</td>
                <td style="color: #6b7280;">${result.Missed_Answers || '0'}</td>
                <td><span class="score-badge ${scoreClass}">${scoreValue}</span></td>
                <td style="font-size: 12px; color: #6b7280;">${result.Date || '-'}</td>
                <td>
                    <button onclick="deleteResult(${sheetRowIndex})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error loading results data!</td></tr>`;
    }
}

// Result Delete Logic
async function deleteResult(rowIndex) {
    if (confirm("Are you sure you want to delete this exam record permanently?")) {
        try {
            const res = await saveData("Results", [], "delete", rowIndex);
            if (res.status === "success") {
                alert("Result record deleted successfully!");
                loadResultsTable(); 
            } else {
                alert("Error deleting result!");
            }
        } catch (e) {
            alert("Server connection error!");
        }
    }
}