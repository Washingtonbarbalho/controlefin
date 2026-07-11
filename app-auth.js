import { App, db, auth, APP_ID, ADMIN_EMAIL, doc, setDoc, getDoc, collection, onSnapshot, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getDeferredPrompt, clearDeferredPrompt } from './firebase-context.js';

const isPermissionDenied = error => {
    const code = String(error?.code || '').toLowerCase();
    return code.includes('permission-denied');
};

Object.assign(App, {
    init() {
        onAuthStateChanged(auth, async user => {
            this.unsubscribeAll();
            this.user = user;
            this.userProfile = null;
            this.data = { cards: [], categories: [], transactions: [], accounts: [], userDirectory: [], accessList: [] };

            if (!user) {
                this.permissions = { cards: true, accounts: false };
                document.getElementById('navbar')?.classList.add('hide');
                this.navigate('login');
                return;
            }

            this.showLoader('Carregando sua conta...');

            const fallbackProfile = {
                name: user.displayName || user.email?.split('@')[0] || 'Usuário',
                email: user.email || ''
            };

            try {
                const profileRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/profile/data`);
                const profileSnap = await getDoc(profileRef);
                this.userProfile = profileSnap.exists() ? profileSnap.data() : fallbackProfile;
            } catch (error) {
                console.warn('Não foi possível ler o perfil; usando dados da autenticação.', error);
                this.userProfile = fallbackProfile;
            }

            const isAdmin = this.isAdmin();
            if (isAdmin) {
                this.permissions = { cards: true, accounts: true };
            } else {
                this.permissions = { cards: true, accounts: false };
                try {
                    const accessSnap = await getDoc(doc(db, `artifacts/${APP_ID}/access/${user.uid}`));
                    if (accessSnap.exists()) {
                        const access = accessSnap.data();
                        this.permissions = {
                            cards: access.cards !== false,
                            accounts: access.accounts === true
                        };
                    }
                } catch (error) {
                    if (!isPermissionDenied(error)) console.warn('Não foi possível consultar permissões.', error);
                }
            }

            // O diretório de usuários é complementar. Se as novas regras ainda não
            // estiverem publicadas, a falha não pode bloquear o login nem os dados antigos.
            try {
                await setDoc(doc(db, `artifacts/${APP_ID}/userDirectory/${user.uid}`), {
                    uid: user.uid,
                    name: this.userProfile.name || fallbackProfile.name,
                    email: user.email || this.userProfile.email || '',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (error) {
                if (!isPermissionDenied(error)) console.warn('Não foi possível atualizar o diretório de usuários.', error);
            }

            try {
                const greeting = document.getElementById('user-greeting');
                if (greeting) greeting.textContent = `Olá, ${(this.userProfile.name || 'Usuário').split(' ')[0]}!`;
                document.getElementById('navbar')?.classList.remove('hide');
                document.getElementById('btn-admin')?.classList.toggle('hide', !isAdmin);

                this.setupListeners();
                this.renderModuleNav();
                this.goHome();
            } catch (error) {
                console.error('Falha ao iniciar a interface após autenticação.', error);
                this.showToast('Seu login foi aceito, mas ocorreu um erro ao carregar a interface.', 'error');
            } finally {
                this.hideLoader();
            }
        });
    },

    unsubscribeAll() {
        this.unsubscribes.forEach(unsub => {
            try { unsub(); } catch (_) {}
        });
        this.unsubscribes = [];
    },

    setupListeners() {
        const basePath = `artifacts/${APP_ID}/users/${this.user.uid}`;
        const rerender = () => {
            if (!['login', 'register', 'loading'].includes(this.ui.view)) this.render();
        };
        const listenerError = error => {
            console.error(error);
            this.showToast('Falha ao sincronizar seus dados financeiros.', 'error');
        };
        const optionalListenerError = error => {
            if (!isPermissionDenied(error)) console.warn('Falha em recurso complementar.', error);
        };

        this.unsubscribes.push(onSnapshot(collection(db, basePath, 'cards'), snap => {
            this.data.cards = snap.docs.map(item => ({ id: item.id, ...item.data() }));
            rerender();
        }, listenerError));
        this.unsubscribes.push(onSnapshot(collection(db, basePath, 'categories'), snap => {
            this.data.categories = snap.docs.map(item => ({ id: item.id, ...item.data() }));
            rerender();
        }, listenerError));
        this.unsubscribes.push(onSnapshot(collection(db, basePath, 'transactions'), snap => {
            this.data.transactions = snap.docs.map(item => ({ id: item.id, ...item.data() }));
            rerender();
        }, listenerError));
        this.unsubscribes.push(onSnapshot(collection(db, basePath, 'accounts'), snap => {
            this.data.accounts = snap.docs.map(item => ({ id: item.id, ...item.data() }));
            rerender();
        }, optionalListenerError));

        if (!this.isAdmin()) {
            this.unsubscribes.push(onSnapshot(doc(db, `artifacts/${APP_ID}/access/${this.user.uid}`), snap => {
                if (!snap.exists()) return;
                const access = snap.data();
                this.permissions = { cards: access.cards !== false, accounts: access.accounts === true };
                if (!this.permissions.cards && !this.permissions.accounts) this.ui.view = 'no_access';
                else if (this.ui.view.startsWith('card') && !this.permissions.cards) this.goHome();
                else if (this.ui.view === 'accounts' && !this.permissions.accounts) this.goHome();
                this.renderModuleNav();
                rerender();
            }, optionalListenerError));
        } else {
            this.unsubscribes.push(onSnapshot(collection(db, `artifacts/${APP_ID}/userDirectory`), snap => {
                this.data.userDirectory = snap.docs.map(item => ({ id: item.id, ...item.data() }));
                rerender();
            }, optionalListenerError));
            this.unsubscribes.push(onSnapshot(collection(db, `artifacts/${APP_ID}/access`), snap => {
                this.data.accessList = snap.docs.map(item => ({ id: item.id, ...item.data() }));
                rerender();
            }, optionalListenerError));
        }
    },

    isAdmin() {
        return (this.user?.email || '').toLowerCase() === ADMIN_EMAIL;
    },

    async installApp() {
        const prompt = getDeferredPrompt();
        if (!prompt) return this.showToast('A instalação não está disponível neste momento.', 'error');
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') document.getElementById('btn-install')?.classList.add('hidden');
        clearDeferredPrompt();
    },

    async login(event) {
        event.preventDefault();
        const button = document.getElementById('btn-login');
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-pass').value;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Firebase Auth:', error?.code, error);
            const messages = {
                'auth/invalid-credential': 'E-mail ou senha inválidos.',
                'auth/user-not-found': 'E-mail ou senha inválidos.',
                'auth/wrong-password': 'E-mail ou senha inválidos.',
                'auth/invalid-email': 'O endereço de e-mail não é válido.',
                'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
                'auth/network-request-failed': 'Não foi possível conectar ao Firebase. Verifique sua internet.'
            };
            this.showToast(messages[error?.code] || `Não foi possível entrar (${error?.code || 'erro desconhecido'}).`, 'error');
            button.disabled = false;
            button.textContent = 'Entrar';
        }
    },

    async register(event) {
        event.preventDefault();
        const password = document.getElementById('reg-pass').value;
        if (password !== document.getElementById('reg-pass-confirm').value) return this.showToast('As senhas não coincidem.', 'error');
        const button = document.getElementById('btn-register');
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';
        try {
            const name = document.getElementById('reg-name').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, `artifacts/${APP_ID}/users/${credential.user.uid}/profile/data`), {
                name, phone, email, createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, `artifacts/${APP_ID}/userDirectory/${credential.user.uid}`), {
                    uid: credential.user.uid, name, email, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (directoryError) {
                if (!isPermissionDenied(directoryError)) console.warn('Não foi possível criar entrada no diretório.', directoryError);
            }
        } catch (error) {
            console.error(error);
            this.showToast(error?.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.' : 'Erro ao criar conta.', 'error');
            button.disabled = false;
            button.textContent = 'Criar Conta';
        }
    },

    logout() { signOut(auth); },
});
