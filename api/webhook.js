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

    const data = req.body;

    // --- 🕵️ MODO DETETIVE ATIVADO ---
    // Isso vai mostrar no log da Vercel TODO o pacote que a Cakto mandou
    console.log("🔍 PAYLOAD CAKTO:", JSON.stringify(data, null, 2));

    const eventName = data.event || ""; 
    // Tenta achar o status em vários lugares comuns
    const status = data.state || data.status || data.current_status || "";

    // Tenta achar o email em vários lugares comuns (Fallback)
    const userEmail = data.customer?.email || data.client?.email || data.payer?.email || data.buyer?.email;
    const userName = data.customer?.name || data.client?.name || data.payer?.name || "Estudante VIP";

    console.log(`WEBHOOK PROCESSANDO | Evento: [${eventName}] | Email: [${userEmail}]`);

    if (!userEmail) {
        // Retorna sucesso 200 para a Cakto não ficar tentando de novo, mas avisa no log
        console.log("❌ ERRO: Email não encontrado no payload.");
        return res.json({ received: true, error: "Email missing" });
    }

    // --- LÓGICA DE APROVAÇÃO ---
    let isApproved = false;

    if (eventName === 'purchase_approved' || status === 'paid' || status === 'approved') {
        isApproved = true;
    } 
    // MODO TESTE PIX
    else if (eventName === 'pix_gerado') {
        console.log("⚠️ TESTE PIX: Liberando acesso...");
        isApproved = true;
    }

    if (!isApproved) {
        return res.json({ message: "Evento ignorado." });
    }

    try {
        // Tenta pegar o nome do produto
        // Às vezes vem dentro de uma lista 'items' ou 'products'
        const productName = data.product?.name || data.products?.[0]?.name || "";
        
        let monthsToAdd = 1;
        let planType = 'monthly';

        if (productName.toLowerCase().includes('trimestral')) {
            monthsToAdd = 3;
            planType = 'quarterly';
        }

        // Cálculos de data
        const now = new Date();
        const endDate = new Date();
        endDate.setMonth(now.getMonth() + monthsToAdd);

        // Firebase Auth e Firestore
        let userRecord;
        let isNewUser = false;

        try {
            userRecord = await auth.getUserByEmail(userEmail);
            console.log("Usuário encontrado:", userRecord.uid);
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

        console.log(`✅ SUCESSO TOTAL: ${userEmail} ativado.`);
        return res.json({ success: true });

    } catch (error) {
        console.error("ERRO CRÍTICO:", error);
        return res.status(500).json({ error: error.message });
    }
}