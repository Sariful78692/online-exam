window.onload = async () => {
    // আজকের তারিখ সেট করা
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    document.getElementById("current-date").innerText = new Date().toLocaleDateString('en-GB', options);

    try {
        // Promise.all ব্যবহার করে একইসাথে ৩টি শিট থেকে ডেটা কল করা হচ্ছে (এতে পেজ দ্রুত লোড হবে)
        const [questionsData, studentsData, resultsData] = await Promise.all([
            fetchData("Questions"),
            fetchData("Students"),
            fetchData("Results")
        ]);

        // 1. Total Questions আপডেট
        document.getElementById("total-questions").innerText = questionsData ? questionsData.length : 0;

        // 2. Active Students আপডেট
        document.getElementById("total-students").innerText = studentsData ? studentsData.length : 0;

        // 3. Total Exams Taken আপডেট
        document.getElementById("total-exams").innerText = resultsData ? resultsData.length : 0;

        // 4. Recent Test Results টেবিল আপডেট
        const tbody = document.getElementById("recent-results-body");
        tbody.innerHTML = "";

        if (!resultsData || resultsData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">কোনো পরীক্ষার ফলাফল পাওয়া যায়নি।</td></tr>`;
            return;
        }

        // শেষের দিক থেকে (সর্বশেষ) ৫টি রেজাল্ট দেখানোর জন্য রিভার্স করা হলো
        const recentResults = resultsData.slice(-5).reverse();

        recentResults.forEach(result => {
            // রেজাল্টের কালার লজিক (পাস/ফেল বুঝতে সুবিধা হবে)
            const scoreColor = parseFloat(result.Score) > 0 ? '#10b981' : '#ef4444'; 

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937;">
                    <td style="padding: 12px 10px; font-weight: 500;">${result.Student_ID || '-'}</td>
                    <td style="padding: 12px 10px;">${result.Subject || '-'}</td>
                    <td style="padding: 12px 10px;">${result.Total_Questions || '-'}</td>
                    <td style="padding: 12px 10px; font-weight: bold; color: ${scoreColor};">${result.Score || '0'}</td>
                    <td style="padding: 12px 10px; color: #6b7280; font-size: 12px;">${result.Date || '-'}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
        document.getElementById("recent-results-body").innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">ডেটা লোড করতে সমস্যা হয়েছে! ইন্টারনেট কানেকশন চেক করুন।</td></tr>`;
    }
};