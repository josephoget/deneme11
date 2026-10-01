#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),E=require('../analysis-engine.js');
const live=JSON.parse(fs.readFileSync(path.join(root,'market-live.json'))),universe=JSON.parse(fs.readFileSync(path.join(root,'market-universe.json')));
const market=E.buildMarket(live.assets,universe.groups.XU100),assets={},all=[],later=[];
for(const sym of universe.groups.XU100){
 const entry=live.assets[sym];if(!entry?.rows)continue;
 const quality=E.barQuality(entry.rows,{entry,asOf:Date.parse(live.generatedAt),fresh:!live.errors?.[sym]});
 const rows=quality.provisional?entry.rows.slice(0,-1):entry.rows;
 if(!E.validRows(rows)||rows.length<100){assets[sym]={error:'En az 100 geçerli günlük bar gerekli.'};continue;}
 const cut=Math.max(60,Math.floor(rows.length*.7)),opts={symbol:sym,isShare:true,marketRecords:market,costBps:20};
 const full=E.simulate(rows,opts),late=E.simulate(rows,{...opts,startIndex:cut}),stress=E.simulate(rows,{...opts,startIndex:cut,costBps:40});
 assets[sym]={signature:E.fingerprint(entry.rows),lastDate:rows.at(-1).date,bars:rows.length,full,later:late,stress:{count:stress.count,meanReturn:stress.meanReturn},buyHoldLater:rows.at(-1).c*(1-.002)/(rows[Math.min(cut+1,rows.length-1)].o*(1+.002))-1};
 all.push(...full.trades);later.push(...late.trades);
}
const summary=ts=>{const s=E.summarize(ts);delete s.compoundedReturn;delete s.closedTradeDrawdown;return s;};
const report={version:E.VERSION,generatedAt:new Date().toISOString(),snapshotAt:live.generatedAt,costBps:20,stressCostBps:40,assumptions:['Tek hisse için tek uzun pozisyon; sinyal kapanışından sonraki açılışta koşullu giriş.','Tek yön maliyet: komisyon + kayma varsayımı 20 baz puan (%0,20).','Stop ve hedef aynı mumda görülürse stop önce; stop altı açılışta açılış fiyatı kullanılır.','En çok 10 bar tutulur. Plan bölgesi dışındaki açılışta işlem atlanır.','Bugünkü BIST 100 üyeleri kullanılır: hayatta kalma / seçim yanlılığı vardır.','Temettü, vergi, fiyat limiti ve gerçek emir dolumu modellenmez; kurumsal işlem etkileri tam doğrulanmamıştır.','Son %30 ayrı tarih aralığıdır; strateji geçmiş veriler görüldükten sonra yazıldığı için bağımsız ileri test değildir.','Toplam istatistikler bağımsız hisse işlemlerini birleştirir; portföy getirisi değildir.'],summary:summary(all),laterSummary:summary(later),assets};
fs.writeFileSync(path.join(root,'analysis-report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'analysis-report.js'),'window.ANALYSIS_REPORT='+JSON.stringify(report)+';\n');
console.log(JSON.stringify({assets:Object.keys(assets).length,full:report.summary,later:report.laterSummary},null,2));
