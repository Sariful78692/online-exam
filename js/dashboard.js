window.onload = async () => {
    try {
        // Promise.all er maddhome 3 ti request eksathe pathano hochhe (Loading Time 3x Fast hobe)
        const [questionsData, studentsData, resultsData] = await Promise.all([
            fetchData("Questions"),
            fetchData("Students"),
            fetchData("Results")
        ]);

        // Card e data bosano
        document.getElementById('total-questions').innerText = questionsData.length > 0 ? questionsData.length : 0;
        document.getElementById('total-students').innerText = studentsData.length > 0 ? studentsData.length : 0;
        document.getElementById('total-results').innerText = resultsData.length > 0 ? resultsData.length : 0;

        // Chart er jonno data toiri kora
        if (questionsData.length > 0) {
            const subjectCounts = {};
            questionsData.forEach(q => {
                const sub = q.Subject;
                if(sub) {
                    subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
                }
            });

            const labels = Object.keys(subjectCounts);
            const data = Object.values(subjectCounts);

            const ctx = document.getElementById('subjectChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'প্রশ্নের সংখ্যা',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });
        } else {
            document.getElementById('subjectChart').parentElement.innerHTML = "<p>চার্ট দেখানোর জন্য পর্যাপ্ত প্রশ্ন নেই।</p>";
        }

    } catch (error) {
        console.error("Dashboard data load error:", error);
        document.getElementById('total-questions').innerText = "Error";
        document.getElementById('total-students').innerText = "Error";
        document.getElementById('total-results').innerText = "Error";
    }
};