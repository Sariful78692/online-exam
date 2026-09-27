let allExams = [];
let subjectRows = [];

window.onload = async () => {
    await loadSubjects();
    await loadExamsTable();
};

// Questions শিট থেকে সাবজেক্টগুলো এনে ড্রপডাউনে বসানোর ফাংশন
async function loadSubjects() {
    const subjectSuggestions = document.getElementById("exam_subject");
    try {
        let savedSubjects = await fetchData("Subjects");
        if (savedSubjects && savedSubjects.length > 0) {
            subjectRows = savedSubjects.map((row, index) => ({ ...row, _rowIndex: Number(row._rowIndex) || index + 2 }));
        } else {
            const questions = await fetchData("Questions");
            // ডুপ্লিকেট সাবজেক্ট বাদ দিয়ে ইউনিক লিস্ট তৈরি
            subjectRows = [...new Set((questions || []).map(q => q.Subject).filter(Boolean))]
                .map((name, index) => ({ Subject_ID: index + 1, Subject_Name: name }));
            for (const subject of subjectRows) {
                await saveData("Subjects", [subject.Subject_ID, subject.Subject_Name], "add");
            }
            savedSubjects = await fetchData("Subjects");
            if (savedSubjects && savedSubjects.length) subjectRows = savedSubjects.map((row, index) => ({ ...row, _rowIndex: Number(row._rowIndex) || index + 2 }));
        }
        if (subjectRows.length > 0) {
            const subjects = subjectRows.map(row => row.Subject_Name || row.Subject).filter(Boolean);
            subjectSuggestions.innerHTML = `<option value="">Select subject</option>` + subjects
                .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`).join("") +
                ``;
        }
    } catch (e) {
        subjectSuggestions.innerHTML = `<option value="">Select subject</option>`;
    }
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

document.getElementById("add-subject-btn").addEventListener("click", function () {
    const input = document.getElementById("manual_subject");
    input.style.display = input.style.display === "none" ? "block" : "none";
    input.required = input.style.display === "block";
    if (input.required) input.focus();
});

document.getElementById("edit-subject-btn").addEventListener("click", async function () {
    const select = document.getElementById("exam_subject");
    const oldName = select.value;
    const subject = subjectRows.find(row => (row.Subject_Name || row.Subject) === oldName);
    if (!subject || !subject._rowIndex) return alert("This subject is not saved in Subjects sheet yet.");
    const newName = prompt("Enter the corrected subject name:", oldName);
    if (!newName || newName.trim() === oldName) return;
    const result = await saveData("Subjects", [subject.Subject_ID || "", newName.trim()], "update", subject._rowIndex);
    if (result.status === "success") {
        const questions = await fetchData("Questions");
        for (const question of questions || []) {
            if (question.Subject === oldName && question._rowIndex) {
                const row = [question.Question_ID, newName.trim(), question.Question, question.Option_A, question.Option_B, question.Option_C, question.Option_D, question.Correct_Answer, question.Mark, question.Negative_Mark];
                await saveData("Questions", row, "update", question._rowIndex);
            }
        }
        await loadSubjects();
        alert("Subject updated successfully.");
    }
    else alert("Subject update failed.");
});

document.getElementById("delete-subject-btn").addEventListener("click", async function () {
    const select = document.getElementById("exam_subject");
    const subject = subjectRows.find(row => (row.Subject_Name || row.Subject) === select.value);
    if (!subject || !subject._rowIndex) return alert("This subject is not saved in Subjects sheet yet.");
    if (!confirm(`Delete subject '${select.value}'?`)) return;
    const result = await saveData("Subjects", [], "delete", subject._rowIndex);
    if (result.status === "success") { await loadSubjects(); alert("Subject deleted successfully."); }
    else alert("Subject delete failed.");
});

// Exams শিট থেকে ডেটা এনে টেবিলে দেখানোর ফাংশন
async function loadExamsTable() {
    const tbody = document.getElementById("exams-table-body");
    try {
        allExams = await fetchData("Exams");
        tbody.innerHTML = "";

        if (!allExams || allExams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6b7280;">No exams configured yet.</td></tr>`;
            return;
        }

        allExams.forEach((exam, index) => {
            const sheetRowIndex = index + 2; 
            const statusBadge = exam.Status === "Active" 
                ? `<span class="badge active"><i class="fa-solid fa-check-circle"></i> Active</span>` 
                : `<span class="badge inactive"><i class="fa-solid fa-times-circle"></i> Inactive</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; color: #1f2937;">${escapeHtml(exam.Exam_Name)}</td>
                <td>${escapeHtml(exam.Subject)}</td>
                <td>${escapeHtml(exam.Duration)} Min</td>
                <td>${escapeHtml(exam.Full_Marks || exam.FullMarks || "-")}</td>
                <td>${escapeHtml(exam.Pass_Mark)}</td>
                <td>${statusBadge}</td>
                <td class="exam-actions">
                    <button onclick="editExam(${index})" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-right: 5px;"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="deleteExam(${sheetRowIndex})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error loading exams data!</td></tr>`;
    }
}

// নতুন এক্সাম সাবমিট করার লজিক
const examForm = document.getElementById("exam-form");
let editingRowIndex = null;
if (examForm) {
    examForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const btn = document.getElementById("e-submit-btn");
        const msg = document.getElementById("e-message");
        
        btn.innerText = editingRowIndex === null ? "Saving Configuration..." : "Updating Configuration...";
        btn.disabled = true;
            msg.innerText = "Processing...";
            msg.style.color = "#64748b";

        const rowData = [
            document.getElementById("exam_name").value.trim(),
            document.getElementById("manual_subject").style.display !== "none"
                ? document.getElementById("manual_subject").value.trim()
                : document.getElementById("exam_subject").value,
            document.getElementById("exam_duration").value,
            document.getElementById("full_marks").value,
            document.getElementById("pass_mark").value,
            document.getElementById("exam_status").value
        ];

        try {
            const action = editingRowIndex === null ? "add" : "update";
            const res = await saveData("Exams", rowData, action, editingRowIndex);

            if (res && res.status === "success") {
                msg.style.color = "green";
                msg.innerText = action === "add" ? "Exam configured successfully!" : "Exam updated successfully!";
                examForm.reset();
                document.getElementById("manual_subject").style.display = "none";
                document.getElementById("manual_subject").required = false;
                editingRowIndex = null;
                document.getElementById("e-submit-btn").innerText = "Save Exam Configuration";
                document.getElementById("e-cancel-btn").hidden = true;
                loadExamsTable();
                
                setTimeout(() => {
                    msg.innerText = "";
                }, 3000);
            } else {
                msg.style.color = "red";
                msg.innerText = "Failed to save exam! Try again.";
            }
        } catch (error) {
            msg.style.color = "red";
            msg.innerText = "Network Error! Check your connection.";
        } finally {
            btn.innerText = "Save Exam Configuration";
            btn.disabled = false;
        }
    });
}

