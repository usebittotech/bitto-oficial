import {firebase} from './firebase.js';
import {effectiveAccess,FREE_LIMITS} from '../js/entitlements.js';
export function usageMonth(now = new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(now);
  return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
}
export async function reserveUsage(uid,tool,units=1) {
  if(!Object.hasOwn(FREE_LIMITS,tool)) throw Object.assign(new Error('Ferramenta inválida.'),{status:400});
  if(!Number.isInteger(units)||units<1||units>50) throw Object.assign(new Error('Quantidade inválida.'),{status:400});
  const {db}=firebase(),ref=db.collection('users').doc(uid),month=usageMonth();
  return db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),user=snapshot.exists?snapshot.data():{};
    if(effectiveAccess(user).isActive) return null;
    const usage=user.usageMonth===month?{...user.usage}: {flashcards:0,quiz:0,review:0};
    const count=Number(usage[tool]||0);
    if(count+units>FREE_LIMITS[tool]) throw Object.assign(new Error('Limite mensal atingido. Escolha uma quantidade menor ou ative um plano.'),{status:403});
    usage[tool]=count+units;
    tx.set(ref,{usage,usageMonth:month},{merge:true});
    return {uid,tool,units,month};
  });
}
export async function releaseUsage(reservation) {
  if(!reservation) return;
  const {db}=firebase(),ref=db.collection('users').doc(reservation.uid);
  await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),user=snapshot.exists?snapshot.data():{};
    if(user.usageMonth!==reservation.month) return;
    const usage={...user.usage,[reservation.tool]:Math.max(0,Number(user.usage?.[reservation.tool]||0)-reservation.units)};
    tx.set(ref,{usage},{merge:true});
  });
}
