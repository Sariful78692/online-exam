let questions = [];
let exams = [];
let currentQuestionPage = 1;
const QUESTIONS_PER_PAGE = 10;
let activeMathOptionId = 'opt_a';
let structureItems = [];
let structureDrawMode = 'bond';
let structurePointerStart = null;
let structureTarget = 'option';
let selectedStructureIndex = -1;
let structureEditDrag = null;

function isQuestionExamConfig(exam) {
    const status = String(exam?.Status || '').trim().toLocaleLowerCase();
    return status !== 'combined' && status !== 'inactive';
}

window.onload = async () => {
    initializeExtendedMathPalette();
    document.getElementById('question-type').addEventListener('change', updateQuestionTypeHelp);
    document.getElementById('question').addEventListener('input', updateMathPreview);
    document.getElementById('question').addEventListener('keydown', moveFractionCursorOnTab);
    document.querySelectorAll('#math-tools .math-tool').forEach(button => button.addEventListener('click', insertMathTemplate));
    setupOptionMathTools();
    setupMathSymbolPopup();
    setupChemicalStructureDrawer();
    setupStructureDrawingPopup();
    document.getElementById('draw-question-diagram').addEventListener('click', () => {
        openStructureDrawingPopup('Question geometry diagram', 'question');
    });
    document.getElementById('image_url').addEventListener('input', updateQuestionImagePreview);
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach(id => {
        const input = document.getElementById(id);
        const type = document.getElementById(`${id}_type`);
        input.addEventListener('focus', () => { activeMathOptionId = id; updateOptionMathPreview(); });
        input.addEventListener('input', updateOptionMathPreview);
        input.addEventListener('keydown', moveFractionCursorOnTab);
        type.addEventListener('change', () => { activeMathOptionId = id; updateOptionMathPreview(); });
        type.addEventListener('click', () => {
            activeMathOptionId = id;
            if (type.value === 'image') { structureTarget = 'option'; updateOptionMathPreview(); }
        });
    });
    await loadQuestionExams();
    await loadQuestions();
    await restoreQuestionFormDefaults();
};

function setupMathSymbolPopup() {
    const dialog = document.getElementById('math-symbol-dialog');
    const content = document.getElementById('math-dialog-content');
    let activeToolbar = null;
    let placeholder = null;
    let returnFocus = null;
    const open = (toolbar, title, input) => {
        if (dialog.open) return;
        activeToolbar = toolbar;
        returnFocus = input;
        placeholder = document.createComment('math toolbar position');
        toolbar.parentNode.insertBefore(placeholder, toolbar);
        content.appendChild(toolbar);
        toolbar.classList.add('visible', 'popup-toolbar');
        document.getElementById('math-dialog-title').textContent = title;
        dialog.classList.remove('closing');
        dialog.showModal();
    };
    document.getElementById('question-math-launcher').addEventListener('click', () =>
        open(document.getElementById('math-tools'), 'Question math symbols', document.getElementById('question')));
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach(id => {
        document.getElementById(`${id}_math_launcher`).addEventListener('click', () => {
            activeMathOptionId = id;
            open(document.getElementById('option-math-tools'), `Option ${id.slice(-1).toUpperCase()} math symbols`, document.getElementById(id));
        });
    });
    document.querySelector('.math-dialog-close').addEventListener('click', closeMathSymbolDialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeMathSymbolDialog(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) closeMathSymbolDialog(); });
    const heading = document.querySelector('.math-dialog-heading');
    let dragOffset = null;
    heading.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        const rect = dialog.getBoundingClientRect();
        dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        dialog.style.position = 'fixed';
        dialog.style.margin = '0';
        dialog.style.left = `${rect.left}px`;
        dialog.style.top = `${rect.top}px`;
        heading.setPointerCapture(event.pointerId);
    });
    heading.addEventListener('pointermove', event => {
        if (!dragOffset) return;
        const rect = dialog.getBoundingClientRect();
        const left = Math.max(0, Math.min(window.innerWidth - rect.width, event.clientX - dragOffset.x));
        const top = Math.max(0, Math.min(window.innerHeight - rect.height, event.clientY - dragOffset.y));
        dialog.style.left = `${left}px`;
        dialog.style.top = `${top}px`;
    });
    const stopDragging = () => { dragOffset = null; };
    heading.addEventListener('pointerup', stopDragging);
    heading.addEventListener('pointercancel', stopDragging);
    dialog.addEventListener('close', () => {
        if (activeToolbar && placeholder?.parentNode) placeholder.parentNode.insertBefore(activeToolbar, placeholder);
        placeholder?.remove();
        activeToolbar?.classList.remove('visible', 'popup-toolbar');
        activeToolbar = null;
        placeholder = null;
        returnFocus?.focus();
        returnFocus = null;
        dialog.classList.remove('closing');
    });
    function closeMathSymbolDialog() {
        if (!dialog.open || dialog.classList.contains('closing')) return;
        dialog.classList.add('closing');
        setTimeout(() => { if (dialog.open) dialog.close(); }, 180);
    }
}

