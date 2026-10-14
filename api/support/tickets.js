import {ADMIN_EMAIL,errorResponse,firebase,requireUser} from '../../lib/firebase.js';

const TYPES=new Set(['reembolso','acesso','email','cobranca','erro','outro']);
const clean=(value,max=120)=>typeof value==='string'?value.trim().replace(/[\u0000-\u001f<>]/g,'').slice(0,max):'';

async function notifyByEmail(ticket) {
  const key=process.env.RESEND_API_KEY;
  if(!key) return false;
  const recipient=process.env.SUPPORT_EMAIL || ADMIN_EMAIL;
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:process.env.SUPPORT_FROM_EMAIL || 'Bitto Suporte <suporte@usebitto.com>',
      to:[recipient],
      reply_to:ticket.email,
      subject:`[Bitto #${ticket.protocol}] ${ticket.subject}`,
      text:[
        `Protocolo: ${ticket.protocol}`,
        `Tipo: ${ticket.type}`,
        `Usuário: ${ticket.name || 'Não informado'} <${ticket.email}>`,
        `UID: ${ticket.uid}`,
        '',
        ticket.message
      ].join('\n')
    })
  });
  if(!response.ok) throw new Error(`Falha no provedor de e-mail: ${response.status}`);
  return true;
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method Not Allowed'});
  try {
    const token=await requireUser(req);
    const type=clean(req.body?.type,30);
    const subject=clean(req.body?.subject,100);
    const message=clean(req.body?.message,3000);
    const orderId=clean(req.body?.orderId,120);
    if(!TYPES.has(type)||subject.length<4||message.length<15) return res.status(400).json({error:'Preencha o assunto e descreva o que aconteceu.'});

    const {admin,db}=firebase();
    const ref=db.collection('supportTickets').doc();
    const protocol=`${new Date().toISOString().slice(0,10).replaceAll('-','')}-${ref.id.slice(0,6).toUpperCase()}`;
    const ticket={
      protocol,type,subject,message,orderId:orderId||null,
      uid:token.uid,email:token.email||'',name:token.name||'',
      status:'open',source:'help-center',
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(ticket);
    let emailed=false;
    try { emailed=await notifyByEmail(ticket); }
    catch(error){ console.error('support-email:',error.message); }
    return res.status(201).json({ok:true,protocol,emailed});
  } catch(error) { return errorResponse(res,error); }
}

