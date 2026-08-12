// Importa as funções do Firebase (Versão Modular - mais leve)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics, logEvent, setUserId, isSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// COLE SUA CONFIGURAÇÃO AQUI (Do passo 1)
const firebaseConfig = {
    apiKey: "AIzaSyDuGpzkLI-1wFOK9wfrGblhoTqW_gQJA30",
    authDomain: "bitto-99fac.firebaseapp.com",
    projectId: "bitto-99fac",
    storageBucket: "bitto-99fac.firebasestorage.app",
    messagingSenderId: "483124758230",
    appId: "1:483124758230:web:cdf73555872c8fe733eb77",
    measurementId: "G-3VKVXDVEZM"
  };

// Inicializa
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ===== Google Analytics 4 (via Firebase Analytics) =====
// isSupported() evita erro em navegadores/contextos que bloqueiam IndexedDB
// (ex: modo anônimo com cookies bloqueados, alguns bloqueadores de anúncio).
let analytics = null;
isSupported()
  .then((ok) => {
    if (ok) analytics = getAnalytics(app);
  })
  .catch(() => {
    /* Analytics indisponível neste navegador — segue normalmente sem quebrar o app */
  });

// Helper seguro para disparar eventos em qualquer arquivo do site,
// sem precisar checar se o Analytics já carregou.
function trackEvent(eventName, params = {}) {
  try {
    if (analytics) logEvent(analytics, eventName, params);
  } catch (e) {
    console.warn("Analytics: falha ao registrar evento", eventName, e);
  }
}

function trackUserId(uid) {
  try {
    if (analytics && uid) setUserId(analytics, uid);
  } catch (e) {
    /* silencioso */
  }
}

export { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, trackEvent, trackUserId };