let allData = [];
let currentQuestions = [];
let timerInterval;
let loggedInStudent = null;
let TOTAL_EXAM_MINUTES = 180; 
const COMBINED_EXAM_MINUTES = 180;
let GLOBAL_FONT_SIZE = "16px"; 
let currentQuestionIndex = 0;
let selectedAnswers = [];
let availableSubjects = [];
let currentExamSubjects = [];
let availableMockExams = [];
let currentMockExam = null;
let subjectDurations = new Map();
let activeExamSubject = null;
let completedExamKeys = new Set();
let currentAttemptName = "";
let studentResults = [];
let examConfigurations = [];
let examSchedules = new Map();
let reExamRequests = new Map();
let activeReExamRequestKey = '';
let scheduleTicker = null;
let currentExamEndsAt = 0;
const EXAM_PROGRESS_PREFIX = 'exam-progress:';
const RE_EXAM_REQUEST_PREFIX = 'ReExam_Request:';

document.addEventListener('keydown', event => {
    const quiz = document.getElementById('quiz-container');
    if (!quiz || quiz.style.display === 'none' || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
    const option = event.key.toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(option)) return;
    const radio = document.querySelector(`input[name="q${currentQuestionIndex}"][value="${option}"]`);
    if (!radio) return;
    event.preventDefault();
    radio.click();
});

window.addEventListener('pagehide', () => saveExamProgress());

function normalizeSubjectName(value) {
    const subject = String(value || "").trim().toLocaleLowerCase();
    // Older question rows use "Physic" while combined exams may use "Physics".
    return subject === "physic" ? "physics" : subject;
}

function normalizeApiRows(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.value)) return value.value;
    if (Array.isArray(value?.data)) return value.data;
    return [];
}

function getSubjectDuration(subject) {
    return subjectDurations.get(normalizeSubjectName(subject)) || TOTAL_EXAM_MINUTES;
}

function normalizeCorrectOption(value) {
    const answer = String(value || "").trim().toUpperCase();
    const match = answer.match(/(?:^|\b)([ABCD])(?:\b|$)/);
    return match ? match[1] : answer;
}

