import { App } from './firebase-context.js';

const originalNavigate = App.navigate.bind(App);

Object.assign(App, {
    navigate(view, data = null) {
        if (view === 'accounts') {
            this.ui.accountListOpen = false;
            this.ui.filterCategory = '';
        }
        return originalNavigate(view, data);
    },

    openCardDetail(cardId) {
        const card = this.data.cards.find(item => item.id === cardId);
        if (!card) return this.showToast('Cartão não localizado.', 'error');
        this.navigate('card_detail', {
            id: card.id,
            name: card.name,
            dueDate: card.dueDate
        });
    },

    openAccountKind(kind) {
        this.ui.accountKind = kind === 'receivable' ? 'receivable' : 'payable';
        this.ui.accountListOpen = true;
        this.ui.filterCategory = '';
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        this.ui.view = 'accounts';
        this.renderModuleNav();
        this.render();
        this.triggerFade();
    },

    backToAccountKinds() {
        this.ui.accountListOpen = false;
        this.ui.filterCategory = '';
        this.render();
        this.triggerFade();
    },

    openNewAccountForKind(kind, event = null) {
        event?.stopPropagation();
        this.ui.accountKind = kind === 'receivable' ? 'receivable' : 'payable';
        this.ui.accountListOpen = true;
        this.ui.filterCategory = '';
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        this.openAccountModal('new');
    },

    setAccountKind(kind) {
        this.openAccountKind(kind);
    },

    renderCardsView() {
        const cards = [...this.data.cards].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        let html = `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"><div><p class="text-xs text-blue-600 font-black uppercase tracking-widest">Modo Cartões</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Meus Cartões</h1></div><button type="button" onclick="App.openCardModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-extrabold shadow-md flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> Novo cartão</button></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">`;

        if (!cards.length) {
            html += `<div class="sm:col-span-2 lg:col-span-3 card-surface border-dashed border-2 py-16 text-center text-slate-400"><i class="fa-solid fa-credit-card text-5xl text-slate-300 mb-4"></i><p class="font-semibold">Nenhum cartão cadastrado.</p></div>`;
        }

        cards.forEach(card => {
            const today = new Date();
            const target = new Date();
            if (today.getDate() > Number(card.dueDate || 31)) target.setMonth(target.getMonth() + 1);
            const referenceMonth = this.toYearMonth(target);
            const transactions = this.data.transactions.filter(item => item.cardId === card.id && item.invoiceMonth === referenceMonth);
            const total = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const safeId = this.escapeJs(card.id);

            html += `<article class="card-surface p-5 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openCardDetail('${safeId}')"><div class="flex justify-between gap-3 mb-3"><div class="min-w-0"><p class="text-xs text-slate-400 font-bold uppercase">Cartão</p><h2 class="text-xl font-black text-slate-800 truncate">${this.escapeHtml(card.name)}</h2></div><div class="flex gap-1.5 shrink-0"><button type="button" onclick="event.stopPropagation();App.openCardModal('${safeId}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="event.stopPropagation();App.deleteCard('${safeId}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimento da fatura: dia ${this.escapeHtml(card.dueDate)}</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(referenceMonth)}</p><p class="text-xs text-slate-500">${transactions.length} lançamento(s)</p></div><strong class="text-xl font-black ${total > 0 ? 'text-red-600' : 'text-slate-700'}">${this.formatMoney(total)}</strong></div></article>`;
        });

        return `${html}</div>`;
    },

    renderAccountsView() {
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();

        if (!this.ui.accountListOpen) {
            const summarize = kind => {
                const accounts = this.data.accounts.filter(item =>
                    item.kind === kind &&
                    (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth
                );
                const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                const settled = accounts.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                const pending = total - settled;
                const overdue = accounts.filter(item => !item.settled && this.isOverdue(item.dueDate)).length;
                return { accounts, total, settled, pending, overdue };
            };

            const payable = summarize('payable');
            const receivable = summarize('receivable');

            return `<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"><div><p class="text-xs text-emerald-600 font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Contas a Pagar e Receber</h1><p class="text-sm text-slate-500 mt-1">Escolha o tipo de conta que deseja gerenciar.</p></div>${this.renderMonthFilter('Vencimentos')}</div><div class="grid md:grid-cols-2 gap-5"><article class="card-surface p-6 hover:border-red-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('payable')"><div class="flex items-start justify-between gap-4"><div><div class="w-13 h-13 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center text-xl mb-4"><i class="fa-solid fa-arrow-up"></i></div><p class="text-xs text-red-600 font-black uppercase tracking-widest">Saídas</p><h2 class="text-2xl font-black text-slate-800 mt-1">Contas a Pagar</h2></div><button type="button" onclick="App.openNewAccountForKind('payable', event)" class="action-icon text-red-600" title="Nova conta a pagar"><i class="fa-solid fa-plus"></i></button></div><div class="mt-6"><p class="text-[10px] text-slate-400 font-black uppercase">Total em ${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-3xl font-black text-red-600 mt-1">${this.formatMoney(payable.total)}</p></div><div class="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center"><div><p class="text-[10px] text-slate-400 font-black uppercase">Contas</p><strong class="text-slate-700">${payable.accounts.length}</strong></div><div><p class="text-[10px] text-slate-400 font-black uppercase">Pendente</p><strong class="text-amber-600">${this.formatMoney(payable.pending)}</strong></div><div><p class="text-[10px] text-slate-400 font-black uppercase">Atrasadas</p><strong class="text-red-600">${payable.overdue}</strong></div></div><span class="inline-flex items-center gap-2 mt-5 text-red-700 font-extrabold">Abrir contas a pagar <i class="fa-solid fa-arrow-right"></i></span></article><article class="card-surface p-6 hover:border-emerald-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('receivable')"><div class="flex items-start justify-between gap-4"><div><div class="w-13 h-13 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-xl mb-4"><i class="fa-solid fa-arrow-down"></i></div><p class="text-xs text-emerald-600 font-black uppercase tracking-widest">Entradas</p><h2 class="text-2xl font-black text-slate-800 mt-1">Contas a Receber</h2></div><button type="button" onclick="App.openNewAccountForKind('receivable', event)" class="action-icon text-emerald-600" title="Nova conta a receber"><i class="fa-solid fa-plus"></i></button></div><div class="mt-6"><p class="text-[10px] text-slate-400 font-black uppercase">Total em ${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-3xl font-black text-emerald-600 mt-1">${this.formatMoney(receivable.total)}</p></div><div class="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center"><div><p class="text-[10px] text-slate-400 font-black uppercase">Contas</p><strong class="text-slate-700">${receivable.accounts.length}</strong></div><div><p class="text-[10px] text-slate-400 font-black uppercase">Pendente</p><strong class="text-amber-600">${this.formatMoney(receivable.pending)}</strong></div><div><p class="text-[10px] text-slate-400 font-black uppercase">Atrasadas</p><strong class="text-red-600">${receivable.overdue}</strong></div></div><span class="inline-flex items-center gap-2 mt-5 text-emerald-700 font-extrabold">Abrir contas a receber <i class="fa-solid fa-arrow-right"></i></span></article></div>`;
        }

        const kind = this.ui.accountKind;
        const isPayable = kind === 'payable';
        const monthAccounts = this.data.accounts.filter(item => item.kind === kind && (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth);
        const categories = [...new Set(monthAccounts.map(item => item.categoryName || 'Geral'))].sort((a, b) => a.localeCompare(b));
        let visible = this.ui.filterCategory ? monthAccounts.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory) : [...monthAccounts];
        visible.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.description || '').localeCompare(b.description || ''));
        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const settledTotal = visible.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingTotal = total - settledTotal;
        const overdue = visible.filter(item => !item.settled && this.isOverdue(item.dueDate));

        let html = `<div class="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.backToAccountKinds()" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div><p class="text-xs ${isPayable ? 'text-red-600' : 'text-emerald-600'} font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">${isPayable ? 'Contas a Pagar' : 'Contas a Receber'}</h1></div></div><div class="flex flex-col sm:flex-row gap-2">${this.renderMonthFilter('Vencimentos')}<div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateAccountsPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openAccountModal('new')" class="${isPayable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Nova conta</button></div></div></div>`;
        html += `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Total do mês</p><p class="text-xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">${isPayable ? 'Pago' : 'Recebido'}</p><p class="text-xl font-black text-emerald-600 mt-1">${this.formatMoney(settledTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Pendente</p><p class="text-xl font-black text-amber-600 mt-1">${this.formatMoney(pendingTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Em atraso</p><p class="text-xl font-black text-red-600 mt-1">${overdue.length} conta(s)</p></div></div>`;
        html += `<section class="card-surface p-4 mb-4"><div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p class="text-sm font-black text-slate-800">${isPayable ? 'Saídas previstas' : 'Entradas previstas'} — ${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500 mt-1">Cada parcela usa seu próprio dia de vencimento.</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern min-w-[210px]"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></div></section>`;
        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-4 py-3 flex justify-between"><span class="font-bold">${isPayable ? 'Contas a pagar' : 'Contas a receber'}</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><ul class="divide-y divide-slate-100">`;

        if (!visible.length) html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-calendar-check text-3xl mb-3"></i><p>Nenhuma conta neste mês.</p></li>`;

        visible.forEach(item => {
            const isLate = !item.settled && this.isOverdue(item.dueDate);
            const installment = item.totalInstallments > 1 && !item.isRecurring ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>` : '';
            const recurring = item.isRecurring ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>' : '';
            const status = item.settled ? `<span class="status-pill bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check"></i>${isPayable ? 'Pago' : 'Recebido'}</span>` : (isLate ? '<span class="status-pill bg-red-100 text-red-700"><i class="fa-solid fa-triangle-exclamation"></i>Atrasado</span>' : '<span class="status-pill bg-amber-100 text-amber-700"><i class="fa-solid fa-clock"></i>Pendente</span>');
            const safeId = this.escapeJs(item.id);
            html += `<li class="p-4 ${item.settled ? 'bg-emerald-50/30' : ''} hover:bg-slate-50 transition"><div class="flex flex-col lg:flex-row lg:items-center gap-3"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800 ${item.settled ? 'line-through opacity-70' : ''}">${this.escapeHtml(item.description)}</strong>${installment}${recurring}${status}</div><div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>Vence ${this.formatDateBR(item.dueDate)}</span><span><i class="fa-solid fa-tag mr-1"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span>${item.settledAt ? `<span><i class="fa-solid fa-check mr-1"></i>Concluída em ${this.formatDateTimeBR(item.settledAt)}</span>` : ''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3 border-t lg:border-0 pt-3 lg:pt-0"><strong class="text-lg min-w-[110px] lg:text-right ${isPayable ? 'text-red-600' : 'text-emerald-600'}">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openSettlementOptions('${safeId}')" class="action-icon ${item.settled ? 'text-amber-600' : 'text-emerald-600'}" title="${item.settled ? 'Desmarcar' : (isPayable ? 'Marcar como paga' : 'Marcar como recebida')}"><i class="fa-solid ${item.settled ? 'fa-rotate-left' : 'fa-check'} text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('edit','${safeId}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('delete','${safeId}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div></div></li>`;
        });

        return `${html}</ul></section>`;
    }
});
