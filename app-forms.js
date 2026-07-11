import { App } from './firebase-context.js';

Object.assign(App, {
    renderCategoryField(prefix) {
        return `<div class="relative"><label class="flex items-center justify-between mb-1"><span class="text-sm font-bold text-slate-700">Categoria</span><span class="text-[9px] text-blue-600 font-black uppercase bg-blue-50 px-1.5 py-0.5 rounded">Escolha ou digite</span></label><input id="${prefix}-category" required class="input-modern" autocomplete="off" placeholder="Ex.: Moradia" oninput="App.handleCategoryInput(this.value,'${prefix}')" onfocus="App.handleCategoryInput(this.value,'${prefix}')" onblur="setTimeout(()=>document.getElementById('${prefix}-category-dropdown')?.classList.add('hidden'),180)"><ul id="${prefix}-category-dropdown" class="absolute z-30 w-full bg-white border border-slate-200 shadow-xl rounded-xl mt-1 hidden max-h-48 overflow-y-auto text-sm divide-y divide-slate-100"></ul></div>`;
    },

    handleCategoryInput(value, prefix) {
        const dropdown = document.getElementById(`${prefix}-category-dropdown`);
        if (!dropdown) return;
        const search = value.toLowerCase().trim();
        const matches = this.data.categories.filter(item => (item.name || '').toLowerCase().includes(search)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const exact = this.data.categories.some(item => (item.name || '').toLowerCase() === search);
        let html = matches.map(item => `<li class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer font-semibold text-slate-700" onmousedown="App.selectCategory('${prefix}','${this.escapeJs(item.name)}')"><i class="fa-solid fa-tag text-blue-400 mr-2 text-xs"></i>${this.escapeHtml(item.name)}</li>`).join('');
        if (search && !exact) html += `<li class="px-4 py-2.5 hover:bg-emerald-50 cursor-pointer font-bold text-emerald-700" onmousedown="App.selectCategory('${prefix}','${this.escapeJs(value.trim())}')"><i class="fa-solid fa-plus-circle mr-2"></i>Criar “${this.escapeHtml(value.trim())}”</li>`;
        if (!html) html = '<li class="px-4 py-3 text-center text-slate-400">Digite uma categoria.</li>';
        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    },

    selectCategory(prefix, value) {
        const input = document.getElementById(`${prefix}-category`);
        if (input) input.value = value;
        document.getElementById(`${prefix}-category-dropdown`)?.classList.add('hidden');
    },

    openCardModal(id = null) {
        const card = id ? this.data.cards.find(item => item.id === id) : null;
        document.getElementById('card-id').value = card?.id || '';
        document.getElementById('card-name').value = card?.name || '';
        document.getElementById('card-due').value = card?.dueDate || '';
        this.openModal('modal-card');
    },

    openTransactionModal(scope, transaction = null) {
        this.ui.actionScope = scope;
        const isEdit = scope && scope !== 'new';
        const item = transaction || this.ui.editingItem;
        document.getElementById('modal-trans-title').textContent = isEdit ? 'Editar lançamento' : 'Registrar gasto';
        const description = document.getElementById('trans-desc');
        const category = document.getElementById('trans-category');
        const amount = document.getElementById('trans-amount');
        const month = document.getElementById('trans-month');
        const monthDisplay = document.getElementById('trans-month-display');
        const type = document.getElementById('trans-type');
        const installments = document.getElementById('trans-installments');
        if (isEdit && item) {
            description.value = item.description || '';
            category.value = item.categoryName || 'Geral';
            month.value = item.invoiceMonth || this.ui.selectedMonth;
            monthDisplay.value = this.formatMonthSmall(month.value);
            month.disabled = true;
            type.value = item.isRecurring ? 'recorrente' : (item.totalInstallments > 1 ? 'parcelado' : 'vista');
            type.disabled = true;
            installments.value = item.totalInstallments || 1;
            installments.disabled = true;
            amount.value = this.formatMoney(item.totalInstallments > 1 && scope === 'all' && !item.isRecurring ? item.totalAmount : item.amount);
        } else {
            description.value = '';
            category.value = '';
            amount.value = '';
            month.value = this.ui.selectedMonth || this.currentYearMonth();
            monthDisplay.value = this.formatMonthSmall(month.value);
            month.disabled = false;
            type.value = 'vista';
            type.disabled = false;
            installments.value = 2;
            installments.disabled = false;
        }
        this.toggleTransactionInstallments();
        this.openModal('modal-transaction');
    },

    openAccountModal(scope, account = null) {
        this.ui.actionScope = scope;
        const isEdit = scope && scope !== 'new';
        const item = account || this.ui.editingItem;
        document.getElementById('modal-account-title').textContent = isEdit ? 'Editar conta' : (this.ui.accountKind === 'payable' ? 'Nova conta a pagar' : 'Nova conta a receber');
        const kind = document.getElementById('account-kind');
        const description = document.getElementById('account-desc');
        const category = document.getElementById('account-category');
        const amount = document.getElementById('account-amount');
        const dueDate = document.getElementById('account-due-date');
        const type = document.getElementById('account-type');
        const installments = document.getElementById('account-installments');
        const note = document.getElementById('account-edit-note');
        if (isEdit && item) {
            kind.value = item.kind || 'payable';
            kind.disabled = true;
            description.value = item.description || '';
            category.value = item.categoryName || 'Geral';
            amount.value = this.formatMoney(item.totalInstallments > 1 && scope === 'all' && !item.isRecurring ? item.totalAmount : item.amount);
            dueDate.value = item.dueDate || '';
            dueDate.disabled = scope !== 'single';
            type.value = item.isRecurring ? 'recorrente' : (item.totalInstallments > 1 ? 'parcelado' : 'vista');
            type.disabled = true;
            installments.value = item.totalInstallments || 1;
            installments.disabled = true;
            note.classList.toggle('hide', scope === 'single');
        } else {
            kind.value = this.ui.accountKind;
            kind.disabled = false;
            description.value = '';
            category.value = '';
            amount.value = '';
            dueDate.value = `${this.ui.selectedMonth || this.currentYearMonth()}-${String(new Date().getDate()).padStart(2, '0')}`;
            if (!this.isValidDateString(dueDate.value)) dueDate.value = `${this.ui.selectedMonth || this.currentYearMonth()}-01`;
            dueDate.disabled = false;
            type.value = 'vista';
            type.disabled = false;
            installments.value = 2;
            installments.disabled = false;
            note.classList.add('hide');
        }
        this.toggleAccountInstallments();
        this.openModal('modal-account');
    },

    toggleTransactionInstallments() {
        const type = document.getElementById('trans-type')?.value;
        document.getElementById('div-trans-installments')?.classList.toggle('hide', type !== 'parcelado');
        const label = document.getElementById('label-trans-amount');
        if (label) label.textContent = type === 'recorrente' ? 'Valor mensal' : 'Valor total';
    },

    toggleAccountInstallments() {
        const type = document.getElementById('account-type')?.value;
        document.getElementById('div-account-installments')?.classList.toggle('hide', type !== 'parcelado');
        const label = document.getElementById('label-account-amount');
        if (label) label.textContent = type === 'recorrente' ? 'Valor mensal' : 'Valor total';
    },

});