function setupStructureDrawingPopup() {
    const dialog = document.getElementById('structure-dialog');
    const content = document.getElementById('structure-dialog-content');
    const drawer = document.getElementById('structure-drawer');
    let placeholder = null;
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach(id => {
        document.getElementById(`${id}_image_launcher`).addEventListener('click', () => {
            activeMathOptionId = id;
            openStructureDrawingPopup(`Option ${id.slice(-1).toUpperCase()} drawing`, 'option');
        });
    });
    document.querySelector('.structure-dialog-close').addEventListener('click', closeStructureDrawingPopup);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeStructureDrawingPopup(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) closeStructureDrawingPopup(); });
    dialog.addEventListener('close', () => {
        if (placeholder?.parentNode) placeholder.parentNode.insertBefore(drawer, placeholder);
        placeholder?.remove();
        placeholder = null;
        drawer.style.display = 'none';
        dialog.classList.remove('closing');
    });
    const heading = document.querySelector('.structure-dialog-heading');
    let dragOffset = null;
    heading.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        const rect = dialog.getBoundingClientRect();
        dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        dialog.style.position = 'fixed'; dialog.style.margin = '0';
        dialog.style.left = `${rect.left}px`; dialog.style.top = `${rect.top}px`;
        heading.setPointerCapture(event.pointerId);
    });
    heading.addEventListener('pointermove', event => {
        if (!dragOffset) return;
        const rect = dialog.getBoundingClientRect();
        dialog.style.left = `${Math.max(0, Math.min(innerWidth - rect.width, event.clientX - dragOffset.x))}px`;
        dialog.style.top = `${Math.max(0, Math.min(innerHeight - rect.height, event.clientY - dragOffset.y))}px`;
    });
    const stopDragging = () => { dragOffset = null; };
    heading.addEventListener('pointerup', stopDragging);
    heading.addEventListener('pointercancel', stopDragging);

    window.openStructureDrawingPopup = (title, target) => {
        structureTarget = target;
        document.getElementById('structure-dialog-title').textContent = title;
        placeholder = document.createComment('drawing editor position');
        drawer.parentNode.insertBefore(placeholder, drawer);
        content.appendChild(drawer);
        drawer.style.display = 'flex';
        dialog.classList.remove('closing');
        dialog.showModal();
    };
    window.closeStructureDrawingPopup = closeStructureDrawingPopup;
    function closeStructureDrawingPopup() {
        if (!dialog.open || dialog.classList.contains('closing')) return;
        dialog.classList.add('closing');
        setTimeout(() => { if (dialog.open) dialog.close(); }, 180);
    }
}

