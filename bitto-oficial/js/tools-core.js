import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { addUserXP, trackActivity } from './xpSystem.js';

// ELEMENTOS DA UI
const navName = document.getElementById('navUserName');
const navAvatar = document.querySelector('.avatar-circle');

// --- 1. AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                updateToolHeader(user, docSnapshot.data());
            }
        });
    } else {
        // Ajuste o caminho se necessário (ex: ../pages/login.html)
        window.location.href = 'login.html'; 
    }
});

function updateToolHeader(user, dbData) {
    const displayName = dbData.displayName || user.displayName || "Estudante";
    const firstName = displayName.split(' ')[0];
    const photoURL = dbData.photoURL || user.photoURL;

    if (navName) navName.innerText = firstName;
    if (photoURL && navAvatar) {
        navAvatar.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
}

// --- 2. SISTEMA DE XP ---
window.awardXP = async (amount, source) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addUserXP(user.uid, amount);
        showToolToast(`+${amount} XP! 🚀`, 'success');
    } catch (error) {
        console.error("Erro XP:", error);
    }
};

// --- 3. SISTEMA DE REGISTRO (NOVO) ---
// type: 'flashcards', 'quiz', 'review'
window.recordActivity = async (type, amount = 1) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await trackActivity(user.uid, type, amount);
    } catch (error) {
        console.error("Erro Activity:", error);
    }
};

// --- 4. TOAST ---
function showToolToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: white; color: #111; padding: 12px 20px; border-radius: 8px; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-top: 10px; display: flex; 
        align-items: center; gap: 10px; font-family: sans-serif; font-weight: bold;
        border-left: 4px solid ${type === 'success' ? '#CCFF00' : 'red'};
        animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `<span>${type==='success'?'✨':'⚠️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove() }, 3000);
}