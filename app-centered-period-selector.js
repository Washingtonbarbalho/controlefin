import { App } from './firebase-context.js';

const renderAccountsLanding = App.renderAccountsView.bind(App);

Object.assign(App, {
    renderCardDetailView() {
        const card = this.ui.selectedCard;
        if (!card) return this.renderCardsView();

        const monthTransactions = this.data.transactions.filter(item =>
            item.cardId === card.id && item.invoiceMonth === this.ui.selectedMonth
        );
        const categories = [...new Set(monthTransactions.map(item => item.categoryName || 'Geral'))]
            .sort((a, b) => a.localeCompare(b));
        let visible = this.ui.filterCategory
            ? monthTransactions.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory)
            : [...monthTransactions];
        visible.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        let html = `<div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.navigate('cards')" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div class="min-w-0"><p class="text-[10px] text-blue-600 font-black uppercase tracking-widest">Cartão</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800 truncate">${this.escapeHtml(card.name)}</h1></div></div><div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateCardPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openTransactionModal('new')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Gasto</button></div></div>`;
        html += `<div class="flex justify-center mb-5">${this.renderMonthFilter('Fatura')}</div>`;
        html += `<section class="card-surface p-5 sm:p-6 mb-5 grid sm:grid-cols-[1fr_auto] gap-5 items-end"><div><p class="text-xs text-slate-500 font-black uppercase">${this.ui.filterCategory ? `Total em ${this.escapeHtml(this.ui.filterCategory)}` : 'Total da fatura'}</p><p class="text-3xl sm:text-4xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p><p class="text-xs text-slate-400 mt-2">Vencimento da fatura: dia ${this.escapeHtml(card.dueDate)}</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern min-w-[210px]"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></section>`;
        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-4 py-3 flex justify-between"><span class="font-bold">Lançamentos</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><ul class="divide-y divide-slate-100">`;

        if (!visible.length) {
            html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-box-open text-3xl mb-3"></i><p>Nenhum lançamento neste mês.</p></li>`;
        }

        visible.forEach(item => {
            const installment = item.totalInstallments > 1 && !item.isRecurring
                ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>`
                : '';
            const recurring = item.isRecurring
                ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>'
                : '';
            const safeId = this.escapeJs(item.id);
            html += `<li class="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800">${this.escapeHtml(item.description || 'Gasto')}</strong>${installment}${recurring}</div><span class="status-pill bg-slate-100 text-slate-600 mt-2"><i class="fa-solid fa-tag"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span></div><div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-3 sm:pt-0"><strong class="text-lg text-slate-800 min-w-[105px] sm:text-right">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openCardActionOptions('edit','${safeId}')" class="action-icon text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openCardActionOptions('delete','${safeId}')" class="action-icon text-red-600"><i class="fa-solid fa-trash text-xs"></i></button></div></div></li>`;
        });

        return `${html}</ul></section>`;
    },

    renderAccountsView() {
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        if (!this.ui.accountListOpen) return renderAccountsLanding();

        const kind = this.ui.accountKind;
        const isPayable = kind === 'payable';
        const monthAccounts = this.data.accounts.filter(item =>
            item.kind === kind &&
            (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth
        );
        const categories = [...new Set(monthAccounts.map(item => item.categoryName || 'Geral'))]
            .sort((a, b) => a.localeCompare(b));
        let visible = this.ui.filterCategory
            ? monthAccounts.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory)
            : [...monthAccounts];
        visible.sort((a, b) =>
            (a.dueDate || '').localeCompare(b.dueDate || '') ||
            (a.description || '').localeCompare(b.description || '')
        );

        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const settledTotal = visible.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingTotal = total - settledTotal;
        const overdue = visible.filter(item => !item.settled && this.isOverdue(item.dueDate));

        let html = `<div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.backToAccountKinds()" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div><p class="text-xs ${isPayable ? 'text-red-600' : 'text-emerald-600'} font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">${isPayable ? 'Contas a Pagar' : 'Contas a Receber'}</h1></div></div><div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateAccountsPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openAccountModal('new')" class="${isPayable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Nova conta</button></div></div>`;
        html += `<div class="flex justify-center mb-5">${this.renderMonthFilter('Vencimentos')}</div>`;
        html += `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Total do mês</p><p class="text-xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">${isPayable ? 'Pago' : 'Recebido'}</p><p class="text-xl font-black text-emerald-600 mt-1">${this.formatMoney(settledTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Pendente</p><p class="text-xl font-black text-amber-600 mt-1">${this.formatMoney(pendingTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Em atraso</p><p class="text-xl font-black text-red-600 mt-1">${overdue.length} conta(s)</p></div></div>`;
        html += `<section class="card-surface p-4 mb-4"><div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p class="text-sm font-black text-slate-800">${isPayable ? 'Saídas previstas' : 'Entradas previstas'} — ${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500 mt-1">Cada parcela usa seu próprio dia de vencimento.</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern min-w-[210px]"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></div></section>`;
        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-4 py-3 flex justify-between"><span class="font-bold">${isPayable ? 'Contas a pagar' : 'Contas a receber'}</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><ul class="divide-y divide-slate-100">`;

        if (!visible.length) {
            html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-calendar-check text-3xl mb-3"></i><p>Nenhuma conta neste mês.</p></li>`;
        }

        visible.forEach(item => {
            const isLate = !item.settled && this.isOverdue(item.dueDate);
            const installment = item.totalInstallments > 1 && !item.isRecurring
                ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>`
                : '';
            const recurring = item.isRecurring
                ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>'
                : '';
            const status = item.settled
                ? `<span class="status-pill bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check"></i>${isPayable ? 'Pago' : 'Recebido'}</span>`
                : (isLate
                    ? '<span class="status-pill bg-red-100 text-red-700"><i class="fa-solid fa-triangle-exclamation"></i>Atrasado</span>'
                    : '<span class="status-pill bg-amber-100 text-amber-700"><i class="fa-solid fa-clock"></i>Pendente</span>');
            const safeId = this.escapeJs(item.id);

            html += `<li class="p-4 ${item.settled ? 'bg-emerald-50/30' : ''} hover:bg-slate-50 transition"><div class="flex flex-col lg:flex-row lg:items-center gap-3"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800 ${item.settled ? 'line-through opacity-70' : ''}">${this.escapeHtml(item.description)}</strong>${installment}${recurring}${status}</div><div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>Vence ${this.formatDateBR(item.dueDate)}</span><span><i class="fa-solid fa-tag mr-1"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span>${item.settledAt ? `<span><i class="fa-solid fa-check mr-1"></i>Concluída em ${this.formatDateTimeBR(item.settledAt)}</span>` : ''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3 border-t lg:border-0 pt-3 lg:pt-0"><strong class="text-lg min-w-[110px] lg:text-right ${isPayable ? 'text-red-600' : 'text-emerald-600'}">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openSettlementOptions('${safeId}')" class="action-icon ${item.settled ? 'text-amber-600' : 'text-emerald-600'}" title="${item.settled ? 'Desmarcar' : (isPayable ? 'Marcar como paga' : 'Marcar como recebida')}"><i class="fa-solid ${item.settled ? 'fa-rotate-left' : 'fa-check'} text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('edit','${safeId}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('delete','${safeId}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div></div></li>`;
        });

        return `${html}</ul></section>`;
    }
});
