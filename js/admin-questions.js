let questions = [];
let exams = [];
let currentQuestionPage = 1;
const QUESTIONS_PER_PAGE = 10;

window.onload = async () => {
    await loadQuestionExams();
    await loadQuestions();
};

async function loadQuestionExams() {
    exams = await fetchData('Exams');
    const examSelect = document.getElementById('exam_name');
    examSelect.innerHTML = '<option value="">Select exam</option>' + (exams || [])
        .filter(exam => exam.Exam_Name)
        .map(exam => `<option value="${escapeQuestionHtml(exam.Exam_Name)}">${escapeQuestionHtml(exam.Exam_Name)}</option>`).join('');
    examSelect.addEventListener('change', loadQuestionSubjects);
    await loadQuestionSubjects();
}

async function loadQuestionSubjects() {
    const select = document.getElementById('subject');
    const selectedExam = document.getElementById('exam_name').value;
    const examSubjects = (exams || []).filter(exam => !selectedExam || exam.Exam_Name === selectedExam).map(exam => exam.Subject);
    const saved = await fetchData('Subjects');
    let names = [...new Set(examSubjects.filter(Boolean))];
    if (!names.length) names = (saved || []).map(s => s.Subject_Name || s.Subject).filter(Boolean);
    select.innerHTML = '<option value="">Select subject</option>' + names.map(name =>
        `<option value="${escapeQuestionHtml(name)}">${escapeQuestionHtml(name)}</option>`).join('');
}

function escapeQuestionHtml(value) {
    const el = document.createElement('div');
    el.textContent = value == null ? '' : String(value);
    return el.innerHTML;
}

async function loadQuestions() {
    questions = await fetchData('Questions');
    await loadQuestionSubjects();
    currentQuestionPage = 1;
    renderQuestionsPage();
}

function renderQuestionsPage() {
    const body = document.getElementById('questions-table-body');
    const totalPages = Math.max(1, Math.ceil((questions || []).length / QUESTIONS_PER_PAGE));
    currentQuestionPage = Math.min(currentQuestionPage, totalPages);
    const start = (currentQuestionPage - 1) * QUESTIONS_PER_PAGE;
    const pageQuestions = (questions || []).slice(start, start + QUESTIONS_PER_PAGE);
    body.innerHTML = pageQuestions.map((q, pageIndex) => {
        const index = start + pageIndex;
        return `<tr>
        <td>${escapeQuestionHtml(q.Subject)}</td>
        <td>${escapeQuestionHtml(q.Question)}</td>
        <td>${escapeQuestionHtml(q.Correct_Answer)}</td>
        <td><button class="question-action question-edit" type="button" onclick="editQuestion(${index})">Edit</button>
        <button class="question-action question-delete" type="button" onclick="deleteQuestion(${index})">Delete</button></td>
    </tr>`;
    }).join('') || '<tr><td colspan="4">No questions found.</td></tr>';
    document.getElementById('questions-pagination').innerHTML = totalPages > 1 ? `
        <button type="button" class="page-btn" ${currentQuestionPage === 1 ? 'disabled' : ''} onclick="changeQuestionPage(-1)">Previous</button>
        <span>Page ${currentQuestionPage} of ${totalPages}</span>
        <button type="button" class="page-btn" ${currentQuestionPage === totalPages ? 'disabled' : ''} onclick="changeQuestionPage(1)">Next</button>` : '';
}

function changeQuestionPage(step) { currentQuestionPage += step; renderQuestionsPage(); }

document.getElementById('question-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('q-submit-btn');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = document.getElementById('edit-row-index').value ? 'Updating...' : 'Saving...';
    const data = [
        document.getElementById('exam_name').value,
        document.getElementById('subject').value,
        document.getElementById('question').value,
        document.getElementById('opt_a').value,
        document.getElementById('opt_b').value,
        document.getElementById('opt_c').value,
        document.getElementById('opt_d').value,
        document.getElementById('correct_answer').value,
        document.getElementById('mark').value,
        document.getElementById('negative_mark').value,
        document.getElementById('image_url').value.trim()
    ];
    const row = Number(document.getElementById('edit-row-index').value);
    const result = await saveData('Questions', data, row ? 'update' : 'add', row || null);
    if (result.status === 'success') {
        resetForm();
        await loadQuestions();
        showQuestionToast('Question saved successfully.', 'success');
    } else {
        showQuestionToast(result.message || 'Could not save question.', 'error');
    }
    button.disabled = false;
    button.textContent = originalText;
});

function showQuestionToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `question-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function editQuestion(index) {
    const q = questions[index];
    document.getElementById('edit-row-index').value = q._rowIndex || index + 2;
    document.getElementById('exam_name').value = q.Exam_Name || '';
    loadQuestionSubjects();
    const subjectSelect = document.getElementById('subject');
    const subjectName = String(q.Subject || '').trim();
    if (subjectName && ![...subjectSelect.options].some(option => option.value === subjectName)) {
        subjectSelect.add(new Option(subjectName, subjectName));
    }
    subjectSelect.value = subjectName;
    document.getElementById('question').value = q.Question || '';
    document.getElementById('opt_a').value = q.Option_A || '';
    document.getElementById('opt_b').value = q.Option_B || '';
    document.getElementById('opt_c').value = q.Option_C || '';
    document.getElementById('opt_d').value = q.Option_D || '';
    document.getElementById('correct_answer').value = q.Correct_Answer || '';
    document.getElementById('mark').value = q.Mark || 1;
    document.getElementById('negative_mark').value = q.Negative_Mark || 0;
    document.getElementById('image_url').value = q.Image_URL || q.Image || q.Time || '';
    document.getElementById('q-submit-btn').textContent = 'Update Question';
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen" style="color: var(--primary);"></i> Edit Question';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
}

async function deleteQuestion(index) {
    const row = questions[index]._rowIndex || index + 2;
    if (!confirm('Delete this question?')) return;
    const result = await saveData('Questions', [], 'delete', row);
    if (result.status === 'success') loadQuestions();
}

function resetForm() {
    document.getElementById('question-form').reset();
    document.getElementById('edit-row-index').value = '';
    document.getElementById('q-submit-btn').textContent = 'Save Question';
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-circle-plus" style="color: var(--primary);"></i> Add New Question';
}
