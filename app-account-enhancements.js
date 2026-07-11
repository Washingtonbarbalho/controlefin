import { App, db, APP_ID, doc, writeBatch } from './firebase-context.js';

const baseRenderAccountsView = App.renderAccountsView.bind(App);

Object.assign(App, {
    renderAccountsView() {
        this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();

        // A tela de entrada do modo Contas mantém os dois cards enxutos,
        // com o seletor de mês centralizado em uma linha própria.
        if (!this.ui.accountListOpen) {
            const summarize = kind => {
                const accounts = this.data.accounts.filter(item =>
                    item.kind === kind &&
                    (item.month || item.dueDate?.slice(0, 7)) === this.ui.selectedMonth
                );
                const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                return { accounts, total };
            };

            const payable = summarize('payable');
            const receivable = summarize('receivable');

            return `<div class="mb-4"><p class="text-xs text-emerald-600 font-black uppercase tracking-widest">Modo Contas</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Minhas Contas</h1></div><div class="flex justify-center mb-6">${this.renderMonthFilter('Vencimentos')}</div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"><article class="card-surface p-5 hover:border-red-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('payable')"><div class="mb-3"><p class="text-xs text-slate-400 font-bold uppercase">Conta</p><h2 class="text-xl font-black text-slate-800">Contas a Pagar</h2></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimentos do mês selecionado</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500">${payable.accounts.length} lançamento(s)</p></div><strong class="text-xl font-black ${payable.total > 0 ? 'text-red-600' : 'text-slate-700'}">${this.formatMoney(payable.total)}</strong></div></article><article class="card-surface p-5 hover:border-emerald-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.openAccountKind('receivable')"><div class="mb-3"><p class="text-xs text-slate-400 font-bold uppercase">Conta</p><h2 class="text-xl font-black text-slate-800">Contas a Receber</h2></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimentos do mês selecionado</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(this.ui.selectedMonth)}</p><p class="text-xs text-slate-500">${receivable.accounts.length} lançamento(s)</p></div><strong class="text-xl font-black ${receivable.total > 0 ? 'text-emerald-600' : 'text-slate-700'}">${this.formatMoney(receivable.total)}</strong></div></article></div>`;
        }

        return baseRenderAccountsView();
    },

    openSettlementOptions(accountId) {
        const account = this.data.accounts.find(item => item.id === accountId);
        if (!account) return;

        this.ui.editingItem = account;
        this.ui.currentAction = account.settled ? 'unsettle' : 'settle';
        const grouped = this.data.accounts.filter(item => item.groupId === account.groupId);

        if (grouped.length <= 1) return this.handleSettlement('single');

        const verb = account.kind === 'payable'
            ? (account.settled ? 'desmarcar pagamentos' : 'marcar pagamentos')
            : (account.settled ? 'desmarcar recebimentos' : 'marcar recebimentos');

        this.openScopeModal({
            title: account.settled
                ? 'Desmarcar como concluída'
                : (account.kind === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'),
            message: `Escolha em quais parcelas deseja ${verb}.`,
            destructive: account.settled,
            options: [
                ['single', 'Apenas esta parcela'],
                ['backward', 'Da primeira até esta parcela'],
                ['forward', 'Desta parcela em diante'],
                ['all', 'Todas as parcelas'],
                ['custom', 'Personalizado — escolher parcelas']
            ],
            handler: 'App.handleSettlement'
        });
    },

    handleSettlement(scope) {
        if (scope === 'custom') return this.openCustomSettlementModal();
        return this.applySettlementScope(scope);
    },

    openCustomSettlementModal() {
        const current = this.ui.editingItem;
        if (!current) return;

        const settling = this.ui.currentAction === 'settle';
        const grouped = this.data.accounts
            .filter(item => item.groupId === current.groupId)
            .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0));

        const panel = document.getElementById('scope-options-content');
        if (!panel) return;

        const isPayable = current.kind === 'payable';
        const actionLabel = isPayable
            ? (settling ? 'Marcar selecionadas como pagas' : 'Desmarcar pagamentos selecionados')
            : (settling ? 'Marcar selecionadas como recebidas' : 'Desmarcar recebimentos selecionados');

        const rows = grouped.map(item => {
            const canChange = settling ? !item.settled : item.settled;
            const isCurrent = item.id === current.id && canChange;
            const installmentLabel = item.isRecurring
                ? 'Recorrente'
                : (item.totalInstallments > 1 ? `${item.installmentNumber}/${item.totalInstallments}` : 'Única');
            const statusLabel = item.settled
                ? (isPayable ? 'Paga' : 'Recebida')
                : 'Pendente';

            return `<label class="flex items-center gap-3 p-3 rounded-xl border ${canChange ? 'border-slate-200 hover:bg-slate-50 cursor-pointer' : 'border-slate-100 bg-slate-50 opacity-55 cursor-not-allowed'}"><input type="checkbox" class="custom-settlement-check w-5 h-5 accent-emerald-600 shrink-0" value="${this.escapeAttr(item.id)}" ${isCurrent ? 'checked' : ''} ${canChange ? '' : 'disabled'}><div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><strong class="text-sm text-slate-800 truncate">${this.escapeHtml(item.description || 'Conta')}</strong><strong class="text-sm ${isPayable ? 'text-red-600' : 'text-emerald-600'} shrink-0">${this.formatMoney(item.amount)}</strong></div><div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>${this.formatDateBR(item.dueDate)}</span><span>${this.escapeHtml(installmentLabel)}</span><span class="font-bold ${item.settled ? 'text-emerald-600' : 'text-amber-600'}">${statusLabel}</span></div></div></label>`;
        }).join('');

        panel.classList.add('max-h-[88vh]', 'overflow-y-auto');
        panel.innerHTML = `<div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden"></div><div class="flex items-start justify-between gap-3 mb-4"><div><div class="w-12 h-12 ${settling ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} rounded-xl flex items-center justify-center mb-3"><i class="fa-solid fa-list-check text-xl"></i></div><h2 class="text-xl font-black text-slate-800">Selecionar parcelas</h2><p class="text-sm text-slate-500 mt-1">Marque exatamente as parcelas que deseja alterar.</p></div><button type="button" onclick="App.closeModal('modal-action-options')" class="action-icon shrink-0"><i class="fa-solid fa-xmark"></i></button></div><div class="space-y-2 max-h-[48vh] overflow-y-auto pr-1">${rows}</div><div class="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100"><button type="button" onclick="App.closeModal('modal-action-options')" class="py-3 rounded-xl font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700">Cancelar</button><button type="button" onclick="App.applyCustomSettlement()" class="py-3 px-3 rounded-xl font-extrabold text-white ${settling ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}">${this.escapeHtml(actionLabel)}</button></div>`;
    },

    async applyCustomSettlement() {
        const ids = [...document.querySelectorAll('.custom-settlement-check:checked')].map(input => input.value);
        if (!ids.length) return this.showToast('Selecione pelo menos uma parcela.', 'error');

        const current = this.ui.editingItem;
        const grouped = this.data.accounts.filter(item => item.groupId === current?.groupId);
        const targets = grouped.filter(item => ids.includes(item.id));
        if (!targets.length) return this.showToast('Nenhuma parcela válida foi selecionada.', 'error');

        const settling = this.ui.currentAction === 'settle';
        const isPayable = current.kind === 'payable';
        const actionName = isPayable
            ? (settling ? 'pagas' : 'não pagas')
            : (settling ? 'recebidas' : 'não recebidas');

        const confirmed = await this.confirmDialog(
            'Confirmar seleção personalizada',
            `Deseja marcar ${targets.length} parcela(s) como ${actionName}?`
        );
        if (!confirmed) return;

        await this.updateSettlementTargets(targets, settling, actionName);
    },

    async applySettlementScope(scope) {
        this.closeModal('modal-action-options');
        const current = this.ui.editingItem;
        const grouped = this.data.accounts.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'dueDate');
        const settling = this.ui.currentAction === 'settle';
        const actionName = current.kind === 'payable'
            ? (settling ? 'paga' : 'não paga')
            : (settling ? 'recebida' : 'não recebida');

        if (!settling) {
            const confirmed = await this.confirmDialog(
                'Desmarcar confirmação',
                `Deseja marcar ${targets.length === 1 ? 'esta conta' : `${targets.length} contas`} como ${actionName}?`
            );
            if (!confirmed) return;
        } else if (targets.length > 1) {
            const confirmed = await this.confirmDialog(
                'Confirmar várias parcelas',
                `Deseja marcar ${targets.length} parcelas como ${actionName}?`
            );
            if (!confirmed) return;
        }

        await this.updateSettlementTargets(targets, settling, actionName);
    },

    async updateSettlementTargets(targets, settling, actionName) {
        this.closeModal('modal-action-options');
        this.showLoader(settling ? 'Confirmando...' : 'Desmarcando...');
        try {
            const batch = writeBatch(db);
            targets.forEach(item => batch.update(
                doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/accounts/${item.id}`),
                {
                    settled: settling,
                    settledAt: settling ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString()
                }
            ));
            await batch.commit();
            this.showToast(`Conta(s) marcada(s) como ${actionName}.`);
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao atualizar a situação.', 'error');
        } finally {
            this.hideLoader();
        }
    }
});
