// Arquivo: api/reviews.js
// Avaliações públicas da BITTO (nome + estrelas + comentário), no estilo
// "avaliação de loja". Não exige login. Toda avaliação nova entra como
// "pending" no Firestore e só aparece no site depois de aprovada manualmente
// (coleção "reviews", campo status). Isso evita que spam/avaliação falsa
// vá direto para o ar.

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

const ALLOWED_ORIGIN = "https://www.usebitto.com";
const REVIEWS_COLLECTION = "reviews";
const RATE_LIMIT_COLLECTION = "reviewRateLimit";
const RATE_LIMIT_SECONDS = 60; // mínimo entre envios do mesmo IP
const MAX_LIST = 20;

function setCors(res, origin) {
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

async function handleGet(req, res) {
  const snapshot = await db
    .collection(REVIEWS_COLLECTION)
    .where("status", "==", "approved")
    .orderBy("createdAt", "desc")
    .limit(MAX_LIST)
    .get();

  const reviews = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      rating: data.rating,
      comment: data.comment,
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
    };
  });

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.status(200).json({ reviews });
}

async function handlePost(req, res) {
  const body = req.body || {};
  const name = sanitizeText(body.name, 60);
  const comment = sanitizeText(body.comment, 500);
  const rating = Number(body.rating);

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Nome inválido." });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Avaliação deve ser de 1 a 5 estrelas." });
  }
  if (!comment || comment.length < 5) {
    return res.status(400).json({ error: "Comentário muito curto." });
  }

  // Rate limit simples por IP (evita flood automatizado sem exigir login)
  const ip = getClientIp(req);
  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(Buffer.from(ip).toString("hex"));

  try {
    const rateLimitDoc = await rateLimitRef.get();
    if (rateLimitDoc.exists) {
      const lastAt = rateLimitDoc.data().lastAt?.toDate?.();
      if (lastAt && (Date.now() - lastAt.getTime()) / 1000 < RATE_LIMIT_SECONDS) {
        return res.status(429).json({ error: "Aguarde um pouco antes de enviar outra avaliação." });
      }
    }
  } catch (e) {
    // Se a checagem de rate limit falhar, segue em frente sem bloquear o usuário.
    console.warn("reviews: falha ao checar rate limit", e);
  }

  const reviewRef = db.collection(REVIEWS_COLLECTION).doc();
  await reviewRef.set({
    name,
    rating,
    comment,
    status: "pending", // vira "approved" manualmente no console do Firebase
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ip,
  });

  await rateLimitRef.set({ lastAt: admin.firestore.FieldValue.serverTimestamp() });

  return res.status(201).json({ ok: true });
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      return await handleGet(req, res);
    }
    if (req.method === "POST") {
      return await handlePost(req, res);
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("reviews: erro inesperado", err);
    return res.status(500).json({ error: "Erro interno ao processar avaliação." });
  }
}
