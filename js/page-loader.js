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
})();
