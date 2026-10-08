import crypto from 'node:crypto';
import {firebase,normalizedEmail} from './firebase.js';
import {effectiveAccess,addMonths,PLAN_MONTHS,asDate} from '../js/entitlements.js';

export const PRODUCTS = {
  '3e0471a5-86a6-41bb-a67d-3b90ac7eaf67':'monthly',
  '1312e3c4-dabf-4621-86c8-102937fea4a2':'quarterly',
  '771e3e51-75dd-4549-b2bc-d206607d073f':'annual'
};
export const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export function accessFields(user, now = new Date()) {
  const access=effectiveAccess(user,now);
  const {admin}=firebase();
  return {plan:access.plan,subscriptionEnd:access.end ? admin.firestore.Timestamp.fromDate(access.end) : null,subscriptionStatus:access.isActive?'active':'expired',updatedAt:admin.firestore.FieldValue.serverTimestamp()};
}
export function subscriptionId(data) { return String(data.subscription?.id || data.subscription_id || ''); }
const APPROVALS = ['purchase_approved','subscription_renewed'];
const REVOCATIONS = ['refund','chargeback'];
const STATES = {subscription_canceled:'canceled',subscription_paused:'paused',subscription_resumed:'active',subscription_late:'late',subscription_renewal_refused:'renewal_refused',subscription_late_recovered:'active'};

export async function processOrder(event,data) {
  const {db,auth,admin}=firebase();
  if (!data || typeof data!=='object' || Array.isArray(data)) throw Object.assign(new Error('Pedido inválido.'),{status:400});
  const plan=PRODUCTS[data.product?.id];
  if(!plan) return {action:'ignored',reason:'unknown_product'};
  if(!APPROVALS.includes(event) && !REVOCATIONS.includes(event) && !STATES[event]) return {action:'ignored',reason:'non_payment_event'};
  if(APPROVALS.includes(event) && !['paid','approved'].includes(data.status)) return {action:'ignored',reason:'not_paid'};
  const email=normalizedEmail(data.customer?.email || data.client?.email || data.payer?.email);
  const orderId=data.id || data.order_id;
  if(!email || typeof orderId!=='string' || !orderId || orderId.length>200) throw Object.assign(new Error('Pedido sem identificação ou e-mail válido.'),{status:400});
  const subId=subscriptionId(data);
  let uid=null;
  try { uid=(await auth.getUserByEmail(email)).uid; } catch(e) { if(e.code!=='auth/user-not-found') throw e; }
  const userRef=uid ? db.collection('users').doc(uid) : db.collection('_pendingAccess').doc(hash(email));
  const orderRef=db.collection('_billingOrders').doc(hash(orderId));
  const eventRef=db.collection('_billingEvents').doc(hash(event+':'+orderId+':'+(data.status||'')));
  const now=new Date();
  return db.runTransaction(async tx => {
    const [userSnap,orderSnap,eventSnap]=await Promise.all([tx.get(userRef),tx.get(orderRef),tx.get(eventRef)]);
    if(eventSnap.exists) return {action:'duplicate'};
    const user=userSnap.exists ? userSnap.data() : {};
    const order=orderSnap.exists ? orderSnap.data() : {};
    if(order.email && order.email!==email) throw Object.assign(new Error('Pedido associado a outra conta.'),{status:409});
    const periodsSnap=await tx.get(db.collection('_billingOrders').where('email','==',email));
    const periods=periodsSnap.docs.map(d=>d.data()).filter(p=>p.orderId!==orderId && p.status==='paid');
    // O acesso anterior à migração também fica separado da concessão manual.
    const legacy=Object.prototype.hasOwnProperty.call(user,'paidAccess') ? user.legacyPaidAccess : (user.plan && user.plan!=='free' ? {plan:user.plan,end:user.subscriptionEnd,orderId:user.lastPaymentId || null,status:user.subscriptionStatus || 'active'} : null);
    const patch={email,legacyPaidAccess:legacy || null};
    let action='ignored';
    let changedOrder=null;
    if(APPROVALS.includes(event)) {
      if(['refunded','chargeback'].includes(order.status)) return {action:'ignored',reason:'order_revoked'};
      if(order.status==='paid') {
        tx.set(eventRef,{event,orderId,email,receivedAt:admin.firestore.FieldValue.serverTimestamp()});
        return {action:'duplicate'};
      }
      const paidAt=asDate(data.paidAt || data.createdAt) || now;
      const candidateEnds=[paidAt,...periods.map(p=>asDate(p.end)),asDate(legacy?.end)].filter(Boolean);
      const start=new Date(Math.max(...candidateEnds.map(x=>x.getTime())));
      const end=addMonths(start,PLAN_MONTHS[plan]);
      changedOrder={orderId,email,uid,plan,status:'paid',subscriptionId:subId,start:admin.firestore.Timestamp.fromDate(start),end:admin.firestore.Timestamp.fromDate(end),paidAt:admin.firestore.Timestamp.fromDate(paidAt),amount:Number(data.amount || 0)};
      periods.push(changedOrder);
      Object.assign(patch,{lastPaymentId:orderId,lastPaymentDate:changedOrder.paidAt,lastPaymentEvent:event,billingCycle:plan,customerId:data.customer?.id || null});
      action='activated';
    } else if(REVOCATIONS.includes(event)) {
      changedOrder={...order,orderId,email,uid,plan,status:event==='refund'?'refunded':'chargeback',subscriptionId:subId,revokedAt:admin.firestore.FieldValue.serverTimestamp()};
      if(legacy?.orderId===orderId) patch.legacyPaidAccess=null;
      action='revoked';
    } else {
      // Cancelar a renovação mantém o período já pago; não afeta concessões gratuitas.
      const currentSub=user.paidAccess?.subscriptionId;
      if(currentSub && subId && currentSub!==subId) return {action:'ignored',reason:'other_subscription'};
      patch.renewalStatus=STATES[event];
      patch.autoRenew= !['canceled','paused'].includes(STATES[event]);
      action='subscription_updated';
      if(order.status==='paid') periods.push(order);
    }
    if(patch.legacyPaidAccess) periods.push(patch.legacyPaidAccess);
    const current=periods.filter(p=>asDate(p.end)>now).sort((a,b)=>asDate(b.end)-asDate(a.end))[0];
    patch.paidAccess=current ? {plan:current.plan,end:current.end,status:'active',orderId:current.orderId || null,subscriptionId:current.subscriptionId || ''} : null;
    if(!userSnap.exists) Object.assign(patch,{name:data.customer?.name || 'Estudante',createdAt:admin.firestore.FieldValue.serverTimestamp(),usage:{flashcards:0,quiz:0,review:0},xp:0});
    Object.assign(patch,accessFields({...user,...patch},now));
    tx.set(userRef,patch,{merge:true});
    if(changedOrder) tx.set(orderRef,changedOrder,{merge:true});
    tx.set(eventRef,{event,orderId,email,action,receivedAt:admin.firestore.FieldValue.serverTimestamp()});
    return {action,plan:patch.plan,expiresAt:asDate(patch.subscriptionEnd)?.toISOString() || null,pending:!uid};
  });
}

