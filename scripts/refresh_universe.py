"""Refresh constituent membership from KAP, preserving the last valid snapshot on failure."""
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://kap.org.tr/tr/Endeksler'
def parse_page(html):
    text = ''.join(json.loads(m.group(1)) for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)', html))
    groups = {}
    companies = {}
    for code, size in [('XU100',100),('XU030',30)]:
        pos = text.find('{"code":"'+code+'"')
        if pos < 0: raise ValueError('KAP membership structure changed')
        item = json.JSONDecoder().raw_decode(text[pos:])[0]
        members = item['content']
        symbols = [m['stockCode'] for m in members]
        if len(set(symbols)) != size or any(not re.fullmatch(r'[A-Z0-9]{3,8}', s) for s in symbols):
            raise ValueError('Unexpected membership count or symbol')
        groups[code] = sorted(symbols)
        for m in members:
            companies[m['stockCode']]={'name':m['title'],'kapId':m['mkkMemberOid']}
    if not set(groups['XU030']).issubset(groups['XU100']):raise ValueError('Inconsistent index membership')
    return {'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),'sourceUrl':SOURCE,'groups':groups,'companies':companies}
def save(data):
    (ROOT/'market-universe.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'market-universe.js').write_text('window.MARKET_UNIVERSE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
def main():
    try:
        req=urllib.request.Request(SOURCE,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=30) as r: data=parse_page(r.read().decode())
        previous=json.loads((ROOT/'market-universe.json').read_text()) if (ROOT/'market-universe.json').exists() else {'groups':{'XU100':[]}}
        old=set(previous['groups']['XU100']);new=set(data['groups']['XU100'])
        data['changes']={'removed':sorted(old-new),'added':sorted(new-old)}
        save(data)
        for name,assignment in [('market-live','window.MARKET_LIVE='),('market-news','window.MARKET_NEWS=')]:
            path=ROOT/(name+'.json')
            if not path.exists():continue
            bundle=json.loads(path.read_text())
            allowed=new|{'XAUUSD','GRAMALTIN','BRENT','WTI','USDTRY','EURTRY','EURUSD'}
            for field in ['assets','errors','disclosures','disclosureErrors']:
                if isinstance(bundle.get(field),dict):bundle[field]={s:v for s,v in bundle[field].items() if s in allowed}
            path.write_text(json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+'\n')
            (ROOT/(name+'.js')).write_text(assignment+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';\n')
        print('Removed:',data['changes']['removed'],'Added:',data['changes']['added']);print('KAP: 100 BIST 100 members, 30 BIST 30 members')
    except Exception as exc:
        print('KAP refresh failed; saved membership retained:',str(exc))
        if not (ROOT/'market-universe.json').exists():raise
if __name__=='__main__':main()
