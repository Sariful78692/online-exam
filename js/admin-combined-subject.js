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
    const saveButton = document.getElementById("save-combined-exam");
    saveButton.disabled = selected.length < 2;
    if (!selected.length || !saveButton.disabled) saveButton.textContent = "Save Combined Exam";
}

async function loadCombinedExams() {
    examRows = (await fetchData("Exams") || []).map((row, index) => ({
        ...row,
        _rowIndex: Number(row._rowIndex) || index + 2
    }));
    const groups = new Map();
    examRows.filter(row => ["combined", "inactive"].includes(normalizeValue(row.Status))).forEach(row => {
        const name = String(row.Exam_Name || "").trim();
        const subject = String(row.Subject || "").trim();
        if (!name || !subject) return;
        const key = normalizeValue(name);
        if (!groups.has(key)) groups.set(key, { name, subjects: [], duration: 0, rows: [] });
        const group = groups.get(key);
        group.rows.push(row);
        if (!group.subjects.some(item => normalizeValue(item) === normalizeValue(subject))) {
            group.subjects.push(subject);
            group.duration += Number(row.Duration) || 0;
        }
    });
    const combined = [...groups.values()].filter(group => group.subjects.length >= 2);
    document.getElementById("combined-exams-list").innerHTML = combined.map((group, index) => {
        const active = group.rows.some(row => normalizeValue(row.Status) === "combined");
        return `
        <tr><td>${escapeCombinedHtml(group.name)}</td><td>${escapeCombinedHtml(group.subjects.join(", "))}</td>
        <td>${group.duration} min</td><td><span style="color:${active ? '#059669' : '#dc2626'};font-weight:600;">${active ? 'Active' : 'Inactive'}</span></td>
        <td><button type="button" class="toggle-combined-btn" data-combined-index="${index}" style="padding:7px 11px;border:0;border-radius:7px;background:${active ? '#dc2626' : '#059669'};color:#fff;font-weight:600;cursor:pointer;">${active ? 'Disable' : 'Enable'}</button></td></tr>`;
    }).join("") ||
        '<tr><td colspan="5">No combined exams configured yet.</td></tr>';
    document.querySelectorAll("[data-combined-index]").forEach(button => button.addEventListener("click", () => {
        toggleCombinedExam(combined[Number(button.dataset.combinedIndex)]);
    }));
}

async function toggleCombinedExam(group) {
    if (!group || !group.rows?.length) return;
    const active = group.rows.some(row => normalizeValue(row.Status) === "combined");
    const nextStatus = active ? "Inactive" : "Combined";
    if (!confirm(`${active ? "Disable" : "Enable"} combined exam "${group.name}" for students?`)) return;
    const buttons = [...document.querySelectorAll("[data-combined-index]")];
    buttons.forEach(item => item.disabled = true);
    try {
        for (const row of group.rows) {
            const rowIndex = Number(row._rowIndex);
            const updated = [row.Exam_Name, row.Subject, row.Duration, row.Full_Marks || row.FullMarks || "", row.Pass_Mark || "", nextStatus];
            const response = await saveData("Exams", updated, "update", rowIndex);
            if (!response || response.status !== "success") throw new Error(response?.message || "Could not disable exam.");
        }
        try {
            const disabledKey = `combined-exam-disabled:${normalizeValue(group.name)}`;
            if (active) localStorage.removeItem(disabledKey);
            else localStorage.setItem(disabledKey, "1");
        } catch (_) { }
        await loadCombinedExams();
    } catch (error) {
        alert(error.message || "Could not disable combined exam.");
        buttons.forEach(item => item.disabled = false);
    }
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
    const originalButtonText = button.textContent;
    button.textContent = "Saving...";
    message.textContent = "";
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
        button.textContent = "Saved ✓";
        message.textContent = "Combined exam saved.";
        document.getElementById("combined-subject-form").reset();
        updateSelectedCount();
        await loadCombinedExams();
    } catch (error) {
        message.style.color = "#dc2626";
        message.textContent = `Could not save all selected subjects: ${error.message}. Check the combined exam list before retrying.`;
        await loadCombinedExams();
    } finally {
        button.disabled = document.querySelectorAll('input[name="combined-subject"]:checked').length < 2;
        if (!button.disabled && button.textContent === "Saving...") button.textContent = originalButtonText;
    }
});
