#!/usr/bin/env python3
"""Fetch public delayed daily bars for the static GitHub Pages dashboard."""
import concurrent.futures
import datetime as dt
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'market-live.json'
JS_OUT = ROOT / 'market-live.js'
FALLBACK = ROOT / 'market-data.json'
BIST30 = ['AEFES','AKBNK','ASELS','ASTOR','BIMAS','DSTKF','EKGYO','ENKAI','EREGL','FROTO','GARAN','GUBRF','ISCTR','KCHOL','KRDMD','MGROS','PETKM','PGSUS','SAHOL','SASA','SISE','TAVHL','TCELL','THYAO','TOASO','TRALT','TTKOM','TUPRS','VAKBN','YKBNK']
UNIVERSE = json.loads((ROOT/'market-universe.json').read_text())
BIST30 = UNIVERSE['groups']['XU030']
STOCKS = UNIVERSE['groups']['XU100']
SYMBOLS = {key: key + '.IS' for key in STOCKS + ['ALTINS1']}
SYMBOLS.update({'USDTRY':'TRY=X','EURTRY':'EURTRY=X','EURUSD':'EURUSD=X','XAUUSD':'GC=F','BRENT':'BZ=F','WTI':'CL=F'})
HEADERS = {'User-Agent':'Mozilla/5.0 (compatible; PiyasaMasasi/1.0)','Accept':'application/json'}

def fetch_one(item):
    key, symbol = item
    path = urllib.parse.quote(symbol, safe='')
    query = urllib.parse.urlencode({'range':'1y','interval':'1d','events':'history'})
    last_error = None
    for host in ('query1.finance.yahoo.com','query2.finance.yahoo.com'):
        for attempt in range(3):
            url = f'https://{host}/v8/finance/chart/{path}?{query}'
            try:
                req = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=25) as response:
                    payload = json.load(response)
                result = payload['chart']['result'][0]
                timestamps = result['timestamp']
                quote = result['indicators']['quote'][0]
                timezone = dt.timezone.utc
                rows = []
                missing_ohlc = 0
                invalid_ohlc = 0
                for i, stamp in enumerate(timestamps):
                    vals = [quote[k][i] for k in ('open','high','low','close')]
                    if any(v is None for v in vals):
                        missing_ohlc += 1
                        continue
                    o,h,l,c = [round(float(v), 6) for v in vals]
                    v = quote.get('volume', [None] * len(timestamps))[i]
                    if not all(math.isfinite(v) for v in (o,h,l,c)) or min(o,h,l,c) <= 0 or l > min(o,c) or h < max(o,c):
                        invalid_ohlc += 1
                        continue
                    date = dt.datetime.fromtimestamp(stamp, timezone).date().isoformat()
                    rows.append({'date':date,'o':o,'h':h,'l':l,'c':c,'v':int(v) if v is not None else None})
                if len(rows) < 20:
                    raise ValueError(f'{symbol}: only {len(rows)} daily bars')
                rows = list({r['date']:r for r in rows}.values())
                rows.sort(key=lambda r:r['date'])
                meta = result.get('meta',{})
                return key, {'symbol':symbol,'currency':meta.get('currency'),'exchangeTimezone':meta.get('exchangeTimezoneName'),'rows':rows,'source':'Yahoo Finance chart API','sourceUrl':f'https://finance.yahoo.com/quote/{path}/history/','lastBar':rows[-1]['date'],'validation':{'receivedBars':len(timestamps),'acceptedBars':len(rows),'omittedBars':len(timestamps)-len(rows),'missingOHLC':missing_ohlc,'invalidOHLC':invalid_ohlc,'ohlcValid':True},'quoteTime':meta.get('regularMarketTime')}, None
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError, json.JSONDecodeError) as exc:
                last_error = str(exc)
                time.sleep(0.8 * (attempt + 1))
    return key, None, last_error