function initializeExtendedMathPalette() {
    const toolbar = document.getElementById('math-tools');
    const palette = document.createElement('details');
    palette.className = 'extended-math-palette';
    palette.innerHTML = '<summary>More math symbols</summary><div class="extended-math-groups"></div>';
    const groups = palette.querySelector('.extended-math-groups');
    const symbolGroups = [
        ['Common operators', [
            ['+', '+'], ['−', '-'], ['÷', '\\div'], ['×', '\\times'], ['±', '\\pm'], ['∓', '\\mp'], ['∝', '\\propto'], ['∗', '\\ast'], ['∘', '\\circ'], ['∙', '\\bullet'], ['⋅', '\\cdot'], ['∩', '\\cap'], ['∪', '\\cup'], ['⊎', '\\uplus'], ['⊓', '\\sqcap'], ['⊔', '\\sqcup'], ['∧', '\\land'], ['∨', '\\lor'], ['⊕', '\\oplus'], ['⊗', '\\otimes'], ['⊙', '\\odot'], ['⋆', '\\star']
        ]],
        ['Advanced operators', [
            ['∖', '\\setminus'], ['⋄', '\\diamond'], ['⋈', '\\bowtie'], ['≀', '\\wr'], ['⨿', '\\amalg'], ['⋉', '\\ltimes'], ['⋊', '\\rtimes'], ['⋋', '\\leftthreetimes'], ['⋌', '\\rightthreetimes'], ['◁', '\\triangleleft'], ['▷', '\\triangleright'], ['⊴', '\\unlhd'], ['⊵', '\\unrhd'], ['†', '\\dagger'], ['‡', '\\ddagger'], ['⊞', '\\boxplus'], ['⊟', '\\boxminus'], ['⊠', '\\boxtimes'], ['⊡', '\\boxdot'], ['⋒', '\\Cap'], ['⋓', '\\Cup'], ['⊼', '\\barwedge'], ['⊻', '\\veebar'], ['⋏', '\\curlywedge'], ['⋎', '\\curlyvee'], ['⨸', '\\divideontimes']
        ]],
        ['Relations and sets', [
            ['=', '='], ['≠', '\\ne'], ['<', '<'], ['>', '>'], ['≤', '\\le'], ['≥', '\\ge'], ['≪', '\\ll'], ['≫', '\\gg'], ['∈', '\\in'], ['∋', '\\ni'], ['∉', '\\notin'], ['⊂', '\\subset'], ['⊃', '\\supset'], ['⊆', '\\subseteq'], ['⊇', '\\supseteq'], ['⊄', '\\nsubset'], ['⊈', '\\nsubseteq'], ['≃', '\\simeq'], ['≅', '\\cong'], ['≡', '\\equiv'], ['≈', '\\approx'], ['∼', '\\sim'], ['≍', '\\asymp'], ['∥', '\\parallel'], ['⊥', '\\perp'], ['∣', '\\mid'], ['∤', '\\nmid'], ['≺', '\\prec'], ['≻', '\\succ'], ['≼', '\\preceq'], ['≽', '\\succeq'], ['∝', '\\propto'], ['∴', '\\therefore'], ['∵', '\\because']
        ]],
        ['Advanced relations', [
            ['≐', '\\doteq'], ['≑', '\\doteqdot'], ['≖', '\\eqcirc'], ['≗', '\\circeq'], ['≜', '\\triangleq'], ['≲', '\\lesssim'], ['≳', '\\gtrsim'], ['≶', '\\lessgtr'], ['≷', '\\gtrless'], ['≦', '\\leqq'], ['≧', '\\geqq'], ['⪅', '\\lessapprox'], ['⪆', '\\gtrapprox'], ['≊', '\\approxeq'], ['⋚', '\\lesseqgtr'], ['⋛', '\\gtreqless'], ['≪', '\\lll'], ['≫', '\\ggg'], ['⊏', '\\sqsubset'], ['⊐', '\\sqsupset'], ['⊑', '\\sqsubseteq'], ['⊒', '\\sqsupseteq'], ['⋈', '\\bowtie'], ['⋉', '\\ltimes'], ['⋊', '\\rtimes']
        ]],
        ['Large operators', [
            ['∑', '\\sum_{i=1}^{n}'], ['∏', '\\prod_{i=1}^{n}'], ['∐', '\\coprod'], ['∫', '\\int'], ['∬', '\\iint'], ['∭', '\\iiint'], ['∮', '\\oint'], ['⋃', '\\bigcup'], ['⋂', '\\bigcap'], ['⋁', '\\bigvee'], ['⋀', '\\bigwedge'], ['⨁', '\\bigoplus'], ['⨂', '\\bigotimes']
        ]],
        ['Negated relations', [
            ['≠', '\\ne'], ['≮', '\\nless'], ['≯', '\\ngtr'], ['≰', '\\nleq'], ['≱', '\\ngeq'], ['⊄', '\\nsubset'], ['⊅', '\\nsupset'], ['⊈', '\\nsubseteq'], ['⊉', '\\nsupseteq'], ['≁', '\\nsim'], ['≄', '\\nsimeq'], ['≇', '\\ncong'], ['≉', '\\napprox'], ['∦', '\\nparallel'], ['∤', '\\nmid'], ['⊬', '\\nvdash'], ['⊭', '\\nvDash']
        ]],
        ['Arrows', [
            ['←', '\\leftarrow'], ['→', '\\rightarrow'], ['↑', '\\uparrow'], ['↓', '\\downarrow'], ['↔', '\\leftrightarrow'], ['↕', '\\updownarrow'], ['⇐', '\\Leftarrow'], ['⇒', '\\Rightarrow'], ['⇑', '\\Uparrow'], ['⇓', '\\Downarrow'], ['⇔', '\\Leftrightarrow'], ['↦', '\\mapsto'], ['↗', '\\nearrow'], ['↘', '\\searrow'], ['↙', '\\swarrow'], ['↖', '\\nwarrow'], ['↪', '\\hookrightarrow'], ['↩', '\\hookleftarrow'], ['⟶', '\\longrightarrow'], ['⟵', '\\longleftarrow'], ['⟹', '\\Longrightarrow'], ['⟺', '\\Longleftrightarrow'], ['↻', '\\circlearrowright'], ['↺', '\\circlearrowleft']
        ]],
        ['Geometry and logic', [
            ['∠', '\\angle'], ['∡', '\\measuredangle'], ['∢', '\\sphericalangle'], ['△', '\\triangle'], ['□', '\\square'], ['∟', '\\rightangle'], ['°', '^\\circ'], ['′', "^{\\prime}"], ['∴', '\\therefore'], ['∵', '\\because'], ['∀', '\\forall'], ['∃', '\\exists'], ['∄', '\\nexists'], ['¬', '\\neg'], ['ℵ', '\\aleph'], ['∞', '\\infty']
        ]],
        ['Brackets', [
            ['(□)', '\\left(\\right)', 6], ['[□]', '\\left[\\right]', 6], ['{□}', '\\left\\{\\right\\}', 7], ['⟨□⟩', '\\left\\langle\\right\\rangle', 12],
            ['⌊□⌋', '\\left\\lfloor\\right\\rfloor', 11], ['⌈□⌉', '\\left\\lceil\\right\\rceil', 11], ['|□|', '\\left\\lvert\\right\\rvert', 11], ['‖□‖', '\\left\\Vert\\right\\Vert', 10],
            ['[□)', '\\left[\\right)', 6], ['(□]', '\\left(\\right]', 6], ['{□)', '\\left\\{\\right)', 7], ['(□}', '\\left(\\right\\}', 6],
            ['⌈□)', '\\left\\lceil\\right)', 11], ['(□⌉', '\\left(\\right\\rceil', 6], ['⌊□]', '\\left\\lfloor\\right]', 11], ['[□⌋', '\\left[\\right\\rfloor', 6],
            ['(□|□)', '\\left(\\middle|\\right)', 6], ['{□|□}', '\\left\\{\\middle|\\right\\}', 7], ['⟨□|□⟩', '\\left\\langle\\middle|\\right\\rangle', 12], ['⟨□|□|□⟩', '\\left\\langle\\middle|\\middle|\\right\\rangle', 12]
        ]],
        ['Single brackets', [
            ['(□', '\\left(\\right.', 6], ['□)', '\\left.\\right)', 6], ['[□', '\\left[\\right.', 6], ['□]', '\\left.\\right]', 6],
            ['{□', '\\left\\{\\right.', 7], ['□}', '\\left.\\right\\}', 6], ['⟨□', '\\left\\langle\\right.', 12], ['□⟩', '\\left.\\right\\rangle', 6],
            ['⌊□', '\\left\\lfloor\\right.', 11], ['□⌋', '\\left.\\right\\rfloor', 6], ['⌈□', '\\left\\lceil\\right.', 11], ['□⌉', '\\left.\\right\\rceil', 6],
            ['|□', '\\left\\lvert\\right.', 11], ['□|', '\\left.\\right\\rvert', 6], ['‖□', '\\left\\Vert\\right.', 10], ['□‖', '\\left.\\right\\Vert', 6],
            ['⌜□', '\\left\\ulcorner\\right.', 12], ['□⌝', '\\left.\\right\\urcorner', 6], ['⌞□', '\\left\\llcorner\\right.', 12], ['□⌟', '\\left.\\right\\lrcorner', 6]
        ]],
        ['Cases and stacks', [
            ['Cases', '\\begin{cases}{}&{}\\\\{}&{}\\end{cases}', 14], ['3 cases', '\\begin{cases}{}\\{}\\{}\\end{cases}', 14],
            ['2 rows', '\\begin{matrix}{}\\\\{}\\end{matrix}', 14], ['(matrix)', '\\begin{pmatrix}{}\\\\{}\\end{pmatrix}', 15],
            ['[matrix]', '\\begin{bmatrix}{}\\\\{}\\end{bmatrix}', 15], ['|matrix|', '\\begin{vmatrix}{}\\\\{}\\end{vmatrix}', 15],
            ['‖matrix‖', '\\begin{Vmatrix}{}\\\\{}\\end{Vmatrix}', 15], ['n choose k', '\\binom{}{}', 7]
        ]]
    ];
    symbolGroups.forEach(([title, symbols]) => {
        const section = document.createElement('section');
        section.className = 'extended-math-group';
        const heading = document.createElement('strong');
        heading.textContent = title;
        const row = document.createElement('div');
        row.className = 'extended-math-buttons';
        symbols.forEach(([label, latex, cursor]) => row.appendChild(createMathPaletteButton(label, latex, cursor)));
        section.append(heading, row);
        groups.appendChild(section);
    });
    [['Script', '\\mathcal'], ['Fraktur', '\\mathfrak'], ['Double-struck', '\\mathbb']].forEach(([title, command]) => {
        const section = document.createElement('section');
        section.className = 'extended-math-group';
        const heading = document.createElement('strong'); heading.textContent = `${title} letters`;
        const row = document.createElement('div'); row.className = 'extended-math-buttons';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('').forEach(letter => {
            row.appendChild(createMathPaletteButton(letter, `${command}{${letter}}`));
        });
        section.append(heading, row); groups.appendChild(section);
    });
    toolbar.appendChild(palette);
}

