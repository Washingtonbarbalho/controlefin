import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, collectionGroup, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Mesma configuração Firebase utilizada pela versão original do aplicativo.
// A chave de API identifica o projeto no cliente; não é uma senha de usuário.
const firebaseConfig = {
    apiKey: 'AIzaSyDycoeDrzLwzqgR7p2Pp918tV9QpDP48B4',
    authDomain: 'controle-financeiro-dce40.firebaseapp.com',
    projectId: 'controle-financeiro-dce40',
    storageBucket: 'controle-financeiro-dce40.firebasestorage.app',
    messagingSenderId: '675008753356',
    appId: '1:675008753356:web:e6b45bf4deb8d344b75c69'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const APP_ID = 'fin-app-direto';
const ADMIN_EMAIL = 'washington.wn8@gmail.com';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('btn-install')?.classList.remove('hidden');
});

const App = {
    user: null,
    userProfile: null,
    permissions: { cards: true, accounts: false },
    unsubscribes: [],
    data: {
        cards: [],
        categories: [],
        transactions: [],
        accounts: [],
        userDirectory: [],
        profileDirectory: [],
        accessList: []
    },
    ui: {
        view: 'loading',
        selectedCard: null,
        selectedMonth: null,
        accountKind: 'payable',
        filterCategory: '',
        editingItem: null,
        currentAction: null,
        actionScope: null,
        actionEntity: null
    },
};

const getDeferredPrompt = () => deferredPrompt;
const clearDeferredPrompt = () => { deferredPrompt = null; };

window.App = App;
export { App, db, auth, APP_ID, ADMIN_EMAIL, doc, setDoc, getDoc, deleteDoc, updateDoc, writeBatch, collection, collectionGroup, onSnapshot, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getDeferredPrompt, clearDeferredPrompt };
