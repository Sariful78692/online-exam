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

function normalizeSubjectName(value) {
    const subject = String(value || "").trim().toLocaleLowerCase();
    // Older question rows use "Physic" while combined exams may use "Physics".
    return subject === "physic" ? "physics" : subject;
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

function updateAvailableQuestionCount() {
    const unavailable = getUnavailableSubjectKeys();
    const availableCount = allData.filter(question => !unavailable.has(normalizeSubjectName(question.Subject))).length;
    const countElement = document.getElementById("question-count");
    if (countElement) countElement.innerText = availableCount;
}

window.onload = async () => {
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

        if (settingsData && settingsData.length > 0) {
            const timeSettings = settingsData.filter(s => s.Setting_Name === "Total_Time");
            if (timeSettings.length > 0) {
                TOTAL_EXAM_MINUTES = parseFloat(timeSettings[timeSettings.length - 1].Setting_Value);
            }

            const fontSettings = settingsData.filter(s => s.Setting_Name === "Font_Size");
            if (fontSettings.length > 0) {
                GLOBAL_FONT_SIZE = fontSettings[fontSettings.length - 1].Setting_Value;
            }
        }

        allData = questionsData || [];
        completedExamKeys = new Set((resultsData || [])
            .filter(result => String(result.Student_ID || "") === String(loggedInStudent.Student_ID || ""))
            .map(result => createAttemptKey(getResultExamName(result))));
        studentResults = (resultsData || []).filter(result => String(result.Student_ID || "") === String(loggedInStudent.Student_ID || ""));
        const localAttemptPrefix = `exam-completed:${String(loggedInStudent.Student_ID || "").trim().toLocaleLowerCase()}|`;
        Object.keys(localStorage).forEach(storageKey => {
            if (storageKey.startsWith(localAttemptPrefix)) completedExamKeys.add(storageKey.slice("exam-completed:".length));
        });
        availableSubjects = [...new Map((subjectsData || [])
            .map(s => s.Subject_Name || s.Subject)
            .filter(Boolean)
            .map(subject => [normalizeSubjectName(subject), String(subject).trim()])).values()];
        if (!availableSubjects.length) {
            availableSubjects = [...new Map(allData
                .map(item => item.Subject)
                .filter(Boolean)
                .map(subject => [normalizeSubjectName(subject), String(subject).trim()])).values()];
        }
        availableMockExams = getCombinedExams(examsData || []);
        subjectDurations = new Map();
        (examsData || []).forEach(exam => {
            const status = normalizeSubjectName(exam.Status);
            const duration = Number(exam.Duration);
            if (!exam.Subject || duration <= 0 || status === "combined" || (status && status !== "active")) return;
            subjectDurations.set(normalizeSubjectName(exam.Subject), duration);
        });
        const combinedSubjectKeys = new Set(availableMockExams.flatMap(exam => exam.subjects.map(normalizeSubjectName)));
        document.getElementById("subject-count").innerText = availableSubjects.filter(subject => !combinedSubjectKeys.has(normalizeSubjectName(subject))).length;
        updateAvailableQuestionCount();
        document.getElementById("exam-duration").innerText = "Varies";
        document.getElementById("exam-duration-unit").innerText = "by subject";

        document.getElementById("dashboard-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.getElementById("exam-duration").innerText = "Varies";
            document.getElementById("exam-duration-unit").innerText = "by subject";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            document.getElementById("dashboard-menu").classList.add("active");
            showCombinedExamSetup();
        });
        document.getElementById("combined-exam-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.getElementById("exam-duration").innerText = "Varies";
            document.getElementById("exam-duration-unit").innerText = "by subject";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active");
            showCombinedExamSetup();
        });
        document.getElementById("result-view-menu").addEventListener("click", event => {
            event.preventDefault();
            clearInterval(timerInterval);
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("result-container").style.display = "none";
            document.getElementById("subject-selection").style.display = "block";
            document.querySelectorAll(".sidebar-menu a").forEach(link => link.classList.remove("active"));
            event.currentTarget.classList.add("active");
            showStudentResultView();
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
        document.getElementById('subject-selection').innerHTML = "<p>ডেটা লোড করতে সমস্যা হয়েছে!</p>";
    }
};

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

function showCombinedExamSetup() {
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
            return `<article class="combined-exam-card">
                <h3>${escapeHtml(exam.name)}</h3>
                <p><b>Subjects:</b></p>
                <div class="combined-subject-list">${counts.map(item => `<div class="combined-subject-item"><i class="fa-solid fa-book-open"></i><strong>${escapeHtml(item.subject)}</strong><b>${item.count}</b><span>Questions</span><small>${exam.subjectDurations.get(normalizeSubjectName(item.subject)) || 0} minutes</small></div>`).join("")}</div>
                <p class="combined-total-time"><b>Total Duration:</b> ${exam.duration} minutes</p>
                <button type="button" class="btn-submit" data-mock-exam-index="${index}" ${ready && !hasCompletedExam(exam.name) ? "" : "disabled"}>${hasCompletedExam(exam.name) ? "Completed" : ready ? "Start Combined Exam" : "Questions unavailable"}</button>
            </article>`;
        }).join("") + `</div>`;
    selection.querySelectorAll("[data-mock-exam-index]").forEach(button => button.addEventListener("click", () => {
        startExam(availableMockExams[Number(button.dataset.mockExamIndex)]);
    }));
}

