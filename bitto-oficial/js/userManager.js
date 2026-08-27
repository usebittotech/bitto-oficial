import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "./firebase-init.js";

/**
 * Cria ou atualiza o usuário no banco ao fazer login
 */
export async function syncUserDatabase(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name: user.displayName || "Estudante",
      plan: "free",
      subscriptionEnd: null,
      usage: {
        flashcards: 0,
        quiz: 0,
        review: 0,
      },
      lastReset: serverTimestamp(),
    });
  }
}

/**
 * Verifica se o usuário pode usar a ferramenta
 */
export async function checkUsageLimit(userId, tool) {
  if (!userId) return false;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return false;

  const userData = userSnap.data();
  const now = new Date();

  // --- 1. VERIFICAÇÃO DE PLANO PAGO (PRO ou EMBAIXADOR) ---
  if (userData.plan !== "free" && userData.subscriptionEnd) {
    const endDate = userData.subscriptionEnd.toDate();
    if (now < endDate) {
      return true; // LIBERADO TOTAL
    }
  }

  // --- 2. REGRAS DO PLANO FREE ---
  const lastReset = userData.lastReset
    ? userData.lastReset.toDate()
    : new Date(0);
  const isNewMonth =
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    await updateDoc(userRef, {
      "usage.flashcards": 0,
      "usage.quiz": 0,
      "usage.review": 0,
      lastReset: serverTimestamp(),
    });
    return true;
  }

  const currentUsage = userData.usage?.[tool] || 0;
  return currentUsage < 3;
}

/**
 * Incrementa o uso (APENAS se for usuário FREE)
 */
export async function incrementUsage(userId, tool) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  // REGRA IMPORTANTE: Se o plano for ativo (não free), não gasta o limite de 3 usos
  if (userData.plan !== "free" && userData.subscriptionEnd) {
    const endDate = userData.subscriptionEnd.toDate();
    if (new Date() < endDate) {
      return; // Sai da função sem incrementar o contador
    }
  }

  // Se for Free, incrementa normal
  await updateDoc(userRef, {
    [`usage.${tool}`]: increment(1),
  });
}
