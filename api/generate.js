// Arquivo: api/generate.js
import admin from "firebase-admin";
import {reserveUsage,releaseUsage} from '../lib/usage.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Origem permitida para CORS (restrito ao próprio domínio, em vez de "*")
const ALLOWED_ORIGIN = "https://www.usebitto.com";

function setCors(res, origin) {
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  res.setHeader("Vary", "Origin");
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPEN_API_KEY;

  if (!geminiKey && !openRouterKey) {
    return res
      .status(500)
      .json({ error: "Chaves de API não configuradas no ambiente da Vercel." });
  }

  // ========== AUTENTICAÇÃO OBRIGATÓRIA ==========
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Token de autenticação ausente." });
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: "Token de autenticação inválido." });
  }

  const uid = decodedToken.uid;

  const prompt = req.body?.contents?.[0]?.parts?.[0]?.text;
  const tool = req.body?.tool;
  const quantity = tool === 'flashcards' ? req.body?.quantity : 1;
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>120000) return res.status(400).json({error:'Conteúdo vazio ou muito grande.'});
  let reservation;
  try { reservation = await reserveUsage(uid,tool,quantity); }
  catch(error) { return res.status(error.status || 503).json({error:error.status?error.message:'Não foi possível verificar o limite. Tente novamente.'}); }
  const adapt = data => {
    if(tool==='flashcards') {
      const text=data.candidates?.[0]?.content?.parts?.[0]?.text;
      const cards=JSON.parse(String(text||'').replace(/```json|```/g,'').trim());
      if(!Array.isArray(cards)||cards.length<quantity) throw new Error('Flashcards incompletos.');
      data.candidates[0].content.parts=[{text:JSON.stringify(cards.slice(0,quantity))}];
    } else if(!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Resposta vazia.');
    return data;
  };
  // A cota é reservada em transação e devolvida se nenhum modelo responder.
  try {
    const body = req.body;
    const prompt = body?.contents?.[0]?.parts?.[0]?.text;

    if (!prompt) {
      return res.status(400).json({ error: "O prompt enviado está vazio ou incorreto." });
    }

    // 🚀 PIPELINE DE FALLBACK (Tier 1 a Tier 6)
    const pipeline = [
      { provider: "gemini", id: "gemini-3.1-flash-lite" },
      { provider: "gemini", id: "gemini-2.5-pro" },
      { provider: "gemini", id: "gemini-2.5-flash" },
      { provider: "openrouter", id: "cohere/north-mini-code:free" },
      { provider: "openrouter", id: "nvidia/nemotron-3.5-content-safety:free" },
      { provider: "openrouter", id: "google/gemma-4-26b-a4b-it:free" },
    ];

    let lastError = null;

    for (const tier of pipeline) {
      if(tier.provider==='gemini'&&!geminiKey || tier.provider==='openrouter'&&!openRouterKey) continue;
      try {
        if (tier.provider === "gemini") {
          const googleResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${tier.id}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              signal: AbortSignal.timeout(20000),
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
              }),
            }
          );

          if (!googleResponse.ok) {
            throw new Error(`Gemini ${tier.id} respondeu com status ${googleResponse.status}`);
          }

          const data = await googleResponse.json();
          return res.status(200).json(adapt(data));
        } else if (tier.provider === "openrouter") {
          const openRouterResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              signal: AbortSignal.timeout(20000),
              headers: {
                Authorization: `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: tier.id,
                messages: [{ role: "user", content: prompt }],
              }),
            }
          );

          if (!openRouterResponse.ok) {
            throw new Error(`OpenRouter ${tier.id} respondeu com status ${openRouterResponse.status}`);
          }

          const data = await openRouterResponse.json();
          const adaptedData = {
            candidates: [
              {
                content: {
                  parts: [{ text: data.choices?.[0]?.message?.content || "" }],
                },
              },
            ],
          };

          return res.status(200).json(adapt(adaptedData));
        }
      } catch (error) {
        console.warn(`[Pipeline Fallback] Falha no modelo ${tier.id}:`, error.message);
        lastError = error;
        continue;
      }
    }

    await releaseUsage(reservation);
    return res.status(502).json({
      error: "Todos os modelos do pipeline falharam de forma consecutiva.",
      details: lastError?.message,
    });
  } catch (error) {
    await releaseUsage(reservation);
    console.error("Erro geral no Backend:", error);
    return res.status(500).json({ error: "Erro interno ao processar solicitação." });
  }
}
