const RE_EXAM_PREFIX = 'ReExam_Request:';
let reExamSettings = [];
const escapeReExam = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function loadReExamRequests() {
    const body = document.getElementById('re-exam-requests');
    try {
        const rows = await fetchData('Settings', { forceRefresh: true });
        reExamSettings = (Array.isArray(rows) ? rows : []).map((row, index) => ({ row, rowIndex: Number(row._rowIndex) || index + 2 }))
            .filter(item => String(item.row.Setting_Name || '').startsWith(RE_EXAM_PREFIX));
        const requests = reExamSettings.map(item => { try { return { ...item, request: JSON.parse(item.row.Setting_Value || '{}') }; } catch (_) { return null; } }).filter(Boolean).reverse();
        body.innerHTML = requests.length ? requests.map((item, index) => { const request = item.request; const status = String(request.status || 'Pending'); const pending = status.toLowerCase() === 'pending'; return `<tr><td><b>${escapeReExam(request.studentName || 'Student')}</b><br><small>${escapeReExam(request.studentId || '')}</small></td><td>${escapeReExam(request.examName || '')}</td><td>${escapeReExam(request.requestedAt || '—')}</td><td class="status">${escapeReExam(status)}</td><td>${pending ? `<button class="approve" data-action="Approved" data-index="${index}">Approve</button> <button class="reject" data-action="Rejected" data-index="${index}">Reject</button>` : '—'}</td></tr>`; }).join('') : '<tr><td colspan="5" class="empty">No re-exam requests found.</td></tr>';
        body.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => { const status = button.dataset.action; const note = status === 'Rejected' ? window.prompt('Why are you rejecting this re-exam request?') : ''; if (status === 'Rejected' && !String(note || '').trim()) return; updateRequest(requests[Number(button.dataset.index)], status, note); }));
    } catch (_) { body.innerHTML = '<tr><td colspan="5" class="empty">Could not load requests.</td></tr>'; }
}
async function updateRequest(item, status, rejectionNote = '') {
    const request = { ...item.request, status, reviewedAt: new Date().toLocaleString(), rejectionNote: status === 'Rejected' ? rejectionNote.trim() : '' };
    const response = await saveData('Settings', [item.row.Setting_Name, JSON.stringify(request)], 'update', item.rowIndex, { silent: true });
    if (response.status === 'success') { showAppToast(`Request ${status.toLowerCase()}.`); loadReExamRequests(); } else showAppToast('Could not update request.', 'error');
}
window.addEventListener('load', loadReExamRequests);