function firstNonEmptyResultValue(...values) {
    return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function getCanonicalExamName(value) {
    const rawName = String(value || "").trim();
    const configured = availableMockExams.find(exam => exam.name.toLocaleLowerCase() === rawName.toLocaleLowerCase());
    return configured ? configured.name : rawName;
}

function getResultExamName(result) {
    return getCanonicalExamName(firstNonEmptyResultValue(
        result?.Exam_Name,
        result?.Exam_Title,
        result?.Test_Name,
        result?.Subject,
        "Completed exam"
    ));
}

function createAttemptKey(examName) {
    return `${String(loggedInStudent?.Student_ID || "").trim().toLocaleLowerCase()}|${String(examName || "").trim().toLocaleLowerCase()}`;
}

function hasCompletedExam(examName) {
    return completedExamKeys.has(createAttemptKey(examName));
}

function getReExamRequestKey(examName) { return `${RE_EXAM_REQUEST_PREFIX}${createAttemptKey(examName)}`; }
function getReExamRequest(examName) { return reExamRequests.get(getReExamRequestKey(examName)) || null; }
function isReExamApproved(examName) { return String(getReExamRequest(examName)?.status || '').toLowerCase() === 'approved'; }
function isExamLocked(examName) { return hasCompletedExam(examName) && !isReExamApproved(examName); }
function hasSavedExamProgress(examName) {
    return !hasCompletedExam(examName) && Boolean(readExamProgress(examName));
}

function getExamProgressKey(examName = currentAttemptName) {
    return `${EXAM_PROGRESS_PREFIX}${createAttemptKey(examName)}`;
}

function getQuestionSignature(questions = currentQuestions) {
    return questions.map(question => [question.Question_ID || question.Question_Number || '', question.Subject || '', question.Question || ''].join('|'));
}

function readExamProgress(examName) {
    try {
        const saved = JSON.parse(localStorage.getItem(getExamProgressKey(examName)) || 'null');
        if (!saved || !Array.isArray(saved.answers) || !Array.isArray(saved.questionSignature)) return null;
        return saved;
    } catch (_) { return null; }
}

function saveExamProgress() {
    if (!currentAttemptName || !currentQuestions.length || !currentExamEndsAt) return;
    const selected = document.querySelector(`input[name="q${currentQuestionIndex}"]:checked`);
    if (selected) selectedAnswers[currentQuestionIndex] = selected.value;
    try {
        localStorage.setItem(getExamProgressKey(), JSON.stringify({
            answers: selectedAnswers,
            currentQuestionIndex,
            activeExamSubject,
            questionSignature: getQuestionSignature(),
            endsAt: currentExamEndsAt,
            savedAt: Date.now()
        }));
    } catch (error) { console.warn('Could not save exam progress on this device.', error); }
}

function clearExamProgress(examName = currentAttemptName) {
    try { localStorage.removeItem(getExamProgressKey(examName)); } catch (_) { }
}

function getUnavailableSubjectKeys() {
    const unavailable = new Set();
    availableSubjects.forEach(subject => {
        if (hasCompletedExam(subject)) unavailable.add(normalizeSubjectName(subject));
    });
    availableMockExams.forEach(exam => {
        if (hasCompletedExam(exam.name)) {
            exam.subjects.forEach(subject => unavailable.add(normalizeSubjectName(subject)));
        }
    });
    return unavailable;
}

function updateOverviewDuration() {
    const combinedDuration = Number(availableMockExams[0]?.duration);
    const activeDuration = Number(examConfigurations.find(exam => normalizeSubjectName(exam.Status) === 'active' && Number(exam.Duration) > 0)?.Duration);
    const duration = Number.isFinite(combinedDuration) && combinedDuration > 0 ? combinedDuration : activeDuration;
    const value = document.getElementById('exam-duration');
    const unit = document.getElementById('exam-duration-unit');
    if (!Number.isFinite(duration) || duration <= 0) {
        value.innerText = '—';
        unit.innerText = 'no exam';
    } else {
        value.innerText = duration;
        unit.innerText = 'min';
    }
}

function updateAvailableQuestionCount() {
    const unavailable = getUnavailableSubjectKeys();
    const availableCount = allData.filter(question => !unavailable.has(normalizeSubjectName(question.Subject))).length;
    const countElement = document.getElementById("question-count");
    if (countElement) countElement.innerText = availableCount;
}

window.addEventListener('load', async () => {
    const updateStudentClock = () => {
        const now = new Date();
        const date = document.getElementById('student-current-date');
        const time = document.getElementById('student-current-time');
        if (date) date.textContent = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
        if (time) time.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };
    updateStudentClock();
    setInterval(updateStudentClock, 1000);

    const studentDataStr = sessionStorage.getItem("loggedInStudent");
    if (!studentDataStr) {
        window.location.href = "index.html"; 
        return;
    }
    
    loggedInStudent = JSON.parse(studentDataStr);
    document.getElementById("student-name").innerText = loggedInStudent.Name; 
    document.getElementById("sidebar-student-name").innerText = loggedInStudent.Name || "Student";
    document.getElementById("sidebar-student-id").innerText = loggedInStudent.Student_ID || "Student account";

    try {
        const [questionsData, settingsData, subjectsData, examsData, resultsData] = await Promise.all([
            fetchData("Questions"),
            fetchData("Settings"),
            fetchData("Subjects"),
            fetchData("Exams"),
            fetchData("Results")
        ]);
        const questionRows = normalizeApiRows(questionsData);
        const settingsRows = normalizeApiRows(settingsData);
        const subjectRows = normalizeApiRows(subjectsData);
        const examRows = normalizeApiRows(examsData);
        const resultRows = normalizeApiRows(resultsData);
        const panelBrand = [...settingsRows].reverse().find(setting => setting.Setting_Name === 'Brand_Name')?.Setting_Value || localStorage.getItem('Brand_Name');
        if (panelBrand) {
            const brandElement = document.getElementById('panel-brand-name');
            if (brandElement) brandElement.textContent = panelBrand;
        }
        examConfigurations = examRows;
        examSchedules = new Map(settingsRows
            .filter(setting => String(setting.Setting_Name || '').startsWith('Exam_Schedule:'))
            .map(setting => [String(setting.Setting_Name).slice('Exam_Schedule:'.length).trim().toLocaleLowerCase(), String(setting.Setting_Value || '')]));

        reExamRequests = new Map(settingsRows.filter(setting => String(setting.Setting_Name || '').startsWith(RE_EXAM_REQUEST_PREFIX)).map(setting => {
            try { return [String(setting.Setting_Name), JSON.parse(setting.Setting_Value || '{}')]; } catch (_) { return null; }
        }).filter(Boolean));
        if (settingsRows.length > 0) {
            const timeSettings = settingsRows.filter(s => s.Setting_Name === "Total_Time");
            if (timeSettings.length > 0) {
                TOTAL_EXAM_MINUTES = parseFloat(timeSettings[timeSettings.length - 1].Setting_Value);
            }

            const fontSettings = settingsRows.filter(s => s.Setting_Name === "Font_Size");
            if (fontSettings.length > 0) {
                GLOBAL_FONT_SIZE = fontSettings[fontSettings.length - 1].Setting_Value;
            }
        }

        allData = questionRows;
        completedExamKeys = new Set(resultRows
            .filter(result => String(result.Student_ID || "") === String(loggedInStudent.Student_ID || ""))
            .map(result => createAttemptKey(getResultExamName(result))));
        studentResults = resultRows.filter(result => String(result.Student_ID || "") === String(loggedInStudent.Student_ID || ""));
        const localAttemptPrefix = `exam-completed:${String(loggedInStudent.Student_ID || "").trim().toLocaleLowerCase()}|`;
        Object.keys(localStorage).forEach(storageKey => {
            if (storageKey.startsWith(localAttemptPrefix)) completedExamKeys.add(storageKey.slice("exam-completed:".length));
        });
        availableSubjects = [...new Map(subjectRows
            .map(s => s.Subject_Name || s.Subject)
            .filter(Boolean)
            .map(subject => [normalizeSubjectName(subject), String(subject).trim()])).values()];
        if (!availableSubjects.length) {
            availableSubjects = [...new Map(allData
                .map(item => item.Subject)
                .filter(Boolean)
                .map(subject => [normalizeSubjectName(subject), String(subject).trim()])).values()];
        }
        availableMockExams = getCombinedExams(examRows);
        subjectDurations = new Map();
        examRows.forEach(exam => {
            const status = normalizeSubjectName(exam.Status);
            const duration = Number(exam.Duration);
            if (!exam.Subject || duration <= 0 || status === "combined" || (status && status !== "active")) return;
            subjectDurations.set(normalizeSubjectName(exam.Subject), duration);
        });
        const combinedSubjectKeys = new Set(availableMockExams.flatMap(exam => exam.subjects.map(normalizeSubjectName)));
        document.getElementById("subject-count").innerText = availableSubjects.length;
        document.getElementById("combined-subject-count").innerText = availableSubjects.filter(subject => combinedSubjectKeys.has(normalizeSubjectName(subject))).length;
        updateAvailableQuestionCount();
        updateOverviewDuration();

        document.getElementById("dashboard-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            clearScheduleTicker();
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            updateOverviewDuration();
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            document.getElementById("dashboard-menu").classList.add("active");
            showCombinedExamSetup();
        });
        document.getElementById("combined-exam-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            clearScheduleTicker();
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            updateOverviewDuration();
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active");
            showCombinedExamSetup();
        });
        document.getElementById("result-view-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            clearScheduleTicker();
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active");
            showStudentResultView();
        });
        document.getElementById("re-exam-menu").addEventListener("click", event => {
            event.preventDefault(); clearInterval(timerInterval); clearScheduleTicker();
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active"); showReExamRequests();
        });        document.getElementById("profile-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            clearScheduleTicker();
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active");
            showStudentProfile();
        });
        
        if (allData && allData.length > 0) {
            setupSidebarSubjects();
            showCombinedExamSetup();
            translateStudentPanel();
        } else {
            document.getElementById('subject-selection').innerHTML = "<p>কোনো প্রশ্ন পাওয়া যায়নি।</p>";
            document.getElementById('subject-sidebar-list').innerHTML = "<li><a href='#'>কোনো বিষয় নেই</a></li>";
        }
    } catch (error) {
        console.error('Student dashboard data initialization failed:', error);
        document.getElementById('subject-selection').innerHTML = '<h2>Could not load dashboard data</h2><p>Please refresh the page. If the problem continues, contact your institution.</p>';
        document.getElementById('subject-sidebar-list').innerHTML = '<li><a href="#">Could not load subjects</a></li>';
    }
});

function showStudentProfile() {
    const selection = document.getElementById('subject-selection');
    selection.innerHTML = `<h2>Student Profile</h2>
        <p style="margin:-8px 0 20px;color:var(--text-gray)">Update your account password below.</p>
        <div class="profile-password-form">
            <label>Student ID<input type="text" value="${escapeReviewHtml(loggedInStudent.Student_ID || '')}" readonly></label>
            <label>Full Name<input type="text" value="${escapeReviewHtml(loggedInStudent.Name || '')}" readonly></label>
            <form id="change-password-form" class="profile-password-form">
                <label>Current Password<input name="currentPassword" type="password" autocomplete="current-password" required></label>
                <label>New Password<input name="newPassword" type="password" minlength="4" autocomplete="new-password" required></label>
                <label>Confirm New Password<input name="confirmPassword" type="password" minlength="4" autocomplete="new-password" required></label>
                <button type="submit" class="btn-submit">Change Password</button>
                <div id="profile-password-message" role="status"></div>
            </form>
        </div>`;
    document.getElementById('change-password-form').addEventListener('submit', changeStudentPassword);
}