function createMathPaletteButton(label, latex, cursor) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'math-tool extended-math-symbol';
    button.textContent = label;
    button.title = latex;
    button.dataset.template = latex;
    if (cursor !== undefined) button.dataset.cursor = String(cursor);
    return button;
}

function moveFractionCursorOnTab(event) {
    if (event.key !== 'Tab') return;
    const input = event.currentTarget;
    const isMath = input.id === 'question'
        ? document.getElementById('question-type').value === 'math'
        : document.getElementById(`${input.id}_type`).value === 'math';
    if (!isMath) return;

    const cursor = input.selectionStart;
    const fractionPattern = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;
    let match;
    while ((match = fractionPattern.exec(input.value))) {
        const numeratorStart = match.index + match[0].indexOf('{') + 1;
        const denominatorStart = match.index + match[0].lastIndexOf('{') + 1;
        const numeratorEnd = numeratorStart + match[1].length;
        const denominatorEnd = denominatorStart + match[2].length;
        const inFraction = cursor >= numeratorStart && cursor <= denominatorEnd;
        if (inFraction) {
            event.preventDefault();
            if (cursor <= numeratorEnd) {
                input.setSelectionRange(denominatorStart, denominatorEnd);
            } else {
                input.setSelectionRange(denominatorStart, denominatorEnd);
            }
            return;
        }
    }
    const firstFraction = fractionPattern.exec(input.value);
    if (firstFraction) {
        event.preventDefault();
        const numeratorStart = firstFraction.index + firstFraction[0].indexOf('{') + 1;
        const numeratorEnd = numeratorStart + firstFraction[1].length;
        input.setSelectionRange(numeratorStart, numeratorEnd);
    }
}

function setupOptionMathTools() {
    const container = document.getElementById('option-math-tools');
    container.innerHTML = document.getElementById('math-tools').innerHTML;
    container.querySelectorAll('.math-tool').forEach(button => button.addEventListener('click', event => {
        const input = document.getElementById(activeMathOptionId);
        if (document.getElementById(`${activeMathOptionId}_type`).value !== 'math') return;
        input.focus();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const template = event.currentTarget.dataset.template || '';
        input.setRangeText(template, start, end, 'end');
        const offset = event.currentTarget.dataset.cursor;
        if (offset !== undefined) input.setSelectionRange(start + Number(offset), start + Number(offset));
        updateOptionMathPreview();
    }));
    updateOptionMathPreview();
}

function updateOptionMathPreview() {
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach(id => {
        const input = document.getElementById(id);
        const type = document.getElementById(`${id}_type`).value;
        const preview = document.getElementById(`${id}_preview`);
        const text = input.value.trim();
        const mathLauncher = document.getElementById(`${id}_math_launcher`);
        mathLauncher.style.display = type === 'math' ? 'inline-block' : 'none';
        preview.replaceChildren();
        preview.style.display = (type === 'math' && text) || (type === 'image' && text) ? 'block' : 'none';
        if (type === 'image' && text) {
            try {
                const isDataImage = /^data:image\/(png|jpeg|webp);base64,/i.test(text);
                const url = isDataImage ? null : new URL(text);
                if (isDataImage || ['http:', 'https:'].includes(url.protocol)) {
                    const image = document.createElement('img');
                    image.src = isDataImage ? text : url.href;
                    image.alt = `${id.slice(-1).toUpperCase()} option image preview`;
                    image.style.maxWidth = '220px';
                    image.style.maxHeight = '160px';
                    preview.appendChild(image);
                }
            } catch (_) {}
        } else if (type === 'math' && text) {
            preview.textContent = `\\(${text}\\)`;
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetClear?.([preview]);
                window.MathJax.typesetPromise([preview]).catch(() => {});
            }
        }
    });
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach(id => {
        const launcher = document.getElementById(`${id}_image_launcher`);
        const isImage = document.getElementById(`${id}_type`).value === 'image';
        launcher.style.display = isImage ? 'inline-block' : 'none';
        launcher.textContent = `Open drawing canvas for Option ${id.slice(-1).toUpperCase()}`;
    });
}

function updateQuestionImagePreview() {
    const value = document.getElementById('image_url').value.trim();
    const preview = document.getElementById('question-image-preview');
    preview.replaceChildren();
    preview.style.display = value ? 'block' : 'none';
    if (!value) return;
    try {
        const isDataImage = /^data:image\/(png|jpeg|webp);base64,/i.test(value);
        const url = isDataImage ? null : new URL(value);
        if (!isDataImage && !['http:', 'https:'].includes(url.protocol)) return;
        const image = document.createElement('img');
        image.src = isDataImage ? value : url.href;
        image.alt = 'Question diagram preview';
        image.style.maxWidth = '260px';
        image.style.maxHeight = '180px';
        preview.appendChild(image);
    } catch (_) {}
}

