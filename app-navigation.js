import { App } from './firebase-context.js';

Object.assign(App, {
    goHome() {
        if (!this.user) return this.navigate('login');
        if (this.permissions.cards && this.permissions.accounts) return this.navigate('home');
        if (this.permissions.cards) return this.navigate('cards');
        if (this.permissions.accounts) return this.navigate('accounts');
        return this.navigate('no_access');
    },

    navigate(view, data = null) {
        if (view === 'admin' && !this.isAdmin()) return;
        if ((view === 'cards' || view === 'card_detail') && !this.permissions.cards) return this.goHome();
        if (view === 'accounts' && !this.permissions.accounts) return this.goHome();

        this.ui.view = view;
        this.ui.filterCategory = '';
        if (view === 'cards') this.ui.selectedCard = null;
        if (view === 'card_detail' && data) {
            this.ui.selectedCard = data;
            const today = new Date();
            const target = new Date();
            if (today.getDate() > Number(data.dueDate || 31)) target.setMonth(target.getMonth() + 1);
            this.ui.selectedMonth = this.toYearMonth(target);
        }
        if (view === 'accounts') this.ui.selectedMonth = this.ui.selectedMonth || this.currentYearMonth();
        this.renderModuleNav();
        this.render();
        this.triggerFade();
    },

    renderModuleNav() {
        const nav = document.getElementById('module-nav');
        if (!nav || !this.user) return;
        const tabs = [];
        if (this.permissions.cards) tabs.push(`<button type="button" onclick="App.navigate('cards')" class="module-tab ${this.ui.view.startsWith('card') ? 'active' : ''}" title="Cartões"><i class="fa-solid fa-credit-card"></i><span class="ml-1.5">Cartões</span></button>`);
        if (this.permissions.accounts) tabs.push(`<button type="button" onclick="App.navigate('accounts')" class="module-tab ${this.ui.view === 'accounts' ? 'active' : ''}" title="Contas"><i class="fa-solid fa-money-bill-transfer"></i><span class="ml-1.5">Contas</span></button>`);
        nav.innerHTML = tabs.join('');
        nav.classList.toggle('hidden', tabs.length < 2);
        nav.classList.toggle('flex', tabs.length >= 2);
    },

    changeMonth(offset) {
        if (!this.ui.selectedMonth) this.ui.selectedMonth = this.currentYearMonth();
        const [year, month] = this.ui.selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        this.ui.selectedMonth = this.toYearMonth(date);
        this.render();
        this.triggerFade();
    },

    selectSpecificMonth(value) {
        if (!value) return;
        this.ui.selectedMonth = value;
        this.render();
        this.triggerFade();
    },

    setCategoryFilter(value) {
        this.ui.filterCategory = value;
        this.render();
    },

    setAccountKind(kind) {
        this.ui.accountKind = kind === 'receivable' ? 'receivable' : 'payable';
        this.ui.filterCategory = '';
        this.render();
        this.triggerFade();
    },

    render() {
        const container = document.getElementById('app-container');
        if (!container) return;
        const views = {
            loading: () => this.renderLoadingView(),
            login: () => this.renderLoginView(),
            register: () => this.renderRegisterView(),
            home: () => this.renderHomeView(),
            no_access: () => this.renderNoAccessView(),
            cards: () => this.renderCardsView(),
            card_detail: () => this.renderCardDetailView(),
            accounts: () => this.renderAccountsView(),
            admin: () => this.renderAdminView()
        };
        container.innerHTML = (views[this.ui.view] || views.home)();
        this.renderModals();
    },

    renderLoadingView() {
        return '<div class="min-h-[60vh] flex items-center justify-center"><i class="fa-solid fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
    },

    renderLoginView() {
        return `<div class="max-w-sm mx-auto mt-8 sm:mt-14 card-surface p-6 sm:p-8"><div class="text-center mb-7"><div class="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-wallet text-3xl"></i></div><h1 class="text-2xl font-black text-slate-800">Acessar o FinançasPro</h1><p class="text-sm text-slate-500 mt-1">Cartões, contas a pagar e a receber.</p></div><form onsubmit="App.login(event)" class="space-y-4"><input type="email" id="login-email" required class="input-modern" placeholder="E-mail" autocomplete="email"><input type="password" id="login-pass" required class="input-modern" placeholder="Senha" autocomplete="current-password"><button id="btn-login" type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl transition shadow-md">Entrar</button></form><p class="text-center text-sm text-slate-600 mt-6">Ainda não tem conta? <button type="button" onclick="App.navigate('register')" class="text-blue-600 font-bold hover:underline">Cadastre-se</button></p></div>`;
    },

    renderRegisterView() {
        return `<div class="max-w-md mx-auto mt-5 sm:mt-10 card-surface p-6 sm:p-8"><div class="text-center mb-6"><h1 class="text-2xl font-black text-slate-800">Criar conta</h1><p class="text-sm text-slate-500 mt-1">O administrador poderá definir seus módulos.</p></div><form onsubmit="App.register(event)" class="space-y-4"><input type="text" id="reg-name" required class="input-modern" placeholder="Nome completo" autocomplete="name"><input type="text" id="reg-phone" oninput="App.applyPhoneMask(this)" required class="input-modern" placeholder="Telefone" autocomplete="tel"><input type="email" id="reg-email" required class="input-modern" placeholder="E-mail" autocomplete="email"><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="password" id="reg-pass" minlength="6" required class="input-modern" placeholder="Senha" autocomplete="new-password"><input type="password" id="reg-pass-confirm" minlength="6" required class="input-modern" placeholder="Confirmar senha" autocomplete="new-password"></div><button id="btn-register" type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl transition shadow-md">Criar Conta</button></form><p class="text-center text-sm text-slate-600 mt-6">Já possui conta? <button type="button" onclick="App.navigate('login')" class="text-blue-600 font-bold hover:underline">Entrar</button></p></div>`;
    },

    renderHomeView() {
        return `<div class="max-w-4xl mx-auto"><div class="text-center py-6 sm:py-10"><p class="text-xs font-black text-blue-600 uppercase tracking-[.18em] mb-2">Escolha um modo</p><h1 class="text-3xl sm:text-4xl font-black text-slate-800">Como deseja controlar hoje?</h1><p class="text-slate-500 mt-3">Os dois módulos são independentes e usam os mesmos padrões de parcelas.</p></div><div class="grid md:grid-cols-2 gap-5">${this.permissions.cards ? `<button type="button" onclick="App.navigate('cards')" class="card-surface p-7 text-left hover:border-blue-400 hover:-translate-y-1 transition group"><div class="w-14 h-14 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-2xl mb-5 group-hover:scale-105 transition"><i class="fa-solid fa-credit-card"></i></div><h2 class="text-2xl font-black text-slate-800">Modo Cartões</h2><p class="text-sm text-slate-500 mt-2 leading-relaxed">Gerencie cartões, faturas, gastos à vista, parcelados e recorrentes.</p><span class="inline-flex items-center gap-2 mt-6 text-blue-700 font-extrabold">Abrir cartões <i class="fa-solid fa-arrow-right"></i></span></button>` : ''}${this.permissions.accounts ? `<button type="button" onclick="App.navigate('accounts')" class="card-surface p-7 text-left hover:border-emerald-400 hover:-translate-y-1 transition group"><div class="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-2xl mb-5 group-hover:scale-105 transition"><i class="fa-solid fa-money-bill-transfer"></i></div><h2 class="text-2xl font-black text-slate-800">Contas a Pagar e Receber</h2><p class="text-sm text-slate-500 mt-2 leading-relaxed">Controle vencimentos individuais e marque pagamentos ou recebimentos.</p><span class="inline-flex items-center gap-2 mt-6 text-emerald-700 font-extrabold">Abrir contas <i class="fa-solid fa-arrow-right"></i></span></button>` : ''}</div></div>`;
    },

    renderNoAccessView() {
        return `<div class="max-w-lg mx-auto mt-12 card-surface p-8 text-center"><div class="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-5"><i class="fa-solid fa-lock text-2xl"></i></div><h1 class="text-2xl font-black text-slate-800">Acesso ainda não liberado</h1><p class="text-slate-500 mt-3">Seu cadastro está ativo, mas nenhum módulo foi autorizado. Solicite ao administrador a liberação de Cartões, Contas ou Ambos.</p></div>`;
    },
});