async function changeStudentPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const message = document.getElementById('profile-password-message');
    const button = form.querySelector('[type="submit"]');
    if (data.currentPassword !== String(loggedInStudent.Password || '')) {
        message.style.color = '#dc2626';
        message.textContent = 'Current password is incorrect.';
        return;
    }
    if (data.newPassword !== data.confirmPassword) {
        message.style.color = '#dc2626';
        message.textContent = 'New password and confirmation do not match.';
        return;
    }
    if (data.newPassword === data.currentPassword) {
        message.style.color = '#dc2626';
        message.textContent = 'Choose a different password.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';
    message.textContent = '';
    try {
        const students = await fetchData('Students');
        const studentIndex = students.findIndex(student => String(student.Student_ID || '').trim() === String(loggedInStudent.Student_ID || '').trim());
        if (studentIndex < 0) throw new Error('Student account not found');
        const currentRecord = students[studentIndex];
        const updatedStudent = { ...currentRecord, Password: data.newPassword };
        // Students sheet headers: Student_ID, Name, Phone, Password, Status, Email.
        const rowData = [updatedStudent.Student_ID, updatedStudent.Name, updatedStudent.Phone, updatedStudent.Password, updatedStudent.Status || 'Active', updatedStudent.Email || ''];
        const response = await saveData('Students', rowData, 'update', studentIndex + 2);
        if (response.status !== 'success') throw new Error('Password update failed');
        loggedInStudent = updatedStudent;
        sessionStorage.setItem('loggedInStudent', JSON.stringify(updatedStudent));
        form.reset();
        message.style.color = '#047857';
        message.textContent = 'Password changed successfully.';
    } catch (_) {
        message.style.color = '#dc2626';
        message.textContent = 'Could not update password. Please try again.';
    } finally {
        button.disabled = false;
        button.textContent = 'Change Password';
    }
}

function logout() {
    sessionStorage.removeItem("loggedInStudent");
    window.location.href = "index.html";
}

function translateStudentPanel() {
    const logoutButton = document.querySelector('.logout-btn-sidebar');
    if (logoutButton) logoutButton.textContent = 'Logout';
    const instruction = document.querySelector('#subject-selection p');
    if (instruction) instruction.textContent = 'Select a subject from the menu to start your exam.';
    const submitButton = document.getElementById('submit-exam-btn');
    if (submitButton && !submitButton.disabled) submitButton.textContent = 'Submit Exam';
}

// সাইডবারে ডাইনামিক সাবজেক্ট মেনু তৈরি করার ফাংশন
function setupSidebarSubjects() {
    const combinedSubjectKeys = new Set(availableMockExams.flatMap(exam => exam.subjects.map(normalizeSubjectName)));
    const subjects = (availableSubjects.length ? availableSubjects : [...new Set(allData.map(item => item.Subject))])
        .filter(subject => !combinedSubjectKeys.has(normalizeSubjectName(subject)));
    const sidebarList = document.getElementById('subject-sidebar-list');
    sidebarList.innerHTML = "";

    if (subjects.length === 0 || (subjects.length === 1 && !subjects[0])) {
        sidebarList.innerHTML = "<li><a href='#'>কোনো বিষয় পাওয়া যায়নি</a></li>";
        return;
    }

    subjects.forEach(sub => {
        if (sub) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" onclick="selectSubject('${sub}', this)">📚 ${sub}</a>`;
            sidebarList.appendChild(li);
        }
    });

    document.getElementById('subject-selection').innerHTML = `<p><b>নির্দেশনা:</b> বাম পাশের মেনু থেকে আপনার পছন্দের বিষয়টি সিলেক্ট করে পরীক্ষা শুরু করুন।</p>`;
}

function getCombinedExams(exams) {
    const grouped = new Map();
    (exams || []).forEach(exam => {
        if (!exam.Exam_Name || !exam.Subject || normalizeSubjectName(exam.Status) !== "combined") return;
        const name = String(exam.Exam_Name).trim();
        const key = normalizeSubjectName(name);
        if (!grouped.has(key)) grouped.set(key, { name, subjects: [], duration: 0, subjectDurations: new Map() });
        const group = grouped.get(key);
        if (!group.subjects.some(subject => normalizeSubjectName(subject) === normalizeSubjectName(exam.Subject))) {
            group.subjects.push(String(exam.Subject).trim());
            group.subjectDurations.set(normalizeSubjectName(exam.Subject), Number(exam.Duration) || 0);
        }
    });
    return [...grouped.values()]
        .filter(exam => exam.subjects.length >= 2)
        .map(exam => ({
            ...exam,
            duration: exam.subjects.reduce((total, subject) =>
                total + (exam.subjectDurations.get(normalizeSubjectName(subject)) || 0), 0) || COMBINED_EXAM_MINUTES
        }));
}

