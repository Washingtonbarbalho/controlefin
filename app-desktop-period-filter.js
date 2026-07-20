import { App } from './firebase-context.js';

Object.assign(App, {
    ensureAccountPeriodState() {
        if (!['month', 'day', 'range'].includes(this.ui.accountPeriodMode)) this.ui.accountPeriodMode = 'month';
        const maxDay = this.getSelectedMonthLastDay();
        this.ui.accountPeriodDay = Math.min(Math.max(Number(this.ui.accountPeriodDay || 1), 1), maxDay);
        this.ui.accountPeriodStart = Math.min(Math.max(Number(this.ui.accountPeriodStart || 1), 1), maxDay);
        this.ui.accountPeriodEnd = Math.min(Math.max(Number(this.ui.accountPeriodEnd || maxDay), 1), maxDay);
        if (this.ui.accountPeriodStart > this.ui.accountPeriodEnd) {
            [this.ui.accountPeriodStart, this.ui.accountPeriodEnd] = [this.ui.accountPeriodEnd, this.ui.accountPeriodStart];
        }
    },

    getSelectedMonthLastDay() {
        const value = this.ui.selectedMonth || this.currentYearMonth();
        const [year, month] = value.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    },

    setAccountPeriodMode(mode) {
        this.ui.accountPeriodMode = ['day', 'range'].includes(mode) ? mode : 'month';
        this.ensureAccountPeriodState();
        this.render();
        this.triggerFade();
    },

    setAccountPeriodDay(value) {
        const maxDay = this.getSelectedMonthLastDay();
        this.ui.accountPeriodDay = Math.min(Math.max(Number(value || 1), 1), maxDay);
        this.render();
    },

    setAccountPeriodStart(value) {
        const maxDay = this.getSelectedMonthLastDay();
        this.ui.accountPeriodStart = Math.min(Math.max(Number(value || 1), 1), maxDay);
        if (this.ui.accountPeriodStart > Number(this.ui.accountPeriodEnd || maxDay)) this.ui.accountPeriodEnd = this.ui.accountPeriodStart;
        this.render();
    },

    setAccountPeriodEnd(value) {
        const maxDay = this.getSelectedMonthLastDay();
        this.ui.accountPeriodEnd = Math.min(Math.max(Number(value || maxDay), 1), maxDay);
        if (this.ui.accountPeriodEnd < Number(this.ui.accountPeriodStart || 1)) this.ui.accountPeriodStart = this.ui.accountPeriodEnd;
        this.render();
    },

    getAccountPeriodRange() {
        this.ensureAccountPeriodState();
        const maxDay = this.getSelectedMonthLastDay();
        if (this.ui.accountPeriodMode === 'day') {
            return { start: this.ui.accountPeriodDay, end: this.ui.accountPeriodDay };
        }
        if (this.ui.accountPeriodMode === 'range') {
            return { start: this.ui.accountPeriodStart, end: this.ui.accountPeriodEnd };
        }
        return { start: 1, end: maxDay };
    },

    getAccountPeriodLabel() {
        const { start, end } = this.getAccountPeriodRange();
        if (this.ui.accountPeriodMode === 'day') return `Dia ${start}`;
        if (this.ui.accountPeriodMode === 'range') return `Dias ${start} a ${end}`;
        return 'Mês inteiro';
    },

    accountMatchesSelectedPeriod(item) {
        if (!this.isValidDateString(item.dueDate)) return false;
        const selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        if ((item.month || item.dueDate.slice(0, 7)) !== selectedMonth) return false;
        const day = Number(item.dueDate.slice(8, 10));
        const { start, end } = this.getAccountPeriodRange();
        return day >= start && day <= end;
    },

    sortAccountsByStatusAndDueDate(accounts) {
        return [...accounts].sort((a, b) => {
            if (Boolean(a.settled) !== Boolean(b.settled)) return a.settled ? 1 : -1;
            const dueComparison = String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
            if (dueComparison !== 0) return dueComparison;
            return String(a.description || '').localeCompare(String(b.description || ''));
        });
    },

    getVisibleAccountsForCurrentFilters() {
        const kind = this.ui.accountKind === 'receivable' ? 'receivable' : 'payable';
        let accounts = this.data.accounts.filter(item => item.kind === kind && this.accountMatchesSelectedPeriod(item));
        if (this.ui.filterCategory) {
            accounts = accounts.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory);
        }
        return this.sortAccountsByStatusAndDueDate(accounts);
    },

    renderCardsView() {
        const cards = [...this.data.cards].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        let html = `<div class="desktop-toolbar mb-6"><div><p class="text-xs text-blue-600 font-black uppercase tracking-widest">Modo Cartões</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Meus Cartões</h1></div><div class="hidden lg:block"></div><button type="button" onclick="App.openCardModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-extrabold shadow-md flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> Novo cartão</button></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">`;

        if (!cards.length) {
            html += `<div class="sm:col-span-2 lg:col-span-3 xl:col-span-4 card-surface border-dashed border-2 py-16 text-center text-slate-400"><i class="fa-solid fa-credit-card text-5xl text-slate-300 mb-4"></i><p class="font-semibold">Nenhum cartão cadastrado.</p></div>`;
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

    renderCardDetailView() {
        const card = this.ui.selectedCard;
        if (!card) return this.renderCardsView();

        const monthTransactions = this.data.transactions.filter(item => item.cardId === card.id && item.invoiceMonth === this.ui.selectedMonth);
        const categories = [...new Set(monthTransactions.map(item => item.categoryName || 'Geral'))].sort((a, b) => a.localeCompare(b));
        let visible = this.ui.filterCategory ? monthTransactions.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory) : [...monthTransactions];
        visible.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        let html = `<div class="desktop-toolbar mb-5"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.navigate('cards')" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div class="min-w-0"><p class="text-[10px] text-blue-600 font-black uppercase tracking-widest">Cartão</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800 truncate">${this.escapeHtml(card.name)}</h1></div></div><div class="flex justify-center">${this.renderMonthFilter('Fatura')}</div><div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateCardPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openTransactionModal('new')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Gasto</button></div></div>`;
        html += `<section class="card-surface p-5 sm:p-6 mb-5 grid lg:grid-cols-[1fr_320px] gap-6 items-end"><div><p class="text-xs text-slate-500 font-black uppercase">${this.ui.filterCategory ? `Total em ${this.escapeHtml(this.ui.filterCategory)}` : 'Total da fatura'}</p><p class="text-3xl sm:text-4xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p><p class="text-xs text-slate-400 mt-2">Vencimento da fatura: dia ${this.escapeHtml(card.dueDate)}</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></section>`;

        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-5 py-3 flex justify-between"><span class="font-bold">Lançamentos</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><div class="hidden lg:block"><div class="desktop-table-row px-5 py-3 bg-slate-50 text-[10px] font-black uppercase text-slate-500" style="grid-template-columns:minmax(260px,1.8fr) minmax(150px,1fr) 150px 130px"><span>Descrição</span><span>Categoria</span><span>Tipo</span><span class="text-right">Valor</span></div>`;
        if (!visible.length) html += `<div class="py-14 text-center text-slate-400"><i class="fa-solid fa-box-open text-3xl mb-3"></i><p>Nenhum lançamento neste mês.</p></div>`;
        visible.forEach(item => {
            const type = item.isRecurring ? 'Recorrente' : (item.totalInstallments > 1 ? `${item.installmentNumber}/${item.totalInstallments}` : 'À vista');
            const safeId = this.escapeJs(item.id);
            html += `<div class="desktop-table-row px-5 py-4 hover:bg-slate-50" style="grid-template-columns:minmax(260px,1.8fr) minmax(150px,1fr) 150px 130px"><div class="min-w-0"><strong class="text-slate-800 block truncate">${this.escapeHtml(item.description || 'Gasto')}</strong><div class="flex gap-1.5 mt-2"><button type="button" onclick="App.openCardActionOptions('edit','${safeId}')" class="text-xs font-bold text-blue-600 hover:underline">Editar</button><span class="text-slate-300">•</span><button type="button" onclick="App.openCardActionOptions('delete','${safeId}')" class="text-xs font-bold text-red-600 hover:underline">Excluir</button></div></div><span class="text-sm text-slate-600">${this.escapeHtml(item.categoryName || 'Geral')}</span><span class="text-sm text-slate-600">${this.escapeHtml(type)}</span><strong class="text-right text-slate-800">${this.formatMoney(item.amount)}</strong></div>`;
        });
        html += `</div><ul class="lg:hidden divide-y divide-slate-100">`;
        if (!visible.length) html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-box-open text-3xl mb-3"></i><p>Nenhum lançamento neste mês.</p></li>`;
        visible.forEach(item => {
            const installment = item.totalInstallments > 1 && !item.isRecurring ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>` : '';
            const recurring = item.isRecurring ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>' : '';
            const safeId = this.escapeJs(item.id);
            html += `<li class="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800">${this.escapeHtml(item.description || 'Gasto')}</strong>${installment}${recurring}</div><span class="status-pill bg-slate-100 text-slate-600 mt-2"><i class="fa-solid fa-tag"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span></div><div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-3 sm:pt-0"><strong class="text-lg text-slate-800 min-w-[105px] sm:text-right">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openCardActionOptions('edit','${safeId}')" class="action-icon text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openCardActionOptions('delete','${safeId}')" class="action-icon text-red-600"><i class="fa-solid fa-trash text-xs"></i></button></div></div></li>`;
        });
        return `${html}</ul></section>`;
    },

    renderAccountPeriodControls(categories) {
        this.ensureAccountPeriodState();
        const maxDay = this.getSelectedMonthLastDay();
        let periodFields = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"><i class="fa-regular fa-calendar-check mr-2 text-emerald-600"></i>Exibindo todos os dias do mês.</div>`;
        if (this.ui.accountPeriodMode === 'day') {
            periodFields = `<div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Dia do mês</label><input type="number" min="1" max="${maxDay}" value="${this.ui.accountPeriodDay}" onchange="App.setAccountPeriodDay(this.value)" class="input-modern font-bold text-center"></div>`;
        } else if (this.ui.accountPeriodMode === 'range') {
            periodFields = `<div class="grid grid-cols-2 gap-2"><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Do dia</label><input type="number" min="1" max="${maxDay}" value="${this.ui.accountPeriodStart}" onchange="App.setAccountPeriodStart(this.value)" class="input-modern font-bold text-center"></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Até o dia</label><input type="number" min="1" max="${maxDay}" value="${this.ui.accountPeriodEnd}" onchange="App.setAccountPeriodEnd(this.value)" class="input-modern font-bold text-center"></div></div>`;
        }

        return `<section class="card-surface p-4 sm:p-5 mb-5"><div class="desktop-filter-grid space-y-3 lg:space-y-0"><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Período</label><select onchange="App.setAccountPeriodMode(this.value)" class="input-modern font-bold"><option value="month" ${this.ui.accountPeriodMode === 'month' ? 'selected' : ''}>Mês inteiro</option><option value="day" ${this.ui.accountPeriodMode === 'day' ? 'selected' : ''}>Dia específico</option><option value="range" ${this.ui.accountPeriodMode === 'range' ? 'selected' : ''}>Intervalo de dias</option></select></div>${periodFields}<div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></div><p class="text-xs text-slate-400 mt-3"><i class="fa-solid fa-filter mr-1"></i>${this.escapeHtml(this.getAccountPeriodLabel())} de ${this.formatMonthSmall(this.ui.selectedMonth)}. Pendentes aparecem primeiro.</p></section>`;
    },

    renderAccountsView() {
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        this.ensureAccountPeriodState();

        if (!this.ui.accountListOpen) {
            const summarize = kind => {
                const accounts = this.data.accounts.filter(item => item.kind === kind && (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth);
                return { accounts, total: accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) };
            };
            const payable = summarize('payable');
            const receivable = summarize('receivable');
            return `<div class="desktop-toolbar mb-6"><div><p class="text-xs text-emerald-600 font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Minhas Contas</h1></div><div class="flex justify-center">${this.renderMonthFilter('Vencimentos')}</div><div class="hidden lg:block"></div></div><div class="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto"><article class="card-surface p-5 hover:border-red-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('payable')"><div class="mb-3"><p class="text-xs text-slate-400 font-bold uppercase">Conta</p><h2 class="text-xl font-black text-slate-800">Contas a Pagar</h2></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimentos do mês selecionado</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500">${payable.accounts.length} lançamento(s)</p></div><strong class="text-xl font-black ${payable.total > 0 ? 'text-red-600' : 'text-slate-700'}">${this.formatMoney(payable.total)}</strong></div></article><article class="card-surface p-5 hover:border-emerald-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('receivable')"><div class="mb-3"><p class="text-xs text-slate-400 font-bold uppercase">Conta</p><h2 class="text-xl font-black text-slate-800">Contas a Receber</h2></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimentos do mês selecionado</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500">${receivable.accounts.length} lançamento(s)</p></div><strong class="text-xl font-black ${receivable.total > 0 ? 'text-emerald-600' : 'text-slate-700'}">${this.formatMoney(receivable.total)}</strong></div></article></div>`;
        }

        const kind = this.ui.accountKind === 'receivable' ? 'receivable' : 'payable';
        const isPayable = kind === 'payable';
        const periodAccounts = this.sortAccountsByStatusAndDueDate(this.data.accounts.filter(item => item.kind === kind && this.accountMatchesSelectedPeriod(item)));
        const categories = [...new Set(periodAccounts.map(item => item.categoryName || 'Geral'))].sort((a, b) => a.localeCompare(b));
        const visible = this.getVisibleAccountsForCurrentFilters();
        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const settledTotal = visible.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingTotal = total - settledTotal;
        const overdue = visible.filter(item => !item.settled && this.isOverdue(item.dueDate));

        let html = `<div class="desktop-toolbar mb-5"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.backToAccountKinds()" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div><p class="text-xs ${isPayable ? 'text-red-600' : 'text-emerald-600'} font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">${isPayable ? 'Contas a Pagar' : 'Contas a Receber'}</h1></div></div><div class="flex justify-center">${this.renderMonthFilter('Vencimentos')}</div><div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateAccountsPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openAccountModal('new')" class="${isPayable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Nova conta</button></div></div>`;
        html += this.renderAccountPeriodControls(categories);
        html += `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Total filtrado</p><p class="text-xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">${isPayable ? 'Pago' : 'Recebido'}</p><p class="text-xl font-black text-emerald-600 mt-1">${this.formatMoney(settledTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Pendente</p><p class="text-xl font-black text-amber-600 mt-1">${this.formatMoney(pendingTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Em atraso</p><p class="text-xl font-black text-red-600 mt-1">${overdue.length} conta(s)</p></div></div>`;

        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-5 py-3 flex justify-between"><span class="font-bold">${isPayable ? 'Contas a pagar' : 'Contas a receber'}</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><div class="hidden lg:block"><div class="desktop-table-row px-5 py-3 bg-slate-50 text-[10px] font-black uppercase text-slate-500" style="grid-template-columns:minmax(260px,1.7fr) 130px minmax(150px,1fr) 130px 130px 120px"><span>Descrição</span><span>Vencimento</span><span>Categoria</span><span>Parcela</span><span>Situação</span><span class="text-right">Valor</span></div>`;
        if (!visible.length) html += `<div class="py-14 text-center text-slate-400"><i class="fa-solid fa-calendar-check text-3xl mb-3"></i><p>Nenhuma conta neste período.</p></div>`;
        visible.forEach(item => {
            const isLate = !item.settled && this.isOverdue(item.dueDate);
            const installment = item.isRecurring ? 'Recorrente' : (item.totalInstallments > 1 ? `${item.installmentNumber}/${item.totalInstallments}` : 'Única');
            const status = item.settled ? (isPayable ? 'Pago' : 'Recebido') : (isLate ? 'Atrasado' : 'Pendente');
            const statusClass = item.settled ? 'text-emerald-700 bg-emerald-50' : (isLate ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50');
            const safeId = this.escapeJs(item.id);
            html += `<div class="desktop-table-row px-5 py-4 ${item.settled ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}" style="grid-template-columns:minmax(260px,1.7fr) 130px minmax(150px,1fr) 130px 130px 120px"><div class="min-w-0"><strong class="text-slate-800 block truncate ${item.settled ? 'line-through opacity-65' : ''}">${this.escapeHtml(item.description || 'Conta')}</strong><div class="flex gap-1.5 mt-2"><button type="button" onclick="App.openSettlementOptions('${safeId}')" class="text-xs font-bold ${item.settled ? 'text-amber-600' : 'text-emerald-600'} hover:underline">${item.settled ? 'Desmarcar' : (isPayable ? 'Pagar' : 'Receber')}</button><span class="text-slate-300">•</span><button type="button" onclick="App.openAccountActionOptions('edit','${safeId}')" class="text-xs font-bold text-blue-600 hover:underline">Editar</button><span class="text-slate-300">•</span><button type="button" onclick="App.openAccountActionOptions('delete','${safeId}')" class="text-xs font-bold text-red-600 hover:underline">Excluir</button></div></div><span class="text-sm text-slate-600">${this.formatDateBR(item.dueDate)}</span><span class="text-sm text-slate-600 truncate">${this.escapeHtml(item.categoryName || 'Geral')}</span><span class="text-sm text-slate-600">${this.escapeHtml(installment)}</span><span class="status-pill ${statusClass} justify-self-start">${status}</span><strong class="text-right ${isPayable ? 'text-red-600' : 'text-emerald-600'}">${this.formatMoney(item.amount)}</strong></div>`;
        });
        html += `</div><ul class="lg:hidden divide-y divide-slate-100">`;
        if (!visible.length) html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-calendar-check text-3xl mb-3"></i><p>Nenhuma conta neste período.</p></li>`;
        visible.forEach(item => {
            const isLate = !item.settled && this.isOverdue(item.dueDate);
            const installment = item.totalInstallments > 1 && !item.isRecurring ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>` : '';
            const recurring = item.isRecurring ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>' : '';
            const status = item.settled ? `<span class="status-pill bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check"></i>${isPayable ? 'Pago' : 'Recebido'}</span>` : (isLate ? '<span class="status-pill bg-red-100 text-red-700"><i class="fa-solid fa-triangle-exclamation"></i>Atrasado</span>' : '<span class="status-pill bg-amber-100 text-amber-700"><i class="fa-solid fa-clock"></i>Pendente</span>');
            const safeId = this.escapeJs(item.id);
            html += `<li class="p-4 ${item.settled ? 'bg-emerald-50/30' : ''} hover:bg-slate-50 transition"><div class="flex flex-col lg:flex-row lg:items-center gap-3"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800 ${item.settled ? 'line-through opacity-70' : ''}">${this.escapeHtml(item.description)}</strong>${installment}${recurring}${status}</div><div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>Vence ${this.formatDateBR(item.dueDate)}</span><span><i class="fa-solid fa-tag mr-1"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span>${item.settledAt ? `<span><i class="fa-solid fa-check mr-1"></i>Concluída em ${this.formatDateTimeBR(item.settledAt)}</span>` : ''}</div></div><div class="flex items-center justify-between gap-3 border-t pt-3"><strong class="text-lg min-w-[110px] text-right ${isPayable ? 'text-red-600' : 'text-emerald-600'}">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openSettlementOptions('${safeId}')" class="action-icon ${item.settled ? 'text-amber-600' : 'text-emerald-600'}" title="${item.settled ? 'Desmarcar' : (isPayable ? 'Marcar como paga' : 'Marcar como recebida')}"><i class="fa-solid ${item.settled ? 'fa-rotate-left' : 'fa-check'} text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('edit','${safeId}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('delete','${safeId}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div></div></li>`;
        });
        return `${html}</ul></section>`;
    },

    async generateAccountsPDF() {
        const button = document.getElementById('btn-pdf');
        if (!button) return;
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Gerando';
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            const kind = this.ui.accountKind;
            const isPayable = kind === 'payable';
            const accounts = this.getVisibleAccountsForCurrentFilters();
            const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const settledTotal = accounts.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(18);
            pdf.setTextColor(isPayable ? 185 : 5, isPayable ? 28 : 150, isPayable ? 28 : 105);
            pdf.text(isPayable ? 'Contas a Pagar' : 'Contas a Receber', 14, 20);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Referência: ${this.formatMonthSmall(this.ui.selectedMonth)} | Período: ${this.getAccountPeriodLabel()}`, 14, 28);

            const rows = accounts.map(item => [
                item.description || 'Conta',
                this.formatDateBR(item.dueDate),
                item.categoryName || 'Geral',
                item.settled ? (isPayable ? 'Pago' : 'Recebido') : (this.isOverdue(item.dueDate) ? 'Atrasado' : 'Pendente'),
                this.formatMoney(item.amount)
            ]);
            if (!rows.length) rows.push(['Nenhuma conta', '-', '-', '-', this.formatMoney(0)]);
            pdf.autoTable({
                startY: 36,
                head: [['Descrição', 'Vencimento', 'Categoria', 'Situação', 'Valor']],
                body: rows,
                theme: 'grid',
                headStyles: { fillColor: isPayable ? [185, 28, 28] : [5, 150, 105] },
                styles: { fontSize: 8.5 },
                columnStyles: { 4: { halign: 'right', cellWidth: 30 } }
            });
            const finalY = pdf.lastAutoTable?.finalY || 45;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(51, 65, 85);
            pdf.text(`Total filtrado: ${this.formatMoney(total)}`, 14, finalY + 9);
            pdf.text(`${isPayable ? 'Pago' : 'Recebido'}: ${this.formatMoney(settledTotal)}`, 14, finalY + 16);
            pdf.text(`Pendente: ${this.formatMoney(total - settledTotal)}`, 14, finalY + 23);
            const periodSuffix = this.getAccountPeriodLabel().replace(/[^a-zA-Z0-9]+/g, '_');
            const fileName = `${isPayable ? 'Contas_a_Pagar' : 'Contas_a_Receber'}_${this.ui.selectedMonth}_${periodSuffix}.pdf`;
            await this.shareOrDownloadPDF(pdf, fileName, isPayable ? 'Contas a Pagar' : 'Contas a Receber', `Relatório de ${this.formatMonthSmall(this.ui.selectedMonth)} — ${this.getAccountPeriodLabel()}.`);
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao gerar PDF.', 'error');
        } finally {
            button.innerHTML = original;
            button.disabled = false;
        }
    }
});
