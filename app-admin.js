import { App, db, APP_ID, ADMIN_EMAIL, doc, setDoc } from './firebase-context.js';

Object.assign(App, {
    renderAdminView() {
        if (!this.isAdmin()) return this.renderNoAccessView();
        const accessMap = new Map(this.data.accessList.map(item => [item.id, item]));
        const users = [...this.data.userDirectory].sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
        let html = `<div class="mb-6"><p class="text-xs text-violet-600 font-black uppercase tracking-widest">Administração</p><h1 class="text-2xl sm:text-3xl font-black text-slate-800">Permissões de usuários</h1><p class="text-sm text-slate-500 mt-2">Defina se cada usuário utilizará Cartões, Contas ou Ambos. As alterações são aplicadas em tempo real.</p></div><section class="card-surface overflow-hidden"><div class="hidden md:grid grid-cols-[1fr_160px_160px_130px] gap-3 bg-slate-800 text-white px-5 py-3 text-xs font-black uppercase"><span>Usuário</span><span class="text-center">Cartões</span><span class="text-center">Contas</span><span></span></div><div class="divide-y divide-slate-100">`;
        if (!users.length) html += `<div class="p-12 text-center text-slate-400"><i class="fa-solid fa-users text-3xl mb-3"></i><p>Nenhum usuário localizado.</p></div>`;
        users.forEach(user => {
            const isAdministrator = (user.email || '').toLowerCase() === ADMIN_EMAIL;
            const access = accessMap.get(user.id) || {};
            const cards = isAdministrator ? true : access.cards !== false;
            const accounts = isAdministrator ? true : access.accounts === true;
            html += `<div class="p-4 md:px-5 grid md:grid-cols-[1fr_160px_160px_130px] gap-3 md:items-center"><div class="min-w-0"><div class="flex items-center gap-2"><strong class="text-slate-800 truncate">${this.escapeHtml(user.name || 'Usuário')}</strong>${isAdministrator ? '<span class="status-pill bg-violet-100 text-violet-700">Administrador</span>' : ''}</div><p class="text-xs text-slate-500 truncate mt-1">${this.escapeHtml(user.email || '')}</p></div><label class="flex md:justify-center items-center gap-2 bg-slate-50 md:bg-transparent px-3 py-2 md:p-0 rounded-lg"><input id="perm-cards-${user.id}" type="checkbox" ${cards ? 'checked' : ''} ${isAdministrator ? 'disabled' : ''} class="w-5 h-5 accent-blue-600"><span class="md:hidden text-sm font-bold text-slate-600">Modo Cartões</span></label><label class="flex md:justify-center items-center gap-2 bg-slate-50 md:bg-transparent px-3 py-2 md:p-0 rounded-lg"><input id="perm-accounts-${user.id}" type="checkbox" ${accounts ? 'checked' : ''} ${isAdministrator ? 'disabled' : ''} class="w-5 h-5 accent-emerald-600"><span class="md:hidden text-sm font-bold text-slate-600">Contas a Pagar/Receber</span></label><button type="button" onclick="App.saveUserPermissions('${user.id}')" ${isAdministrator ? 'disabled' : ''} class="w-full md:w-auto px-4 py-2.5 rounded-xl font-extrabold text-sm ${isAdministrator ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white shadow'}">${isAdministrator ? 'Ambos' : 'Salvar'}</button></div>`;
        });
        return `${html}</div></section><div class="mt-5 card-surface p-5 border-l-4 border-amber-400"><h2 class="font-black text-slate-800"><i class="fa-solid fa-shield-halved text-amber-500 mr-2"></i>Segurança</h2><p class="text-sm text-slate-500 mt-2">O repositório inclui um arquivo <code class="bg-slate-100 px-1.5 py-0.5 rounded">firestore.rules</code>. Essas regras precisam ser publicadas no Firebase para impedir que usuários alterem suas próprias permissões fora da interface.</p></div>`;
    },

    async saveUserPermissions(uid) {
        if (!this.isAdmin()) return;
        const user = this.data.userDirectory.find(item => item.id === uid);
        if (!user || (user.email || '').toLowerCase() === ADMIN_EMAIL) return;
        const cards = document.getElementById(`perm-cards-${uid}`)?.checked === true;
        const accounts = document.getElementById(`perm-accounts-${uid}`)?.checked === true;
        if (!cards && !accounts) return this.showToast('Selecione Cartões, Contas ou Ambos.', 'error');
        this.showLoader('Salvando permissões...');
        try {
            await setDoc(doc(db, `artifacts/${APP_ID}/access/${uid}`), {
                uid,
                email: user.email || '',
                name: user.name || '',
                cards,
                accounts,
                updatedBy: this.user.email,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            this.showToast('Permissões atualizadas.');
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao salvar permissões. Verifique as regras do Firebase.', 'error');
        } finally { this.hideLoader(); }
    },
});
