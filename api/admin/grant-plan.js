import {firebase,requireUser,isAdmin,normalizedEmail,errorResponse} from '../../lib/firebase.js';
import {hash,accessFields} from '../../lib/billing.js';
import {PLAN_MONTHS,addMonths,asDate} from '../../js/entitlements.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method Not Allowed'});
  try {
    const token=await requireUser(req);
    if(!isAdmin(token)) return res.status(403).json({error:'Acesso restrito ao administrador.'});
    const email=normalizedEmail(req.body?.email),plan=req.body?.plan;
    const requestId=req.body?.requestId;
    if(!email||(!PLAN_MONTHS[plan] && plan!=='free')||typeof requestId!=='string'||!requestId||requestId.length>100) return res.status(400).json({error:'Informe e-mail, plano e identificação válidos.'});
    const now=new Date(),end=plan==='free'?null:req.body.endDate?asDate(req.body.endDate):addMonths(now,PLAN_MONTHS[plan]);
    if(plan!=='free' && (!end||end<=now||end>addMonths(now,120))) return res.status(400).json({error:'A validade precisa estar no futuro, em até 10 anos.'});
    const {db,auth,admin}=firebase();
    let account=null;try{account=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
    const uid=account?.emailVerified?account.uid:null;
    const userRef=uid?db.collection('users').doc(uid):db.collection('_pendingAccess').doc(hash(email));
    const unverifiedRef=plan==='free' && account && !uid ? db.collection('users').doc(account.uid) : null;
    const auditRef=db.collection('_adminPlanAudit').doc(hash(token.uid+':'+requestId));
    const result=await db.runTransaction(async tx=>{
      const [snapshot,audit]=await Promise.all([tx.get(userRef),tx.get(auditRef)]);
      if(audit.exists) return audit.data().result;
      const unverified=unverifiedRef ? await tx.get(unverifiedRef) : null;
      const previous=snapshot.exists?snapshot.data():{};
      const paidAccess=Object.prototype.hasOwnProperty.call(previous,'paidAccess')?previous.paidAccess:previous.plan && previous.plan!=='free'?{plan:previous.plan,end:previous.subscriptionEnd,status:previous.subscriptionStatus||'active',orderId:previous.lastPaymentId||null}:null;
      const grant=end?{plan,end:admin.firestore.Timestamp.fromDate(end),status:'active',grantedBy:token.uid,grantedAt:admin.firestore.Timestamp.fromDate(now)}:null;
      const patch={email,paidAccess,manualGrant:grant,...accessFields({...previous,paidAccess,manualGrant:grant},now)};
      if(!snapshot.exists) Object.assign(patch,{name:'Estudante',createdAt:admin.firestore.FieldValue.serverTimestamp(),usage:{flashcards:0,quiz:0,review:0},xp:0});
      const result={success:true,pending:!uid,plan:patch.plan,grantedPlan:plan,expiresAt:end?.toISOString()||null};
      tx.set(userRef,patch,{merge:true});
      if(unverified?.exists) {
        const values={...unverified.data(),manualGrant:null};
        tx.set(unverifiedRef,{manualGrant:null,...accessFields(values,now)},{merge:true});
      }
      tx.set(auditRef,{adminUid:token.uid,email,requestId,previousGrant:previous.manualGrant||null,grant,result,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return result;
    });
    return res.json(result);
  }catch(error){return errorResponse(res,error);}
}
