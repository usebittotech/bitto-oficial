import {auth,onAuthStateChanged,trackEvent} from './firebase-init.js';
import {sendPasswordResetEmail,verifyBeforeUpdateEmail} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const status=(message,type='')=>{const box=document.getElementById('helpStatus');box.textContent=message;box.className=`status ${type}`;};
const authLink=document.getElementById('authLink');
let currentUser=null;
onAuthStateChanged(auth,user=>{
  currentUser=user;
  authLink.textContent=user?'Minha conta':'Entrar';
  authLink.href=user?'/pages/dashboard.html':'/pages/login.html';
  document.getElementById('supportEmail').value=user?.email||'';
  document.getElementById('loginNotice').classList.toggle('hidden',!!user);
  document.getElementById('supportForm').querySelector('button').disabled=!user;
});

document.getElementById('helpSearch').addEventListener('input',event=>{
  const query=event.target.value.trim().toLowerCase();
  document.querySelectorAll('[data-search]').forEach(card=>card.classList.toggle('empty',query&&!card.dataset.search.includes(query)));
});

document.getElementById('resetPassword').addEventListener('click',async event=>{
  event.preventDefault();
  if(!currentUser) return location.href='/pages/forgot-password.html';
  try {await sendPasswordResetEmail(auth,currentUser.email);status('Link para trocar a senha enviado. Confira sua caixa de entrada.','success');trackEvent('help_self_service',{action:'password'});}
  catch {status('Não foi possível enviar agora. Tente novamente em alguns minutos.','error');}
});

document.getElementById('changeEmailForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!currentUser) return location.href='/pages/login.html';
  const email=new FormData(event.currentTarget).get('newEmail').trim().toLowerCase();
  if(!email) return;
  try {await verifyBeforeUpdateEmail(currentUser,email);status(`Enviamos uma confirmação para ${email}. A troca termina quando você abrir o link.`, 'success');trackEvent('help_self_service',{action:'email'});event.currentTarget.reset();}
  catch(error){status(error.code==='auth/requires-recent-login'?'Por segurança, saia, entre novamente e repita a troca de e-mail.':'Não foi possível iniciar a troca. Contas Google devem alterar o e-mail na própria Conta Google.','error');}
});

document.getElementById('supportType').addEventListener('change',event=>{
  document.getElementById('orderWrap').classList.toggle('hidden',!['reembolso','cobranca'].includes(event.target.value));
});

document.getElementById('supportForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!currentUser) return location.href='/pages/login.html';
  const button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='Enviando…';
  try {
    const token=await currentUser.getIdToken();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch('/api/support/tickets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});
    const result=await response.json();if(!response.ok) throw new Error(result.error);
    status(`Pedido recebido. Protocolo ${result.protocol}. Você receberá a resposta no e-mail da sua conta.`, 'success');
    trackEvent('support_request',{support_type:data.type});event.currentTarget.reset();
  } catch(error){status(error.message||'Não foi possível enviar. Tente novamente.','error');}
  finally{button.disabled=false;button.textContent='Enviar pedido';}
});

