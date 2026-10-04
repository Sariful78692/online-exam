(function () {
    var root = document.createElement('div');
    root.className = 'page-loader';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-label', 'Loading page');
    root.innerHTML = '<div class="page-loader__card"><div class="page-loader__mark"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></div><span>Preparing your exam portal</span><span class="page-loader__dots" aria-hidden="true"><i></i><i></i><i></i></span></div>';
    document.body.prepend(root);

    var started = Date.now();
    function dismiss() {
        var wait = Math.max(0, 550 - (Date.now() - started));
        window.setTimeout(function () {
            root.classList.add('is-leaving');
            window.setTimeout(function () { root.remove(); }, 500);
        }, wait);
    }
    if (document.readyState === 'complete') dismiss();
    else window.addEventListener('load', dismiss, { once: true });

    var actionLoader;
    var actionTimer;
    var actionMessages = ['Just a moment…', 'Working on it…', 'Almost ready…'];

    function showActionLoader() {
        if (!actionLoader) {
            actionLoader = document.createElement('div');
            actionLoader.className = 'action-loader';
            actionLoader.setAttribute('role', 'status');
            actionLoader.setAttribute('aria-live', 'polite');
            actionLoader.innerHTML = '<div class="action-loader__card"><span class="action-loader__orbit"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span><span class="action-loader__text"></span><span class="action-loader__bar"><i></i></span></div>';
            document.body.appendChild(actionLoader);
        }
        actionLoader.querySelector('.action-loader__text').textContent = actionMessages[Math.floor(Math.random() * actionMessages.length)];
        actionLoader.classList.add('is-visible');
        clearTimeout(actionTimer);
        actionTimer = setTimeout(function () { actionLoader.classList.remove('is-visible'); }, 850);
    }

    document.addEventListener('click', function (event) {
        if (event.button && event.button !== 0) return;
        var button = event.target.closest('button, input[type="button"], input[type="submit"], [role="button"]');
        if (!button || button.disabled || button.dataset.skipLoader !== undefined) return;
        showActionLoader();
    });
})();
