import { App, db, APP_ID, doc, setDoc, writeBatch } from './firebase-context.js';

Object.assign(App, {
    async saveCard(event) {
        event.preventDefault();
        const id = document.getElementById('card-id').value;
        const name = document.getElementById('card-name').value.trim();
        const dueDate = Number(document.getElementById('card-due').value);
        if (!name || dueDate < 1 || dueDate > 31) return this.showToast('Preencha os dados do cartão corretamente.', 'error');
        this.showLoader('Salvando cartão...');
        try {
            await setDoc(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/cards/${id || crypto.randomUUID()}`), {
                name, dueDate: String(dueDate), updatedAt: new Date().toISOString()
            }, { merge: true });
            this.closeModal('modal-card');
            this.showToast('Cartão salvo.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao salvar cartão.', 'error');
        } finally { this.hideLoader(); }
    },

    async deleteCard(id) {
        const confirmed = await this.confirmDialog('Apagar cartão', 'O cartão será excluído junto com todos os seus lançamentos. Deseja continuar?');
        if (!confirmed) return;
        this.showLoader('Excluindo cartão...');
        try {
            const batch = writeBatch(db);
            this.data.transactions.filter(item => item.cardId === id).forEach(item => batch.delete(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/transactions/${item.id}`)));
            batch.delete(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/cards/${id}`));
            await batch.commit();
            if (this.ui.selectedCard?.id === id) this.navigate('cards');
            this.showToast('Cartão excluído.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao excluir cartão.', 'error');
        } finally { this.hideLoader(); }
    },

    async ensureCategory(name) {
        const normalized = (name || 'Geral').trim() || 'Geral';
        const existing = this.data.categories.find(item => (item.name || '').toLowerCase() === normalized.toLowerCase());
        if (existing) return { id: existing.id, name: existing.name };
        const id = crypto.randomUUID();
        await setDoc(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/categories/${id}`), { name: normalized });
        return { id, name: normalized };
    },

    async saveTransaction(event) {
        event.preventDefault();
        const totalAmount = this.unmaskCurrency(document.getElementById('trans-amount').value);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) return this.showToast('Informe um valor válido.', 'error');
        const description = document.getElementById('trans-desc').value.trim() || 'Gasto';
        const rawType = document.getElementById('trans-type').value;
        const initialMonth = document.getElementById('trans-month').value;
        const isRecurring = rawType === 'recorrente';
        const installmentCount = rawType === 'parcelado' ? Number(document.getElementById('trans-installments').value) : (isRecurring ? 60 : 1);
        if (!initialMonth || installmentCount < 1 || installmentCount > 120) return this.showToast('Confira o mês e as parcelas.', 'error');

        this.showLoader('Salvando lançamento...');
        try {
            const category = await this.ensureCategory(document.getElementById('trans-category').value);
            const isEdit = this.ui.actionScope && this.ui.actionScope !== 'new';
            if (isEdit) {
                const current = this.ui.editingItem;
                const grouped = this.data.transactions.filter(item => item.groupId === current.groupId);
                const targets = this.selectTargets(grouped, current, this.ui.actionScope, 'invoiceMonth');
                const batch = writeBatch(db);
                targets.forEach(item => {
                    let amount = totalAmount;
                    if (this.ui.actionScope === 'all' && !item.isRecurring && item.totalInstallments > 1) amount = totalAmount / item.totalInstallments;
                    batch.update(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/transactions/${item.id}`), {
                        description,
                        categoryId: category.id,
                        categoryName: category.name,
                        amount,
                        ...(this.ui.actionScope === 'all' ? { totalAmount } : {}),
                        updatedAt: new Date().toISOString()
                    });
                });
                await batch.commit();
            } else {
                const groupId = crypto.randomUUID();
                const amountPerInstallment = isRecurring ? totalAmount : totalAmount / installmentCount;
                const batch = writeBatch(db);
                for (let index = 0; index < installmentCount; index += 1) {
                    const id = crypto.randomUUID();
                    batch.set(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/transactions/${id}`), {
                        groupId,
                        cardId: this.ui.selectedCard.id,
                        description,
                        categoryId: category.id,
                        categoryName: category.name,
                        amount: amountPerInstallment,
                        totalAmount,
                        installmentNumber: index + 1,
                        totalInstallments: installmentCount,
                        isRecurring,
                        invoiceMonth: this.addMonthsToYearMonth(initialMonth, index),
                        createdAt: new Date().toISOString()
                    });
                }
                await batch.commit();
            }
            this.closeModal('modal-transaction');
            this.closeModal('modal-action-options');
            this.showToast('Lançamento salvo.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao salvar lançamento.', 'error');
        } finally { this.hideLoader(); }
    },

    openCardActionOptions(action, transactionId) {
        const transaction = this.data.transactions.find(item => item.id === transactionId);
        if (!transaction) return;
        this.ui.editingItem = transaction;
        this.ui.currentAction = action;
        this.ui.actionEntity = 'card';
        const grouped = this.data.transactions.filter(item => item.groupId === transaction.groupId);
        if (grouped.length <= 1) return action === 'edit' ? this.openTransactionModal('single') : this.handleCardOption('single');
        this.openScopeModal({
            title: action === 'edit' ? 'Editar lançamento' : 'Excluir lançamento',
            message: transaction.isRecurring ? 'Escolha quais cobranças recorrentes serão afetadas.' : 'Escolha quais parcelas serão afetadas.',
            destructive: action === 'delete',
            options: [
                ['single', transaction.isRecurring ? 'Apenas este mês' : 'Apenas esta parcela'],
                ['forward', transaction.isRecurring ? 'Deste mês em diante' : 'Desta parcela em diante'],
                ['all', transaction.isRecurring ? 'Todas as cobranças' : 'Todas as parcelas']
            ],
            handler: 'App.handleCardOption'
        });
    },

    async handleCardOption(scope) {
        this.closeModal('modal-action-options');
        this.ui.actionScope = scope;
        if (this.ui.currentAction === 'edit') return this.openTransactionModal(scope);
        const current = this.ui.editingItem;
        const grouped = this.data.transactions.filter(item => item.groupId === current.groupId);
        const targets = this.selectTargets(grouped, current, scope, 'invoiceMonth');
        const confirmed = await this.confirmDialog('Excluir lançamento', `Deseja excluir ${targets.length === 1 ? 'este lançamento' : `${targets.length} lançamentos`}?`);
        if (!confirmed) return;
        this.showLoader('Excluindo lançamento...');
        try {
            const batch = writeBatch(db);
            targets.forEach(item => batch.delete(doc(db, `artifacts/${APP_ID}/users/${this.user.uid}/transactions/${item.id}`)));
            await batch.commit();
            this.showToast('Lançamento excluído.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao excluir lançamento.', 'error');
        } finally { this.hideLoader(); }
    },

    renderCardsView() {
        const cards = [...this.data.cards].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        let html = `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"><div><p class="text-xs text-blue-600 font-black uppercase tracking-widest">Modo Cartões</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Meus Cartões</h1></div><button type="button" onclick="App.openCardModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-extrabold shadow-md flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> Novo cartão</button></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">`;
        if (!cards.length) html += `<div class="sm:col-span-2 lg:col-span-3 card-surface border-dashed border-2 py-16 text-center text-slate-400"><i class="fa-solid fa-credit-card text-5xl text-slate-300 mb-4"></i><p class="font-semibold">Nenhum cartão cadastrado.</p></div>`;
        cards.forEach(card => {
            const today = new Date();
            const target = new Date();
            if (today.getDate() > Number(card.dueDate || 31)) target.setMonth(target.getMonth() + 1);
            const referenceMonth = this.toYearMonth(target);
            const transactions = this.data.transactions.filter(item => item.cardId === card.id && item.invoiceMonth === referenceMonth);
            const total = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            html += `<article class="card-surface p-5 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col" onclick="App.navigate('card_detail', ${this.toInlineJson({ id: card.id, name: card.name, dueDate: card.dueDate })})"><div class="flex justify-between gap-3 mb-3"><div class="min-w-0"><p class="text-xs text-slate-400 font-bold uppercase">Cartão</p><h2 class="text-xl font-black text-slate-800 truncate">${this.escapeHtml(card.name)}</h2></div><div class="flex gap-1.5 shrink-0"><button type="button" onclick="event.stopPropagation();App.openCardModal('${card.id}')" class="action-icon text-blue-600" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="event.stopPropagation();App.deleteCard('${card.id}')" class="action-icon text-red-600" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button></div></div><p class="text-sm text-slate-500"><i class="fa-regular fa-calendar mr-1"></i> Vencimento da fatura: dia ${this.escapeHtml(card.dueDate)}</p><div class="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3"><div><p class="text-[10px] text-slate-400 font-black uppercase">${this.formatMonthSmall(referenceMonth)}</p><p class="text-xs text-slate-500">${transactions.length} lançamento(s)</p></div><strong class="text-xl font-black ${total > 0 ? 'text-red-600' : 'text-slate-700'}">${this.formatMoney(total)}</strong></div></article>`;
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
        let html = `<div class="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div class="flex items-center gap-3 min-w-0"><button type="button" onclick="App.navigate('cards')" class="action-icon text-slate-600 shrink-0"><i class="fa-solid fa-arrow-left"></i></button><div class="min-w-0"><p class="text-[10px] text-blue-600 font-black uppercase tracking-widest">Cartão</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800 truncate">${this.escapeHtml(card.name)}</h1></div></div><div class="flex flex-col sm:flex-row gap-2">${this.renderMonthFilter('Fatura')}<div class="grid grid-cols-2 gap-2"><button id="btn-pdf" type="button" onclick="App.generateCardPDF()" class="bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 px-3 h-11 rounded-xl font-bold"><i class="fa-solid fa-file-pdf mr-1.5"></i> PDF</button><button type="button" onclick="App.openTransactionModal('new')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-11 rounded-xl font-extrabold shadow-md"><i class="fa-solid fa-plus mr-1.5"></i> Gasto</button></div></div></div>`;
        html += `<section class="card-surface p-5 sm:p-6 mb-5 grid sm:grid-cols-[1fr_auto] gap-5 items-end"><div><p class="text-xs text-slate-500 font-black uppercase">${this.ui.filterCategory ? `Total em ${this.escapeHtml(this.ui.filterCategory)}` : 'Total da fatura'}</p><p class="text-3xl sm:text-4xl font-black text-slate-800 mt-1">${this.formatMoney(total)}</p><p class="text-xs text-slate-400 mt-2">Vencimento da fatura: dia ${this.escapeHtml(card.dueDate)}</p></div><div><label class="block text-[10px] text-slate-400 font-black uppercase mb-1">Filtrar categoria</label><select onchange="App.setCategoryFilter(this.value)" class="input-modern min-w-[210px]"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${this.escapeAttr(category)}" ${this.ui.filterCategory === category ? 'selected' : ''}>${this.escapeHtml(category)}</option>`).join('')}</select></div></section>`;
        html += `<section class="card-surface overflow-hidden"><header class="bg-slate-800 text-white px-4 py-3 flex justify-between"><span class="font-bold">Lançamentos</span><span class="text-xs text-slate-300">${visible.length} item(ns)</span></header><ul class="divide-y divide-slate-100">`;
        if (!visible.length) html += `<li class="py-14 text-center text-slate-400"><i class="fa-solid fa-box-open text-3xl mb-3"></i><p>Nenhum lançamento neste mês.</p></li>`;
        visible.forEach(item => {
            const installment = item.totalInstallments > 1 && !item.isRecurring ? `<span class="status-pill bg-blue-50 text-blue-700">${item.installmentNumber}/${item.totalInstallments}</span>` : '';
            const recurring = item.isRecurring ? '<span class="status-pill bg-purple-50 text-purple-700"><i class="fa-solid fa-repeat"></i> Recorrente</span>' : '';
            html += `<li class="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50"><div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800">${this.escapeHtml(item.description || 'Gasto')}</strong>${installment}${recurring}</div><span class="status-pill bg-slate-100 text-slate-600 mt-2"><i class="fa-solid fa-tag"></i>${this.escapeHtml(item.categoryName || 'Geral')}</span></div><div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-3 sm:pt-0"><strong class="text-lg text-slate-800 min-w-[105px] sm:text-right">${this.formatMoney(item.amount)}</strong><div class="flex gap-1.5"><button type="button" onclick="App.openCardActionOptions('edit','${item.id}')" class="action-icon text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button><button type="button" onclick="App.openCardActionOptions('delete','${item.id}')" class="action-icon text-red-600"><i class="fa-solid fa-trash text-xs"></i></button></div></div></li>`;
        });
        return `${html}</ul></section>`;
    },
});