export async function claimPendingAccess(token) {
  const email=normalizedEmail(token.email);
  if(!email) return {pending:false};
  const {db,admin}=firebase();
  const pendingRef=db.collection('_pendingAccess').doc(hash(email));
  const userRef=db.collection('users').doc(token.uid);
  return db.runTransaction(async tx=>{
    const [pending,user]=await Promise.all([tx.get(pendingRef),tx.get(userRef)]);
    const base=user.exists?user.data():{email,name:token.name || 'Estudante',createdAt:admin.firestore.FieldValue.serverTimestamp(),usage:{flashcards:0,quiz:0,review:0},xp:0};
    if(pending.exists && !token.email_verified) {
      if(!user.exists) tx.set(userRef,{...base,plan:'free',subscriptionEnd:null});
      return {pending:true,needsEmailVerification:true};
    }
    const values=pending.exists ? pending.data() : {};
    if(values.claimedBy && values.claimedBy!==token.uid) throw Object.assign(new Error('Liberação já vinculada a outra conta.'),{status:409});
    const transferred={};
    for(const key of ['manualGrant','paidAccess','legacyPaidAccess','billingCycle','customerId','lastPaymentId','lastPaymentDate','lastPaymentEvent','renewalStatus','autoRenew']) if(Object.hasOwn(values,key)) transferred[key]=values[key];
    for(const key of ['paidAccess','manualGrant']) if(asDate(base[key]?.end)>asDate(transferred[key]?.end)) transferred[key]=base[key];
    const patch={...base,...transferred,email,...accessFields({...base,...transferred})};
    tx.set(userRef,patch,{merge:true});
    if(pending.exists) tx.delete(pendingRef);
    return {pending:false,plan:patch.plan};
  });
}
