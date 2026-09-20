export const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = { brush: 'm14 3 4 4-8 8-4-4 8-8M6 11c-4 0-1 5-5 6 5 2 9-1 9-4', erase: 'm9 3 9 9-7 7H7l-6-6 8-10M5 9l9 8M11 19h9', fill: 'm8 3 10 10-6 6L2 9l6-6M3 10h12M18 15c-4 4-2 6 0 6s4-2 0-6M7 1l4 8', pipette: 'm14 2 5 5M13 5l3 3-10 10-4 1 1-4 10-10', hand: 'M7 10V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 5-3 7-7 7-2 0-4-1-5-3l-4-5c-1-2 1-3 2-2l2 1', cursor: 'm4 2 14 10-7 1-3 7-4-18', cube: 'm10 2 8 4v10l-8 4-8-4V6l8-4M2 6l8 4 8-4M10 10v10', layers: 'm10 2 9 5-9 5-9-5 9-5M2 12l8 5 8-5M2 16l8 5 8-5', plus: 'M10 3v14M3 10h14', minus: 'M3 10h14', eye: 'M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6', hidden: 'm2 2 16 16M8 4c6-1 11 6 11 6l-3 4M3 6 1 10s4 6 10 6', lock: 'M5 9V6a5 5 0 0 1 10 0v3M4 9h12v11H4V9M10 13v3', unlock: 'M5 9V6a5 5 0 0 1 10-3M4 9h12v11H4V9', trash: 'M3 5h14M7 5V2h6v3M5 5l1 14h8l1-14M8 8v7M12 8v7', copy: 'M7 7h11v12H7V7M3 14H1V1h11v3', undo: 'M6 4 1 9l5 5M2 9h10a6 6 0 0 1 0 12', redo: 'm14 4 5 5-5 5M18 9H8a6 6 0 0 0 0 12', save: 'M3 2h12l4 4v14H2V2h1M6 2v6h8V2M6 20v-8h9v8', folder: 'M2 5V2h6l3 3h8v14H2V5', upload: 'M10 15V2M5 7l5-5 5 5M2 14v6h16v-6', download: 'M10 2v13M5 10l5 5 5-5M2 15v5h16v-5', share: 'M14 4 6 9M6 12l8 5M3 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6M17 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6', chevron: 'm7 5 5 5-5 5', down: 'm5 7 5 5 5-5', dots: 'M3 10h.01M10 10h.01M17 10h.01', grid: 'M2 2h16v16H2V2M2 10h16M10 2v16', sun: 'M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 1v2M10 17v2M1 10h2M17 10h2M3 3l2 2M15 15l2 2M17 3l-2 2M5 15l-2 2', node: 'M2 2h6v6H2V2M12 12h6v6h-6v-6M8 5h5v7M3 16h9', image: 'M2 2h16v16H2V2M3 15l5-6 4 4 3-4 3 4M13 5h1', check: 'm3 10 5 5L18 4', x: 'm4 4 12 12M16 4 4 16', search: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2M13 13l6 6', info: 'M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18M10 9v6M10 5h.01', settings: 'M3 5h14M3 15h14M7 2v6M13 12v6', arrowup: 'm5 10 5-5 5 5M10 5v13', arrowdown: 'm5 10 5 5 5-5M10 15V2', play: 'm5 2 13 8-13 8V2', pause: 'M6 2v16M14 2v16', symmetry: 'M10 1v18M6 4 1 10l5 6V4M14 4l5 6-5 6V4', frame: 'M7 2H2v5M13 2h5v5M2 13v5h5M18 13v5h-5', moon: 'M17 13A8 8 0 0 1 7 3a8 8 0 1 0 10 10', comment: 'M2 2h17v13H8l-6 4V2M6 6h9M6 10h6', clock: 'M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18M10 5v5l4 3' };
export const icon = (name) => `<svg class="icon" viewBox="0 0 22 22" aria-hidden="true"><path d="${paths[name] || paths.cube}"/></svg>`;
export const button = (action, name, title, extra = '') => `<button data-action="${action}" title="${title}" aria-label="${title}" ${extra}>${icon(name)}</button>`;
export function toast(message, error = false) { document.querySelector('.toast')?.remove(); const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : ''); el.setAttribute('role', 'status'); el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), error ? 6500 : 3600); }
export function dialog(title, body, { action = 'Done', cancel = 'Cancel', onSubmit = null } = {}) { const prior = document.activeElement, el = document.createElement('div'); el.className = 'dialog'; el.innerHTML = `<form class="dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="dialog-head">${escapeHTML(title)}<span class="spacer"></span><button type="button" data-close aria-label="Close">${icon('x')}</button></div><div class="dialog-body">${body}</div><div class="dialog-foot"><button type="button" data-close>${cancel}</button><button class="primary" type="submit">${action}</button></div></form>`; document.body.append(el); const close = () => { el.remove(); prior?.focus(); }; el.querySelectorAll('[data-close]').forEach(b => b.onclick = close); el.onmousedown = e => { if (e.target === el)
    close(); }; el.onkeydown = e => { if (e.key === 'Escape')
    close(); if (e.key === 'Tab') {
    const focusables = [...el.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled), first = focusables[0], last = focusables.at(-1);
    if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
    }
} }; el.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const submit = el.querySelector('[type=submit]'); try {
    submit.disabled = true;
    const result = await onSubmit?.(new FormData(e.target), el);
    if (result !== false)
        close();
}
catch (err) {
    toast(err.message, true);
}
finally {
    submit.disabled = false;
} }; queueMicrotask(() => el.querySelector('input,select,textarea,button')?.focus()); return { element: el, close }; }
export class EventBus {
    constructor() { this.handlers = new Map(); }
    on(type, fn) { const set = this.handlers.get(type) || new Set(); set.add(fn); this.handlers.set(type, set); return () => set.delete(fn); }
    emit(type, data) { for (const fn of this.handlers.get(type) || [])
        fn(data); }
}
export class LayerStackControl extends HTMLElement {
    set layers(v) { this._layers = v; this.render(); }
    set selected(v) { this._selected = v; this.render(); }
    connectedCallback() { this.addEventListener('click', e => { const row = e.target.closest('[data-layer]'); if (row)
        this.dispatchEvent(new CustomEvent('layerselect', { detail: { id: row.dataset.layer, action: e.target.closest('[data-layer-action]')?.dataset.layerAction || 'select' }, bubbles: true })); }); this.addEventListener('dblclick', e => { const row = e.target.closest('[data-layer]'); if (row)
        this.dispatchEvent(new CustomEvent('layerrename', { detail: { id: row.dataset.layer }, bubbles: true })); }); this.addEventListener('dragstart', e => { const row = e.target.closest('[data-layer]'); if (row)
        e.dataTransfer.setData('text/tessera-layer', row.dataset.layer); }); this.addEventListener('dragover', e => e.preventDefault()); this.addEventListener('drop', e => { e.preventDefault(); const row = e.target.closest('[data-layer]'), from = e.dataTransfer.getData('text/tessera-layer'); if (row && from)
        this.dispatchEvent(new CustomEvent('layerreorder', { detail: { from, to: row.dataset.layer }, bubbles: true })); }); this.render(); }
    render() { if (!this.isConnected)
        return; this.innerHTML = [...(this._layers || [])].reverse().map(l => `<div class="layer-row ${l.id === this._selected ? 'active' : ''}" data-layer="${escapeHTML(l.id)}" draggable="true" role="option" aria-selected="${l.id === this._selected}" tabindex="0"><button data-layer-action="visible" aria-label="Toggle visibility">${icon(l.visible ? 'eye' : 'hidden')}</button><span class="layer-thumb" style="background:${/^#[0-9a-f]{6}$/i.test(l.color) ? l.color : '#54766c'}"></span><div class="layer-name">${escapeHTML(l.name)}<small>${escapeHTML(l.kind)} · ${Math.round(l.opacity * 100)}%${l.mask ? ' · mask' : ''}</small></div><button data-layer-action="lock" aria-label="Toggle layer lock">${icon(l.locked ? 'lock' : 'unlock')}</button></div>`).join(''); }
}
if (globalThis.customElements && !customElements.get('tessera-layer-stack'))
    customElements.define('tessera-layer-stack', LayerStackControl);
