const timeForm = document.getElementById('time-setting-form');
if (timeForm) {
    timeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('time-btn');
        const newTime = document.getElementById('global-time').value;
        button.disabled = true;
        button.textContent = 'Updating...';
        try {
            const result = await saveSetting('Total_Time', newTime);
            if (result.status !== 'success') throw new Error('Update failed');
            timeForm.reset();
        } catch (_) {
            // saveSetting already reports write errors with a toast.
        } finally {
            button.textContent = 'Update Time';
            button.disabled = false;
        }
    });
}

const fontForm = document.getElementById('font-setting-form');
if (fontForm) {
    fontForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('font-btn');
        const newSize = document.getElementById('global-font-size').value;
        button.disabled = true;
        button.textContent = 'Updating...';
        try {
            const result = await saveSetting('Font_Size', newSize);
            if (result.status !== 'success') throw new Error('Update failed');
            fontForm.reset();
        } catch (_) {
            // saveSetting already reports write errors with a toast.
        } finally {
            button.textContent = 'Update Font Size';
            button.disabled = false;
        }
    });
}
