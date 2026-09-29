let configuredSubjectOptions = [];
let examRows = [];

function normalizeValue(value) {
    return String(value || "").trim().toLocaleLowerCase();
}

function escapeCombinedHtml(value) {
    const element = document.createElement("span");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
}

window.onload = async () => {
    await Promise.all([loadConfiguredSubjects(), loadCombinedExams()]);
};

async function loadConfiguredSubjects() {
    const container = document.getElementById("subject-options");
    examRows = await fetchData("Exams") || [];

    const optionsByPair = new Map();
    examRows.forEach(row => {
        const examName = String(row.Exam_Name || "").trim();
        const subject = String(row.Subject || "").trim();
        const duration = Number(row.Duration);
        const status = normalizeValue(row.Status);
        if (!examName || !subject || duration <= 0 || status === "combined") return;
        const pairKey = `${normalizeValue(examName)}::${normalizeValue(subject)}`;
        optionsByPair.set(pairKey, { examName, subject, duration });
    });
    configuredSubjectOptions = [...optionsByPair.values()];

    if (!configuredSubjectOptions.length) {
        container.innerHTML = '<p>No active exam subjects with a duration were found. Configure exams first.</p>';
        return;
    }

    const grouped = new Map();
    configuredSubjectOptions.forEach((option, index) => {
        if (!grouped.has(option.examName)) grouped.set(option.examName, []);
        grouped.get(option.examName).push({ ...option, index });
    });
    container.innerHTML = [...grouped].map(([examName, options]) => `
        <section style="grid-column:1/-1;">
            <h3 style="margin:14px 0 8px;font-size:14px;color:#475569;">${escapeCombinedHtml(examName)}</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">
                ${options.map(option => `
                    <label class="subject-option">
                        <input type="checkbox" name="combined-subject" value="${option.index}" data-subject-key="${escapeCombinedHtml(normalizeValue(option.subject))}">
                        <span>${escapeCombinedHtml(option.subject)}<small style="display:block;margin-top:4px;color:#6b7280;">${option.duration} min</small></span>
                    </label>`).join("")}
            </div>
        </section>`).join("");

    container.querySelectorAll('input[name="combined-subject"]').forEach(input => input.addEventListener("change", () => {
        if (input.checked) {
            container.querySelectorAll(`input[name="combined-subject"][data-subject-key="${CSS.escape(input.dataset.subjectKey)}"]`)
                .forEach(other => { if (other !== input) other.checked = false; });
        }
        updateSelectedCount();
    }));
}

function getSelectedOptions() {
    return [...document.querySelectorAll('input[name="combined-subject"]:checked')]
        .map(input => configuredSubjectOptions[Number(input.value)])
        .filter(Boolean);
}

function updateSelectedCount() {
    const selected = getSelectedOptions();
    const duration = selected.reduce((total, option) => total + option.duration, 0);
    document.getElementById("selected-count").textContent = `${selected.length} subjects selected · combined duration: ${duration} minutes (choose at least 2)`;
    document.getElementById("save-combined-exam").disabled = selected.length < 2;
}

async function loadCombinedExams() {
    examRows = await fetchData("Exams") || [];
    const groups = new Map();
    examRows.filter(row => normalizeValue(row.Status) === "combined").forEach(row => {
        const name = String(row.Exam_Name || "").trim();
        const subject = String(row.Subject || "").trim();
        if (!name || !subject) return;
        const key = normalizeValue(name);
        if (!groups.has(key)) groups.set(key, { name, subjects: [], duration: 0 });
        const group = groups.get(key);
        if (!group.subjects.some(item => normalizeValue(item) === normalizeValue(subject))) {
            group.subjects.push(subject);
            group.duration += Number(row.Duration) || 0;
        }
    });
    const combined = [...groups.values()].filter(group => group.subjects.length >= 2);
    document.getElementById("combined-exams-list").innerHTML = combined.map(group => `
        <tr><td>${escapeCombinedHtml(group.name)}</td><td>${escapeCombinedHtml(group.subjects.join(", "))}</td>
        <td>${group.duration} min</td><td>Active</td></tr>`).join("") ||
        '<tr><td colspan="4">No combined exams configured yet.</td></tr>';
}

document.getElementById("combined-subject-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("combined-exam-name").value.trim();
    const selected = getSelectedOptions();
    const message = document.getElementById("form-message");
    const button = document.getElementById("save-combined-exam");
    if (selected.length < 2) return;

    examRows = await fetchData("Exams") || [];
    button.disabled = true;
    message.style.color = "#64748b";
    message.textContent = "Saving combined exam...";
    try {
        for (const option of selected) {
            const existingIndex = examRows.findIndex(row => normalizeValue(row.Exam_Name) === normalizeValue(name) &&
                normalizeValue(row.Subject) === normalizeValue(option.subject));
            const existing = existingIndex >= 0 ? examRows[existingIndex] : null;
            const rowData = [name, option.subject, option.duration,
                existing?.Full_Marks || existing?.FullMarks || "", existing?.Pass_Mark || "", "Combined"];
            const action = existing ? "update" : "add";
            const rowIndex = existing ? (Number(existing._rowIndex) || existingIndex + 2) : null;
            const response = await saveData("Exams", rowData, action, rowIndex);
            if (!response || response.status !== "success") throw new Error(response?.message || `Could not save ${option.subject}.`);
        }
        message.style.color = "#059669";
        message.textContent = "Combined exam saved. Selected subjects now move from My Subjects to the student's Combined Subject menu.";
        document.getElementById("combined-subject-form").reset();
        updateSelectedCount();
        await loadCombinedExams();
    } catch (error) {
        message.style.color = "#dc2626";
        message.textContent = `Could not save all selected subjects: ${error.message}. Check the combined exam list before retrying.`;
        await loadCombinedExams();
    } finally {
        button.disabled = document.querySelectorAll('input[name="combined-subject"]:checked').length < 2;
    }
});
