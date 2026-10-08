import {requireUser,errorResponse} from '../../lib/firebase.js';
import {claimPendingAccess} from '../../lib/billing.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method Not Allowed'});
  try{return res.json(await claimPendingAccess(await requireUser(req)));}
  catch(error){return errorResponse(res,error);}
}
