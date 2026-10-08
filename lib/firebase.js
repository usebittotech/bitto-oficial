import admin from 'firebase-admin';
export function firebase() {
  if (!admin.apps.length) admin.initializeApp({credential:admin.credential.cert({
    projectId:process.env.FIREBASE_PROJECT_ID,
    clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')
  })});
  return {admin, db:admin.firestore(), auth:admin.auth()};
}
export const ADMIN_EMAIL = 'usebitto.tech@gmail.com';
export async function requireUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Faça login para continuar.'),{status:401});
  try { return await firebase().auth.verifyIdToken(header.slice(7),true); }
  catch { throw Object.assign(new Error('Sessão inválida. Entre novamente.'),{status:401}); }
}
export function isAdmin(token) { return token.email?.toLowerCase() === ADMIN_EMAIL && token.email_verified === true; }
export function normalizedEmail(value) {
  if(typeof value !== 'string') return null;
  const email=value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length<=254 ? email : null;
}
export function errorResponse(res,error) {
  console.error('Solicitação não concluída:',error.code || error.status || 'internal');
  return res.status(error.status || 500).json({error:error.status ? error.message : 'Não foi possível concluir. Tente novamente.'});
}
