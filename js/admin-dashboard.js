let dashboardStudents = [];

function escapeAdminDashboardText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderPendingStudentNotifications(students) {
    dashboardStudents = Array.isArray(students) ? students : [];
    const pending = dashboardStudents
        .map((student, index) => ({ student, index }))
        .filter(({ student }) => String(student.Status || '').trim().toLowerCase() === 'pending');
    const badge = document.getElementById('pending-student-count');
    const list = document.getElementById('pending-student-list');
    badge.textContent = pending.length;
    badge.style.display = pending.length ? 'grid' : 'none';

    if (!pending.length) {
        list.innerHTML = '<p class="pending-empty">No pending registrations.</p>';
        return;
    }

    list.innerHTML = pending.map(({ student, index }) => `<div class="pending-student">
        <div><strong>${escapeAdminDashboardText(student.Name || 'Student')}</strong><small>${escapeAdminDashboardText(student.Student_ID || student.Phone || '')}</small></div>
        <button type="button" class="pending-approve" data-approve-student="${index}">Approve</button>
    </div>`).join('');
    list.querySelectorAll('[data-approve-student]').forEach(button => button.addEventListener('click', () => approvePendingStudent(Number(button.dataset.approveStudent), button)));
}

async function refreshPendingStudentNotifications() {
    const list = document.getElementById('pending-student-list');
    list.innerHTML = '<p class="pending-empty">Checking registrations...</p>';
    try {
        const students = await fetchData('Students', { forceRefresh: true });
        renderPendingStudentNotifications(students);
        document.getElementById('total-students').textContent = students.filter(student => String(student.Status || '').trim().toLowerCase() === 'active').length;
    } catch (_) {
        list.innerHTML = '<p class="pending-empty">Could not check registrations. Try again.</p>';
    }
}

async function approvePendingStudent(index, button) {
    const student = dashboardStudents[index];
    if (!student || String(student.Status || '').trim().toLowerCase() !== 'pending') return;
    button.disabled = true;
    button.textContent = 'Approving…';
    const rowIndex = Number(student._rowIndex) || index + 2;
    const row = [student.Student_ID, student.Name, student.Phone, student.Password, 'Active', student.Email || ''];
    try {
        const result = await saveData('Students', row, 'update', rowIndex);
        if (result.status !== 'success') throw new Error('Approval was not saved');
        const students = await fetchData('Students', { forceRefresh: true });
        renderPendingStudentNotifications(students);
        document.getElementById('total-students').textContent = students.filter(item => String(item.Status || '').trim().toLowerCase() === 'active').length;
    } catch (_) {
        button.disabled = false;
        button.textContent = 'Approve';
        alert('Could not approve this student. Please try again.');
    }
}

window.onload = async () => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const brandName = localStorage.getItem('Brand_Name')?.trim() || 'Admin';
    document.getElementById('greeting-name').textContent = `${greeting}, ${brandName}`;
    const updateDateTime = () => {
        const current = new Date();
        document.getElementById('current-date').textContent = current.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
        document.getElementById('current-time').textContent = current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };
    updateDateTime();
    setInterval(updateDateTime, 1000);

    const notificationButton = document.getElementById('admin-notifications-button');
    const notificationPanel = document.getElementById('admin-notifications-panel');
    notificationButton.addEventListener('click', () => {
        const isOpen = notificationPanel.classList.toggle('open');
        notificationButton.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) refreshPendingStudentNotifications();
    });

    try {
        const [questionsData, studentsData, examsData, settingsData] = await Promise.all([
            fetchData("Questions"), fetchData("Students"), fetchData("Exams"), fetchData("Settings")
        ]);
        renderPendingStudentNotifications(studentsData);
        const settings = Array.isArray(settingsData) ? settingsData : (Array.isArray(settingsData?.value) ? settingsData.value : []);
        const savedBrandName = [...settings].reverse().find(setting => setting.Setting_Name === 'Brand_Name')?.Setting_Value;
        const finalBrandName = String(savedBrandName || localStorage.getItem('Brand_Name') || 'Admin').trim();
        if (finalBrandName !== 'Admin') localStorage.setItem('Brand_Name', finalBrandName);
        document.getElementById('greeting-name').textContent = `${greeting}, ${finalBrandName}`;
        document.getElementById("total-questions").innerText = questionsData?.length || 0;
        document.getElementById("total-students").innerText = (studentsData || [])
            .filter(student => String(student.Status || '').trim().toLowerCase() === 'active').length;
        document.getElementById("total-exams").innerText = examsData?.length || 0;
        refreshPendingStudentNotifications();
        setInterval(() => {
            if (!document.hidden) refreshPendingStudentNotifications();
        }, 30000);
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
        document.getElementById("total-questions").innerText = '—';
        document.getElementById("total-students").innerText = '—';
        document.getElementById("total-exams").innerText = '—';
    }
};