function getExamScheduleStart(examName) {
    const value = examSchedules.get(String(examName || '').trim().toLocaleLowerCase());
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function formatScheduleCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clearScheduleTicker() {
    if (scheduleTicker) clearInterval(scheduleTicker);
    scheduleTicker = null;
}

function startScheduleTicker() {
    clearScheduleTicker();
    const update = () => {
        let waiting = false;
        document.querySelectorAll('[data-schedule-start]').forEach(element => {
            const start = Number(element.dataset.scheduleStart);
            const remaining = start - Date.now();
            const container = element.closest('.combined-exam-card, .subject-schedule-wrap');
            const button = container?.querySelector('[data-start-exam-button]');
            if (remaining > 0) {
                waiting = true;
                element.textContent = `Starts in ${formatScheduleCountdown(remaining)}`;
                if (button) {
                    button.disabled = true;
                    button.textContent = button.dataset.waitingLabel || 'Exam not open yet';
                }
            } else {
                element.textContent = 'Available now';
                if (button) {
                    button.disabled = button.dataset.permanentlyDisabled === 'true';
                    button.textContent = button.dataset.readyLabel || 'Start Exam';
                }
            }
        });
        if (!waiting) clearScheduleTicker();
    };
    update();
    if (document.querySelector('[data-schedule-start]')) scheduleTicker = setInterval(update, 1000);
}

function renderScheduleBlock(examName, permanentlyDisabled, readyLabel) {
    const start = getExamScheduleStart(examName);
    if (!start) return '<div class="schedule-block"><small>No start time scheduled</small></div>';
    const startLabel = new Date(start).toLocaleString();
    return `<div class="schedule-block"><small>Scheduled: ${escapeReviewHtml(startLabel)}</small><strong data-schedule-start="${start}">${Date.now() < start ? `Starts in ${formatScheduleCountdown(start - Date.now())}` : 'Available now'}</strong></div>`;
}

function showCombinedExamSetup() {
    clearScheduleTicker();
    const selection = document.getElementById("subject-selection");
    if (!availableMockExams.length) {
        selection.innerHTML = `<h2>Combined Subject Exams</h2><p>No active combined exam is configured yet. Ask the admin to create one from the Combined Subject menu.</p>`;
        return;
    }

    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
    selection.innerHTML = `<h2>Combined Subject Exams</h2><p>Choose an exam configured by your admin. You can switch subjects during the exam; your answers will stay saved.</p><div class="combined-exam-grid">` +
        availableMockExams.map((exam, index) => {
            const counts = exam.subjects.map(subject => ({
                subject,
                count: allData.filter(question => normalizeSubjectName(question.Subject) === normalizeSubjectName(subject)).length
            }));
            const ready = counts.every(item => item.count > 0);
            const scheduledAt = getExamScheduleStart(exam.name);
            const future = scheduledAt !== null && scheduledAt > Date.now();
            const unavailable = !ready || isExamLocked(exam.name);
            const startLabel = isExamLocked(exam.name) ? 'Completed' : isReExamApproved(exam.name) ? 'Start Re-Exam' : ready ? (hasSavedExamProgress(exam.name) ? 'Resume Combined Exam' : 'Start Combined Exam') : 'Questions unavailable';
            return `<article class="combined-exam-card">
                <h3>${escapeHtml(exam.name)}</h3>
                <p><b>Subjects:</b></p>
                <div class="combined-subject-list">${counts.map(item => `<div class="combined-subject-item"><i class="fa-solid fa-book-open"></i><strong>${escapeHtml(item.subject)}</strong><b>${item.count}</b><span>Questions</span><small>${exam.subjectDurations.get(normalizeSubjectName(item.subject)) || 0} minutes</small></div>`).join("")}</div>
                <p class="combined-total-time"><b>Total Duration:</b> ${exam.duration} minutes</p>
                ${renderScheduleBlock(exam.name, unavailable, startLabel)}
                <button type="button" class="btn-submit" data-start-exam-button data-ready-label="${escapeReviewHtml(startLabel)}" data-waiting-label="Exam not open yet" data-permanently-disabled="${unavailable ? 'true' : 'false'}" data-mock-exam-index="${index}" ${unavailable || future ? "disabled" : ""}>${future ? 'Exam not open yet' : startLabel}</button>
            </article>`;
        }).join("") + `</div>`;
    selection.querySelectorAll("[data-mock-exam-index]").forEach(button => button.addEventListener("click", () => {
        startExam(availableMockExams[Number(button.dataset.mockExamIndex)]);
    }));
    startScheduleTicker();
}

// সাইডবার থেকে কোনো সাবজেক্ট সিলেক্ট করলে যা হবে
function selectSubject(subjectName, element) {
    clearScheduleTicker();
    // মেনুর একটিভ ক্লাস কন্ট্রোল
    document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
    element.classList.add('active');

    if (isExamLocked(subjectName)) {
        document.getElementById('subject-selection').style.display = 'block';
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('result-container').style.display = 'none';
        document.getElementById('subject-selection').innerHTML = `<h2>${subjectName}</h2><p class="exam-completed-note">You have completed this exam. You cannot attempt it again.</p>`;
        return;
    }

    const subjectQuestions = allData.filter(q => normalizeSubjectName(q.Subject) === normalizeSubjectName(subjectName));
    const subjectDuration = getSubjectDuration(subjectName);
    document.getElementById("exam-duration").innerText = subjectDuration;
    document.getElementById("exam-duration-unit").innerText = "min";
    let totalMarks = 0;
    subjectQuestions.forEach(q => {
        let qMark = parseFloat(q.Mark);
        if (isNaN(qMark)) qMark = 1; 
        totalMarks += qMark;
    });

    document.getElementById('subject-selection').style.display = "block";
    document.getElementById('quiz-container').style.display = "none";
    document.getElementById('result-container').style.display = "none";

    const configuredExam = examConfigurations.find(exam => normalizeSubjectName(exam.Subject) === normalizeSubjectName(subjectName) && normalizeSubjectName(exam.Status) === 'active');
    const scheduleName = configuredExam?.Exam_Name || subjectName;
    const scheduledAt = getExamScheduleStart(scheduleName);
    const waiting = scheduledAt !== null && scheduledAt > Date.now();
    const unavailable = subjectQuestions.length === 0;
    const startLabel = unavailable ? 'Questions unavailable' : (hasSavedExamProgress(scheduleName) ? 'Resume Exam' : 'Start Exam');
    document.getElementById('subject-selection').innerHTML = `
        <h3 style="color: #1e293b; margin-top: 0;">বিষয়: ${subjectName}</h3>
        <p style="color: #64748b; line-height: 1.6;">এই পরীক্ষায় মোট <b>${subjectQuestions.length}টি</b> প্রশ্ন রয়েছে। সর্বমোট নম্বর <b>${totalMarks}</b> এবং পরীক্ষার জন্য নির্ধারিত সময় <b>${subjectDuration} মিনিট</b>।</p>
        <div class="subject-schedule-wrap">${renderScheduleBlock(scheduleName, false, 'Start Exam')}
        <button type="button" class="btn-submit" data-start-exam-button data-ready-label="${startLabel}" data-waiting-label="Exam not open yet" data-permanently-disabled="${unavailable ? 'true' : 'false'}" style="width: AUto; margin-top: 15px;" ${waiting || unavailable ? 'disabled' : ''}>${waiting ? 'Exam not open yet' : startLabel}</button></div>
    `;
    const startButton = document.querySelector('#subject-selection .btn-submit');
    if (startButton) startButton.addEventListener('click', () => startExam(subjectName, scheduleName));
    startScheduleTicker();
}

function startTimer(minutes, savedEndsAt = null) {
    const totalSeconds = minutes * 60;
    currentExamEndsAt = Number(savedEndsAt) > 0 ? Number(savedEndsAt) : Date.now() + totalSeconds * 1000;
    clearInterval(timerInterval);
    const tick = () => {
        const timeInSeconds = Math.max(0, Math.ceil((currentExamEndsAt - Date.now()) / 1000));
        updateTimerDisplay(timeInSeconds, totalSeconds);
        saveExamProgress();
        if (timeInSeconds <= 0) {
            clearInterval(timerInterval);
            alert("আপনার সময় শেষ! স্বয়ংক্রিয়ভাবে খাতা জমা হচ্ছে।");
            submitExam();
        }
    };
    tick();
    if (currentExamEndsAt <= Date.now()) return;
    timerInterval = setInterval(() => {
        tick();
    }, 1000);
}

function updateTimerDisplay(timeInSeconds, totalSeconds) {
    const progress = Math.max(0, (timeInSeconds / totalSeconds) * 100);
    const minutes = Math.floor(Math.max(0, timeInSeconds) / 60);
    const seconds = Math.max(0, timeInSeconds) % 60;
    document.getElementById('time-left').innerText = `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    document.getElementById('timer-progress').style.width = `${progress}%`;
    document.getElementById('timer-progress').classList.toggle('warning', progress <= 30);
}

function cancelExam() {
    if (!confirm('আপনি কি পরীক্ষা বাতিল করে ফিরে যেতে চান? আপনার দেওয়া উত্তর সংরক্ষণ করা হবে না।')) return;
    clearInterval(timerInterval);
    clearExamProgress();
    currentExamEndsAt = 0;
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('result-container').style.display = 'none';
    document.getElementById('subject-selection').style.display = 'block';
    setupSidebarSubjects();
}

function startExam(selectedSubject, scheduleName = null) {
    currentMockExam = selectedSubject && !Array.isArray(selectedSubject) && typeof selectedSubject === "object"
        ? selectedSubject
        : null;
    currentAttemptName = currentMockExam ? currentMockExam.name : String(selectedSubject);
    const gateName = currentMockExam ? currentMockExam.name : (scheduleName || String(selectedSubject));
    const scheduledStart = getExamScheduleStart(gateName);
    if (scheduledStart !== null && Date.now() < scheduledStart) {
        alert(`This exam will open at ${new Date(scheduledStart).toLocaleString()}.`);
        return;
    }
    clearScheduleTicker();
    if (isExamLocked(currentAttemptName)) {
        alert("You have already completed this exam. Request a re-exam and wait for admin approval.");
        return;
    }
    currentExamSubjects = currentMockExam
        ? currentMockExam.subjects
        : (Array.isArray(selectedSubject) ? selectedSubject : [selectedSubject]);
    const selectedSubjectKeys = currentExamSubjects.map(normalizeSubjectName);
    currentQuestions = allData.filter(q => selectedSubjectKeys.includes(normalizeSubjectName(q.Subject)));
    if (currentQuestions.length === 0) {
        alert("এই পরীক্ষার জন্য কোনো প্রশ্ন পাওয়া যায়নি।");
        return;
    }
    const savedProgress = readExamProgress(currentAttemptName);
    const progressMatchesCurrentExam = savedProgress && JSON.stringify(savedProgress.questionSignature) === JSON.stringify(getQuestionSignature());
    activeExamSubject = currentExamSubjects.length > 1 ? currentExamSubjects[0] : null;
    currentQuestionIndex = progressMatchesCurrentExam ? Math.min(Math.max(Number(savedProgress.currentQuestionIndex) || 0, 0), currentQuestions.length - 1) : 0;
    selectedAnswers = progressMatchesCurrentExam
        ? currentQuestions.map((_, index) => ['A', 'B', 'C', 'D'].includes(savedProgress.answers[index]) ? savedProgress.answers[index] : null)
        : new Array(currentQuestions.length).fill(null);
    if (progressMatchesCurrentExam && currentExamSubjects.some(subject => normalizeSubjectName(subject) === normalizeSubjectName(savedProgress.activeExamSubject))) {
        activeExamSubject = savedProgress.activeExamSubject;
    }
    
    document.getElementById('subject-selection').style.display = "none";
    document.getElementById('quiz-container').style.display = "block";
    document.getElementById('exam-title').innerText = currentMockExam
        ? `${currentMockExam.subjects.length}-Subject Combined Exam: ${currentMockExam.name}`
        : (currentExamSubjects.length > 1 ? `${currentExamSubjects.length}-Subject Combined Exam: ${currentExamSubjects.join(", ")}`
            : `${selectedSubject} Examination`);
    translateStudentPanel();

    let questionsHtml = "";

    currentQuestions.forEach((q, index) => {
        questionsHtml += `
        <div class="question-block" style="font-size: ${GLOBAL_FONT_SIZE}; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p><small style="color:#8b5cf6;font-weight:600;">${q.Subject}</small><br><b class="question-label">Question ${getQuestionDisplayNumber(index)}:</b> <span class="question-text">${renderQuestionContent(q.Question)}</span><br><small style="color: #64748b;">(+${q.Mark} correct | -${q.Negative_Mark} wrong)</small></p>
            ${q.Image_URL || q.Image || q.Time ? `<img class="question-image" src="${q.Image_URL || q.Image || q.Time}" alt="Question image" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="options" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <label><input type="radio" name="q${index}" value="A" onchange="showQuestion(currentQuestionIndex)"> A) ${renderOptionContent(q.Option_A)}</label>
                <label><input type="radio" name="q${index}" value="B" onchange="showQuestion(currentQuestionIndex)"> B) ${renderOptionContent(q.Option_B)}</label>
                <label><input type="radio" name="q${index}" value="C" onchange="showQuestion(currentQuestionIndex)"> C) ${renderOptionContent(q.Option_C)}</label>
                <label><input type="radio" name="q${index}" value="D" onchange="showQuestion(currentQuestionIndex)"> D) ${renderOptionContent(q.Option_D)}</label>
            </div>
        </div>`;
    });
    
    document.getElementById('questions-list').innerHTML = questionsHtml;
    selectedAnswers.forEach((answer, index) => {
        const radio = answer && document.querySelector(`input[name="q${index}"][value="${answer}"]`);
        if (radio) radio.checked = true;
    });
    document.getElementById('questions-list').addEventListener('change', event => {
        const radio = event.target.closest('input[type="radio"][name^="q"]');
        if (!radio) return;
        const index = Number(String(radio.name).slice(1));
        if (Number.isInteger(index)) selectedAnswers[index] = radio.value;
        saveExamProgress();
    });
    renderExamSubjectTabs();
    renderQuestionNavigator();
    showQuestion(currentQuestionIndex);

    if (window.MathJax) MathJax.typesetPromise([document.getElementById('questions-list')]);
    
    const examDuration = currentMockExam
        ? currentMockExam.duration
        : (currentExamSubjects.length > 1 ? COMBINED_EXAM_MINUTES : getSubjectDuration(currentExamSubjects[0]));
    document.getElementById("exam-duration").innerText = examDuration;
    document.getElementById("exam-duration-unit").innerText = "min";
    startTimer(examDuration, progressMatchesCurrentExam ? savedProgress.endsAt : null);
}

