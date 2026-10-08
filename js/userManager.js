import {auth,db,doc,getDoc} from './firebase-init.js';
import {effectiveAccess,FREE_LIMITS} from './entitlements.js';
export async function syncUserDatabase(user) {
 const token=await user.getIdToken(true);
 const response=await fetch('/api/account/sync',{method:'POST',headers:{Authorization:'Bearer '+token}});
 const data=await response.json();
 if(!response.ok) throw new Error(data.error || 'Não foi possível sincronizar sua conta.');
 sessionStorage.setItem('bitto_pending_verification',data.needsEmailVerification?'1':'0');
 return data;
}
export async function checkUsageLimit(userId,tool,units=1) {
 if(!userId||!Object.hasOwn(FREE_LIMITS,tool))return false;
 const snap=await getDoc(doc(db,'users',userId));
 if(!snap.exists())return false;
 const user=snap.data();
 if(effectiveAccess(user).isActive)return true;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const month=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
 return (user.usageMonth===month?Number(user.usage?.[tool]||0):0)+units<=FREE_LIMITS[tool];
}
// O servidor já contabiliza a geração; o cliente não altera cotas.
export async function incrementUsage() {}