function setupChemicalStructureDrawer() {
    const canvas = document.getElementById('structure-canvas');
    const context = canvas.getContext('2d');
    const draw = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        structureItems.forEach(item => {
            context.strokeStyle = '#111827';
            context.fillStyle = '#111827';
            context.lineWidth = 3;
            context.lineCap = 'round';
            if (item.type === 'benzene') {
                const size = 58 * (item.scale || 1);
                const vertices = Array.from({ length: 6 }, (_, i) => {
                    const angle = -Math.PI / 2 + i * Math.PI / 3;
                    return { x: item.x + Math.cos(angle) * size, y: item.y + Math.sin(angle) * size };
                });
                context.beginPath();
                vertices.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
                context.closePath();
                context.stroke();
                [[0, 1], [2, 3], [4, 5]].forEach(([a, b]) => {
                    const p = vertices[a], q = vertices[b];
                    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
                    const dx = item.x - mx, dy = item.y - my;
                    const length = Math.hypot(dx, dy) || 1;
                    context.beginPath();
                    context.moveTo(p.x + dx / length * 8, p.y + dy / length * 8);
                    context.lineTo(q.x + dx / length * 8, q.y + dy / length * 8);
                    context.stroke();
                });
            } else if (item.type === 'benzene-circle') {
                const size = 58 * (item.scale || 1);
                const vertices = Array.from({ length: 6 }, (_, i) => {
                    const angle = -Math.PI / 2 + i * Math.PI / 3;
                    return { x: item.x + Math.cos(angle) * size, y: item.y + Math.sin(angle) * size };
                });
                context.beginPath();
                vertices.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
                context.closePath(); context.stroke();
                context.beginPath(); context.arc(item.x, item.y, 34 * (item.scale || 1), 0, Math.PI * 2); context.stroke();
            } else if (item.type === 'circle') {
                context.beginPath(); context.arc(item.x, item.y, item.radius, 0, Math.PI * 2); context.stroke();
            } else if (item.type === 'rectangle') {
                context.strokeRect(item.x, item.y, item.width, item.height);
            } else if (item.type === 'triangle') {
                context.beginPath(); context.moveTo(item.x + item.width / 2, item.y);
                context.lineTo(item.x + item.width, item.y + item.height); context.lineTo(item.x, item.y + item.height);
                context.closePath(); context.stroke();
            } else if (item.type === 'line') {
                context.beginPath(); context.moveTo(item.x1, item.y1); context.lineTo(item.x2, item.y2); context.stroke();
            } else if (item.type === 'label') {
                const scale = item.scale || 1;
                context.font = `600 ${22 * scale}px Arial`; context.fillText(item.text, item.x, item.y);
                if (item.subscript) {
                    const labelWidth = context.measureText(item.text).width;
                    context.font = `600 ${14 * scale}px Arial`;
                    context.fillText(item.subscript, item.x + labelWidth, item.y + 5);
                }
                if (item.superscript) {
                    const labelWidth = context.measureText(item.text).width;
                    context.font = `600 ${14 * scale}px Arial`;
                    context.fillText(item.superscript, item.x + labelWidth, item.y - 9);
                }
            }
        });
        if (selectedStructureIndex >= 0 && structureItems[selectedStructureIndex]) {
            const bounds = getStructureBounds(structureItems[selectedStructureIndex]);
            context.save(); context.strokeStyle = '#7c3aed'; context.fillStyle = '#fff'; context.lineWidth = 2;
            context.setLineDash([5, 4]); context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.setLineDash([]); context.fillRect(bounds.x + bounds.width - 5, bounds.y + bounds.height - 5, 10, 10);
            context.strokeRect(bounds.x + bounds.width - 5, bounds.y + bounds.height - 5, 10, 10); context.restore();
        }
    };
    const getStructureBounds = item => {
        const scale = item.scale || 1;
        if (item.type === 'benzene' || item.type === 'benzene-circle' || item.type === 'circle') {
            const radius = item.type === 'circle' ? item.radius : 58 * scale;
            return { x: item.x - radius, y: item.y - radius, width: radius * 2, height: radius * 2 };
        }
        if (item.type === 'rectangle' || item.type === 'triangle') return { x: item.x, y: item.y, width: item.width, height: item.height };
        if (item.type === 'line') return { x: Math.min(item.x1, item.x2), y: Math.min(item.y1, item.y2), width: Math.abs(item.x2 - item.x1), height: Math.abs(item.y2 - item.y1) };
        return { x: item.x, y: item.y - 28 * scale, width: Math.max(38, item.text.length * 14) * scale, height: 38 * scale };
    };
    const point = event => {
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    const selectItemAt = position => {
        for (let i = structureItems.length - 1; i >= 0; i--) {
            const bounds = getStructureBounds(structureItems[i]);
            if (position.x >= bounds.x - 8 && position.x <= bounds.x + bounds.width + 8 && position.y >= bounds.y - 8 && position.y <= bounds.y + bounds.height + 8) return i;
        }
        return -1;
    };
    const showSelectedLabel = item => {
        const isLabel = item?.type === 'label';
        document.getElementById('update-label').disabled = !isLabel;
        if (isLabel) {
            document.getElementById('structure-label').value = item.text;
            document.getElementById('structure-subscript').value = item.subscript || '';
            document.getElementById('structure-superscript').value = item.superscript || '';
        }
    };
    document.getElementById('select-structure').addEventListener('click', () => { structureDrawMode = 'select'; });
    document.getElementById('update-label').addEventListener('click', () => {
        const item = structureItems[selectedStructureIndex];
        if (item?.type !== 'label') return;
        item.text = document.getElementById('structure-label').value.trim() || item.text;
        item.subscript = document.getElementById('structure-subscript').value.trim();
        item.superscript = document.getElementById('structure-superscript').value.trim();
        draw();
    });
    document.getElementById('draw-benzene').addEventListener('click', () => {
        structureItems.push({ type: 'benzene', x: canvas.width / 2, y: canvas.height / 2 }); draw();
    });
    document.getElementById('draw-benzene-circle').addEventListener('click', () => {
        structureItems.push({ type: 'benzene-circle', x: canvas.width / 2, y: canvas.height / 2 }); draw();
    });
    document.getElementById('draw-circle').addEventListener('click', () => { structureDrawMode = 'circle'; });
    document.getElementById('draw-triangle').addEventListener('click', () => { structureDrawMode = 'triangle'; });
    document.getElementById('draw-rectangle').addEventListener('click', () => { structureDrawMode = 'rectangle'; });
    document.getElementById('draw-bond').addEventListener('click', () => { structureDrawMode = 'bond'; });
    document.getElementById('draw-label').addEventListener('click', () => {
        const text = document.getElementById('structure-label').value.trim();
        if (!text) return;
        structureDrawMode = 'label';
        document.getElementById('structure-label').dataset.pending = text;
        document.getElementById('structure-label').dataset.subscript = document.getElementById('structure-subscript').value.trim();
        document.getElementById('structure-label').dataset.superscript = document.getElementById('structure-superscript').value.trim();
    });
    document.getElementById('undo-structure').addEventListener('click', () => { structureItems.pop(); selectedStructureIndex = -1; showSelectedLabel(null); draw(); });
    canvas.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            structureItems.pop();
            selectedStructureIndex = -1; showSelectedLabel(null);
            draw();
        }
    });
    document.getElementById('clear-structure').addEventListener('click', () => { structureItems = []; selectedStructureIndex = -1; showSelectedLabel(null); draw(); });
    document.getElementById('save-structure').addEventListener('click', () => {
        selectedStructureIndex = -1;
        showSelectedLabel(null);
        draw();
        const drawing = canvas.toDataURL('image/png');
        if (structureTarget === 'question') {
            document.getElementById('image_url').value = drawing;
            updateQuestionImagePreview();
        } else {
            const input = document.getElementById(activeMathOptionId);
            input.value = drawing;
            document.getElementById(`${activeMathOptionId}_type`).value = 'image';
            updateOptionMathPreview();
        }
        document.getElementById('structure-drawer').style.display = 'none';
        if (structureTarget === 'option') document.getElementById(`${activeMathOptionId}_preview`).style.display = 'none';
        structureTarget = 'option';
        closeStructureDrawingPopup();
    });
    canvas.addEventListener('pointerdown', event => {
        const position = point(event);
        if (structureDrawMode === 'select') {
            selectedStructureIndex = selectItemAt(position);
            const item = structureItems[selectedStructureIndex];
            showSelectedLabel(item);
            if (item) {
                const bounds = getStructureBounds(item);
                const handle = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
                const onResizeHandle = Math.hypot(position.x - handle.x, position.y - handle.y) <= 14;
                structureEditDrag = { index: selectedStructureIndex, action: onResizeHandle ? 'resize' : 'move', start: position, original: { ...item }, handle };
            } else structureEditDrag = null;
            draw();
        } else structurePointerStart = position;
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
        if (!structureEditDrag) return;
        const position = point(event), edit = structureEditDrag;
        const item = structureItems[edit.index], original = edit.original;
        const dx = position.x - edit.start.x, dy = position.y - edit.start.y;
        if (edit.action === 'move') {
            if (original.type === 'line') Object.assign(item, { x1: original.x1 + dx, y1: original.y1 + dy, x2: original.x2 + dx, y2: original.y2 + dy });
            else Object.assign(item, { x: original.x + dx, y: original.y + dy });
        } else if (original.type === 'circle') {
            item.radius = Math.max(6, Math.hypot(position.x - original.x, position.y - original.y));
        } else if (original.type === 'rectangle' || original.type === 'triangle') {
            item.width = Math.max(10, original.width + dx); item.height = Math.max(10, original.height + dy);
        } else if (original.type === 'line') {
            item.x2 = position.x; item.y2 = position.y;
        } else {
            const initialDistance = Math.hypot(edit.handle.x - original.x, edit.handle.y - original.y) || 1;
            const nextDistance = Math.hypot(position.x - original.x, position.y - original.y);
            item.scale = Math.max(0.35, (original.scale || 1) * nextDistance / initialDistance);
        }
        draw();
    });
    canvas.addEventListener('pointerup', event => {
        if (structureEditDrag) { structureEditDrag = null; return; }
        if (!structurePointerStart) return;
        const end = point(event);
        if (structureDrawMode === 'label') {
            const text = document.getElementById('structure-label').dataset.pending || '';
            const subscript = document.getElementById('structure-label').dataset.subscript || '';
            const superscript = document.getElementById('structure-label').dataset.superscript || '';
            if (text) structureItems.push({ type: 'label', text, subscript, superscript, x: end.x, y: end.y });
            document.getElementById('structure-label').dataset.pending = '';
            document.getElementById('structure-label').dataset.subscript = '';
            document.getElementById('structure-label').dataset.superscript = '';
            structureDrawMode = 'bond';
        } else if (Math.hypot(end.x - structurePointerStart.x, end.y - structurePointerStart.y) > 5) {
            const left = Math.min(structurePointerStart.x, end.x), top = Math.min(structurePointerStart.y, end.y);
            const width = Math.abs(end.x - structurePointerStart.x), height = Math.abs(end.y - structurePointerStart.y);
            if (structureDrawMode === 'circle') {
                structureItems.push({ type: 'circle', x: structurePointerStart.x, y: structurePointerStart.y, radius: Math.hypot(end.x - structurePointerStart.x, end.y - structurePointerStart.y) });
            } else if (structureDrawMode === 'rectangle') {
                structureItems.push({ type: 'rectangle', x: left, y: top, width, height });
            } else if (structureDrawMode === 'triangle') {
                structureItems.push({ type: 'triangle', x: left, y: top, width, height });
            } else {
                structureItems.push({ type: 'line', x1: structurePointerStart.x, y1: structurePointerStart.y, x2: end.x, y2: end.y });
            }
        }
        structurePointerStart = null; draw();
    });
}