function renderExamSubjectTabs() {
    const tabs = document.getElementById("exam-subject-tabs");
    tabs.replaceChildren();
    tabs.style.display = currentExamSubjects.length > 1 ? "flex" : "none";
    currentExamSubjects.forEach(subject => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "exam-subject-tab";
        button.textContent = subject;
        button.addEventListener("click", () => {
            activeExamSubject = subject;
            renderQuestionNavigator();
            const firstIndex = currentQuestions.findIndex(question => normalizeSubjectName(question.Subject) === normalizeSubjectName(subject));
            if (firstIndex >= 0) showQuestion(firstIndex);
        });
        tabs.appendChild(button);
    });
}

function getVisibleQuestionIndices() {
    return currentQuestions
        .map((question, index) => ({ question, index }))
        .filter(item => !activeExamSubject || normalizeSubjectName(item.question.Subject) === normalizeSubjectName(activeExamSubject))
        .map(item => item.index);
}

function getQuestionDisplayNumber(questionIndex) {
    const question = currentQuestions[questionIndex];
    const normalizedNumberKey = Object.keys(question || {}).find(key =>
        ['questionnumber', 'questionno', 'questionnum', 'qnumber', 'qno'].includes(String(key).toLocaleLowerCase().replace(/[^a-z0-9]/g, '')) && Number(question[key]) > 0
    );
    const savedQuestionNumber = Number(question?.Question_Number);
    if (Number.isFinite(savedQuestionNumber) && savedQuestionNumber > 0) return savedQuestionNumber;
    const alternateQuestionNumber = Number(normalizedNumberKey ? question[normalizedNumberKey] : NaN);
    if (Number.isFinite(alternateQuestionNumber) && alternateQuestionNumber > 0) return alternateQuestionNumber;
    const subjectKey = normalizeSubjectName(currentQuestions[questionIndex]?.Subject);
    const sectionStarts = new Map([["physics", 1], ["chemistry", 46], ["biology", 91]]);
    if (sectionStarts.has(subjectKey)) {
        const subjectQuestionIndices = currentQuestions
            .map((question, index) => ({ question, index }))
            .filter(item => normalizeSubjectName(item.question.Subject) === subjectKey)
            .map(item => item.index);
        return sectionStarts.get(subjectKey) + subjectQuestionIndices.indexOf(questionIndex);
    }
    return getVisibleQuestionIndices().indexOf(questionIndex) + 1;
}

