import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
                : undefined,
        }),
    });
}

const db = admin.firestore();
const auth = admin.auth();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const payload = req.body;
    
    // --- CORREÇÃO DO PAYLOAD ---
    // A Cakto envia os dados úteis dentro de um objeto 'data'.
    // Se existir payload.data, usamos ele. Se não, usamos o payload direto.
    const data = payload.data || payload;

    const eventName = payload.event || data.event || ""; 
    const status = data.status || data.state || "";

    // Busca o email dentro do objeto correto
    const userEmail = data.customer?.email || data.client?.email || data.payer?.email;
    const userName = data.customer?.name || data.client?.name || "Estudante VIP";

    console.log(`WEBHOOK | Evento: [${eventName}] | Email: [${userEmail}]`);

    if (!userEmail) {
        console.log("❌ ERRO: Email não encontrado mesmo após correção.");
        return res.json({ error: "Email missing" });
    }

    // --- LÓGICA DE APROVAÇÃO ---
    let isApproved = false;

    // 1. Aprovação Real (Produção)
    if (eventName === 'purchase_approved' || status === 'paid' || status === 'approved' || eventName === 'subscription_renewed') {
        isApproved = true;
    } 
    // 2. MODO TESTE (Pix Gerado) - REMOVER DEPOIS
    else if (eventName === 'pix_gerado') {
        console.log("⚠️ TESTE PIX: Liberando acesso...");
        isApproved = true;
    }
    // 3. Cancelamento/Reembolso (Revoga acesso)
    else if (['refund', 'chargeback', 'purchase_refused'].includes(eventName) || status === 'refunded' || status === 'refused') {
        console.log(`⛔ REVOGANDO ACESSO de ${userEmail}`);
        try {
            const userRecord = await auth.getUserByEmail(userEmail);
            await db.collection('users').doc(userRecord.uid).set({
                plan: 'free',
                subscriptionEnd: null,
                lastStatus: eventName
            }, { merge: true });
            return res.json({ success: true, action: 'revoked' });
        } catch (e) {
            return res.json({ message: "Nada a revogar." });
        }
    }

    if (!isApproved) {
        return res.json({ message: "Evento ignorado." });
    }

    try {
        // Busca o nome do produto para saber se é Trimestral
        // No seu log, o nome está em data.product.name
        const productName = data.product?.name || data.offer?.name || "";
        console.log(`Produto: ${productName}`);
        
        let monthsToAdd = 1;
        let planType = 'monthly';

        if (productName.toLowerCase().includes('trimestral')) {
            monthsToAdd = 3;
            planType = 'quarterly';
            console.log(">> Plano Trimestral detectado");
        }

        const now = new Date();
        const endDate = new Date();
        endDate.setMonth(now.getMonth() + monthsToAdd);

        // --- FIRESTORE & AUTH ---
        let userRecord;
        let isNewUser = false;

        try {
            userRecord = await auth.getUserByEmail(userEmail);
            console.log("Usuário existente encontrado.");
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log("Criando novo usuário...");
                userRecord = await auth.createUser({
                    email: userEmail,
                    emailVerified: true,
                    displayName: userName
                });
                isNewUser = true;
            } else throw error;
        }

        await db.collection('users').doc(userRecord.uid).set({
            name: userName,
            email: userEmail,
            plan: planType,
            subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
            lastPaymentId: data.id || `webhook_${Date.now()}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(isNewUser && { 
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                usage: { flashcards: 0, quiz: 0, review: 0 },
                xp: 0
            })
        }, { merge: true });

        console.log(`✅ SUCESSO: ${userEmail} ativado até ${endDate.toISOString()}`);
        return res.json({ success: true });

    } catch (error) {
        console.error("ERRO CRÍTICO:", error);
        return res.status(500).json({ error: error.message });
    }
}