function getOptionForStorage(id) {
    const text = document.getElementById(id).value.trim();
    const type = document.getElementById(`${id}_type`).value;
    if (!text) return text;
    if (type === 'image') return `[[IMAGE]]${text}`;
    if (type !== 'math') return text;
    if ((text.startsWith('\\(') && text.endsWith('\\)')) || (text.startsWith('\\[') && text.endsWith('\\]'))) return text;
    return `\\(${text}\\)`;
}

function getEditableOption(value) {
    const text = String(value || '');
    if (text.startsWith('[[IMAGE]]')) return { type: 'image', text: text.slice(9) };
    if ((text.startsWith('\\(') && text.endsWith('\\)')) || (text.startsWith('\\[') && text.endsWith('\\]'))) {
        return { type: 'math', text: text.slice(2, -2).trim() };
    }
    return { type: 'text', text };
}

function updateQuestionTypeHelp() {
    const isMath = document.getElementById('question-type').value === 'math';
    document.getElementById('question-math-launcher').style.display = isMath ? 'inline-block' : 'none';
    document.getElementById('draw-question-diagram').style.display = isMath ? 'inline-block' : 'none';
    document.getElementById('math-tools').classList.remove('visible');
    document.getElementById('math-preview').style.display = isMath ? 'block' : 'none';
    document.getElementById('question').placeholder = isMath
        ? 'Enter LaTeX, e.g. \\frac{a}{b} or x^2 + y^2 = z^2'
        : 'Write your question here...';
    document.getElementById('question-type-help').textContent = isMath
        ? 'Use the symbol buttons and type inside the braces. Use 1½ for a mixed fraction like 1 1/2; enter the whole number and numerator/denominator in the braces.'
        : 'Use normal text for the question.';
    if (isMath) updateMathPreview();
}

