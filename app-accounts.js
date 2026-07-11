import { App, db, APP_ID, doc, writeBatch } from './firebase-context.js';

Object.assign(App, {
    async saveAccount(event) {
        event.preventDefault();
        const totalAmount = this.unmaskCurrency(document.getElementById('account-amount').value);
        const description = document.getElementById('account-desc').value.trim();
        const firstDueDate = document.getElementById('account-due-date').value;
        const kind = document.getElementById('account-kind').value === 'receivable' ? 'receivable' : 'payable';
        const rawType = document.getElementById('account-type').value;
        const isRecurring = rawType === 'recorrente';
        const installmentCount = rawType === 'parcelado' ? Number(document.getElementById('account-installments').value) : (isRecurring ? 60 : 1);
        if (!description || !firstDueDate || !Number.isFinite(totalAmount) || totalAmount <= 0 || installmentCount < 1 || installmentCount > 120) return this.showToast('Preencha os dados da conta corretamente.', 'error');

        this.showLoader('Salvando conta...');
        try {
            const category = await this.ensureCategory(document.getElementById('account-category').value);
            const isEdit = this.ui.actionScope && this.ui.actionScope !== 'new';
            if (isEdit) {
                const current = this.ui.editingItem;
                const grouped = this.data.accounts.filter(item => item.groupId === current.groupId);
                const targets = this.selectTargets(grouped, current, this.ui.actionScope, 'dueDate');
                const batch = writeBatch(db);
                targets.forEach(item => {
                    let amount = totalAmount;
                    if (this.ui.actionScope === 'all' && !item.isRecurring && item.totalInstallments > 1) amount = totalAmount / item.totalInstallments;
                    const changes = {
                        description,
                        categoryId: category.id,
                        categoryName: category.name,
                        amount,
                        ...(this.ui.actionScope === 'all' ? { totalAmount } : {}),
                        updatedAt: new Date().toISOString()
                    };
                    if (this.ui.actionScope === 'single') {
                        changes.dueDate = firstDueDate;
                        changes.month = firstDueDate.slice(0, 7);
                    }
                    batch.update(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/accounts/${item.id}`), changes);
                });
                await batch.commit();
            } else {
                const groupId = crypto.randomUUID();
                const amountPerInstallment = isRecurring ? totalAmount : totalAmount / installmentCount;
                const batch = writeBatch(db);
                for (let index = 0; index < installmentCount; index += 1) {
                    const dueDate = this.addMonthsToDate(firstDueDate, index);
                    const id = crypto.randomUUID();
                    batch.set(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/accounts/${id}`), {
                        groupId,
                        kind,
                        description,
                        categoryId: category.id,
                        categoryName: category.name,
                        amount: amountPerInstallment,
                        totalAmount,
                        installmentNumber: index + 1,
                        totalInstallments: installmentCount,
                        isRecurring,
                        dueDate,
                        month: dueDate.slice(0, 7),
                        settled: false,
                        settledAt: null,
                        createdAt: new Date().toISOString()
                    });
                }
                await batch.commit();
            }
            this.ui.accountKind = kind;
            this.ui.selectedMonth = firstDueDate.slice(0, 7);
            this.closeModal('modal-account');
            this.closeModal('modal-action-options');
            this.showToast(kind === 'payable' ? 'Conta a pagar salva.' : 'Conta a receber salva.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao salvar a conta.', 'error');
        } finally { this.hideLoader(); }
    },

    openAccountActionOptions(action, accountId) {
        const account = this.data.accounts.find(item => item.id === accountId);
        if (!account) return;
        this.ui.editingItem = account;
        this.ui.currentAction = action;
        this.ui.actionEntity = 'account';
        const grouped = this.data.accounts.filter(item => item.groupId === account.groupId);
        if (grouped.length <= 1) return action === 'edit' ? this.openAccountModal('single', account) : this.handleAccountOption('single');
        this.openScopeModal({
            title: action === 'edit' ? 'Editar conta' : 'Excluir conta',
            message: account.isRecurring ? 'Escolha quais ocorrências serão afetadas.' : 'Escolha quais parcelas serão afetadas.',
            destructive: action === 'delete',
            options: [
                ['single', account.isRecurring ? 'Apenas este vencimento' : 'Apenas esta parcela'],
                ['forward', account.isRecurring ? 'Deste vencimento em diante' : 'Desta parcela em diante'],
                ['all', account.isRecurring ? 'Todas as ocorrências' : 'Todas as parcelas']
            ],
            handler: 'App.handleAccountOption'
        });
    },

    async handleAccountOption(scope) {
        this.closeModal('modal-action-options');
        this.ui.actionScope = scope;
        if (this.ui.currentAction === 'edit') return this.openAccountModal(scope, this.ui.editingItem);
        const current = this.ui.editingItem;
        const grouped = this.data.accounts.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'dueDate');
        const confirmed = await this.confirmDialog('Excluir conta', `Deseja excluir ${targets.length === 1 ? 'esta conta' : `${targets.length} contas/parcelas`}?`);
        if (!confirmed) return;
        this.showLoader('Excluindo conta...');
        try {
            const batch = writeBatch(db);
            targets.forEach(item => batch.delete(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/accounts/${item.id}`)));
            await batch.commit();
            this.showToast('Conta excluída.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao excluir conta.', 'error');
        } finally { this.hideLoader(); }
    },

    openSettlementOptions(accountId) {
        const account = this.data.accounts.find(item => item.id === accountId);
        if (!account) return;
        this.ui.editingItem = account;
        this.ui.currentAction = account.settled ? 'unsettle' : 'settle';
        const grouped = this.data.accounts.filter(item => item.groupId === account.groupId);
        if (grouped.length <= 1) return this.handleSettlement('single');
        const verb = account.kind === 'payable' ? (account.settled ? 'desmarcar pagamentos' : 'marcar pagamentos') : (account.settled ? 'desmarcar recebimentos' : 'marcar recebimentos');
        this.openScopeModal({
            title: account.settled ? 'Desmarcar como concluída' : (account.kind === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'),
            message: `Escolha em quais parcelas deseja ${verb}.`,
            destructive: account.settled,
            options: [
                ['single', 'Apenas esta parcela'],
                ['backward', 'Da primeira até esta parcela'],
                ['forward', 'Desta parcela em diante'],
                ['all', 'Todas as parcelas']
            ],
            handler: 'App.handleSettlement'
        });
    },

    async handleSettlement(scope) {
        this.closeModal('modal-action-options');
        const current = this.ui.editingItem;
        const grouped = this.data.accounts.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'dueDate');
        const settling = this.ui.currentAction === 'settle';
        const actionName = current.kind === 'payable' ? (settling ? 'paga' : 'não paga') : (settling ? 'recebida' : 'não recebida');
        if (!settling) {
            const confirmed = await this.confirmDialog('Desmarcar confirmação', `Deseja marcar ${targets.length === 1 ? 'esta conta' : `${targets.length} contas`} como ${actionName}?`);
            if (!confirmed) return;
        } else if (targets.length > 1) {
            const confirmed = await this.confirmDialog('Confirmar várias parcelas', `Deseja marcar ${targets.length} parcelas como ${actionName}?`);
            if (!confirmed) return;
        }
        this.showLoader(settling ? 'Confirmando...' : 'Desmarcando...');
        try {
            const batch = writeBatch(db);
            targets.forEach(item => batch.update(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/accounts/${item.id}`), {
                settled: settling,
                settledAt: settling ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
            }));
            await batch.commit();
            this.showToast(`Conta(s) marcada(s) como ${actionName}.`);
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao atualizar a situação.', 'error');
        } finally { this.hideLoader(); }
    },

    renderAccountsView() {
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        const kind = this.ui.accountKind;
        const isPayable = kind === 'payable';
        let monthAccounts = this.data.accounts.filter(item => item.kind === kind && (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth);
        const categories = [...new Set(monthAccounts.map(item => item.categoryName || 'Geral'))].sort((a, b) => a.localeCompare(b));
        let visible = this.ui.filterCategory ? monthAccounts.filter(item => (item.categoryName || 'Geral') === this.ui.filterCategory) : [...monthAccounts];
        visible.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.description || '').localeCompare(b.description || ''));
        const total = visible.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const settledTotal = visible.filter(item => item.settled).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingTotal = total - settledTotal;
        const overdue = visible.filter(item => !item.settled && this.isOverdue(item.dueDate));
        let html = `<div class="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><p class="text-xs text-emerald-600 font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Contas a Pagar e Receber</h1></div><div class="flex flex-col sm:flex-row gap-2">${this.renderMonthFilter('Vencimentos')}<div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateAccountsPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openAccountModal('new')" class="${isPayable ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Nova conta</button></div></div></div>`;
        html += `<div class="grid grid-cols-2 bg-slate-200 p-1 rounded-xl mb-5 max-w-lg"><button type="button" onclick="App.setAccountKind('payable')" class="py-2.5 rounded-lg font-extrabold text-sm transition ${isPayable ? 'bg-white text-red-700 shadow' : 'text-slate-500'}"><i class="fa-solid fa-arrow-up mr-1.5"></i> Contas a Pagar</button><button type="button" onclick="App.setAccountKind('receivable')" class="py-2.5 rounded-lg font-extrabold text-sm transition ${!isPayable ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}"><i class="fa-solid fa-arrow-down mr-1.5"></i> Contas a Receber</button></div>`;
        html += `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Total do mês</p><p class="text-xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">${isPayable ? 'Pago' : 'Recebido'}</p><p class="text-xl font-black text-emerald-600 mt-1">${this.formatMoney(settledTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Pendente</p><p class="text-xl font-black text-amber-600 mt-1">${this.formatMoney(pendingTotal)}</p></div><div class="card-surface p-4"><p class="text-[10px] font-black text-slate-400 uppercase">Em atraso</p><p class="text-xl font-black text-red-600 mt-1">${overdue.length} conta(s)</p></div></div>`;
        html += `<section class="card-surface p-4 mb-4"><div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p class="text-sm font-black text-slate-800">${isPayable ? 'Saídas previstas' : 'Entradas previstas'} — ${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500 mt-1">Cada parcela usa seu próprio dia de vencimento.</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern min-w-[210px]"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></div></section>`;
        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-4 py-3 flex justify-between"><span class="font-bold">${isPayable ? 'Contas a pagar' : 'Contas a receber'}</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><ul class="divide-y divide-slate-100">`;
        if (!visible.length) html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-calendar-check text-3xl mb-3"></i><p>Nenhuma conta neste mês.</p></li>`;
        visible.forEach(item => {
            const isLate = !item.settled && this.isOverdue(item.dueDate);
            const installment = item.totalInstallments > 1 && !item.isRecurring ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>` : '';
            const recurring = item.isRecurring ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>' : '';
            const status = item.settled ? `<span class="status-pill bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle-check"></i>${isPayable ? 'Pago' : 'Recebido'}</span>` : (isLate ? '<span class="status-pill bg-red-100 text-red-700"><i class="fa-solid fa-triangle-exclamation"></i>Atrasado</span>' : '<span class="status-pill bg-amber-100 text-amber-700"><i class="fa-solid fa-clock"></i>Pendente</span>');
            html += `<li class="p-4 ${item.settled ? 'bg-emerald-50/30' : ''} hover:bg-slate-50 transition"><div class="flex flex-col lg:flex-row lg:items-center gap-3"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800 ${item.settled ? 'line-through opacity-70' : ''}">${this.escapeHtml(item.description)}</strong>${installment}${recurring}${status}</div><div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>Vence ${this.formatDateBR(item.dueDate)}</span><span><i class="fa-solid fa-tag mr-1"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span>${item.settledAt ? `<span><i class="fa-solid fa-check mr-1"></i>Concluída em ${this.formatDateTimeBR(item.settledAt)}</span>` : ''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3 border-t lg:border-0 pt-3 lg:pt-0"><strong class="text-lg min-w-[110px] lg:text-right ${isPayable ? 'text-red-600' : 'text-emerald-600'}">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openSettlementOptions('${item.id}')" class="action-icon ${item.settled ? 'text-amber-600' : 'text-emerald-600'}" title="${item.settled ? 'Desmarcar' : (isPayable ? 'Marcar como paga' : 'Marcar como recebida')}"><i class="fa-solid ${item.settled ? 'fa-rotate-left' : 'fa-check'} text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('edit','${item.id}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openAccountActionOptions('delete','${item.id}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div></div></li>`;
        });
        return `${html}</ul></section>`;
    },
});
