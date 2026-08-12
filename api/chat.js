// Arquivo: api/chat.js
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
const authAdmin = admin.auth();

const ALLOWED_ORIGIN = 'https://www.usebitto.com';

export default async function handler(req, res) {
    // 1. Configuração de CORS (restrita ao próprio domínio, não mais "*")
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Autenticação obrigatória
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }
    try {
        await authAdmin.verifyIdToken(idToken);
    } catch (e) {
        return res.status(401).json({ error: 'Token de autenticação inválido.' });
    }

    // 3. Busca a Chave de API
    // Tenta a chave específica do Chat, se não achar, usa a geral
    const apiKey = process.env.GEMINI_API_CHAT || process.env.GEMINI_API_CHAT;

    if (!apiKey) {
        return res.status(500).json({ error: 'Chave de API não configurada.' });
    }

    const { contents } = req.body;

    // 3. ESTRATÉGIA DE REDUNDÂNCIA (FAILOVER)
    // Tenta o modelo rápido primeiro. Se der erro de limite (429), pula para o estável.
    // O 'gemini-2.5-flash-lite' é otimizado para volume.
    // O 'gemini-1.5-flash' é o backup estável.
    const models = ["gemini-2.5-flash-lite", "gemini-1.5-flash"];

    // Função auxiliar para tentar chamar a API
    async function tryModel(modelName) {
        console.log(`[Backend] Tentando modelo: ${modelName}...`);
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents,
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            }
        );
        return response;
    }

    try {
        // TENTATIVA 1: Modelo Principal (Lite)
        let googleResponse = await tryModel(models[0]);

        // Se der erro 429 (Limite Excedido) ou 503 (Serviço Indisponível), tenta o Backup
        if (googleResponse.status === 429 || googleResponse.status === 503) {
            console.warn(`⚠️ Modelo ${models[0]} falhou (${googleResponse.status}). Ativando Backup...`);
            
            // TENTATIVA 2: Modelo Backup (1.5 Flash)
            googleResponse = await tryModel(models[1]);
        }

        const data = await googleResponse.json();

        // Se ainda assim der erro (nos dois modelos), repassa o erro para o front
        if (!googleResponse.ok) {
            return res.status(googleResponse.status).json(data);
        }

        // Sucesso!
        res.status(200).json(data);

    } catch (error) {
        console.error("❌ Erro Crítico no Backend:", error);
        res.status(500).json({ error: 'Erro interno ao processar solicitação.' });
    }
}