// সাইডবার থেকে কোনো সাবজেক্ট সিলেক্ট করলে যা হবে
function selectSubject(subjectName, element) {
    // মেনুর একটিভ ক্লাস কন্ট্রোল
    document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
    element.classList.add('active');

    if (hasCompletedExam(subjectName)) {
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

    document.getElementById('subject-selection').innerHTML = `
        <h3 style="color: #1e293b; margin-top: 0;">বিষয়: ${subjectName}</h3>
        <p style="color: #64748b; line-height: 1.6;">এই পরীক্ষায় মোট <b>${subjectQuestions.length}টি</b> প্রশ্ন রয়েছে। সর্বমোট নম্বর <b>${totalMarks}</b> এবং পরীক্ষার জন্য নির্ধারিত সময় <b>${subjectDuration} মিনিট</b>।</p>
        <button onclick="startExam('${subjectName}')" class="btn-submit" style="width: AUto; margin-top: 15px;">পরীক্ষা শুরু করুন</button>
    `;
    const startButton = document.querySelector('#subject-selection .btn-submit');
    if (startButton) startButton.textContent = 'Start Exam';
}

function startTimer(minutes) {
    let timeInSeconds = minutes * 60;
    const totalSeconds = timeInSeconds;
    clearInterval(timerInterval);
    updateTimerDisplay(timeInSeconds, totalSeconds);
    timerInterval = setInterval(() => {
        timeInSeconds--;
        updateTimerDisplay(timeInSeconds, totalSeconds);
        let m = Math.floor(timeInSeconds / 60);
        let s = timeInSeconds % 60;
        document.getElementById('time-left').innerText = `${m < 10 ? "0"+m : m}:${s < 10 ? "0"+s : s}`;
        
        if (timeInSeconds <= 0) {
            clearInterval(timerInterval); 
            alert("আপনার সময় শেষ! স্বয়ংক্রিয়ভাবে খাতা জমা হচ্ছে।");
            submitExam(); 
        }
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
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('result-container').style.display = 'none';
    document.getElementById('subject-selection').style.display = 'block';
    setupSidebarSubjects();
}

function startExam(selectedSubject) {
    currentMockExam = selectedSubject && !Array.isArray(selectedSubject) && typeof selectedSubject === "object"
        ? selectedSubject
        : null;
    currentAttemptName = currentMockExam ? currentMockExam.name : String(selectedSubject);
    if (hasCompletedExam(currentAttemptName)) {
        alert("You have already completed this exam. A second attempt is not allowed.");
        return;
    }
    currentExamSubjects = currentMockExam
        ? currentMockExam.subjects
        : (Array.isArray(selectedSubject) ? selectedSubject : [selectedSubject]);
    const selectedSubjectKeys = currentExamSubjects.map(normalizeSubjectName);
    currentQuestions = allData.filter(q => selectedSubjectKeys.includes(normalizeSubjectName(q.Subject)));
    activeExamSubject = currentExamSubjects.length > 1 ? currentExamSubjects[0] : null;
    currentQuestionIndex = 0;
    selectedAnswers = new Array(currentQuestions.length).fill(null);
    
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
            ${q.Image_URL || q.Image || q.Time ? `<img class="question-image" src="${q.Image_URL || q.Image || q.Time}" alt="Question image" loading="lazy" onerror="this.style.display='none'">` : ''}
            <p><small style="color:#8b5cf6;font-weight:600;">${q.Subject}</small><br><b class="question-label">Question ${getQuestionDisplayNumber(index)}:</b> <span class="question-text">${renderQuestionContent(q.Question)}</span><br><small style="color: #64748b;">(+${q.Mark} correct | -${q.Negative_Mark} wrong)</small></p>
            <div class="options" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <label><input type="radio" name="q${index}" value="A" onchange="showQuestion(currentQuestionIndex)"> A) ${q.Option_A}</label>
                <label><input type="radio" name="q${index}" value="B" onchange="showQuestion(currentQuestionIndex)"> B) ${q.Option_B}</label>
                <label><input type="radio" name="q${index}" value="C" onchange="showQuestion(currentQuestionIndex)"> C) ${q.Option_C}</label>
                <label><input type="radio" name="q${index}" value="D" onchange="showQuestion(currentQuestionIndex)"> D) ${q.Option_D}</label>
            </div>
        </div>`;
    });
    
    document.getElementById('questions-list').innerHTML = questionsHtml;
    renderExamSubjectTabs();
    renderQuestionNavigator();
    showQuestion(0);

    if (window.MathJax) MathJax.typesetPromise([document.getElementById('questions-list')]);
    
    const examDuration = currentMockExam
        ? currentMockExam.duration
        : (currentExamSubjects.length > 1 ? COMBINED_EXAM_MINUTES : getSubjectDuration(currentExamSubjects[0]));
    document.getElementById("exam-duration").innerText = examDuration;
    document.getElementById("exam-duration-unit").innerText = "min";
    startTimer(examDuration);
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

function showQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) return;
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
    try { await saveData("Results", resultData); }
    catch (error) { console.error("Could not save exam result.", error); }
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

    panel.innerHTML = '<h2>Result View</h2><p>Choose an exam to see subject-wise correct, wrong and unanswered questions.</p>' +
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
