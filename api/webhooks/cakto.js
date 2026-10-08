import crypto from 'node:crypto';
import {processOrder} from '../../lib/billing.js';
import {errorResponse} from '../../lib/firebase.js';
export const config = {api:{bodyParser:false}};
const equal = (a,b) => {
  if(typeof a!=='string' || typeof b!=='string') return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && crypto.timingSafeEqual(x,y);
};
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Method Not Allowed'});
  try {
    let raw,payload;
    if(req.body && typeof req.body==='object' && !Buffer.isBuffer(req.body)) payload=req.body;
    else {
      const chunks=[];let size=0;
      if(typeof req.body==='string' || Buffer.isBuffer(req.body)) chunks.push(Buffer.from(req.body));
      else for await(const chunk of req) {size+=chunk.length;if(size>1048576) throw Object.assign(new Error('Payload muito grande.'),{status:413});chunks.push(Buffer.from(chunk));}
      raw=Buffer.concat(chunks);
      try{payload=JSON.parse(raw.toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}
    }
    const secret=process.env.CAKTO_WEBHOOK_SECRET;
    if(!secret) throw new Error('Webhook não configurado.');
    if(!payload || typeof payload!=='object' || Array.isArray(payload)) throw Object.assign(new Error('Payload inválido.'),{status:400});
    if(!equal(payload.secret,secret)) return res.status(401).json({error:'Webhook não autorizado.'});
    const signature=req.headers['x-cakto-signature'],timestamp=req.headers['x-cakto-timestamp'];
    if(signature || timestamp) {
      const time=Number(timestamp);
      const digest=raw && crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
      if(!Number.isFinite(time)||Math.abs(Date.now()/1000-time)>300||!digest||!String(signature||'').split(',').some(s=>equal(s.trim(),'v1='+digest))) return res.status(401).json({error:'Assinatura inválida ou expirada.'});
    }
    if(typeof payload.event!=='string') throw Object.assign(new Error('Evento inválido.'),{status:400});
    const orders=Array.isArray(payload.data)?payload.data:[payload.data];
    if(!orders.length||orders.length>20) throw Object.assign(new Error('Quantidade de pedidos inválida.'),{status:400});
    const results=[];
    for(const order of orders) results.push(await processOrder(payload.event,order));
    const gaId=process.env.GA4_MEASUREMENT_ID,gaSecret=process.env.GA4_API_SECRET;
    if(process.env.VERCEL_ENV==='production'&&gaId&&gaSecret) for(let i=0;i<results.length;i++) if(results[i].action==='activated') {
      try {await fetch('https://www.google-analytics.com/mp/collect?measurement_id='+gaId+'&api_secret='+gaSecret,{method:'POST',signal:AbortSignal.timeout(1000),body:JSON.stringify({client_id:String(orders[i].customer?.id || orders[i].id),events:[{name:'purchase',params:{transaction_id:orders[i].id,value:Number(orders[i].amount||0),currency:'BRL',items:[{item_id:results[i].plan,item_name:'Plano '+results[i].plan}]}}]})});}catch{console.warn('Evento GA4 não entregue.');}
    }
    return res.json({success:true,results});
  }catch(error){return errorResponse(res,error);}
}
