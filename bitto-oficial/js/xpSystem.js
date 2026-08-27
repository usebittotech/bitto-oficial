import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- TABELA DE NÍVEIS ---
export const XP_TABLE = [
    { level: 1, min: 0, limit: 100 },
    { level: 2, min: 100, limit: 250 },
    { level: 3, min: 250, limit: 500 },
    { level: 4, min: 500, limit: 900 },
    { level: 5, min: 900, limit: 1400 },
    { level: 6, min: 1400, limit: 2100 },
    { level: 7, min: 2100, limit: 3000 },
    { level: 8, min: 3000, limit: 4200 },
    { level: 9, min: 4200, limit: 5800 },
    { level: 10, min: 5800, limit: 10000 }
];

export function calculateLevel(xp) {
    const levelData = XP_TABLE.find(l => xp < l.limit) || XP_TABLE[XP_TABLE.length - 1];
    return levelData;
}

// --- VERIFICAÇÃO MENSAL (RESET) ---
export async function checkMonthlyReset(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const currentMonth = new Date().toISOString().slice(0, 7); // Ex: "2026-01"

    if (snap.exists()) {
        const data = snap.data();
        
        // Se mudou o mês, ZERA TUDO
        if (data.lastResetMonth !== currentMonth) {
            console.log("📅 Novo mês! Resetando estatísticas...");
            await updateDoc(userRef, {
                xp: 0,
                level: 1,
                lastResetMonth: currentMonth,
                // Zera os contadores específicos
                "stats.cardsGeneratedMonth": 0, // Total Geral
                "stats.flashcardsGen": 0,
                "stats.quizGen": 0,
                "stats.reviewGen": 0
            });
            return 0; 
        }
        return data.xp || 0;
    } else {
        // PRIMEIRO ACESSO
        await setDoc(userRef, {
            displayName: user.displayName || "Estudante",
            email: user.email,
            xp: 0,
            level: 1,
            lastResetMonth: currentMonth,
            photoURL: user.photoURL || "",
            stats: {
                cardsGeneratedMonth: 0,
                flashcardsGen: 0,
                quizGen: 0,
                reviewGen: 0
            }
        }, { merge: true });
        return 0;
    }
}

// --- FUNÇÃO PARA DAR XP ---
export async function addUserXP(userId, amount) {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        xp: increment(amount)
    });
    return { success: true };
}

// --- FUNÇÃO PARA REGISTRAR ATIVIDADE ESPECÍFICA ---
export async function trackActivity(userId, type, amount) {
    const userRef = doc(db, "users", userId);
    
    // Atualiza o contador específico e o total geral
    const updates = {
        "stats.cardsGeneratedMonth": increment(amount) // Mantemos o total geral para o Dashboard
    };

    // Atualiza o contador específico
    if (type === 'flashcards') updates["stats.flashcardsGen"] = increment(amount);
    if (type === 'quiz') updates["stats.quizGen"] = increment(1); // Conta como 1 jogo
    if (type === 'review') updates["stats.reviewGen"] = increment(1); // Conta como 1 resumo

    await updateDoc(userRef, updates);
}