function editExam(index) {
    const exam = allExams[index];
    if (!exam) return;
    editingRowIndex = index + 2;
    document.getElementById("exam_name").value = exam.Exam_Name || "";
    const subjectSelect = document.getElementById("exam_subject");
    const subjectOption = [...subjectSelect.options].find(option => option.value === String(exam.Subject || ""));
    if (subjectOption) {
        subjectSelect.value = exam.Subject || "";
    } else {
        document.getElementById("manual_subject").value = exam.Subject || "";
        document.getElementById("manual_subject").style.display = "block";
        document.getElementById("manual_subject").required = true;
    }
    document.getElementById("exam_duration").value = exam.Duration || "";
    document.getElementById("full_marks").value = exam.Full_Marks || exam.FullMarks || "";
    document.getElementById("pass_mark").value = exam.Pass_Mark || "";
    document.getElementById("exam_status").value = exam.Status || "Active";
    document.getElementById("e-submit-btn").innerText = "Update Exam Configuration";
    document.getElementById("e-cancel-btn").hidden = false;
    document.querySelector(".form-container").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("e-cancel-btn").addEventListener("click", () => {
    editingRowIndex = null;
    examForm.reset();
    document.getElementById("manual_subject").style.display = "none";
    document.getElementById("manual_subject").required = false;
    document.getElementById("e-submit-btn").innerText = "Save Exam Configuration";
    document.getElementById("e-cancel-btn").hidden = true;
});

// এক্সাম ডিলিট করার লজিক
async function deleteExam(rowIndex) {
    if (confirm("Are you sure you want to delete this exam configuration?")) {
        try {
            const res = await saveData("Exams", [], "delete", rowIndex);
            if (res.status === "success") {
                alert("Exam deleted successfully!");
                loadExamsTable();
            } else {
                alert("Error deleting exam!");
            }
        } catch (e) {
            alert("Server connection error!");
        }
    }
}
