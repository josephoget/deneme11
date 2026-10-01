/* Shared deterministic engine for browser, simulation and tests. No network/order access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AnalysisEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='3.0.0', MIN_BARS=60;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const last=xs=>xs.at(-1), finite=Number.isFinite;
function sma(xs,n){let sum=0;return xs.map((x,i)=>{sum+=x;if(i>=n)sum-=xs[i-n];return i>=n-1?sum/n:null;});}
function ema(xs,n){let v=xs[0],k=2/(n+1);return xs.map((x,i)=>v=i?v+(x-v)*k:x);}
function wilder(xs,n){let v=0;return xs.map((x,i)=>{if(i<n){v+=x;return i===n-1?(v/=n):null;}return v=(v*(n-1)+x)/n;});}
function rsi(xs,n=14){const out=Array(xs.length).fill(null);if(xs.length<=n)return out;let g=0,l=0;for(let i=1;i<=n;i++){const d=xs[i]-xs[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);}g/=n;l/=n;for(let i=n;i<xs.length;i++){if(i>n){const d=xs[i]-xs[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}out[i]=l?100-100/(1+g/l):g?100:50;}return out;}
function validRows(rows){return Array.isArray(rows)&&rows.length>0&&rows.every((r,i)=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&(!i||rows[i-1].date<r.date)&&['o','h','l','c'].every(k=>finite(r[k])&&r[k]>0)&&r.l<=Math.min(r.o,r.c)&&r.h>=Math.max(r.o,r.c)&&(r.v==null||finite(r.v)&&r.v>=0));}
function indicators(rows){
 const c=rows.map(r=>r.c),n=rows.length,m20=sma(c,20),m50=sma(c,50),m200=sma(c,200),e12=ema(c,12),e26=ema(c,26),mac=e12.map((v,i)=>v-e26[i]),sig=ema(mac,9);
 const tr=rows.map((r,i)=>Math.max(r.h-r.l,i?Math.abs(r.h-rows[i-1].c):0,i?Math.abs(r.l-rows[i-1].c):0)),atr=wilder(tr,14);
 const plus=rows.map((r,i)=>{if(!i)return 0;const u=r.h-rows[i-1].h,d=rows[i-1].l-r.l;return u>d&&u>0?u:0;}),minus=rows.map((r,i)=>{if(!i)return 0;const d=rows[i-1].l-r.l,u=r.h-rows[i-1].h;return d>u&&d>0?d:0;});
 const p=wilder(plus,14),m=wilder(minus,14),dx=p.map((v,i)=>v===null?null:(v+m[i]?100*Math.abs(v-m[i])/(v+m[i]):0)),adx=Array(13).fill(null).concat(wilder(dx.slice(13),14));
 return {c,m20,m50,m200,mac,sig,rsi:rsi(c),atr,adx,diPlus:p.map((v,i)=>v===null?null:atr[i]?100*v/atr[i]:0),diMinus:m.map((v,i)=>v===null?null:atr[i]?100*v/atr[i]:0),n};
}
function dateInIstanbul(asOf){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));}
function barQuality(rows,options={}){
 const issues=[],now=options.asOf??Date.now();
 if(!validRows(rows))return {usable:false,provisional:false,issues:['OHLC, hacim veya tarih sırası geçersiz.']};
 const end=last(rows),today=dateInIstanbul(now),age=(now-Date.parse(end.date+'T23:59:59+03:00'))/864e5;
 if(rows.length<MIN_BARS)issues.push(`En az ${MIN_BARS} günlük kayıt gerekli.`);
 if(end.date>today)issues.push('Gelecek tarihli fiyat kaydı.');
 if(!options.historical&&(age>4||options.fresh===false))issues.push('Fiyat eski veya son kaynak kontrolü başarısız.');
 if(options.derived)issues.push('Türetilmiş fiyat doğrudan işlem sinyali üretmez.');
 const anomalies=rows.slice(-60).filter((r,j)=>{const i=rows.length-Math.min(60,rows.length)+j;return i>0&&Math.abs(r.o/rows[i-1].c-1)>.4;});
 if(anomalies.length)issues.push('Son 60 barda %40 üzeri fiyat boşluğu: sermaye işlemi veya veri hatası kontrolü gerekiyor.');
 const entry=options.entry||{},sessionEnd=entry.sessionEnd*1000,checked=Date.parse(entry.checkedAt||entry.fetchedAt||'');
 const sessionDate=finite(sessionEnd)?dateInIstanbul(sessionEnd):null;
 const confirmed=entry.lastBar===end.date&&sessionDate===end.date&&finite(checked)&&checked>=sessionEnd+15*60000&&now>=checked;
 const incompleteStored=sessionDate===end.date&&finite(checked)&&checked<sessionEnd+15*60000;
 const provisional=!options.historical&&(incompleteStored||end.date===today&&!confirmed);
 return {usable:issues.length===0,provisional,issues,lastDate:end.date,bars:rows.length};
}
// Historical breadth uses only the date's available data. Constituents are today's universe.
function buildMarket(assets,symbols){
 const records={};
 for(const sym of symbols){const rows=assets[sym]?.rows;if(!validRows(rows))continue;const c=rows.map(r=>r.c),m50=sma(c,50);
 rows.forEach((r,i)=>{if(i<50)return;const d=records[r.date]||(records[r.date]=[]);d.push({sym,above:r.c>m50[i],up:r.c>rows[i-1].c,ret20:(r.c/rows[i-20].c-1)*100,start20:rows[i-20].date});});}
 return records;
}
function marketAt(records,date,sym,start20){
 const peers=(records?.[date]||[]).filter(r=>r.sym!==sym&&(!start20||r.start20===start20));
 if(peers.length<30)return {available:false,count:peers.length,regime:'PİYASA KAPSAMI SINIRLI',breadth:null,return20:null};
 const breadth=peers.filter(p=>p.above).length/peers.length,advance=peers.filter(p=>p.up).length/peers.length;
 const returns=peers.map(p=>p.ret20).sort((a,b)=>a-b),mid=Math.floor(returns.length/2),median=returns.length%2?returns[mid]:(returns[mid-1]+returns[mid])/2;
 return {available:true,count:peers.length,breadth,advance,return20:median,regime:breadth>=.6?'GENİŞ KATILIMLI YÜKSELİŞ':breadth<=.35?'ZAYIF PİYASA KATILIMI':'KARIŞIK PİYASA'};
}
function weeklyTrend(rows){
 // Include only weeks strictly before the last bar's week; no incomplete weekly confirmation.
 const monday=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
 const endWeek=monday(last(rows).date),weeks=new Map();for(const r of rows){const key=monday(r.date);if(key<endWeek)weeks.set(key,r.c);}
 const c=[...weeks.values()];if(c.length<11)return {available:false,label:'Haftalık geçmiş sınırlı'};
 const ma=mean(c.slice(-10)),prior=mean(c.slice(-11,-1)),positive=last(c)>ma&&ma>prior;
 return {available:true,positive,label:positive?'Tamamlanmış haftalarda yükseliş':'Tamamlanmış haftalarda teyit zayıf'};
}
function diagonalResistance(rows,atr){
 // Pivot needs two right-hand bars before the signal bar; no future pivot detection.
 const prior=rows.slice(0,-1),pivots=[];
 for(let i=Math.max(2,prior.length-60);i<prior.length-2;i++)if(prior[i].h>prior[i-1].h&&prior[i].h>=prior[i-2].h&&prior[i].h>prior[i+1].h&&prior[i].h>=prior[i+2].h)pivots.push({i,v:prior[i].h});
 if(pivots.length<2)return null;const second=last(pivots),first=[...pivots].reverse().find(p=>second.i-p.i>=5);if(!first)return null;
 const slope=(second.v-first.v)/(second.i-first.i),at=i=>first.v+slope*(i-first.i);
 if(prior.slice(second.i+1).some((r,j)=>r.c>at(second.i+1+j)+atr*.3))return null;
 const value=at(rows.length-1);return value>0?{value,slope,kind:slope>0?'Yükselen':slope<0?'Düşen':'Yatay',first,second}:null;
}
function analyze(rows,options={}){
 const quality=barQuality(rows,options),blocked={version:VERSION,label:'KARAR VERİLEMEZ',style:'wait',setup:'VERİ KONTROLÜ',action:'VERİYİ DOĞRULA',score:null,parts:{},quality,reasons:quality.issues,risks:[],plan:null};
 if(!quality.usable)return blocked;
 const I=indicators(rows),i=rows.length-1,L=rows[i],P=rows[i-1],A=I.atr[i],r=I.rsi[i],m20=I.m20[i],m50=I.m50[i],hist=I.mac[i]-I.sig[i],prevHist=I.mac[i-1]-I.sig[i-1];
 if(!(A>0))return {...blocked,reasons:['Oynaklık sıfır; işlem mesafesi hesaplanamıyor.']};
 const prior=rows.slice(-21,-1),resistance=Math.max(...prior.map(r=>r.h)),support=Math.min(...prior.map(r=>r.l)),high60=Math.max(...rows.slice(-61,-1).map(r=>r.h)),low5=Math.min(...rows.slice(-5).map(r=>r.l));
 const volumes=prior.map(r=>r.v),hasVolume=volumes.every(finite)&&mean(volumes)>0&&finite(L.v),vol=hasVolume?L.v/mean(volumes):null;
 const trend=L.c>m20&&m20>m50&&m20>I.m20[i-1],weak=L.c<m20&&L.c<m50,turn=hist>prevHist&&r>I.rsi[i-1],momentum=hist>0&&r>=45;
 const ret20=(L.c/rows[i-20].c-1)*100,market=options.market||marketAt(options.marketRecords,L.date,options.symbol,rows[i-20].date),relative=market.available?ret20-market.return20:null;
 const weekly=weeklyTrend(rows),diagonal=diagonalResistance(rows,A),lineBreak=diagonal&&L.c>diagonal.value&&P.c<=diagonal.value-diagonal.slope;
 const breakout=L.c>resistance,near=!breakout&&resistance-L.c<=A,failed=L.h>resistance+.15*A&&L.c<resistance-.15*A;
 const closePosition=L.h>L.l?(L.c-L.l)/(L.h-L.l):.5,gainATR=(L.c-P.c)/A;
 const recovery=vol>=1.2&&gainATR>=.75&&closePosition>=.7&&L.c>P.h&&turn;
 const early=L.c>m20&&m20>I.m20[i-1]&&turn&&r>=40;
 const pullback=trend&&L.l<=m20+.5*A&&L.c>=P.c&&hist>=prevHist;
 const stretched=(L.c-m20)/A>3;
 const range=rs=>mean(rs.map(r=>r.h-r.l)),compression=range(rows.slice(-5))<range(rows.slice(-20,-5))*.75;
 const adx=I.adx[i],parts={trend:(L.c>m20?8:0)+(m20>m50?7:0)+(m20>I.m20[i-1]?5:0)+(weekly.positive?5:0),momentum:(hist>0?8:0)+(hist>prevHist?6:0)+(r>=45?6:0),structure:(breakout||lineBreak?12:near&&trend?9:pullback?10:early?7:0)+(compression?3:0),volume:hasVolume?(vol>=1.2&&L.c>P.c?15:vol>=.8&&L.c>P.c?9:4):0,relative:relative===null?0:relative>=5?15:relative>0?10:relative> -5?5:0,market:market.available?(market.breadth>=.6?10:market.breadth>.35?6:2):0};
 const score=Object.values(parts).reduce((a,b)=>a+b,0),risks=[],reasons=[];let setup,positive=false;
 if(failed)setup='BAŞARISIZ KIRILIM';
 else if(recovery&&!trend){setup='HACİMLİ TOPARLANMA';positive=true;}
 else if(stretched&&(trend||breakout))setup='OLUMLU TREND · UZAK GİRİŞ';
 else if((breakout||lineBreak)&&(trend||early)&&momentum){setup=lineBreak&&!breakout?'EĞİK DİRENÇ KIRILIMI':'DİRENÇ KIRILIMI';positive=true;}
 else if(pullback){setup='TREND İÇİ TOPARLANMA';positive=true;}
 else if(trend&&momentum){setup=near?'KIRILIM ADAYI':'TREND DEVAMI';positive=true;}
 else if(early){setup='ERKEN MOMENTUM DÖNÜŞÜ';positive=true;}
 else if(turn&&gainATR>0)setup='TOPARLANMA İZLENİYOR';
 else if(weak&&hist<0)setup='ZAYIF TREND';
 else setup='KARIŞIK GÖRÜNÜM';
 if(market.available&&market.breadth<=.35)risks.push('Piyasa katılımı zayıf; yükseliş genel piyasaya karşı oluşuyor.');
 if(weekly.available&&!weekly.positive)risks.push('Tamamlanmış haftalık görünüm günlük yükselişi henüz desteklemiyor.');
 if(!hasVolume)risks.push('Karşılaştırılabilir hacim eksik; fiyat sinyali hacimle doğrulanamıyor.');
 else if(vol<1.2)risks.push('Hacim 1,2 kat teyit eşiğinin altında.');
 if(quality.provisional)risks.push('Son günlük mum kapanış teyidi taşımıyor; görünen evre seans içi ön izleme.');
 if(stretched)risks.push('Fiyat SMA20’den 3 ATR uzakta; giriş mesafesi geniş.');
 if(r>70)risks.push('RSI 70 üzerinde; güçlü momentumla birlikte geri çekilme riski de var.');
 if(rows.length<200)risks.push('200 günlük uzun dönem eğilimi için geçmiş sınırlı.');
 reasons.push(`${setup}: ${trend?'günlük trend olumlu':weak?'orta vadeli ortalamalar hâlâ fiyatın üzerinde':'günlük trend geçiş evresinde'}.`);
 reasons.push(`RSI ${r.toFixed(1)}; MACD histogramı ${hist>prevHist?'iyileşiyor':'zayıflıyor'}; ADX ${adx.toFixed(1)} (${adx>=25?'belirgin trend kuvveti':'trend kuvveti sınırlı'}, yön göstergesi değildir).`);
 reasons.push(`Son mum hariç 20 günlük yatay direnç ${resistance.toFixed(2)}; destek ${support.toFixed(2)}. ${diagonal?diagonal.kind+' eğik direnç '+diagonal.value.toFixed(2)+'.':'İki teyitli tepeyle eğik direnç oluşmadı.'}`);
 reasons.push(`Hacim ${hasVolume?vol.toFixed(2)+' × önceki 20 bar':'ölçülemiyor'}; ${compression?'fiyat aralığı sıkışıyor':'sıkışma koşulu yok'}.`);
 reasons.push(market.available?`Mevcut evrendeki ${market.count} eş tarihli emsalin %${(market.breadth*100).toFixed(0)} kadarı SMA50 üzerinde. 20 günlük getiri farkı ${relative.toFixed(1)} yüzde puan. Bu resmî endeks getirisi değildir.`:'Göreli güç için yeterli eş tarihli emsal yok.');
 reasons.push(weekly.label+'.');
 const entry=L.c,stop=Math.max(entry-2.5*A,Math.min(low5-.2*A,entry-A)),risk=entry-stop;
 if(!(stop>0&&risk>0&&finite(risk)))return {...blocked,quality:{...quality,usable:false},reasons:['Fiyat/oynaklık ilişkisi geçerli stop mesafesi üretmiyor.']};
 const obstacles=[resistance,high60,diagonal?.value].filter(v=>finite(v)&&v>entry+.25*A),obstacle=obstacles.length?Math.min(...obstacles):null;
 const target2R=entry+2*risk,target=obstacle?Math.min(target2R,obstacle):target2R;
 const costRate=clamp(options.costBps??20,0,200)/10000;
 const netRisk=entry-stop+(entry+stop)*costRate,netReward=target-entry-(entry+target)*costRate,rr=netRisk>0?netReward/netRisk:null;
 const plan={entryLow:entry,entryHigh:entry+.25*A,stop,target,target2R,obstacle,rr,riskPerUnit:netRisk,costBps:costRate*10000,maxHoldingBars:10,available:positive&&!stretched,trigger:setup==='KIRILIM ADAYI'?resistance:entry,invalidation:recovery?Math.min(L.l,stop):stop};
 const tradable=positive&&rr>=1.5&&(!options.isShare||hasVolume)&&!quality.provisional;
 const action=quality.provisional?'SEANS İÇİ ADAY':tradable?'PLAN KOŞULLARI UYGUN':positive?'ERKEN / SINIRLI ADAY':setup==='ZAYIF TREND'?'POZİSYON RİSKİNİ İNCELE':'KOŞUL İZLE';
 if(positive&&rr<1.5)risks.push('Yakın direnç ve maliyet sonrası hedef/risk oranı 1,5 altında; mevcut fiyatla plan elverişsiz.');
 return {version:VERSION,label:positive?'ALINABİLİR':setup==='ZAYIF TREND'?'ALINMAZ':'BEKLE',style:positive?'buy':setup==='ZAYIF TREND'?'reduce':'wait',setup,action,positive,tradable,score,parts,quality,reasons,risks,plan,market,weekly,indicators:{atr:A,adx,rsi:r,sma20:m20,sma50:m50,sma200:I.m200[i],volumeRatio:vol,relative20:relative,resistance,support,diagonal},change:`Yukarı: ${resistance.toFixed(2)} üzerinde kapanış ve kalıcılık. Aşağı: ${stop.toFixed(2)} altı örnek planı geçersiz kılar. Kapanış veya yeniden test beklerken fiyat uzaklaşabilir; yeniden test garanti değildir.`};
}
function sizePosition(plan,capital,riskPct=1,maxAllocationPct=20,fx=1){
 if(!plan?.available||![plan.entryHigh,plan.stop,plan.costBps].every(finite)||plan.stop<=0||plan.entryHigh<=plan.stop||![capital,riskPct,maxAllocationPct,fx].every(finite)||capital<=0||riskPct<=0||maxAllocationPct<=0||fx<=0)return {quantity:0,estimatedRisk:0,amount:0};
 const riskBudget=capital*clamp(riskPct,0,5)/100,allocation=capital*clamp(maxAllocationPct,0,100)/100,unit=plan.entryHigh*fx*(1+plan.costBps/10000),loss=(plan.entryHigh-plan.stop+(plan.entryHigh+plan.stop)*plan.costBps/10000)*fx;
 const quantity=Math.max(0,Math.floor(Math.min(riskBudget/loss,allocation/unit)));
 return {quantity,riskBudget,estimatedRisk:quantity*loss,amount:quantity*unit};
}
function executionExit(position,bar,expired=false,periodEnd=false){
 if(bar.o<=position.stop)return {exit:bar.o,reason:'stop-gap'};
 if(bar.o>=position.target)return {exit:position.target,reason:'target-gap'};
 if(bar.l<=position.stop)return {exit:position.stop,reason:bar.h>=position.target?'same-bar-stop-first':'stop'};
 if(bar.h>=position.target)return {exit:position.target,reason:'target'};
 if(expired||periodEnd)return {exit:bar.c,reason:periodEnd?'period-end':'time'};
 return {exit:null,reason:null};
}
// One long position per symbol. Signal at t close, fill at t+1 open; no same-close execution.
function simulate(rows,options={}){
 if(!validRows(rows))return {trades:[],error:'Geçersiz seri'};
 const trades=[],cost=clamp(options.costBps??20,0,200)/10000;let position=null,pending=null,skipped=0;
 const start=Math.max(MIN_BARS-1,options.startIndex??MIN_BARS-1),end=options.endIndex??rows.length-1;
 for(let i=start;i<=end;i++){
  const bar=rows[i];
  if(pending&&!position){const p=pending.plan,fill=bar.o;
   if(fill>=p.entryLow-.25*pending.atr&&fill<=p.entryHigh&&fill>p.stop&&p.target>fill){const rr=(p.target-fill-(p.target+fill)*cost)/(fill-p.stop+(fill+p.stop)*cost);if(rr>=1.5)position={signalDate:pending.date,entryDate:bar.date,entryIndex:i,entry:fill,stop:p.stop,target:p.target,setup:pending.setup};else skipped++;}else skipped++;
   pending=null;
  }
  if(position){const {exit,reason}=executionExit(position,bar,i-position.entryIndex>=9,i===end);
   if(exit!==null){const net=exit*(1-cost)/(position.entry*(1+cost))-1;trades.push({...position,exitDate:bar.date,exit,reason,netReturn:net});position=null;}
  }
  if(!position&&i<end){const prefix=rows.slice(0,i+1),result=analyze(prefix,{...options,historical:true,asOf:Date.parse(bar.date+'T23:59:59+03:00')});if(result.tradable)pending={plan:result.plan,date:bar.date,setup:result.setup,atr:result.indicators.atr};}
 }
 return {trades,skipped,...summarize(trades),startDate:rows[start]?.date,endDate:rows[end]?.date};
}
function fingerprint(rows){let hash=2166136261;const text=JSON.stringify(rows);for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
function summarize(trades){let equity=1,peak=1,maxDrawdown=0;for(const t of trades){equity*=1+t.netReturn;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,1-equity/peak);}const wins=trades.filter(t=>t.netReturn>0),losses=trades.filter(t=>t.netReturn<0),profit=wins.reduce((s,t)=>s+t.netReturn,0),loss=-losses.reduce((s,t)=>s+t.netReturn,0);return {count:trades.length,winRate:trades.length?wins.length/trades.length:null,meanReturn:trades.length?mean(trades.map(t=>t.netReturn)):null,profitFactor:loss>0?profit/loss:null,compoundedReturn:trades.length?equity-1:null,closedTradeDrawdown:trades.length?maxDrawdown:null};}
return {VERSION,MIN_BARS,sma,ema,rsi,indicators,analyze,validRows,barQuality,buildMarket,marketAt,weeklyTrend,diagonalResistance,sizePosition,simulate,summarize,fingerprint,executionExit};
});
