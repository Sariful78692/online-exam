(() => {
    const storageKey = 'onlineExamTheme';
    let savedTheme = 'light';
    try {
        savedTheme = localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
    } catch (_) {}
    document.documentElement.dataset.theme = savedTheme;

    const mountToggle = () => {
        if (document.querySelector('.theme-toggle')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Switch color theme');
        const render = () => {
            const dark = document.documentElement.dataset.theme === 'dark';
            button.innerHTML = `<i class="fa-solid ${dark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i><span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
            button.setAttribute('aria-pressed', String(dark));
        };
        button.addEventListener('click', () => {
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem(storageKey, next); } catch (_) {}
            render();
        });
        render();
        document.body.appendChild(button);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
    else mountToggle();
})();