def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    previous = json.loads(OUT.read_text()) if OUT.exists() else {'assets':{}}
    fallback = json.loads(FALLBACK.read_text()) if FALLBACK.exists() else {}
    assets = previous.get('assets',{}).copy()
    errors = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for key, entry, error in pool.map(fetch_one, SYMBOLS.items()):
            if entry:
                entry['fetchedAt'] = now
                entry['checkedAt'] = now
                old = assets.get(key)
                assets[key] = entry
                print(f'{key:8} {len(entry["rows"]):3} bars through {entry["lastBar"]}')
            else:
                errors[key] = error
                if key not in assets and key in fallback:
                    rows = fallback[key]
                    assets[key] = {'symbol':SYMBOLS[key],'currency':'TRY','exchangeTimezone':'Europe/Istanbul','rows':rows,'source':'Historical snapshot','sourceUrl':('https://tr.investing.com/equities/turkiye-cumhuriyeti-hazine-ve-historical-data' if key == 'ALTINS1' else f'https://stockanalysis.com/quote/ist/{key}/history/'),'lastBar':rows[-1]['date'],'fetchedAt':'2026-09-29T18:10:00+03:00'}
                print(f'{key:8} FAILED: {error}')
                # Retain the last good price series, but record the failed
                # attempt separately so the UI never presents it as refreshed.
                if key in assets:
                    assets[key]['lastAttemptAt'] = now
                    assets[key]['lastFetchError'] = error
    # Derived gram price from gold ounce USD and USD/TRY daily closes.
    gold = assets.get('XAUUSD',{}).get('rows',[])
    fx = {r['date']:r for r in assets.get('USDTRY',{}).get('rows',[])}
    gram = []
    for g in gold:
        f = fx.get(g['date'])
        if not f: continue
        values = [g[k]*f[k]/31.1034768 for k in ('o','h','l','c')]
        gram.append({'date':g['date'],'o':round(values[0],4),'h':round(max(values),4),'l':round(min(values),4),'c':round(values[3],4),'v':None})
    if len(gram)>=20:
        gram_fetched = now if not any(k in errors for k in ['XAUUSD','USDTRY']) else previous.get('assets',{}).get('GRAMALTIN',{}).get('fetchedAt',now)
        assets['GRAMALTIN']={'symbol':'GC=F × TRY=X ÷ 31.1034768','currency':'TRY','exchangeTimezone':'UTC','rows':gram,'source':'Derived from gold futures and USD/TRY; indicative, not physical gram gold quote','sourceUrl':'https://finance.yahoo.com/markets/commodities/','lastBar':gram[-1]['date'],'fetchedAt':gram_fetched}
    if any(k in errors for k in ['XAUUSD','USDTRY']):
        errors['GRAMALTIN']='Dayanak fiyat kaynaklarından biri yenilenemedi'
    if 'ALTINS1' in assets and assets['ALTINS1'].get('source') == 'Historical snapshot':
        assets['ALTINS1']['sourceUrl'] = 'https://tr.investing.com/equities/turkiye-cumhuriyeti-hazine-ve-historical-data'
    out={'generatedAt':now,'marketDataAsOf':max((v.get('lastBar','') for v in assets.values()),default=''),'membershipCheckedAt':UNIVERSE['checkedAt'],'bist30Source':UNIVERSE['sourceUrl'],'assets':assets,'errors':errors}
    comparable = dict(out)
    comparable.pop('generatedAt', None)
    old_comparable = dict(previous)
    old_comparable.pop('generatedAt', None)
    # Always save the run timestamp and per-symbol error state. A no-change
    # quote response is still a successful live check; a failed response is
    # recorded as failed and must not silently appear fresh.
    temp=OUT.with_suffix('.tmp')
    temp.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
    os.replace(temp,OUT)
    JS_OUT.write_text('window.MARKET_LIVE=' + json.dumps(out,ensure_ascii=False,separators=(',',':')) + ';\n')
    print(f'Wrote {OUT}: {len(assets)} assets, {len(errors)} fetch errors')
    if len([key for key in BIST30 if key in assets])<30:
        print('WARNING: BIST 30 data incomplete; missing members remain visible without a score')

if __name__=='__main__': main()
