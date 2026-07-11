import { App } from './firebase-context.js';

Object.assign(App, {
    openScopeModal({ title, message, options, handler, destructive = false }) {
        const panel = document.getElementById('scope-options-content');
        if (!panel) return;
        const iconClass = destructive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
        const primaryClass = destructive ? 'bg-red-600 hover:bg-red-700 text-white shadow' : 'bg-blue-600 hover:bg-blue-700 text-white shadow';
        const secondaryClass = destructive ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200';
        panel.innerHTML = `<div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden"></div><div class="w-12 h-12 ${iconClass} rounded-xl flex items-center justify-center mb-4"><i class="fa-solid ${destructive ? 'fa-triangle-exclamation' : 'fa-sliders'} text-xl"></i></div><h2 class="text-xl font-black text-slate-800">${this.escapeHtml(title)}</h2><p class="text-sm text-slate-500 mt-2 mb-5">${this.escapeHtml(message)}</p><div class="space-y-2.5">${options.map(([scope, label], index) => `<button type="button" onclick="${handler}('${scope}')" class="w-full py-3 px-4 rounded-xl font-extrabold transition ${index === options.length - 1 ? primaryClass : secondaryClass}">${this.escapeHtml(label)}</button>`).join('')}<button type="button" onclick="App.closeModal('modal-action-options')" class="w-full py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancelar</button></div>`;
        this.openModal('modal-action-options');
    },

    confirmDialog(title, message) {
        return new Promise(resolve => {
            const titleElement = document.getElementById('modal-confirm-title');
            const messageElement = document.getElementById('modal-confirm-message');
            const actionButton = document.getElementById('btn-confirm-action');
            const cancelButton = document.getElementById('btn-confirm-cancel');
            if (titleElement) titleElement.textContent = title;
            if (messageElement) messageElement.textContent = message;
            if (!actionButton || !cancelButton) return resolve(false);
            let finished = false;
            const finish = result => {
                if (finished) return;
                finished = true;
                this.closeModal('modal-confirm');
                resolve(result);
            };
            actionButton.onclick = () => finish(true);
            cancelButton.onclick = () => finish(false);
            this.openModal('modal-confirm');
        });
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hide');
        document.body.classList.add('modal-active');
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hide');
        const hasOpenModal = [...document.querySelectorAll('.modal')].some(item => !item.classList.contains('hide'));
        if (!hasOpenModal) document.body.classList.remove('modal-active');
    },

    showLoader(message = 'Processando...') {
        const loader = document.getElementById('global-loader');
        const label = document.getElementById('global-loader-msg');
        if (label) label.textContent = message;
        loader?.classList.remove('hide');
    },

    hideLoader() {
        document.getElementById('global-loader')?.classList.add('hide');
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-extrabold flex items-center gap-2 transition-all duration-300 translate-y-4 opacity-0 ${type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('translate-y-4', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('opacity-0', 'scale-95');
            setTimeout(() => toast.remove(), 280);
        }, 3200);
    },
});
