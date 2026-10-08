const PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','src','sck'];
const KEY = 'bitto_campaign';
export function campaignContext() {
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch {}
  if(!saved || typeof saved!=='object' || Array.isArray(saved)) saved={};
  saved=Object.fromEntries(Object.entries(saved).filter(([key,value])=>(PARAMS.includes(key)||key==='entry') && typeof value==='string' && value.length<=120 && !/[\r\n@]/.test(value)));
  const query=new URLSearchParams(location.search);
  const current={};
  for(const key of PARAMS) {
    const value=query.get(key);
    if(value && value.length<=120 && !/[\r\n@]/.test(value)) current[key]=value;
  }
  const entry=location.pathname==='/enem' || location.pathname==='/enem.html' ? 'enem' : query.get('entry');
  if(entry==='enem') current.entry='enem';
  const result=PARAMS.some(key=>Object.hasOwn(current,key)) ? {...current,entry:current.entry || saved.entry} : {...saved,...current};
  try {sessionStorage.setItem(KEY,JSON.stringify(result));}catch{}
  return result;
}
export function campaignLink(href) {
  const url=new URL(href,location.href);
  if(url.origin!==location.origin && url.hostname!=='pay.cakto.com.br') return href;
  const context=campaignContext();
  for(const key of PARAMS) if(context[key] && !url.searchParams.has(key)) url.searchParams.set(key,context[key]);
  if(url.origin===location.origin && context.entry==='enem') url.searchParams.set('entry','enem');
  return url.href;
}
export function decorateCampaignLinks(root=document) {
  root.querySelectorAll('a[href]').forEach(link=>{
    const href=link.getAttribute('href');
    if(href.includes('login.html') || href.startsWith('https://pay.cakto.com.br/')) link.href=campaignLink(href);
  });
}
export function campaignEventParams() {
  const values=campaignContext(),params={landing_page:values.entry==='enem'?'enem':'geral'};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']) if(values[key]) params[key]=values[key];
  return params;
}
