window.onload = async () => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    document.getElementById("current-date").innerText = new Date().toLocaleDateString('en-GB', options);

    try {
        const cacheKey = "admin-dashboard-data-v2";
        let dashboardData;
        try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
            if (cached && Date.now() - cached.savedAt < 60000) dashboardData = cached.data;
        } catch (_) { }
        if (!dashboardData) {
            const [questionsData, studentsData, resultsData, examsData] = await Promise.all([
                fetchData("Questions"), fetchData("Students"), fetchData("Results"), fetchData("Exams")
            ]);
            dashboardData = { questionsData, studentsData, resultsData, examsData };
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: dashboardData })); } catch (_) { }
        }
        const { questionsData, studentsData, resultsData, examsData } = dashboardData;
        document.getElementById("total-questions").innerText = questionsData?.length || 0;
        document.getElementById("total-students").innerText = studentsData?.length || 0;
        document.getElementById("total-exams").innerText = resultsData?.length || 0;

        const container = document.getElementById("recent-results-body");
        if (!resultsData?.length) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:20px;color:#6b7280;">No exam results found.</p>';
            return;
        }
        const studentNames = new Map((studentsData || []).map(student => [String(student.Student_ID || '').trim(), student.Name || student.Student_Name || 'Student']));
        container.innerHTML = resultsData.slice(-5).reverse().map(result => {
            const studentId = String(result.Student_ID || '').trim();
            const studentName = studentNames.get(studentId) || result.Student_Name || 'Student';
            const examName = result.Exam_Name || result.Exam_Title || result.Subject || 'Exam';
            const total = Number(result.Total_Questions || result.Total_Question || 0) || 0;
            const correct = Number(result.Right_Answers || result.Correct || 0) || 0;
            const wrong = Number(result.Wrong_Answers || result.Wrong_Answer || result.Wrong || 0) || 0;
            const unanswered = Number(result.Missed_Answers || result.Missed_Answer || result.Missed || Math.max(0, total - correct - wrong)) || 0;
            const negative = getNegativeMark(result, questionsData, examsData, wrong);
            const score = result.Score ?? result.Total_Score ?? 0;
            return `<article class="recent-result-card">
                <div class="recent-result-head"><div><h4>${escapeAdminHtml(studentName)}</h4><p>${escapeAdminHtml(studentId)} · ${escapeAdminHtml(examName)}</p></div><strong class="recent-result-score">${escapeAdminHtml(score)}</strong></div>
                <div class="recent-result-stats"><span>Total<strong>${total || '-'}</strong></span><span>Correct<strong>${correct}</strong></span><span class="wrong">Wrong<strong>${wrong}</strong></span><span>Unanswered<strong>${unanswered}</strong></span></div>
                <div class="recent-result-stats" style="margin-top:7px;grid-template-columns:1fr;"><span class="negative">Negative Mark<strong>${negative}</strong></span></div>
                <small class="recent-result-date"><i class="fa-regular fa-clock"></i> ${escapeAdminHtml(result.Date || '-')}</small>
            </article>`;
        }).join('');
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
        document.getElementById("recent-results-body").innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:20px;color:red;">Could not load dashboard data.</p>';
    }
};

function escapeAdminHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}

function getNegativeMark(result, questions, exams, wrongCount) {
    const saved = result.Negative_Marks ?? result.Negative_Mark ?? result.Total_Negative_Mark;
    if (saved !== undefined && saved !== null && String(saved).trim() !== '') return Math.abs(Number(saved) || 0);
    const examName = String(result.Exam_Name || result.Exam_Title || '').trim().toLocaleLowerCase();
    const subject = String(result.Subject || '').trim().toLocaleLowerCase();
    const combinedSubjects = new Set((exams || []).filter(exam =>
        String(exam.Exam_Name || '').trim().toLocaleLowerCase() === examName &&
        String(exam.Status || '').trim().toLocaleLowerCase() === 'combined'
    ).map(exam => String(exam.Subject || '').trim().toLocaleLowerCase()).filter(Boolean));
    const values = [...new Set((questions || []).filter(question => {
        const questionExam = String(question.Exam_Name || '').trim().toLocaleLowerCase();
        const questionSubject = String(question.Subject || '').trim().toLocaleLowerCase();
        return (examName && questionExam === examName) || (subject && questionSubject === subject) || combinedSubjects.has(questionSubject);
    }).map(question => Number(question.Negative_Mark)).filter(value => Number.isFinite(value) && value > 0))];
    if (values.length === 1) return Number((values[0] * wrongCount).toFixed(2));
    return values.length > 1 ? 'Varies' : '—';
}
