import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
// Os testes exigem emuladores. Nunca carregam credenciais nem conectam à produção.
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Execute com os emuladores de Firestore e Auth.');
const projectId='demo-bitto-billing';
process.env.GCLOUD_PROJECT=projectId;
process.env.CAKTO_WEBHOOK_SECRET='local-test-secret';
process.env.GEMINI_API_KEY='local-test-key';
const require=createRequire(import.meta.url);
const admin=require('firebase-admin');
admin.initializeApp({projectId});
const {initializeTestEnvironment,assertFails,assertSucceeds}=await import('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,getDoc,collection,getDocs,Timestamp}=await import('firebase/firestore');
const {processOrder,PRODUCTS,claimPendingAccess,hash}=await import('../lib/billing.js');
const {effectiveAccess,addMonths}=await import('../js/entitlements.js');
const {reserveUsage,releaseUsage,usageMonth}=await import('../lib/usage.js');
const {default:grant}=await import('../api/admin/grant-plan.js');
const {default:webhook}=await import('../api/webhooks/cakto.js');
const {default:legacyWebhook}=await import('../api/webhook.js');
const {default:status}=await import('../api/webhooks/cakto-status.js');
const {default:generate}=await import('../api/generate.js');
const db=admin.firestore(),auth=admin.auth(),nativeFetch=globalThis.fetch;
let rulesEnv,adminToken,userToken;
const email='student@example.test',uid='student';
const at=date=>admin.firestore.Timestamp.fromDate(new Date(date));
const future=()=>at(new Date(Date.now()+45*86400000));
const product=plan=>Object.entries(PRODUCTS).find(([id,p])=>p===plan)[0];
const order=(plan='monthly',id='order-1',extras={})=>({id,status:'paid',product:{id:product(plan),name:'nome que pode mudar'},offer:{id:'offer'},customer:{email,name:'Teste'},paidAt:new Date().toISOString(),subscription:{id:'sub-1'},...extras});
const user=()=>db.collection('users').doc(uid);
async function invoke(handler,body,token=adminToken,method='POST',query={}) {
 const req={method,headers:token?{authorization:'Bearer '+token}:{},query,body};
 const res={code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;},setHeader(){},end(){return this;}};
 await handler(req,res);return res;
}
async function tokenFor(uid) {
 const token=await auth.createCustomToken(uid);
 const r=await nativeFetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})});
 const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b.idToken;
}
before(async()=>{
 rulesEnv=await initializeTestEnvironment({projectId,firestore:{host:process.env.FIRESTORE_EMULATOR_HOST.split(':')[0],port:Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
 await auth.createUser({uid:'administrator',email:'usebitto.tech@gmail.com',emailVerified:true});
 await auth.createUser({uid,email,emailVerified:true});
 adminToken=await tokenFor('administrator');userToken=await tokenFor(uid);
});
beforeEach(async()=>{globalThis.fetch=nativeFetch;await rulesEnv.clearFirestore();await user().set({email,plan:'free',subscriptionEnd:null,usage:{flashcards:0,quiz:0,review:0},usageMonth:usageMonth()});});
after(async()=>{globalThis.fetch=nativeFetch;await rulesEnv?.cleanup();await admin.app().delete();});
for(const plan of ['monthly','quarterly','annual']) {
 test('aprovação '+plan+' nas duas rotas',async()=>{
  for(const handler of [webhook,legacyWebhook]) {
   await rulesEnv.clearFirestore();await user().set({email,plan:'free'});
   const r=await invoke(handler,{secret:'local-test-secret',event:'purchase_approved',data:order(plan)});
   assert.equal(r.code,200);assert.equal(effectiveAccess((await user().get()).data()).plan,plan);
  }
 });
 test('liberação gratuita '+plan+' em conta nova e vencida',async()=>{
  for(const seed of [{email,plan:'free'},{email,plan:'monthly',subscriptionEnd:at('2020-01-01')}]) {
   await user().set(seed);
   const r=await invoke(grant,{email:' STUDENT@EXAMPLE.TEST ',plan,requestId:crypto.randomUUID()});
   assert.equal(r.code,200);assert.equal(effectiveAccess((await user().get()).data()).plan,plan);
  }
 });
 test('plano vigente '+plan+' não consome cota',async()=>{
  await user().set({email,plan,subscriptionEnd:future(),usage:{quiz:3},usageMonth:usageMonth()});
  assert.equal(await reserveUsage(uid,'quiz'),null);
 });
 test('plano vencido '+plan+' retorna à cota gratuita',async()=>{
  await user().set({email,plan,subscriptionEnd:at('2020-01-01'),usage:{quiz:3},usageMonth:usageMonth()});
  await assert.rejects(reserveUsage(uid,'quiz'),e=>e.status===403);
 });
}
test('mesmo pedido com aprovação e renovação não duplica prazo',async()=>{
 const data=order();await processOrder('purchase_approved',data);
 const first=(await user().get()).data().subscriptionEnd.toMillis();
 await processOrder('subscription_renewed',data);await processOrder('purchase_approved',data);
 assert.equal((await user().get()).data().subscriptionEnd.toMillis(),first);
});
test('aprovações concorrentes idênticas têm efeito único',async()=>{
 const data=order();const results=await Promise.all(Array.from({length:4},()=>processOrder('purchase_approved',data)));
 assert.equal(results.filter(r=>r.action==='activated').length,1);
 assert.equal((await db.collection('_billingOrders').get()).size,1);
});
test('renovação antecipada soma ao prazo vigente',async()=>{
 const data=order();await processOrder('purchase_approved',data);const first=(await user().get()).data().subscriptionEnd.toDate();
 await processOrder('subscription_renewed',order('monthly','order-2'));
 assert.equal((await user().get()).data().subscriptionEnd.toMillis(),addMonths(first,1).getTime());
});
test('produto desconhecido e order bump não concedem plano',async()=>{
 const r=await processOrder('purchase_approved',order('annual','unknown',{product:{id:'other-product',name:'BITTO ANUAL'},offer_type:'orderbump'}));
 assert.equal(r.action,'ignored');assert.equal((await user().get()).data().plan,'free');
});
test('Pix ou boleto pendente não concede plano',async()=>{
 for(const event of ['pix_gerado','boleto_gerado','purchase_approved'])await processOrder(event,order('monthly','pending',{status:'waiting_payment'}));
 assert.equal((await user().get()).data().plan,'free');
});
test('compra recusada não remove pagamento ou concessão',async()=>{
 await processOrder('purchase_approved',order());await invoke(grant,{email,plan:'annual',requestId:'grant'});
 await processOrder('purchase_refused',order('monthly','refused',{status:'refused'}));
 assert.equal(effectiveAccess((await user().get()).data()).plan,'annual');
});
for(const event of ['refund','chargeback'])test(event+' revoga apenas o pedido e preserva concessão',async()=>{
 await processOrder('purchase_approved',order());await invoke(grant,{email,plan:'annual',requestId:'grant'});
 await processOrder(event,order());const state=(await user().get()).data();assert.equal(state.paidAccess,null);assert.equal(effectiveAccess(state).plan,'annual');
});
test('reembolso antigo preserva compra mais recente',async()=>{
 await processOrder('purchase_approved',order());await processOrder('purchase_approved',order('annual','new'));
 await processOrder('refund',order());assert.equal(effectiveAccess((await user().get()).data()).plan,'annual');
});
test('aprovação atrasada não reativa pedido reembolsado',async()=>{
 await processOrder('refund',order());await processOrder('purchase_approved',order());assert.equal(effectiveAccess((await user().get()).data()).isActive,false);
});
test('cancelamento mantém período pago e registra renovação desligada',async()=>{
 await processOrder('purchase_approved',order());const end=(await user().get()).data().subscriptionEnd.toMillis();
 await processOrder('subscription_canceled',order('monthly','order-1',{status:'canceled'}));const state=(await user().get()).data();
 assert.equal(state.autoRenew,false);assert.equal(state.subscriptionEnd.toMillis(),end);
});
test('remover concessão preserva período comprado',async()=>{
 await processOrder('purchase_approved',order());await invoke(grant,{email,plan:'annual',requestId:'g1'});
 await invoke(grant,{email,plan:'free',requestId:'g2'});const state=(await user().get()).data();assert.equal(state.manualGrant,null);assert.equal(effectiveAccess(state).plan,'monthly');
});
test('liberação com e-mail sem conta é pendente e exige confirmação',async()=>{
 const pendingEmail='new@example.test';const r=await invoke(grant,{email:pendingEmail,plan:'annual',requestId:'pending'});assert.equal(r.body.pending,true);
 assert.equal((await db.collection('_pendingAccess').doc(hash(pendingEmail)).get()).exists,true);
 assert.equal((await claimPendingAccess({uid:'new',email:pendingEmail,email_verified:false})).needsEmailVerification,true);
 await claimPendingAccess({uid:'new',email:pendingEmail,email_verified:true});
 assert.equal(effectiveAccess((await db.collection('users').doc('new').get()).data()).plan,'annual');
 assert.equal((await db.collection('_pendingAccess').doc(hash(pendingEmail)).get()).exists,false);
});
test('compra antes do cadastro não cria conta sem senha',async()=>{
 const pendingEmail='buyer@example.test';await processOrder('purchase_approved',order('quarterly','before-register',{customer:{email:pendingEmail}}));
 await assert.rejects(auth.getUserByEmail(pendingEmail),e=>e.code==='auth/user-not-found');
 await claimPendingAccess({uid:'buyer',email:pendingEmail,email_verified:true});
 assert.equal(effectiveAccess((await db.collection('users').doc('buyer').get()).data()).plan,'quarterly');
});
test('reenvio da mesma concessão é idempotente',async()=>{
 const b={email,plan:'monthly',requestId:'same'};await invoke(grant,b);const first=(await user().get()).data().manualGrant.end.toMillis();await invoke(grant,b);
 assert.equal((await user().get()).data().manualGrant.end.toMillis(),first);assert.equal((await db.collection('_adminPlanAudit').get()).size,1);
});
test('concessão rejeita plano ou validade inválidos',async()=>{
 for(const b of [{plan:'basic'},{plan:'annual',endDate:'bad'},{plan:'monthly',endDate:'2020-01-01'},{plan:'monthly',email:'bad'}])assert.equal((await invoke(grant,{email,requestId:crypto.randomUUID(),...b})).code,400);
});
test('concessão exige administrador verificado',async()=>{
 assert.equal((await invoke(grant,{email,plan:'annual',requestId:'x'},userToken)).code,403);
 assert.equal((await invoke(grant,{email,plan:'annual',requestId:'x'},null)).code,401);
 await auth.updateUser('administrator',{emailVerified:false});const unverified=await tokenFor('administrator');
 assert.equal((await invoke(grant,{email,plan:'annual',requestId:'x'},unverified)).code,403);
 await auth.updateUser('administrator',{emailVerified:true});
});
test('consulta converte Timestamp e protege outras contas',async()=>{
 await processOrder('purchase_approved',order());const r=await invoke(status,null,userToken,'GET',{userId:uid});
 assert.equal(r.code,200);assert.equal(r.body.isActive,true);assert.ok(r.body.lastPaymentDate.endsWith('Z'));
 assert.equal((await invoke(status,null,userToken,'GET',{userId:'another'})).code,403);
});
test('quota gratuita: 10 cards, 3 quizzes, 3 revisões',async()=>{
 await reserveUsage(uid,'flashcards',10);await assert.rejects(reserveUsage(uid,'flashcards',1),e=>e.status===403);
 for(const tool of ['quiz','review']) {for(let i=0;i<3;i++)await reserveUsage(uid,tool);await assert.rejects(reserveUsage(uid,tool),e=>e.status===403);}
});
test('requisições simultâneas não ultrapassam quota',async()=>{
 const r=await Promise.allSettled(Array.from({length:4},()=>reserveUsage(uid,'quiz')));
 assert.equal(r.filter(x=>x.status==='fulfilled').length,3);assert.equal((await user().get()).data().usage.quiz,3);
});
test('falha de geração devolve cota e reset usa mês atual',async()=>{
 const reservation=await reserveUsage(uid,'quiz');await releaseUsage(reservation);assert.equal((await user().get()).data().usage.quiz,0);
 await user().update({usageMonth:'2020-01',usage:{quiz:3}});await reserveUsage(uid,'quiz');assert.equal((await user().get()).data().usage.quiz,1);
});
test('API não gera para plano vencido com quota esgotada',async()=>{
 await user().set({email,plan:'annual',subscriptionEnd:at('2020-01-01'),usageMonth:usageMonth(),usage:{quiz:3}});
 const r=await invoke(generate,{tool:'quiz',contents:[{parts:[{text:'teste'}]}]},userToken);assert.equal(r.code,403);
});
test('API devolve quota quando todos os modelos falham',async()=>{
 globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({})});
 const r=await invoke(generate,{tool:'quiz',contents:[{parts:[{text:'teste'}]}]},userToken);
 assert.equal(r.code,502);assert.equal((await user().get()).data().usage.quiz,0);
});
test('API limita flashcards à quantidade cobrada da quota',async()=>{
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(Array.from({length:20},()=>({q:'Q',a:'A'})))}]}}]})});
 const r=await invoke(generate,{tool:'flashcards',quantity:5,contents:[{parts:[{text:'teste'}]}]},userToken);
 assert.equal(r.code,200);assert.equal(JSON.parse(r.body.candidates[0].content.parts[0].text).length,5);assert.equal((await user().get()).data().usage.flashcards,5);
});
test('webhook rejeita segredo, JSON e assinatura inválidos',async()=>{
 assert.equal((await invoke(webhook,{secret:'wrong',event:'purchase_approved',data:order()})).code,401);
 assert.equal((await invoke(webhook,'{bad')).code,400);
 assert.equal((await invoke(webhook,'null')).code,400);
 const req={method:'POST',headers:{'x-cakto-signature':'v1=bad','x-cakto-timestamp':String(Math.floor(Date.now()/1000))},body:JSON.stringify({secret:'local-test-secret',event:'purchase_approved',data:order()})};
 const res={code:200,status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await webhook(req,res);assert.equal(res.code,401);
});
test('webhook aceita HMAC válido e rejeita replay antigo',async()=>{
 const body=JSON.stringify({secret:'local-test-secret',event:'purchase_approved',data:order()});
 for(const offset of [0,-600]) {
  const timestamp=String(Math.floor(Date.now()/1000)+offset),signature='v1='+crypto.createHmac('sha256','local-test-secret').update(timestamp+'.'+body).digest('hex');
  const req={method:'POST',body,headers:{'x-cakto-signature':signature,'x-cakto-timestamp':timestamp}};
  const res={code:200,status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await webhook(req,res);assert.equal(res.code,offset?401:200);
 }
});
test('webhook V2 processa plano e ignora order bump',async()=>{
 const r=await invoke(webhook,{secret:'local-test-secret',event:'purchase_approved',data:[order('annual'),order('monthly','bump',{product:{id:'other'},offer_type:'orderbump'})]});
 assert.equal(r.code,200);assert.equal(effectiveAccess((await user().get()).data()).plan,'annual');
});
test('fim de mês é ajustado e anual respeita calendário',()=>{
 assert.equal(addMonths(new Date('2026-01-31T12:00:00Z'),1).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(addMonths(new Date('2028-02-29T12:00:00Z'),12).toISOString(),'2029-02-28T12:00:00.000Z');
});
test('regras: usuário não altera plano, concessão, quota ou pagamento',async()=>{
 const client=rulesEnv.authenticatedContext(uid,{email,email_verified:true}).firestore();
 for(const values of [{plan:'annual'},{subscriptionEnd:Timestamp.fromDate(new Date('2099-01-01'))},{paidAccess:{plan:'annual'}},{manualGrant:{plan:'annual'}},{usage:{quiz:0}},{usageMonth:'x'},{aiUsage:{count:0}},{lastPaymentId:'forged'}])await assertFails(updateDoc(doc(client,'users',uid),values));
 await assertSucceeds(updateDoc(doc(client,'users',uid),{displayName:'Nome',xp:10,studyPlanner:{subjects:[]}}));
 await assertSucceeds(setDoc(doc(client,'users',uid,'decks','d1'),{name:'Deck'}));
 await assertFails(getDoc(doc(client,'_pendingAccess',hash(email))));
 await assertFails(getDocs(collection(client,'users')));
});
test('regras: criação não permite plano pago ou campos reservados',async()=>{
 const client=rulesEnv.authenticatedContext('new',{email:'new@example.test',email_verified:true}).firestore();
 await assertFails(setDoc(doc(client,'users','new'),{email:'new@example.test',plan:'annual'}));
 await assertFails(setDoc(doc(client,'users','new'),{email:'new@example.test',manualGrant:{plan:'annual'}}));
 await assertSucceeds(setDoc(doc(client,'users','new'),{email:'new@example.test',plan:'free',subscriptionEnd:null}));
});
test('regras: admin pode listar contas mas não alterar plano direto',async()=>{
 const client=rulesEnv.authenticatedContext('administrator',{email:'usebitto.tech@gmail.com',email_verified:true}).firestore();
 await assertSucceeds(getDocs(collection(client,'users')));
 await assertFails(updateDoc(doc(client,'users',uid),{plan:'annual'}));
 await assertSucceeds(setDoc(doc(client,'embaixadores','lead'),{name:'Teste'}));
});