function renderQuestionNavigator() {
    const visibleIndices = getVisibleQuestionIndices();
    document.getElementById('question-navigator').innerHTML = visibleIndices.map(questionIndex =>
        `<button type="button" class="question-number ${questionIndex === currentQuestionIndex ? 'active' : ''}" onclick="showQuestion(${questionIndex})">${getQuestionDisplayNumber(questionIndex)}</button>`
    ).join('');
}

function renderQuestionContent(value) {
    return String(value || '').replace(/\\\\/g, '\\');
}

function renderOptionContent(value) {
    const text = String(value || '');
    if (text.startsWith('[[IMAGE]]')) {
        try {
            const source = text.slice(9);
            const isDataImage = /^data:image\/(png|jpeg|webp);base64,/i.test(source);
            const url = isDataImage ? null : new URL(source);
            if (isDataImage || ['http:', 'https:'].includes(url.protocol)) {
                const src = isDataImage ? source : url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                return `<img src="${src}" alt="Answer option structure" loading="lazy" style="max-width:min(320px,70vw);max-height:180px;vertical-align:middle;object-fit:contain" onerror="this.style.display='none'">`;
            }
        } catch (_) {}
        return '[Invalid option image URL]';
    }
    return renderQuestionContent(text);
}

function showQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) return;
    const previousAnswer = document.querySelector(`input[name="q${currentQuestionIndex}"]:checked`);
    if (previousAnswer) selectedAnswers[currentQuestionIndex] = previousAnswer.value;
    currentQuestionIndex = index;
    document.querySelectorAll('.question-block').forEach((block, i) => {
        const matchesSubject = !activeExamSubject || normalizeSubjectName(currentQuestions[i].Subject) === normalizeSubjectName(activeExamSubject);
        block.style.display = matchesSubject && i === index ? 'block' : 'none';
    });
    const visibleIndices = getVisibleQuestionIndices();
    document.querySelectorAll('.question-number').forEach((button, visibleIndex) => {
        const questionIndex = visibleIndices[visibleIndex];
        button.classList.toggle('active', questionIndex === index);
        button.classList.toggle('answered', Boolean(document.querySelector(`input[name="q${questionIndex}"]:checked`)));
    });
    const activeSubject = normalizeSubjectName(currentQuestions[index]?.Subject);
    document.querySelectorAll(".exam-subject-tab").forEach(button => {
        button.classList.toggle("active", normalizeSubjectName(button.textContent) === activeSubject);
    });
    document.getElementById('next-question-btn').disabled = visibleIndices.indexOf(index) === visibleIndices.length - 1;
    saveExamProgress();
}

function goToNextQuestion() {
    const visibleIndices = getVisibleQuestionIndices();
    const position = visibleIndices.indexOf(currentQuestionIndex);
    if (position >= 0 && position < visibleIndices.length - 1) showQuestion(visibleIndices[position + 1]);
}

async function submitExam() {
    clearInterval(timerInterval);
    const submitBtn = document.getElementById("submit-exam-btn");
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    let score = 0, rightAnswers = 0, wrongAnswers = 0, missedAnswers = 0;
    const reviewItems = [];
    currentQuestions.forEach((q, index) => {
        const selectedOption = document.querySelector(`input[name="q${index}"]:checked`);
        const selected = selectedOption ? selectedOption.value : "";
        const correct = normalizeCorrectOption(q.Correct_Answer);
        const status = !selected ? "missing" : selected === correct ? "correct" : "wrong";
        if (status === "correct") { score += Number(q.Mark) || 1; rightAnswers++; }
        else if (status === "wrong") { score -= Number(q.Negative_Mark) || 0; wrongAnswers++; }
        else missedAnswers++;
        reviewItems.push({
            subject: q.Subject || "Other",
            number: getQuestionDisplayNumber(index),
            question: q.Question || "",
            options: { A: q.Option_A || "", B: q.Option_B || "", C: q.Option_C || "", D: q.Option_D || "" },
            selected, correct, status,
            mark: Number(q.Mark) || 1,
            negativeMark: Number(q.Negative_Mark) || 0
        });
    });

    const attemptKey = createAttemptKey(currentAttemptName);
    completedExamKeys.add(attemptKey);
    clearExamProgress();
    currentExamEndsAt = 0;
    try {
        localStorage.setItem(`exam-review:${attemptKey}`, JSON.stringify(reviewItems));
        localStorage.setItem(`exam-completed:${attemptKey}`, "1");
    } catch (error) { console.warn("Could not save exam review on this device.", error); }

    document.getElementById("quiz-container").style.display = "none";
    document.getElementById("result-container").style.display = "block";
    document.getElementById("score-text").innerHTML = `
        <div class="result-summary-grid">
            <div><span>Total questions</span><strong>${currentQuestions.length}</strong></div>
            <div><span>Correct</span><strong class="result-correct">${rightAnswers}</strong></div>
            <div><span>Wrong</span><strong class="result-wrong">${wrongAnswers}</strong></div>
            <div><span>Unanswered</span><strong>${missedAnswers}</strong></div>
            <div class="result-score"><span>Total Number</span><strong>${Number(score.toFixed(2))}</strong></div>
        </div>`;
    updateAvailableQuestionCount();
    renderExamReview(reviewItems);

    const resultData = [
        loggedInStudent.Student_ID,
        currentAttemptName,
        currentQuestions.length,
        rightAnswers + wrongAnswers,
        rightAnswers,
        wrongAnswers,
        missedAnswers,
        score,
        new Date().toLocaleString()
    ];
    try {
        const response = await saveData("Results", resultData, 'add', null, { silent: true });
        if (response.status === 'success' && activeReExamRequestKey) {
            const request = reExamRequests.get(activeReExamRequestKey);
            if (request) { request.status = 'Used'; request.usedAt = new Date().toLocaleString(); await saveSetting(activeReExamRequestKey, JSON.stringify(request)); reExamRequests.set(activeReExamRequestKey, request); }
            activeReExamRequestKey = '';
        }
    } catch (error) { console.error("Could not save exam result.", error); }
}

function escapeReviewHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function renderExamReview(items, containerId = "exam-review", showTitle = true) {
    const container = document.getElementById(containerId);
    if (!items.length) {
        container.innerHTML = '<div class="review-perfect"><strong>No question review available</strong><span>This exam was completed before detailed answer review was enabled.</span></div>';
        return;
    }
    const subjects = [...new Set(items.map(item => item.subject))];
    container.innerHTML = (showTitle ? '<h3 class="review-title">Review your answers</h3>' : '') + subjects.map(subject => {
        const subjectItems = items.filter(item => item.subject === subject);
        return `<section class="review-subject"><h4>${escapeReviewHtml(subject)} <span>${subjectItems.length} questions</span></h4>` +
            subjectItems.map(item => `<article class="review-question ${item.status}">
                <div class="review-question-heading"><strong>Question ${escapeReviewHtml(item.number)}</strong><span class="review-status">${item.status === "missing" ? "Not answered" : item.status === "wrong" ? "Incorrect" : "Correct"}</span></div>
                <p>${escapeReviewHtml(item.question)}</p>
                <div class="review-answers">
                    <span>Your answer: <b>${item.selected ? `${item.selected}) ${escapeReviewHtml(item.options[item.selected])}` : "No answer"}</b></span>
                    <span>Correct answer: <b>${escapeReviewHtml(item.correct)}${item.correct && item.options[item.correct] ? `) ${escapeReviewHtml(item.options[item.correct])}` : ""}</b></span>
                </div>
            </article>`).join("") + '</section>';
    }).join("");
}

function getReviewMark(item) {
    if (Number.isFinite(Number(item.mark)) && Number(item.mark) > 0) return Number(item.mark);
    const question = allData.find(candidate =>
        normalizeSubjectName(candidate.Subject) === normalizeSubjectName(item.subject) &&
        String(candidate.Question || "") === String(item.question || "")
    );
    return Number(question?.Mark) || 1;
}

function getSubjectResultStats(items) {
    const grouped = new Map();
    items.forEach(item => {
        const subject = item.subject || "Other";
        if (!grouped.has(subject)) grouped.set(subject, { subject, total: 0, right: 0, wrong: 0, missed: 0, score: 0 });
        const stats = grouped.get(subject);
        const mark = getReviewMark(item);
        stats.total += mark;
        if (item.status === "correct") { stats.right++; stats.score += mark; }
        else if (item.status === "wrong") { stats.wrong++; stats.score -= Number(item.negativeMark) || 0; }
        else stats.missed++;
    });
    return [...grouped.values()];
}

function getReviewScore(items) {
    return items.reduce((score, item) => {
        if (item.status === "correct") return score + getReviewMark(item);
        if (item.status === "wrong") return score - (Number(item.negativeMark) || 0);
        return score;
    }, 0);
}

function renderSubjectResultCards(items, containerId = "subject-result-cards") {
    const container = document.getElementById(containerId);
    if (!container) return;
    const stats = getSubjectResultStats(items);
    container.innerHTML = stats.length ? stats.map(item => `<article class="subject-result-card">
        <h3>${escapeReviewHtml(item.subject)}</h3>
        <div class="subject-score">${Number(item.score.toFixed(2))} <small>/ ${Number(item.total.toFixed(2))}</small></div>
        <div class="subject-result-stats">
            <span>Correct<strong>${item.right}</strong></span>
            <span>Wrong<strong>${item.wrong}</strong></span>
            <span>Unanswered<strong>${item.missed}</strong></span>
        </div>
    </article>`).join("") : '<div class="review-perfect"><strong>No subject result available</strong></div>';
}

