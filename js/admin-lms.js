let allMaterials = [];

window.onload = async () => {
    await loadLmsTable();
};

async function loadLmsTable() {
    const tbody = document.getElementById("lms-table-body");
    try {
        allMaterials = await fetchData("LMS");
        tbody.innerHTML = "";

        if (!allMaterials || allMaterials.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: #6b7280;">No materials uploaded yet.</td></tr>`;
            return;
        }

        allMaterials.forEach((item, index) => {
            const sheetRowIndex = index + 2; 
            
            // Type এর ওপর ভিত্তি করে ব্যাজের কালার
            let badgeClass = "type-link";
            if (item.Type === "PDF") badgeClass = "type-pdf";
            if (item.Type === "Video") badgeClass = "type-video";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="color: #6b7280; font-size: 12px;">${item.Date}</td>
                <td style="font-weight: 600;">${item.Title}</td>
                <td>${item.Subject}</td>
                <td><span class="type-badge ${badgeClass}">${item.Type}</span></td>
                <td>
                    <a href="${item.Link}" target="_blank" class="btn-view"><i class="fa-solid fa-eye"></i> View</a>
                </td>
                <td>
                    <button onclick="deleteMaterial(${sheetRowIndex})" class="btn-delete"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: red;">Error loading data!</td></tr>`;
    }
}

// Upload Form Submit Logic
const lmsForm = document.getElementById("lms-form");
if (lmsForm) {
    lmsForm.addEventListener("submit", async function(e) {
        e.preventDefAUlt();
        const btn = document.getElementById("lms-submit-btn");
        const msg = document.getElementById("lms-message");
        
        btn.innerText = "Uploading...";
        btn.disabled = true;
        msg.innerText = "";

        const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const rowData = [
            document.getElementById("mat_title").value.trim(),
            document.getElementById("mat_subject").value.trim(),
            document.getElementById("mat_type").value,
            document.getElementById("mat_link").value.trim(),
            currentDate
        ];

        try {
            const res = await saveData("LMS", rowData, "add", null);

            if (res && res.status === "success") {
                msg.style.color = "green";
                msg.innerText = "Material uploaded successfully!";
                lmsForm.reset();
                loadLmsTable();
                
                setTimeout(() => { msg.innerText = ""; }, 3000);
            } else {
                msg.style.color = "red";
                msg.innerText = "Failed to upload material! Try again.";
            }
        } catch (error) {
            msg.style.color = "red";
            msg.innerText = "Network Error! Check your connection.";
        } finally {
            btn.innerText = "Upload Material";
            btn.disabled = false;
        }
    });
}

// Delete Logic
async function deleteMaterial(rowIndex) {
    if (confirm("Are you sure you want to delete this material?")) {
        try {
            const res = await saveData("LMS", [], "delete", rowIndex);
            if (res.status === "success") {
                alert("Material deleted successfully!");
                loadLmsTable();
            } else {
                alert("Error deleting material!");
            }
        } catch (e) {
            alert("Server connection error!");
        }
    }
}