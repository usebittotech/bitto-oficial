import admin from 'firebase-admin';

console.log("🔧 WEBHOOK CARREGADO (SEM VALIDAÇÃO)");

// ========== INICIALIZAR FIREBASE ==========
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log("✅ Firebase OK");
    } catch (err) {
        console.error("❌ Firebase Error:", err.message);
    }
}

const db = admin.firestore();
const auth = admin.auth();

// ========== HANDLER ==========
export default async function handler(req, res) {
    try {
        console.log("\n🔔 WEBHOOK RECEBIDO");
        console.log("Método:", req.method);
        
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const payload = req.body;
        const data = payload.data || payload;
        
        console.log("Evento:", payload.event);
        console.log("Status:", data.status);
        console.log("Email:", data.customer?.email);

        const userEmail = data.customer?.email;
        const userName = data.customer?.name || "Usuário";
        const eventName = payload.event;
        const status = data.status;

        if (!userEmail) {
            console.log("❌ Email não encontrado");
            return res.json({ message: "Email missing" });
        }

        // Apenas process purchase_approved
        if (eventName !== 'purchase_approved' && status !== 'paid') {
            console.log("⏳ Evento não é pagamento aprovado, ignorando");
            return res.json({ message: "Payment pending" });
        }

        console.log("💰 PROCESSANDO PAGAMENTO:", userEmail);

        // Determinar plano
        const productName = data.product?.name || "";
        let planType = 'monthly';
        let monthsToAdd = 1;

        if (productName.toLowerCase().includes('trimestral') || productName.toLowerCase().includes('quarterly')) {
            planType = 'quarterly';
            monthsToAdd = 3;
        } else if (productName.toLowerCase().includes('anual') || productName.toLowerCase().includes('annual')) {
            planType = 'annual';
            monthsToAdd = 12;
        }

        const now = new Date();
        const endDate = new Date(now.getTime() + monthsToAdd * 30 * 24 * 60 * 60 * 1000);

        // Buscar ou criar usuário
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(userEmail);
            console.log("👤 Usuário existe:", userRecord.uid);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log("➕ Criando usuário");
                userRecord = await auth.createUser({
                    email: userEmail,
                    emailVerified: true,
                    displayName: userName,
                });
                console.log("✅ Usuário criado:", userRecord.uid);
            } else {
                throw error;
            }
        }

        // Atualizar Firestore
        console.log("💾 Salvando no Firestore...");
        await db.collection('users').doc(userRecord.uid).set({
            name: userName,
            email: userEmail,
            plan: planType,
            subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
            subscriptionStatus: 'active',
            billingCycle: planType,
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentId: data.id || `webhook_${Date.now()}`,
            usage: { flashcards: 0, quiz: 0, review: 0 },
            xp: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log("✅ SUCESSO! Plano:", planType, "Válido até:", endDate.toLocaleDateString('pt-BR'));

        return res.json({
            success: true,
            plan: planType,
            userId: userRecord.uid,
            expiresAt: endDate.toISOString(),
        });

    } catch (error) {
        console.error("❌ ERRO:", error.message);
        console.error("Stack:", error.stack);
        return res.status(500).json({
            error: error.message,
            details: error.toString(),
        });
    }
}