function insertMathTemplate(event) {
    const input = document.getElementById('question');
    const template = event.currentTarget.dataset.template || '';
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(template, start, end, 'end');
    const cursorOffset = event.currentTarget.dataset.cursor;
    if (cursorOffset !== undefined) {
        const cursor = start + Number(cursorOffset);
        input.setSelectionRange(cursor, cursor);
    }
    input.focus();
    updateMathPreview();
}

let mathPreviewQueue = Promise.resolve();
function updateMathPreview() {
    if (document.getElementById('question-type').value !== 'math') return;
    const expression = document.getElementById('question').value.trim();
    const preview = document.getElementById('math-preview');
    if (!expression) {
        preview.textContent = '';
        return;
    }
    if (!window.MathJax?.typesetPromise) {
        preview.textContent = `\\(${expression}\\)`;
        return;
    }
    mathPreviewQueue = mathPreviewQueue.then(() => {
        window.MathJax.typesetClear?.([preview]);
        preview.textContent = `\\(${expression}\\)`;
        return window.MathJax.typesetPromise([preview]);
    }).catch(() => {});
}

function getQuestionForStorage(value) {
    const text = String(value || '').trim();
    if (document.getElementById('question-type').value !== 'math') return text;
    if ((text.startsWith('\\(') && text.endsWith('\\)')) || (text.startsWith('\\[') && text.endsWith('\\]'))) return text;
    return `\\(${text}\\)`;
}

function getEditableQuestion(value) {
    const text = String(value || '');
    if ((text.startsWith('\\(') && text.endsWith('\\)')) || (text.startsWith('\\[') && text.endsWith('\\]'))) {
        return { type: 'math', text: text.slice(2, -2).trim() };
    }
    return { type: 'text', text };
}

async function restoreQuestionFormDefaults() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('questionFormDefaults') || 'null'); } catch (_) { saved = null; }
    if (!saved) {
        document.getElementById('question_number').value = getNextQuestionNumber();
        return;
    }
    const examSelect = document.getElementById('exam_name');
    examSelect.value = [...examSelect.options].some(option => option.value === saved.exam) ? saved.exam : '';
    await loadQuestionSubjects();
    const subjectSelect = document.getElementById('subject');
    if (saved.subject && ![...subjectSelect.options].some(option => option.value === saved.subject)) {
        subjectSelect.add(new Option(saved.subject, saved.subject));
    }
    subjectSelect.value = saved.subject || '';
    document.getElementById('mark').value = saved.mark ?? '1';
    document.getElementById('negative_mark').value = saved.negativeMark ?? '0.25';
    document.getElementById('question_number').value = getNextQuestionNumber();
}

async function loadQuestionExams() {
    exams = await fetchData('Exams');
    const examSelect = document.getElementById('exam_name');
    const uniqueExamNames = [...new Map((exams || [])
        .filter(isQuestionExamConfig)
        .map(exam => String(exam.Exam_Name || '').trim())
        .filter(Boolean)
        .map(name => [name.toLocaleLowerCase(), name])).values()];
    examSelect.innerHTML = '<option value="">Select exam</option>' + uniqueExamNames
        .map(name => `<option value="${escapeQuestionHtml(name)}">${escapeQuestionHtml(name)}</option>`).join('');
    examSelect.addEventListener('change', loadQuestionSubjects);
    await loadQuestionSubjects();
}

async function loadQuestionSubjects() {
    const select = document.getElementById('subject');
    const previousSubject = select.value;
    const selectedExam = document.getElementById('exam_name').value;
    const selectedExamKey = selectedExam.toLocaleLowerCase();
    const examSubjects = (exams || []).filter(isQuestionExamConfig)
        .filter(exam => !selectedExam || String(exam.Exam_Name || '').trim().toLocaleLowerCase() === selectedExamKey)
        .map(exam => exam.Subject);
    const saved = await fetchData('Subjects');
    let names = [...new Set(examSubjects.filter(Boolean))];
    if (!selectedExam && !names.length) names = (saved || []).map(s => s.Subject_Name || s.Subject).filter(Boolean);
    select.innerHTML = '<option value="">Select subject</option>' + names.map(name =>
        `<option value="${escapeQuestionHtml(name)}">${escapeQuestionHtml(name)}</option>`).join('');
    if (previousSubject && [...select.options].some(option => option.value === previousSubject)) select.value = previousSubject;
}

function escapeQuestionHtml(value) {
    const el = document.createElement('div');
    el.textContent = value == null ? '' : String(value);
    return el.innerHTML;
}

async function loadQuestions() {
    questions = await fetchData('Questions');
    await loadQuestionSubjects();
    currentQuestionPage = 1;
    renderQuestionsPage();
}

function renderQuestionsPage() {
    const body = document.getElementById('questions-table-body');
    const totalPages = Math.max(1, Math.ceil((questions || []).length / QUESTIONS_PER_PAGE));
    currentQuestionPage = Math.min(currentQuestionPage, totalPages);
    const start = (currentQuestionPage - 1) * QUESTIONS_PER_PAGE;
    const pageQuestions = (questions || []).slice(start, start + QUESTIONS_PER_PAGE);
    body.innerHTML = pageQuestions.map((q, pageIndex) => {
        const index = start + pageIndex;
        return `<tr>
        <td>${escapeQuestionHtml(q.Question_Number ?? q.Question_ID ?? index + 1)}</td>
        <td>${escapeQuestionHtml(q.Subject)}</td>
        <td>${escapeQuestionHtml(q.Question)}</td>
        <td>${escapeQuestionHtml(q.Correct_Answer)}</td>
        <td>${escapeQuestionHtml(q.Mark ?? '-')}</td>
        <td>${escapeQuestionHtml(q.Negative_Mark ?? '-')}</td>
        <td><button class="question-action question-edit" type="button" onclick="editQuestion(${index})">Edit</button>
        <button class="question-action question-delete" type="button" onclick="deleteQuestion(${index})">Delete</button></td>
    </tr>`;
    }).join('') || '<tr><td colspan="7">No questions found.</td></tr>';
    document.getElementById('questions-pagination').innerHTML = totalPages > 1 ? `
        <button type="button" class="page-btn" ${currentQuestionPage === 1 ? 'disabled' : ''} onclick="changeQuestionPage(-1)">Previous</button>
        <span>Page ${currentQuestionPage} of ${totalPages}</span>
        <button type="button" class="page-btn" ${currentQuestionPage === totalPages ? 'disabled' : ''} onclick="changeQuestionPage(1)">Next</button>` : '';
}

