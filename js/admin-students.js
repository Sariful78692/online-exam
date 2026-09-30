let allStudents = [];

window.onload = async () => {
    document.getElementById('show-student-form').addEventListener('click', () => {
        document.getElementById('student-form').classList.add('open');
        document.querySelector('#student-form [name="studentId"]').focus();
    });
    document.getElementById('cancel-student-form').addEventListener('click', resetStudentForm);
    document.getElementById('student-form').addEventListener('submit', addStudent);
    await loadStudentsTable();
};

function escapeStudentHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function resetStudentForm() {
    document.getElementById('student-form').reset();
    document.getElementById('student-form').classList.remove('open');
    document.getElementById('student-form-message').textContent = '';
}

async function addStudent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById('student-form-message');
    const submitButton = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form).entries());
    const studentId = values.studentId.trim();
    if (allStudents.some(student => String(student.Student_ID || '').trim().toLocaleLowerCase() === studentId.toLocaleLowerCase())) {
        message.style.color = '#dc2626';
        message.textContent = 'This Student ID already exists.';
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    message.textContent = '';
    try {
        // Students sheet headers: Student_ID, Name, Phone, Password, Status, Email.
        const rowData = [studentId, values.name.trim(), values.phone.trim(), values.password, 'Active', values.email.trim()];
        const response = await saveData('Students', rowData, 'add');
        if (response.status === 'success') {
            resetStudentForm();
            await loadStudentsTable();
        } else {
            message.style.color = '#dc2626';
            message.textContent = 'Could not save student. Please try again.';
        }
    } catch (_) {
        message.style.color = '#dc2626';
        message.textContent = 'Server connection error.';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Save Student';
    }
}

async function loadStudentsTable() {
    const tbody = document.getElementById("students-table-body");
    try {
        allStudents = await fetchData("Students", { forceRefresh: true });
        tbody.innerHTML = "";

        if (!allStudents || allStudents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280;">No registered students found.</td></tr>`;
            return;
        }

        const approvedStudents = allStudents.map((student, index) => ({ student, index }))
            .filter(({ student }) => String(student.Status || '').trim().toLowerCase() !== 'pending');
        if (!approvedStudents.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280;">No approved students found.</td></tr>`;
            return;
        }

        approvedStudents.forEach(({ student, index }) => {
            const sheetRowIndex = index + 2; // +2 কারণ গুগল শিটে ১ নং রো হলো হেডার

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary);">${escapeStudentHtml(student.Student_ID || '-')}</td>
                <td style="font-weight: 500;">${escapeStudentHtml(student.Name || '-')}</td>
                <td>${escapeStudentHtml(student.Phone || student.Email || '-')}</td>
                <td style="color: #6b7280;">${escapeStudentHtml(student.Password || '-')}</td>
                <td><strong style="color:${String(student.Status || '').toLowerCase() === 'active' ? '#059669' : '#dc2626'}">${escapeStudentHtml(student.Status || 'Inactive')}</strong></td>
                <td>
                    <button onclick="toggleStudentStatus(${index})" class="btn-status ${String(student.Status || '').toLowerCase() === 'active' ? 'btn-deactivate' : 'btn-activate'}"><i class="fa-solid ${String(student.Status || '').toLowerCase() === 'active' ? 'fa-user-slash' : 'fa-user-check'}"></i> ${String(student.Status || '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}</button>
                    <button onclick="deleteStudent(${sheetRowIndex})" class="btn-delete"><i class="fa-solid fa-trash"></i> Remove</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error loading students data!</td></tr>`;
    }
}

async function toggleStudentStatus(index) {
    const student = allStudents[index];
    if (!student) return;
    const nextStatus = String(student.Status || '').trim().toLowerCase() === 'active' ? 'Inactive' : 'Active';
    const rowData = [student.Student_ID, student.Name, student.Phone, student.Password, nextStatus, student.Email || ''];
    try {
        const response = await saveData('Students', rowData, 'update', Number(student._rowIndex) || index + 2);
        if (response.status === 'success') await loadStudentsTable();
        else alert(`Could not ${nextStatus === 'Active' ? 'activate' : 'deactivate'} this student.`);
    } catch (_) {
        alert('Server connection error.');
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
