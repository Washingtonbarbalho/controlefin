import { App, db, APP_ID, doc, writeBatch } from './firebase-context.js';

const baseSelectTargets = App.selectTargets.bind(App);

Object.assign(App, {
    selectTargets(groupedItems, current, scope, dateField) {
        if (scope !== 'custom') return baseSelectTargets(groupedItems, current, scope, dateField);
        const selectedIds = new Set(this.ui.customTargetIds || []);
        return [...groupedItems]
            .filter(item => selectedIds.has(item.id))
            .sort((a, b) =>
                String(a[dateField] || '').localeCompare(String(b[dateField] || '')) ||
                Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0)
            );
    },

    getStandardScopeOptions() {
        return [
            ['single', 'Esta parcela'],
            ['all', 'Todas as parcelas'],
            ['custom', 'Personalizado']
        ];
    },

    openSettlementOptions(accountId) {
        const account = this.data.accounts.find(item => item.id === accountId);
        if (!account) return;

        this.ui.editingItem = account;
        this.ui.currentAction = account.settled ? 'unsettle' : 'settle';
        this.ui.actionEntity = 'account';
        this.ui.customTargetIds = [];

        const grouped = this.data.accounts.filter(item => item.groupId === account.groupId);
        if (grouped.length <= 1) return this.handleSettlement('single');

        const verb = account.kind === 'payable'
            ? (account.settled ? 'desmarcar como paga' : 'marcar como paga')
            : (account.settled ? 'desmarcar como recebida' : 'marcar como recebida');

        this.openScopeModal({
            title: account.settled
                ? 'Desmarcar conclusão'
                : (account.kind === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'),
            message: `Escolha quais parcelas deseja ${verb}.`,
            destructive: account.settled,
            options: this.getStandardScopeOptions(),
            handler: 'App.handleSettlement'
        });
    },

    openAccountActionOptions(action, accountId) {
        const account = this.data.accounts.find(item => item.id === accountId);
        if (!account) return;

        this.ui.editingItem = account;
        this.ui.currentAction = action;
        this.ui.actionEntity = 'account';
        this.ui.customTargetIds = [];

        const grouped = this.data.accounts.filter(item => item.groupId === account.groupId);
        if (grouped.length <= 1) {
            return action === 'edit'
                ? this.openAccountModal('single', account)
                : this.handleAccountOption('single');
        }

        this.openScopeModal({
            title: action === 'edit' ? 'Editar conta' : 'Excluir conta',
            message: 'Escolha quais parcelas serão afetadas.',
            destructive: action === 'delete',
            options: this.getStandardScopeOptions(),
            handler: 'App.handleAccountOption'
        });
    },

    async handleAccountOption(scope) {
        if (scope === 'custom') return this.openCustomRecordSelection('account');

        this.closeModal('modal-action-options');
        this.ui.customTargetIds = [];
        this.ui.actionScope = scope;

        if (this.ui.currentAction === 'edit') {
            return this.openAccountModal(scope, this.ui.editingItem);
        }

        const current = this.ui.editingItem;
        const grouped = this.data.accounts.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'dueDate');
        await this.deleteSelectedRecords('account', targets);
    },

    openCardActionOptions(action, transactionId) {
        const transaction = this.data.transactions.find(item => item.id === transactionId);
        if (!transaction) return;

        this.ui.editingItem = transaction;
        this.ui.currentAction = action;
        this.ui.actionEntity = 'card';
        this.ui.customTargetIds = [];

        const grouped = this.data.transactions.filter(item => item.groupId === transaction.groupId);
        if (grouped.length <= 1) {
            return action === 'edit'
                ? this.openTransactionModal('single', transaction)
                : this.handleCardOption('single');
        }

        this.openScopeModal({
            title: action === 'edit' ? 'Editar lançamento' : 'Excluir lançamento',
            message: 'Escolha quais parcelas serão afetadas.',
            destructive: action === 'delete',
            options: this.getStandardScopeOptions(),
            handler: 'App.handleCardOption'
        });
    },

    async handleCardOption(scope) {
        if (scope === 'custom') return this.openCustomRecordSelection('card');

        this.closeModal('modal-action-options');
        this.ui.customTargetIds = [];
        this.ui.actionScope = scope;

        if (this.ui.currentAction === 'edit') {
            return this.openTransactionModal(scope, this.ui.editingItem);
        }

        const current = this.ui.editingItem;
        const grouped = this.data.transactions.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'invoiceMonth');
        await this.deleteSelectedRecords('card', targets);
    },

    openCustomRecordSelection(entity) {
        const current = this.ui.editingItem;
        if (!current) return;

        const isAccount = entity === 'account';
        const grouped = (isAccount ? this.data.accounts : this.data.transactions)
            .filter(item => item.groupId === current.groupId)
            .sort((a, b) => {
                const field = isAccount ? 'dueDate' : 'invoiceMonth';
                return String(a[field] || '').localeCompare(String(b[field] || '')) ||
                    Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0);
            });

        const panel = document.getElementById('scope-options-content');
        if (!panel) return;

        const deleting = this.ui.currentAction === 'delete';
        const title = deleting ? 'Selecionar para excluir' : 'Selecionar para editar';
        const actionLabel = deleting ? 'Excluir selecionadas' : 'Editar selecionadas';
        const buttonClass = deleting
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700';

        const rows = grouped.map(item => {
            const isCurrent = item.id === current.id;
            const installment = item.isRecurring
                ? 'Recorrente'
                : (item.totalInstallments > 1
                    ? `${item.installmentNumber}/${item.totalInstallments}`
                    : 'Única');
            const reference = isAccount
                ? this.formatDateBR(item.dueDate)
                : this.formatMonthSmall(item.invoiceMonth);
            const status = isAccount
                ? (item.settled
                    ? (item.kind === 'payable' ? 'Paga' : 'Recebida')
                    : 'Pendente')
                : installment;
            const amountClass = isAccount && item.kind === 'receivable'
                ? 'text-emerald-600'
                : (isAccount ? 'text-red-600' : 'text-slate-800');

            return `<label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"><input type="checkbox" class="custom-record-check w-5 h-5 ${deleting ? 'accent-red-600' : 'accent-blue-600'} shrink-0" value="${this.escapeAttr(item.id)}" ${isCurrent ? 'checked' : ''}><div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><strong class="text-sm text-slate-800 truncate">${this.escapeHtml(item.description || (isAccount ? 'Conta' : 'Lançamento'))}</strong><strong class="text-sm ${amountClass} shrink-0">${this.formatMoney(item.amount)}</strong></div><div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500"><span><i class="fa-regular fa-calendar mr-1"></i>${this.escapeHtml(reference)}</span><span>${this.escapeHtml(installment)}</span>${isAccount ? `<span class="font-bold ${item.settled ? 'text-emerald-600' : 'text-amber-600'}">${this.escapeHtml(status)}</span>` : ''}</div></div></label>`;
        }).join('');

        panel.classList.add('max-h-[88vh]', 'overflow-y-auto');
        panel.innerHTML = `<div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden"></div><div class="flex items-start justify-between gap-3 mb-4"><div><div class="w-12 h-12 ${deleting ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} rounded-xl flex items-center justify-center mb-3"><i class="fa-solid fa-list-check text-xl"></i></div><h2 class="text-xl font-black text-slate-800">${title}</h2><p class="text-sm text-slate-500 mt-1">Marque exatamente as parcelas que deseja alterar.</p></div><button type="button" onclick="App.closeModal('modal-action-options')" class="action-icon shrink-0"><i class="fa-solid fa-xmark"></i></button></div><div class="space-y-2 max-h-[48vh] overflow-y-auto pr-1">${rows}</div><div class="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100"><button type="button" onclick="App.closeModal('modal-action-options')" class="py-3 rounded-xl font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700">Cancelar</button><button type="button" onclick="App.applyCustomRecordSelection('${entity}')" class="py-3 px-3 rounded-xl font-extrabold text-white ${buttonClass}">${actionLabel}</button></div>`;
        this.openModal('modal-action-options');
    },

    async applyCustomRecordSelection(entity) {
        const ids = [...document.querySelectorAll('.custom-record-check:checked')]
            .map(input => input.value);
        if (!ids.length) return this.showToast('Selecione pelo menos uma parcela.', 'error');

        this.ui.customTargetIds = ids;
        this.ui.actionScope = 'custom';
        this.closeModal('modal-action-options');

        if (this.ui.currentAction === 'edit') {
            return entity === 'account'
                ? this.openAccountModal('custom', this.ui.editingItem)
                : this.openTransactionModal('custom', this.ui.editingItem);
        }

        const grouped = entity === 'account'
            ? this.data.accounts.filter(item => item.groupId === this.ui.editingItem.groupId)
            : this.data.transactions.filter(item => item.groupId === this.ui.editingItem.groupId);
        const field = entity === 'account' ? 'dueDate' : 'invoiceMonth';
        const targets = this.selectTargets(grouped, this.ui.editingItem, 'custom', field);
        await this.deleteSelectedRecords(entity, targets);
    },

    async deleteSelectedRecords(entity, targets) {
        if (!targets.length) return this.showToast('Nenhuma parcela foi selecionada.', 'error');

        const isAccount = entity === 'account';
        const singular = isAccount ? 'esta conta' : 'este lançamento';
        const plural = isAccount ? `${targets.length} contas/parcelas` : `${targets.length} lançamentos/parcelas`;
        const confirmed = await this.confirmDialog(
            isAccount ? 'Excluir conta' : 'Excluir lançamento',
            `Deseja excluir ${targets.length === 1 ? singular : plural}?`
        );
        if (!confirmed) return;

        this.showLoader(isAccount ? 'Excluindo conta...' : 'Excluindo lançamento...');
        try {
            const batch = writeBatch(db);
            const collectionName = isAccount ? 'accounts' : 'transactions';
            targets.forEach(item => batch.delete(
                doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/${collectionName}/${item.id}`)
            ));
            await batch.commit();
            this.ui.customTargetIds = [];
            this.showToast(isAccount ? 'Conta(s) excluída(s).' : 'Lançamento(s) excluído(s).');
        } catch (error) {
            console.error(error);
            this.showToast(isAccount ? 'Erro ao excluir conta.' : 'Erro ao excluir lançamento.', 'error');
        } finally {
            this.hideLoader();
        }
    }
});