function changeQuestionPage(step) { currentQuestionPage += step; renderQuestionsPage(); }

document.getElementById('question-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('q-submit-btn');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = document.getElementById('edit-row-index').value ? 'Updating...' : 'Saving...';
    const questionNumber = document.getElementById('question_number').value;
    const existingQuestionId = document.getElementById('question-id').value;
    const questionId = existingQuestionId || getNextQuestionId();
    // Match the live Questions sheet order shown in the spreadsheet:
    // Exam_Name, Subject, Question, options, Correct_Answer, Mark, Negative_Mark, Time, Question_ID, Image_URL, Question_Number.
    const data = [
        document.getElementById('exam_name').value,
        document.getElementById('subject').value,
        getQuestionForStorage(document.getElementById('question').value),
        getOptionForStorage('opt_a'),
        getOptionForStorage('opt_b'),
        getOptionForStorage('opt_c'),
        getOptionForStorage('opt_d'),
        document.getElementById('correct_answer').value,
        document.getElementById('mark').value,
        document.getElementById('negative_mark').value,
        document.getElementById('time').value || '',
        questionId,
        document.getElementById('image_url').value.trim(),
        questionNumber
    ];
    const row = Number(document.getElementById('edit-row-index').value);
    const result = await saveData('Questions', data, row ? 'update' : 'add', row || null);
    if (result.status === 'success') {
        const keep = {
            exam: document.getElementById('exam_name').value,
            subject: document.getElementById('subject').value,
            mark: document.getElementById('mark').value,
            negativeMark: document.getElementById('negative_mark').value
        };
        localStorage.setItem('questionFormDefaults', JSON.stringify(keep));
        resetForm();
        await loadQuestions();
        document.getElementById('exam_name').value = keep.exam;
        await loadQuestionSubjects();
        document.getElementById('subject').value = keep.subject;
        document.getElementById('mark').value = keep.mark;
        document.getElementById('negative_mark').value = keep.negativeMark;
        document.getElementById('question_number').value = getNextQuestionNumber();
    } else {
        // saveData displays a toast for failed writes.
    }
    button.disabled = false;
    button.textContent = originalText;
});

function showQuestionToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `question-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function editQuestion(index) {
    const q = questions[index];
    document.getElementById('edit-row-index').value = q._rowIndex || index + 2;
    const examSelect = document.getElementById('exam_name');
    const savedExam = String(q.Exam_Name || '').trim();
    const matchingExam = [...examSelect.options].find(option => option.value.toLocaleLowerCase() === savedExam.toLocaleLowerCase());
    examSelect.value = matchingExam ? matchingExam.value : '';
    await loadQuestionSubjects();
    const subjectSelect = document.getElementById('subject');
    const subjectName = String(q.Subject || '').trim();
    if (subjectName && ![...subjectSelect.options].some(option => option.value === subjectName)) {
        subjectSelect.add(new Option(subjectName, subjectName));
    }
    subjectSelect.value = subjectName;
    const editableQuestion = getEditableQuestion(q.Question);
    document.getElementById('question').value = editableQuestion.text;
    document.getElementById('question-type').value = editableQuestion.type;
    updateQuestionTypeHelp();
    const editableOptions = ['Option_A', 'Option_B', 'Option_C', 'Option_D'].map(key => getEditableOption(q[key]));
    ['opt_a', 'opt_b', 'opt_c', 'opt_d'].forEach((id, optionIndex) => {
        document.getElementById(id).value = editableOptions[optionIndex].text;
        document.getElementById(`${id}_type`).value = editableOptions[optionIndex].type;
    });
    activeMathOptionId = 'opt_a';
    updateOptionMathPreview();
    document.getElementById('correct_answer').value = q.Correct_Answer || '';
    document.getElementById('question-id').value = q.Question_ID || '';
    document.getElementById('question_number').value = q.Question_Number ?? q.Question_ID ?? index + 1;
    document.getElementById('mark').value = q.Mark ?? 1;
    document.getElementById('negative_mark').value = q.Negative_Mark ?? 0.25;
    document.getElementById('image_url').value = q.Image_URL || q.Image || '';
    updateQuestionImagePreview();
    document.getElementById('time').value = q.Time || '';
    document.getElementById('q-submit-btn').textContent = 'Update Question';
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen" style="color: var(--primary);"></i> Edit Question';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
}

async function deleteQuestion(index) {
    const row = questions[index]._rowIndex || index + 2;
    if (!confirm('Delete this question?')) return;
    const result = await saveData('Questions', [], 'delete', row);
    if (result.status === 'success') loadQuestions();
}

function resetForm() {
    const defaults = {
        exam: document.getElementById('exam_name').value,
        subject: document.getElementById('subject').value,
        mark: document.getElementById('mark').value,
        negativeMark: document.getElementById('negative_mark').value
    };
    document.getElementById('question-form').reset();
    document.getElementById('question-type').value = 'text';
    ['opt_a_type', 'opt_b_type', 'opt_c_type', 'opt_d_type'].forEach(id => { document.getElementById(id).value = 'text'; });
    activeMathOptionId = 'opt_a';
    updateOptionMathPreview();
    updateQuestionTypeHelp();
    document.getElementById('exam_name').value = defaults.exam;
    document.getElementById('mark').value = defaults.mark || '1';
    document.getElementById('negative_mark').value = defaults.negativeMark || '0.25';
    loadQuestionSubjects().then(() => { document.getElementById('subject').value = defaults.subject; });
    document.getElementById('question_number').value = getNextQuestionNumber();
    document.getElementById('edit-row-index').value = '';
    document.getElementById('q-submit-btn').textContent = 'Save Question';
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-circle-plus" style="color: var(--primary);"></i> Add New Question';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function getNextQuestionNumber() {
    return Math.max(0, ...(questions || []).map(q => Number(q.Question_Number) || 0)) + 1;
}

function getNextQuestionId() {
    return Math.max(0, ...(questions || []).map(q => Number(q.Question_ID) || 0)) + 1;
}
