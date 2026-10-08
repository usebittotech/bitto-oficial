import {firebase,requireUser,isAdmin,errorResponse} from '../../lib/firebase.js';
import {effectiveAccess,asDate} from '../../js/entitlements.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'Method Not Allowed'});
  try {
    const token=await requireUser(req);
    const id=req.query.userId;
    if(typeof id!=='string'||!id) return res.status(400).json({error:'Informe o usuário.'});
    if(token.uid!==id&&!isAdmin(token)) return res.status(403).json({error:'Acesso não autorizado.'});
    const snapshot=await firebase().db.collection('users').doc(id).get();
    const user=snapshot.exists?snapshot.data():{};
    const now=new Date(),access=effectiveAccess(user,now);
    return res.json({status:!snapshot.exists?'not_found':access.isActive?'active':'expired',plan:access.plan,isActive:access.isActive,subscriptionEnd:access.end?.toISOString()||null,daysLeft:access.end?Math.ceil((access.end-now)/86400000):0,source:access.source,billingCycle:user.billingCycle||null,renewalStatus:user.renewalStatus||null,lastPaymentDate:asDate(user.lastPaymentDate)?.toISOString()||null,name:user.name||null,email:user.email||null,usage:user.usage||{},usageMonth:user.usageMonth||null,xp:user.xp||0});
  }catch(error){return errorResponse(res,error);}
}
