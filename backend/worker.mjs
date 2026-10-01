import SYMBOLS from './symbols.mjs';
function json(body,status,origin){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','X-Content-Type-Options':'nosniff'}})}
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=env.SITE_ORIGIN||'https://josephoget.github.io';
  if(origin&&origin!==allowed)return json({error:'Bu web sitesi API erişimi için tanımlı değil.'},403,allowed);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'86400'}});
  if(request.method!=='GET')return json({error:'Yalnız GET desteklenir.'},405,allowed);
  if(url.pathname==='/health')return json({ok:true,provider:'Yahoo Finance chart API',time:new Date().toISOString()},200,allowed);
  if(url.pathname!=='/chart')return json({error:'Geçersiz API yolu.'},404,allowed);
  const key=url.searchParams.get('symbol');if(!Object.hasOwn(SYMBOLS,key))return json({error:'Desteklenmeyen varlık.'},400,allowed);
  let message='Fiyat sağlayıcısı yanıt vermedi.',status=502;
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
   try{
    const endpoint=`https://${host}/v8/finance/chart/${encodeURIComponent(SYMBOLS[key])}?range=5y&interval=1d&events=div%2Csplits`;
    const response=await fetch(endpoint,{headers:{'User-Agent':'Mozilla/5.0 (compatible; LuckyCatMarket/1.0)','Accept':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok){status=response.status===404?404:502;message=key==='ALTINS1'&&status===404?'Yahoo Finance ALTIN.S1 fiyat serisini sağlamıyor (404).':`Fiyat sağlayıcısı HTTP ${response.status} döndürdü.`;continue}
    const data=await response.json();if(!data.chart?.result?.[0]?.timestamp)throw Error('Geçerli fiyat serisi bulunamadı.');
    return json({symbol:key,fetchedAt:new Date().toISOString(),provider:'Yahoo Finance chart API',data},200,allowed);
   }catch(error){message=error.name==='TimeoutError'?'Fiyat sağlayıcısı zaman aşımı.':error.message;status=502}
  }
  return json({symbol:key,error:message},status,allowed);
 }
};
