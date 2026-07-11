import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const fallbackConfig = JSON.parse(atob('eyJhcGlLZXkiOiJBSXphU3lEeWNvZURyekx3enFnUjJwUHA5MTh0VjlRcERQNDhCNCIsImF1dGhEb21haW4iOiJjb250cm9sZS1maW5hbmNlaXJvLWRjZTQwLmZpcmViYXNlYXBwLmNvbSIsInByb2plY3RJZCI6ImNvbnRyb2xlLWZpbmFuY2Vpcm8tZGNlNDAiLCJzdG9yYWdlQnVja2V0IjoiY29udHJvbGUtZmluYW5jZWlyby1kY2U0MC5maXJlYmFzZXN0b3JhZ2UuYXBwIiwibWVzc2FnaW5nU2VuZGVySWQiOiI2NzUwMDg3NTMzNTYiLCJhcHBJZCI6IjE6Njc1MDA4NzUzMzU2OndlYjplNmI0NWJmNGRlYjhkMzQ0Yjc1YzY5In0='));
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : fallbackConfig;

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
export { App, db, auth, APP_ID, ADMIN_EMAIL, doc, setDoc, getDoc, deleteDoc, updateDoc, writeBatch, collection, onSnapshot, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getDeferredPrompt, clearDeferredPrompt };
