let allExams = [];

window.onload = async () => {
    await loadSubjects();
    await loadExamsTable();
};

// Questions শিট থেকে সাবজেক্টগুলো এনে ড্রপডাউনে বসানোর ফাংশন
async function loadSubjects() {
    const subjectSuggestions = document.getElementById("subject-suggestions");
    try {
        const questions = await fetchData("Questions");
        if (questions && questions.length > 0) {
            // ডুপ্লিকেট সাবজেক্ট বাদ দিয়ে ইউনিক লিস্ট তৈরি
            const subjects = [...new Set(questions.map(q => q.Subject).filter(Boolean))];
            subjectSuggestions.innerHTML = subjects
                .map(sub => `<option value="${escapeHtml(sub)}"></option>`).join("");
        }
    } catch (e) {
        subjectSuggestions.innerHTML = "";
    }
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

// Exams শিট থেকে ডেটা এনে টেবিলে দেখানোর ফাংশন
async function loadExamsTable() {
    const tbody = document.getElementById("exams-table-body");
    try {
        allExams = await fetchData("Exams");
        tbody.innerHTML = "";

        if (!allExams || allExams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280;">No exams configured yet.</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error loading exams data!</td></tr>`;
    }
}

// নতুন এক্সাম সাবমিট করার লজিক
const examForm = document.getElementById("exam-form");
let editingRowIndex = null;
if (examForm) {
    examForm.addEventListener("submit", async function(e) {
        e.preventDefAUlt();
        const btn = document.getElementById("e-submit-btn");
        const msg = document.getElementById("e-message");
        
        btn.innerText = "Saving Configuration...";
        btn.disabled = true;
        msg.innerText = "";

        const rowData = [
            document.getElementById("exam_name").value.trim(),
            document.getElementById("exam_subject").value,
            document.getElementById("exam_duration").value,
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
    document.getElementById("exam_subject").value = exam.Subject || "";
    document.getElementById("exam_duration").value = exam.Duration || "";
    document.getElementById("pass_mark").value = exam.Pass_Mark || "";
    document.getElementById("exam_status").value = exam.Status || "Active";
    document.getElementById("e-submit-btn").innerText = "Update Exam Configuration";
    document.getElementById("e-cancel-btn").hidden = false;
    document.querySelector(".form-container").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("e-cancel-btn").addEventListener("click", () => {
    editingRowIndex = null;
    examForm.reset();
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
