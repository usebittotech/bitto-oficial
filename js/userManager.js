import { db, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from './firebase-init.js';

/**
 * Cria ou atualiza o usuário no banco ao fazer login
 */
export async function syncUserDatabase(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // Só cria o plano Free se o usuário NÃO existir.
    // Se o Webhook já criou (pagamento), isso aqui é pulado, preservando o plano pago.
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            email: user.email,
            name: user.displayName || "Estudante",
            plan: "free", 
            subscriptionEnd: null,
            usage: {
                flashcards: 0,
                quiz: 0,
                review: 0
            },
            lastReset: serverTimestamp() 
        });
    }
}

/**
 * Verifica se o usuário pode usar a ferramenta
 * @param {string} userId - ID do usuário
 * @param {string} tool - 'flashcards', 'quiz' ou 'review'
 * @returns {Promise<boolean>} - true se permitido, false se bloqueado
 */
export async function checkUsageLimit(userId, tool) {
    if (!userId) return false;
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return false;

    const userData = userSnap.data();
    const now = new Date();
    
    // --- 1. VERIFICAÇÃO DE PLANO PAGO ---
    // Se não for 'free' e tiver data de fim definida
    if (userData.plan !== 'free' && userData.subscriptionEnd) {
        const endDate = userData.subscriptionEnd.toDate(); 
        
        // Se a data de hoje for anterior ao vencimento, LIBERA TUDO
        if (now < endDate) {
            return true; 
        }
        // Se venceu, o código continua e cai nas regras do plano Free abaixo
    }

    // --- 2. REGRAS DO PLANO FREE ---
    // Verifica se virou o mês para resetar as cotas
    const lastReset = userData.lastReset ? userData.lastReset.toDate() : new Date(0);
    const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

    if (isNewMonth) {
        await updateDoc(userRef, {
            "usage.flashcards": 0,
            "usage.quiz": 0,
            "usage.review": 0,
            lastReset: serverTimestamp()
        });
        return true; // Liberado (acabou de resetar)
    }

    // Verifica limite (Free tem 3 usos por ferramenta)
    // < 3 permite: 0, 1 e 2. O 4º uso bloqueia.
    const currentUsage = userData.usage?.[tool] || 0;
    
    if (currentUsage < 4) {
        return true;
    } else {
        return false; // Bloqueado
    }
}

/**
 * Incrementa o uso após o sucesso da geração
 */
export async function incrementUsage(userId, tool) {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        [`usage.${tool}`]: increment(1)
    });
}