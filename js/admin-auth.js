(() => {
    if (sessionStorage.getItem('adminAuthenticated') !== 'true') {
        window.location.replace('login.html');
        return;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof fetchData === 'function') {
            const data = await fetchData('Settings');
            const settings = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
            const brandName = [...settings].reverse().find(row => row.Setting_Name === 'Brand_Name')?.Setting_Value;
            if (brandName) {
                localStorage.setItem('Brand_Name', String(brandName).trim());
                document.querySelectorAll('.logo-area,.logo').forEach(element => {
                    const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
                    if (textNode) textNode.textContent = ` ${brandName}`;
                });
            }
        }
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || sidebar.querySelector('.admin-logout')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'admin-logout';
        button.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Logout';
        button.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:#6b7280;text-align:left;font:500 14px Inter,sans-serif;cursor:pointer;';
        button.addEventListener('mouseenter', () => { button.style.background = '#fef2f2'; button.style.color = '#dc2626'; });
        button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; button.style.color = '#6b7280'; });
        button.addEventListener('click', () => {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.replace('login.html');
        });
        sidebar.appendChild(button);
    });
})();
