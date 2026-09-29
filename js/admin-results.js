let allResults = [];
let studentNameById = new Map();
let resultQuestions = [];
let resultExams = [];

function firstResultValue(...values) {
    return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

window.onload = async () => {
    await loadResultsTable();
};

async function loadResultsTable() {
    const tbody = document.getElementById("results-table-body");
    
    // যদি tbody না পাওয়া যায়, তবে ফাংশনটি এখানেই থেমে যাবে (এরর এড়ানোর জন্য)
    if (!tbody) return; 

    try {
        const [results, students, questions, exams] = await Promise.all([
            fetchData("Results"), fetchData("Students"), fetchData("Questions"), fetchData("Exams")
        ]);
        allResults = results || [];
        resultQuestions = questions || [];
        resultExams = exams || [];
        studentNameById = new Map((students || []).map(student => [String(student.Student_ID || '').trim(), student.Name || '—']));
        tbody.innerHTML = "";

        if (allResults.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #6b7280;">No exam results found.</td></tr>`;
            return;
        }

        // সর্বশেষ পরীক্ষাগুলো আগে দেখানোর জন্য রিভার্স করা হলো
        const reversedResults = [...allResults].reverse();

        reversedResults.forEach((result, index) => {
            // আসল অ্যারে থেকে ডিলিট করার জন্য সঠিক ইনডেক্স বের করা
            const originalIndex = allResults.length - 1 - index;
            const sheetRowIndex = originalIndex + 2; 

            // স্কোরের ওপর ভিত্তি করে ব্যাজ কালার
            const scoreValue = parseFloat(firstResultValue(result.Score, result.Total_Score)) || 0;
            const scoreClass = scoreValue > 0 ? "score-good" : "score-bad";
            const studentId = String(result.Student_ID || '').trim();
            let right = Number(firstResultValue(result.Right_Answers, result.Correct, result.Right, 0)) || 0;
            let wrong = Number(firstResultValue(result.Wrong_Answers, result.Wrong_Answer, result.Wrong, 0)) || 0;
            let missed = Number(firstResultValue(result.Missed_Answers, result.Missed_Answer, result.Missed, 0)) || 0;
            const total = Number(firstResultValue(result.Total_Questions, result.Total_Question, result.Total_Qs, 0)) || 0;
            const attempted = Number(firstResultValue(result.Attempted, result.Attempted_Questions, 0)) || 0;
            let countsUnavailable = false;
            try {
                const reviewKey = `exam-review:${studentId.toLocaleLowerCase()}|${String(result.Exam_Name || result.Subject || '').trim().toLocaleLowerCase()}`;
                const review = JSON.parse(localStorage.getItem(reviewKey) || 'null');
                if (Array.isArray(review) && total > 0 && review.length === total) {
                    right = review.filter(item => item.status === 'correct').length;
                    wrong = review.filter(item => item.status === 'wrong').length;
                    missed = review.filter(item => item.status === 'missing').length;
                } else if (total && right === 0 && wrong === 0 && missed === 0) {
                    if (attempted === 0) missed = total;
                    else {
                        const derived = deriveUniformMarkCounts(result, attempted, total);
                        if (derived) {
                            right = derived.right;
                            wrong = derived.wrong;
                            missed = derived.missed;
                        } else {
                            countsUnavailable = true;
                            missed = Math.max(0, total - attempted);
                        }
                    }
                }
            } catch (_) { /* Keep the values saved in Results when no local review exists. */ }
            const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary);">${escapeHtml(studentId || '-')}</td>
                <td style="font-weight: 500;">${escapeHtml(studentNameById.get(studentId) || result.Student_Name || '—')}</td>
                <td style="font-weight: 500;">${escapeHtml(result.Exam_Name || result.Subject || result.Exam_Title || '-')}</td>
                <td>${total || '-'}</td>
                <td style="color: #10b981; font-weight: bold;" title="${countsUnavailable ? 'This old result did not store the right-answer count.' : ''}">${countsUnavailable ? 'Not recorded' : right}</td>
                <td style="color: #ef4444; font-weight: bold;" title="${countsUnavailable ? 'This old result did not store the wrong-answer count.' : ''}">${countsUnavailable ? 'Not recorded' : wrong}</td>
                <td style="color: #6b7280;">${missed}</td>
                <td><span class="score-badge ${scoreClass}">${scoreValue}</span></td>
                <td style="font-size: 12px; color: #6b7280;">${result.Date || '-'}</td>
                <td>
                    <button onclick="deleteResult(${sheetRowIndex})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Error loading results data!</td></tr>`;
    }
}

function deriveUniformMarkCounts(result, attempted, total) {
    const examName = String(result.Exam_Name || '').trim();
    const normalized = value => String(value || '').trim().toLocaleLowerCase().replace(/s$/, '');
    const combinedSubjects = resultExams
        .filter(exam => String(exam.Exam_Name || '').trim().toLocaleLowerCase() === examName.toLocaleLowerCase() && String(exam.Status || '').trim().toLocaleLowerCase() === 'combined')
        .map(exam => normalized(exam.Subject));
    let candidates;
    if (combinedSubjects.length) {
        candidates = resultQuestions.filter(question => combinedSubjects.includes(normalized(question.Subject)));
    } else {
        candidates = resultQuestions.filter(question =>
            String(question.Exam_Name || '').trim().toLocaleLowerCase() === examName.toLocaleLowerCase() ||
            normalized(question.Subject) === normalized(examName));
    }
    if (candidates.length !== total || attempted > total) return null;

    const marks = candidates.map(question => Number(question.Mark) || 1);
    const negatives = candidates.map(question => Number(question.Negative_Mark) || 0);
    if (!marks.length || !marks.every(mark => mark === marks[0]) || !negatives.every(mark => mark === negatives[0])) return null;
    const positiveMark = marks[0];
    const negativeMark = negatives[0];
    const score = Number(result.Score);
    if (!Number.isFinite(score) || positiveMark + negativeMark === 0) return null;
    const exactRight = (score + attempted * negativeMark) / (positiveMark + negativeMark);
    const right = Math.round(exactRight);
    if (Math.abs(exactRight - right) > 0.001 || right < 0 || right > attempted) return null;
    return { right, wrong: attempted - right, missed: total - attempted };
}

// Result Delete Logic
async function deleteResult(rowIndex) {
    if (confirm("Are you sure you want to delete this exam record permanently?")) {
        try {
            const res = await saveData("Results", [], "delete", rowIndex);
            if (res.status === "success") {
                alert("Result record deleted successfully!");
                loadResultsTable(); 
            } else {
                alert("Error deleting result!");
            }
        } catch (e) {
            alert("Server connection error!");
        }
    }
}
