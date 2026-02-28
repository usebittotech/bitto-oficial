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

  // Só cria o plano Free se o usuário NÃO existir.
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

  // --- 1. LOGICA DE PLANOS PAGOS / EMBAIXADOR ---
  // Se não for 'free' e tiver data de fim definida (Ex: plano 'embaixador')
  if (userData.plan !== "free" && userData.subscriptionEnd) {
    const endDate = userData.subscriptionEnd.toDate();

    // Se a data de hoje for anterior ao vencimento, LIBERA TUDO
    if (now < endDate) {
      return true;
    }
  }

  // --- 2. REGRAS DO PLANO FREE (Reseta mensalmente ou barra no 3º uso) ---
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

  if (currentUsage < 3) {
    return true;
  } else {
    return false;
  }
}

/**
 * Registra o uso de uma ferramenta
 */
export async function recordToolUsage(userId, tool) {
  if (!userId) return;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  // Se o plano for vitalício/embaixador ativo, não incrementa o contador de uso
  if (userData.plan !== "free" && userData.subscriptionEnd) {
    if (new Date() < userData.subscriptionEnd.toDate()) {
      return;
    }
  }

  const field = `usage.${tool}`;
  await updateDoc(userRef, {
    [field]: increment(1),
  });
}
