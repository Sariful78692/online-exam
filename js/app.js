let allData = [];
let currentQuestions = [];
let timerInterval;
let loggedInStudent = null;
let TOTAL_EXAM_MINUTES = 180; 
let GLOBAL_FONT_SIZE = "16px"; 

window.onload = async () => {
    const studentDataStr = sessionStorage.getItem("loggedInStudent");
    if (!studentDataStr) {
        window.location.href = "index.html"; 
        return;
    }
    
    loggedInStudent = JSON.parse(studentDataStr);
    document.getElementById("student-name").innerText = loggedInStudent.Name; 

    try {
        const [questionsData, settingsData] = await Promise.all([
            fetchData("Questions"),
            fetchData("Settings")
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

        allData = questionsData;
        
        if (allData && allData.length > 0) {
            setupSidebarSubjects();
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

// সাইডবারে ডাইনামিক সাবজেক্ট মেনু তৈরি করার ফাংশন
function setupSidebarSubjects() {
    const subjects = [...new Set(allData.map(item => item.Subject))]; 
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

// সাইডবার থেকে কোনো সাবজেক্ট সিলেক্ট করলে যা হবে
function selectSubject(subjectName, element) {
    // মেনুর একটিভ ক্লাস কন্ট্রোল
    document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
    element.classList.add('active');

    const subjectQuestions = allData.filter(q => q.Subject === subjectName);
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
        <p style="color: #64748b; line-height: 1.6;">এই পরীক্ষায় মোট <b>${subjectQuestions.length}টি</b> প্রশ্ন রয়েছে। সর্বমোট নম্বর <b>${totalMarks}</b> এবং পরীক্ষার জন্য নির্ধারিত সময় <b>${TOTAL_EXAM_MINUTES} মিনিট</b>।</p>
        <button onclick="startExam('${subjectName}')" class="btn-submit" style="width: AUto; margin-top: 15px;">পরীক্ষা শুরু করুন</button>
    `;
}

function startTimer(minutes) {
    let timeInSeconds = minutes * 60;
    timerInterval = setInterval(() => {
        let m = Math.floor(timeInSeconds / 60);
        let s = timeInSeconds % 60;
        document.getElementById('time-left').innerText = `${m < 10 ? "0"+m : m}:${s < 10 ? "0"+s : s}`;
        
        if (timeInSeconds <= 0) {
            clearInterval(timerInterval); 
            alert("আপনার সময় শেষ! স্বয়ংক্রিয়ভাবে খাতা জমা হচ্ছে।");
            submitExam(); 
        }
        timeInSeconds--;
    }, 1000);
}

function startExam(selectedSubject) {
    currentQuestions = allData.filter(q => q.Subject === selectedSubject);
    
    document.getElementById('subject-selection').style.display = "none";
    document.getElementById('quiz-container').style.display = "block";
    document.getElementById('exam-title').innerText = `${selectedSubject} Examination`;

    let questionsHtml = "";

    currentQuestions.forEach((q, index) => {
        questionsHtml += `
        <div class="question-block" style="font-size: ${GLOBAL_FONT_SIZE}; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p><b>প্রশ্ন ${index + 1}:</b> ${q.Question} <br><small style="color: #64748b;">(সঠিক: +${q.Mark} | ভুল: -${q.Negative_Mark})</small></p>
            <div class="options" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <label><input type="radio" name="q${index}" value="A"> A) ${q.Option_A}</label>
                <label><input type="radio" name="q${index}" value="B"> B) ${q.Option_B}</label>
                <label><input type="radio" name="q${index}" value="C"> C) ${q.Option_C}</label>
                <label><input type="radio" name="q${index}" value="D"> D) ${q.Option_D}</label>
            </div>
        </div>`;
    });
    
    document.getElementById('questions-list').innerHTML = questionsHtml;

    if (window.MathJax) {
        MathJax.typesetPromise();
    }
    
    startTimer(TOTAL_EXAM_MINUTES); 
}

async function submitExam() {
    clearInterval(timerInterval); 
    
    const submitBtn = document.getElementById("submit-exam-btn");
    submitBtn.innerText = "রেজাল্ট প্রসেস হচ্ছে, দয়া করে অপেক্ষা করুন...";
    submitBtn.disabled = true;

    let score = 0, rightAnswers = 0, wrongAnswers = 0, missedAnswers = 0;

    currentQuestions.forEach((q, index) => {
        const selectedOption = document.querySelector(`input[name="q${index}"]:checked`);
        if (selectedOption) {
            if (selectedOption.value === q.Correct_Answer) {
                score += parseFloat(q.Mark); rightAnswers++;
            } else {
                score -= parseFloat(q.Negative_Mark); wrongAnswers++;
            }
        } else { missedAnswers++; }
    });

    document.getElementById('quiz-container').style.display = "none";
    document.getElementById('result-container').style.display = "block";
    
    document.getElementById('score-text').innerHTML = `
        মোট প্রশ্ন: <b>${currentQuestions.length}</b><br>
        সঠিক উত্তর: <b style="color: green;">${rightAnswers}</b><br>
        ভুল উত্তর: <b style="color: red;">${wrongAnswers}</b><br>
        বাদ দেওয়া: <b>${missedAnswers}</b><br><br>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; display: inline-block;">
            সর্বমোট প্রাপ্ত নম্বর: <b style="font-size: 24px; color: #0f172a;">${score}</b>
        </div>
    `;

    const resultData = [
        loggedInStudent.Student_ID,
        document.getElementById('exam-title').innerText.replace(" Examination", ""),
        currentQuestions.length,
        rightAnswers + wrongAnswers,
        rightAnswers,
        wrongAnswers,
        missedAnswers,
        score,
        new Date().toLocaleString()
    ];
    
    try {
        await saveData("Results", resultData);
    } catch (e) {
        console.error("Rejalt save hote shomossha hoyeche", e);
    }
}