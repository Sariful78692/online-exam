let allStudents = [];

window.onload = async () => {
    await loadStudentsTable();
};

async function loadStudentsTable() {
    const tbody = document.getElementById("students-table-body");
    try {
        allStudents = await fetchData("Students");
        tbody.innerHTML = "";

        if (!allStudents || allStudents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6b7280;">No registered students found.</td></tr>`;
            return;
        }

        allStudents.forEach((student, index) => {
            const sheetRowIndex = index + 2; // +2 কারণ গুগল শিটে ১ নং রো হলো হেডার

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary);">${student.Student_ID || '-'}</td>
                <td style="font-weight: 500;">${student.Name || '-'}</td>
                <td>${student.Phone || student.Email || '-'}</td>
                <td style="color: #6b7280;">${student.Password || '-'}</td>
                <td>
                    <button onclick="deleteStudent(${sheetRowIndex})" class="btn-delete"><i class="fa-solid fa-trash"></i> Remove</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error loading students data!</td></tr>`;
    }
}

// Student Delete Logic
async function deleteStudent(rowIndex) {
    if (confirm("Are you sure you want to permanently remove this student?")) {
        try {
            const res = await saveData("Students", [], "delete", rowIndex);
            if (res.status === "success") {
                alert("Student removed successfully!");
                loadStudentsTable(); // রিলোড টেবিল
            } else {
                alert("Error removing student!");
            }
        } catch (e) {
            alert("Server connection error!");
        }
    }
}