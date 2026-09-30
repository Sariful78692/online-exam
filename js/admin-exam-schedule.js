const SCHEDULE_PREFIX = 'Exam_Schedule:';
let scheduleExams = [];
let scheduleSettings = [];

window.onload = loadScheduleAdmin;

function scheduleEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function scheduleKey(name) {
    return SCHEDULE_PREFIX + String(name || '').trim().toLocaleLowerCase();
}

async function loadScheduleAdmin() {
    const [exams, settings] = await Promise.all([fetchData('Exams'), fetchData('Settings')]);
    scheduleExams = exams || [];
    scheduleSettings = settings || [];
    const names = [...new Map(scheduleExams.filter(exam => exam.Exam_Name).map(exam => [String(exam.Exam_Name).trim().toLocaleLowerCase(), String(exam.Exam_Name).trim()])).values()];
    const select = document.getElementById('schedule-exam');
    select.innerHTML = '<option value="">Select an exam</option>' + names.map(name => `<option value="${scheduleEscape(name)}">${scheduleEscape(name)}</option>`).join('');
    renderScheduleList();
}

function formatScheduleDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderScheduleList() {
    const tbody = document.getElementById('schedule-list');
    const schedules = scheduleSettings.map((row, index) => ({row,index})).filter(({row}) => String(row.Setting_Name || '').startsWith(SCHEDULE_PREFIX));
    if (!schedules.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">No exams scheduled yet.</td></tr>';
        return;
    }
    tbody.innerHTML = schedules.map(({row,index}) => {
        const name = String(row.Setting_Name).slice(SCHEDULE_PREFIX.length);
        const examName = scheduleExams.find(exam => String(exam.Exam_Name || '').trim().toLocaleLowerCase() === name.toLocaleLowerCase())?.Exam_Name || name;
        return `<tr><td>${scheduleEscape(examName)}</td><td>${scheduleEscape(formatScheduleDate(row.Setting_Value))}</td><td><button class="remove" type="button" onclick="removeSchedule(${index + 2})"><i class="fa-solid fa-trash"></i> Remove</button></td></tr>`;
    }).join('');
}

document.getElementById('schedule-form').addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.getElementById('schedule-exam').value;
    const localDate = document.getElementById('schedule-start').value;
    const message = document.getElementById('schedule-message');
    const button = document.getElementById('schedule-save');
    const start = new Date(localDate);
    if (!name || Number.isNaN(start.getTime())) return;
    if (start.getTime() <= Date.now()) {
        message.style.color = '#dc2626';
        message.textContent = 'Choose a future date and time.';
        return;
    }
    button.disabled = true;
    message.textContent = '';
    try {
        const key = scheduleKey(name);
        const response = await saveSetting(key, start.toISOString());
        if (response.status !== 'success') throw new Error('Save failed');
        message.style.color = '#047857';
        message.textContent = 'Exam schedule saved.';
        document.getElementById('schedule-start').value = '';
        await loadScheduleAdmin();
    } catch (_) {
        message.style.color = '#dc2626';
        message.textContent = 'Could not save the schedule. Please try again.';
    } finally {
        button.disabled = false;
    }
});

async function removeSchedule(rowIndex) {
    if (!confirm('Remove this exam schedule? Students will be able to start the exam without a schedule.')) return;
    const response = await saveData('Settings', [], 'delete', rowIndex);
    if (response.status === 'success') await loadScheduleAdmin();
    else showAppToast('Could not remove schedule. Please try again.', 'error');
}