async function submitReExamRequest(examName) {
    const key = getReExamRequestKey(examName), existing = reExamRequests.get(key);
    if (existing && ['pending','approved','used'].includes(String(existing.status || '').toLowerCase())) return;
    const request = { studentId: String(loggedInStudent.Student_ID || '').trim(), studentName: loggedInStudent.Name || 'Student', examName, status: 'Pending', requestedAt: new Date().toLocaleString() };
    const response = await saveSetting(key, JSON.stringify(request));
    if (response.status === 'success') { reExamRequests.set(key, request); showReExamRequests(); }
}
function showReExamRequests() {
    const panel = document.getElementById('subject-selection');
    const exams = [...new Map(studentResults.map(row => { const name = getResultExamName(row); return [name.toLowerCase(), name]; })).values()];
    panel.innerHTML = '<h2>Request for Re-Exam</h2><p>Admin approval is required before you can take a completed exam again.</p>' + (exams.length ? `<div class="student-result-list">${exams.map(name => { const req=getReExamRequest(name), status=String(req?.status||''), locked=['pending','approved','used'].includes(status.toLowerCase()); return `<article class="student-result-card"><span><strong>${escapeReviewHtml(name)}</strong><small>${status ? `Status: ${escapeReviewHtml(status)}` : 'No request sent'}</small></span><button type="button" class="btn-submit" data-reexam="${escapeReviewHtml(name)}" ${locked?'disabled':''}>${status.toLowerCase()==='approved'?'Approved — start exam':status.toLowerCase()==='pending'?'Request pending':status.toLowerCase()==='used'?'Re-exam completed':'Request Re-Exam'}</button></article>`; }).join('')}</div>` : '<p>No completed exams yet.</p>');
    panel.querySelectorAll('[data-reexam]').forEach(button => button.addEventListener('click', () => submitReExamRequest(button.dataset.reexam)));
}
function showStudentResultView() {
    const panel = document.getElementById("subject-selection");
    const prefix = `exam-review:${String(loggedInStudent.Student_ID || "").trim().toLocaleLowerCase()}|`;
    const reviewNames = Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length));
    const names = [...new Map([
        ...studentResults.map(result => {
            const examName = getResultExamName(result);
            return [examName.toLocaleLowerCase(), examName];
        }),
        ...reviewNames.map(name => {
            const canonicalName = getCanonicalExamName(name);
            return [canonicalName.toLocaleLowerCase(), canonicalName];
        })
    ].filter(([key, name]) => key && name)).values()];

    const attemptHistory = [...studentResults].reverse().map((result, index) => `<article class="student-result-card" style="cursor:default"><span><strong>${escapeReviewHtml(getResultExamName(result))}</strong><small>Attempt ${studentResults.length - index} · ${escapeReviewHtml(result.Date || 'Completed exam')}</small></span><span class="student-result-score">${escapeReviewHtml(firstNonEmptyResultValue(result.Score, result.Total_Score, '—'))} <small>Total Number</small></span></article>`).join('');
    panel.innerHTML = '<h2>Result View</h2><p>All attempts are retained below. Select an exam for its answer review.</p>' + (attemptHistory ? `<div class="student-result-list">${attemptHistory}</div><h3 class="result-review-heading">Exam Reviews</h3>` : '') +
        (names.length ? `<div class="student-result-list">${names.map((name, index) => {
            const result = [...studentResults].reverse().find(row => getResultExamName(row).toLocaleLowerCase() === name.toLocaleLowerCase());
            return `<button type="button" class="student-result-card" data-result-name-index="${index}">
                <span><strong>${escapeReviewHtml(name)}</strong><small>${escapeReviewHtml(result?.Date || "Completed exam")}</small></span>
                <span class="student-result-score">${escapeReviewHtml(firstNonEmptyResultValue(result?.Score, result?.Total_Score, "View review"))} <small>Total Number</small></span>
            </button>`;
        }).join("")}</div>` : '<div class="review-perfect"><strong>No completed exams yet</strong><span>Your completed exams and answer reviews will appear here.</span></div>');

    panel.querySelectorAll("[data-result-name-index]").forEach(button => button.addEventListener("click", () => {
        const name = names[Number(button.dataset.resultNameIndex)];
        const attemptKey = createAttemptKey(name);
        let details = [];
        try { details = JSON.parse(localStorage.getItem(`exam-review:${attemptKey}`) || "[]"); } catch (_) { details = []; }
        const result = [...studentResults].reverse().find(row => getResultExamName(row).toLocaleLowerCase() === name.toLocaleLowerCase());
        const resultTotal = Number(firstNonEmptyResultValue(result?.Total_Questions, result?.Total_Question, result?.Total_Qs, 0)) || 0;
        if (details.length < resultTotal) {
            const upgradedReview = completeOlderReview(details, result, name, resultTotal);
            if (upgradedReview) {
                details = upgradedReview;
                try { localStorage.setItem(`exam-review:${attemptKey}`, JSON.stringify(details)); } catch (_) { }
            }
        }
        const hasCompleteReview = (resultTotal > 0 && details.length === resultTotal) || (!resultTotal && details.length > 0);
        const counts = details.reduce((total, item) => {
            if (item.status === "correct") total.right++;
            else if (item.status === "wrong") total.wrong++;
            else if (item.status === "missing") total.missed++;
            return total;
        }, { right: 0, wrong: 0, missed: 0 });
        const totalQuestions = resultTotal || details.length;
        const savedScore = firstNonEmptyResultValue(result?.Score, result?.Total_Score);
        const displayScore = savedScore !== undefined ? savedScore : (details.length ? Number(getReviewScore(details).toFixed(2)) : "—");
        panel.innerHTML = `<button type="button" class="btn-next" id="result-view-back">← All results</button>
            <h2 style="margin-top:18px;">${escapeReviewHtml(name)}</h2>
            <div class="result-detail-summary">
                <div><span>Total questions</span><strong>${totalQuestions || "—"}</strong></div>
                <div><span>Total Number</span><strong>${escapeReviewHtml(displayScore)}</strong></div>
                <div><span>Correct</span><strong>${hasCompleteReview ? counts.right : escapeReviewHtml(firstNonEmptyResultValue(result?.Right_Answers, result?.Correct, "—"))}</strong></div>
                <div><span>Wrong</span><strong>${hasCompleteReview ? counts.wrong : escapeReviewHtml(firstNonEmptyResultValue(result?.Wrong_Answers, result?.Wrong_Answer, result?.Wrong, "—"))}</strong></div>
                <div><span>Unanswered</span><strong>${hasCompleteReview ? counts.missed : escapeReviewHtml(firstNonEmptyResultValue(result?.Missed_Answers, result?.Missed_Answer, result?.Missed, "—"))}</strong></div>
            </div>
            <h3 class="review-title result-review-heading">Review your answers</h3>
            <div class="result-filter"><label for="result-subject-filter">Subject</label><select id="result-subject-filter"><option value="all">All subjects</option>${[...new Set(details.map(item => item.subject))].map(subject => `<option value="${escapeReviewHtml(subject)}">${escapeReviewHtml(subject)}</option>`).join("")}</select></div>
            <div id="subject-result-cards" class="subject-result-grid"></div>
            <div id="saved-exam-review"></div>`;
        const filter = document.getElementById("result-subject-filter");
        const renderFilteredResult = () => {
            const filtered = filter.value === "all" ? details : details.filter(item => item.subject === filter.value);
            renderSubjectResultCards(filtered);
            renderExamReview(filtered, "saved-exam-review", false);
        };
        filter.addEventListener("change", renderFilteredResult);
        renderFilteredResult();
        document.getElementById("result-view-back").addEventListener("click", showStudentResultView);
    }));
}

function completeOlderReview(savedDetails, result, examName, totalCount) {
    const configuredExam = availableMockExams.find(exam => exam.name.toLocaleLowerCase() === String(examName).trim().toLocaleLowerCase());
    const subjectKeys = configuredExam
        ? configuredExam.subjects.map(normalizeSubjectName)
        : availableSubjects.filter(subject => normalizeSubjectName(subject) === normalizeSubjectName(examName)).map(normalizeSubjectName);
    const pool = allData.filter(question => subjectKeys.includes(normalizeSubjectName(question.Subject)));
    if (pool.length !== totalCount) return null;

    const keyFor = (subject, number) => `${normalizeSubjectName(subject)}|${String(number)}`;
    const savedByQuestion = new Map(savedDetails.map(item => [keyFor(item.subject, item.number), item]));
    const correctCount = Number(firstNonEmptyResultValue(result?.Right_Answers, result?.Correct, result?.Right, 0)) || 0;
    const alreadyCorrect = savedDetails.filter(item => item.status === "correct").length;
    const unrecorded = pool.map((question, index) => {
        const subjectKey = normalizeSubjectName(question.Subject);
        const sectionStart = new Map([["physics", 1], ["chemistry", 46], ["biology", 91]]).get(subjectKey);
        const sameSubjectIndex = pool.slice(0, index).filter(item => normalizeSubjectName(item.Subject) === subjectKey).length;
        const number = sectionStart ? sectionStart + sameSubjectIndex : index + 1;
        return { question, number, key: keyFor(question.Subject, number) };
    }).filter(item => !savedByQuestion.has(item.key));

    // Older reviews stored only wrong and unanswered questions. Use the saved correct count
    // to ensure every omitted database question is actually one of the correct answers.
    if (unrecorded.length !== correctCount - alreadyCorrect) return null;
    const upgraded = [...savedDetails];
    unrecorded.forEach(({ question, number }) => {
        const correct = normalizeCorrectOption(question.Correct_Answer);
        upgraded.push({
            subject: question.Subject || "Other",
            number,
            question: question.Question || "",
            options: { A: question.Option_A || "", B: question.Option_B || "", C: question.Option_C || "", D: question.Option_D || "" },
            selected: correct,
            correct,
            status: "correct"
        });
    });
    return upgraded;
}