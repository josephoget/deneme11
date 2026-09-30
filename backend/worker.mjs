const SYMBOLS={"AEFES":"AEFES.IS","AKBNK":"AKBNK.IS","AKSA":"AKSA.IS","AKSEN":"AKSEN.IS","ALARK":"ALARK.IS","ALTNY":"ALTNY.IS","ANSGR":"ANSGR.IS","ARCLK":"ARCLK.IS","ASELS":"ASELS.IS","ASTOR":"ASTOR.IS","BALSU":"BALSU.IS","BERA":"BERA.IS","BIMAS":"BIMAS.IS","BRSAN":"BRSAN.IS","BRYAT":"BRYAT.IS","BSOKE":"BSOKE.IS","BTCIM":"BTCIM.IS","CANTE":"CANTE.IS","CCOLA":"CCOLA.IS","CIMSA":"CIMSA.IS","CVKMD":"CVKMD.IS","CWENE":"CWENE.IS","DAPGM":"DAPGM.IS","DOAS":"DOAS.IS","DOHOL":"DOHOL.IS","DSTKF":"DSTKF.IS","ECILC":"ECILC.IS","EFOR":"EFOR.IS","EKGYO":"EKGYO.IS","ENERY":"ENERY.IS","ENJSA":"ENJSA.IS","ENKAI":"ENKAI.IS","EREGL":"EREGL.IS","ESEN":"ESEN.IS","EUPWR":"EUPWR.IS","EUREN":"EUREN.IS","FENER":"FENER.IS","FROTO":"FROTO.IS","GARAN":"GARAN.IS","GENIL":"GENIL.IS","GESAN":"GESAN.IS","GLRMK":"GLRMK.IS","GRSEL":"GRSEL.IS","GRTHO":"GRTHO.IS","GSRAY":"GSRAY.IS","GUBRF":"GUBRF.IS","HALKB":"HALKB.IS","HEKTS":"HEKTS.IS","IEYHO":"IEYHO.IS","ISCTR":"ISCTR.IS","ISMEN":"ISMEN.IS","IZENR":"IZENR.IS","KCHOL":"KCHOL.IS","KLRHO":"KLRHO.IS","KRDMD":"KRDMD.IS","KTLEV":"KTLEV.IS","KUYAS":"KUYAS.IS","MAGEN":"MAGEN.IS","MAVI":"MAVI.IS","MGROS":"MGROS.IS","MIATK":"MIATK.IS","MPARK":"MPARK.IS","OBAMS":"OBAMS.IS","ODAS":"ODAS.IS","ODINE":"ODINE.IS","OTKAR":"OTKAR.IS","OYAKC":"OYAKC.IS","PAHOL":"PAHOL.IS","PASEU":"PASEU.IS","PATEK":"PATEK.IS","PETKM":"PETKM.IS","PGSUS":"PGSUS.IS","PSGYO":"PSGYO.IS","QUAGR":"QUAGR.IS","RALYH":"RALYH.IS","REEDR":"REEDR.IS","SAHOL":"SAHOL.IS","SARKY":"SARKY.IS","SASA":"SASA.IS","SISE":"SISE.IS","SKBNK":"SKBNK.IS","SOKM":"SOKM.IS","TAVHL":"TAVHL.IS","TCELL":"TCELL.IS","THYAO":"THYAO.IS","TKFEN":"TKFEN.IS","TOASO":"TOASO.IS","TRALT":"TRALT.IS","TRENJ":"TRENJ.IS","TRMET":"TRMET.IS","TSKB":"TSKB.IS","TTKOM":"TTKOM.IS","TUKAS":"TUKAS.IS","TUPRS":"TUPRS.IS","TURSG":"TURSG.IS","ULKER":"ULKER.IS","VAKBN":"VAKBN.IS","VESTL":"VESTL.IS","YKBNK":"YKBNK.IS","ZOREN":"ZOREN.IS","ALTINS1":"ALTINS1.IS","USDTRY":"TRY=X","EURTRY":"EURTRY=X","EURUSD":"EURUSD=X","XAUUSD":"GC=F","BRENT":"BZ=F","WTI":"CL=F"};
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
    const endpoint=`https://${host}/v8/finance/chart/${encodeURIComponent(SYMBOLS[key])}?range=1y&interval=1d&events=history`;
    const response=await fetch(endpoint,{headers:{'User-Agent':'Mozilla/5.0 (compatible; LuckyCatMarket/1.0)','Accept':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok){status=response.status===404?404:502;message=key==='ALTINS1'&&status===404?'Yahoo Finance ALTIN.S1 fiyat serisini sağlamıyor (404).':`Fiyat sağlayıcısı HTTP ${response.status} döndürdü.`;continue}
    const data=await response.json();if(!data.chart?.result?.[0]?.timestamp)throw Error('Geçerli fiyat serisi bulunamadı.');
    return json({symbol:key,fetchedAt:new Date().toISOString(),provider:'Yahoo Finance chart API',data},200,allowed);
   }catch(error){message=error.name==='TimeoutError'?'Fiyat sağlayıcısı zaman aşımı.':error.message;status=502}
  }
  return json({symbol:key,error:message},status,allowed);
 }
};
