"""Per-asset headlines and full-text checked official KAP disclosures."""
import concurrent.futures
import datetime as dt
from email.utils import parsedate_to_datetime
import html
from html.parser import HTMLParser
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ALIASES={
'AEFES':'Anadolu Efes','AKBNK':'Akbank','AKSA':'Aksa Akrilik','AKSEN':'Aksa Enerji','ALARK':'Alarko','ALTNY':'Altınay Savunma','ANSGR':'Anadolu Sigorta','ARCLK':'Arçelik','ASELS':'Aselsan','ASTOR':'Astor','BALSU':'Balsu','BTCIM':'Batıçim','BSOKE':'Batısöke','BERA':'Bera Holding','BIMAS':'BİM','BRSAN':'Borusan Boru','BRYAT':'Borusan Yatırım','CCOLA':'Coca Cola İçecek','CVKMD':'CVK Maden','CWENE':'CW Enerji','CANTE':'Çan2 Termik','CIMSA':'Çimsa','DAPGM':'DAP Gayrimenkul','DSTKF':'Destek Faktoring','DOHOL':'Doğan Holding','DOAS':'Doğuş Otomotiv','EFOR':'Efor Yatırım','ECILC':'Eczacıbaşı İlaç','EKGYO':'Emlak Konut','ENJSA':'Enerjisa','ENERY':'Enerya','ENKAI':'Enka','EREGL':'Erdemir','ESEN':'Esenboğa Elektrik','EUREN':'Europen','EUPWR':'Europower','FENER':'Fenerbahçe','FROTO':'Ford Otosan','GSRAY':'Galatasaray','GENIL':'Gen İlaç','GESAN':'Girişim Elektrik','GRTHO':'Grainturk','GUBRF':'Gübretaş','GLRMK':'Gülermak','GRSEL':'Gürsel Turizm','SAHOL':'Sabancı Holding','HEKTS':'Hektaş','IEYHO':'Işıklar Enerji','ISMEN':'İş Yatırım','IZENR':'İzdemir Enerji','KRDMD':'Kardemir','KTLEV':'Katılımevim','KLRHO':'Kiler Holding','KCHOL':'Koç Holding','KUYAS':'Kuyaş','MAGEN':'Margün Enerji','MAVI':'Mavi Giyim','MIATK':'Mia Teknoloji','MGROS':'Migros','MPARK':'MLP Sağlık','OBAMS':'Oba Makarna','ODAS':'Odaş','ODINE':'Odine','OTKAR':'Otokar','OYAKC':'Oyak Çimento','PASEU':'Pasifik Eurasia','PSGYO':'Pasifik Gayrimenkul','PAHOL':'Pasifik Holding','PATEK':'Pasifik Teknoloji','PGSUS':'Pegasus','PETKM':'Petkim','QUAGR':'Qua Granite','RALYH':'Ral Yatırım','REEDR':'Reeder','SARKY':'Sarkuysan','SASA':'Sasa','SKBNK':'Şekerbank','SOKM':'Şok Marketler','TAVHL':'TAV Havalimanları','TKFEN':'Tekfen','TOASO':'Tofaş','TRMET':'TR Anadolu Metal','TRENJ':'TR Doğal Enerji','TUKAS':'Tukaş','TCELL':'Turkcell','TUPRS':'Tüpraş','TRALT':'Türk Altın','THYAO':'Türk Hava Yolları','GARAN':'Garanti BBVA','HALKB':'Halkbank','ISCTR':'İş Bankası','TSKB':'Sınai Kalkınma Bankası','TURSG':'Türkiye Sigorta','SISE':'Şişecam','VAKBN':'VakıfBank','TTKOM':'Türk Telekom','ULKER':'Ülker','VESTL':'Vestel','YKBNK':'Yapı Kredi','ZOREN':'Zorlu Enerji',
'ALTINS1':'altın sertifikası','XAUUSD':'ons altın','GRAMALTIN':'gram altın','BRENT':'Brent petrol','WTI':'WTI petrol','USDTRY':'dolar TL','EURTRY':'euro TL','EURUSD':'euro dolar'}
ALTERNATES={'USDTRY':['dolar/tl','dolar kuru'],'EURTRY':['euro/tl','euro kuru'],'EURUSD':['eur/usd','euro dolar'],'ALTINS1':['altın.s1','darphane sertifikası'],'WTI':['batı teksas'],'BRENT':['brent'],'CCOLA':['coca-cola içecek'],'THYAO':['THY'],'GARAN':['Garanti Bankası'],'TRALT':['Koza Altın']}

class VisibleText(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'): self.skip+=1
    def handle_endtag(self,tag):
        if tag in ('script','style') and self.skip:self.skip-=1
    def handle_data(self,data):
        text=' '.join(data.split())
        if not self.skip and text and len(text)>2:self.parts.append(text)

def fetch_page(url,limit=2_000_000):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; PiyasaMasasi/1.0)'})
    with urllib.request.urlopen(req,timeout=22) as response:
        return response.read(limit).decode('utf-8','replace')

def kap_results(member_id):
    url='https://www.kap.org.tr/tr/bildirim-sorgu-sonuc?member='+urllib.parse.quote(member_id)
    page=fetch_page(url); flight=[]
    for match in re.finditer(r'self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)',page):
        flight.append(json.loads(match.group(1)))
    payload=''.join(flight); output=[]; position=0
    while True:
        start=payload.find('{"disclosureBasic":',position)
        if start<0: break
        try:
            item,end=json.JSONDecoder().raw_decode(payload[start:]); output.append(item['disclosureBasic']); position=start+end
        except (ValueError,KeyError): position=start+1
    return output

def classify_disclosure(title,summary,body):
    text=normalize(' '.join([title,summary]))
    amounts=[]
    for value in re.findall(r'(?i)(\d[\d., ]{0,16}\s*(?:milyar|milyon|bin)?\s*(?:TL|Türk Lirası|ABD Doları|Dolar|USD|Avro|Euro|EUR))',body):
        value=' '.join(value.split())
        if value not in amounts: amounts.append(value)
        if len(amounts)>=3: break
    if any(k in text for k in ['yeni is iliskisi','sozlesme imzalan','yeni siparis','siparis alindi','ihale kazan']):
        kind='Yeni iş / sözleşme'; channel='Satış veya sipariş bakiyesine katkı potansiyeli. Teslimat takvimi, maliyet ve kârlılık açıklanmadan net kâr etkisi hesaplanamaz.'; bias='Koşullu olumlu'
    elif any(k in text for k in ['devreye alinan yatirim','yatirim tesisi','uretim merkezi','kapasite artisi','yatirim tamamlan']):
        kind='Yatırım / kapasite kararı'; channel='Üretim ve teslimat kapasitesini destekleyebilir; yatırım harcaması kısa vadede nakit çıkışıdır. Kullanım oranı ve yatırım getirisi izlenmeli.'; bias='Karışık · orta/uzun vade'
    elif any(k in text for k in ['kar payi dagit','temettu','nakit kar payi']):
        kind='Temettü / kâr payı'; channel='Dağıtım tutarı ve hak kullanım tarihi nakit akışını belirler; nakit şirketten çıkar ve fiyat temettü sonrasında düzeltilebilir.'; bias='Tutar ve tarihe bağlı'
    elif any(k in text for k in ['paylarinin geri alinmasi','pay geri alim','geri alim programi']):
        kind='Pay geri alımı'; channel='Geri alım talep ve pay başına kârı etkileyebilir; nakit kullanımı ve gerçekleşen miktar izlenmeli.'; bias='Koşullu olumlu'
    elif any(k in text for k in ['sermaye artirimi','bedelli sermaye','bedelsiz sermaye','yeni pay alma']):
        kind='Sermaye işlemi'; channel='Bedellide sulanma ve fon kullanım yeri; bedelsizde pay adedi/fiyat düzeltmesi önemlidir. Tek başına değer yaratımı değildir.'; bias='İşlemin türüne bağlı'
    elif any(k in text for k in ['finansal rapor','finansal tablo','faaliyet raporu']):
        kind='Finansal rapor'; channel='Bu bildirim rapor yayımlandığını doğrular; tablolar ayrıca hesaplanmadan kâr, borç veya nakit akışı hakkında sonuç çıkarılmaz.'; bias='Rapor incelenmeli'
    elif any(k in text for k in ['dava','ceza','idari para cezasi','faaliyet izni','lisans iptali','temerrut']):
        kind='Hukuki / operasyonel risk'; channel='Mali yük ve faaliyet etkisi açıklanan kapsam, tutar ve sonuca bağlıdır.'; bias='Koşullu olumsuz'
    elif any(k in text for k in ['devre kesici','islem sirasi kapatil','islem sirasi acil']):
        kind='İşlem / piyasa tedbiri'; channel='Bu bildirim işlem koşulunu etkiler; şirketin faaliyet kârı hakkında tek başına bilgi vermez. Fiyat ve hacim hareketini tedbir sonrası ayrıca izleyin.'; bias='Faaliyet etkisi yok · piyasa riski'
    else:
        kind='Kurumsal bildirim'; channel='Tam KAP metni açıldı; açıklanmış metin ve başlık üzerinden doğrudan finansal etkisi sınıflandırılamadı.'; bias='Nötr / bilgi'
    return {'decisionType':kind,'potentialChannel':channel,'directionalReading':bias,'amounts':amounts}

def get_kap(item):
    symbol,company=item;member_id=company.get('kapId')
    if not member_id:return symbol,[],'KAP üye kodu yok'
    try:
        records=kap_results(member_id);selected=[]
        for row in records:
            if row.get('stockCode')!=symbol:continue
            try:published=dt.datetime.strptime(row['publishDate'],'%d.%m.%Y %H:%M:%S').replace(tzinfo=dt.timezone(dt.timedelta(hours=3)))
            except (KeyError,ValueError):continue
            if published<dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=31):continue
            selected.append((published,row))
        selected.sort(key=lambda pair:pair[0],reverse=True);disclosures=[]
        for published,row in selected[:5]:
            url='https://www.kap.org.tr/tr/Bildirim/'+str(row['disclosureIndex'])
            page=fetch_page(url);parser=VisibleText();parser.feed(page)
            try:start=parser.parts.index('oda_ExplanationTextBlock|')+1
            except ValueError:start=max(0,len(parser.parts)-12)
            body=' '.join(parser.parts[start:])
            for marker in ('Yukarıdaki açıklamalarımızın','This statement has been translated','Yukarıdaki açıklamaların'):
                if marker in body:body=body.split(marker,1)[0]
            if len(body)<100:raise ValueError('KAP tam metni okunamadı')
            body=re.sub(r'\boda_[A-Za-z0-9_]+\|','',body)
            body=re.sub(r'\s+',' ',body).strip()
            match=re.search(r'(.{0,220}(?:sözleşme|yatırım|devreye|kâr payı|sermaye|finansal rapor|sipariş|açıklamıştır).{0,900})',body,re.I)
            evidence=' '.join(match.group(1).split()) if match else (row.get('summary') or row.get('title',''))
            if len(evidence)>900:evidence=evidence[:897].rsplit(' ',1)[0]+'…'
            summary=row.get('summary') or row.get('title','')
            analysis=classify_disclosure(row.get('title',''),summary,body)
            disclosures.append({'id':row['disclosureIndex'],'title':summary,'notificationType':row.get('title',''),'publishedAt':published.isoformat(timespec='seconds'),'url':url,'summary':evidence,'fullTextVerified':True,'source':'KAP resmî bildirimi',**analysis})
        return symbol,disclosures,None
    except Exception as exc:return symbol,[],str(exc)
def normalize(text):
    text=unicodedata.normalize('NFKD',text.casefold().replace('ı','i'))
    text=''.join(c for c in text if not unicodedata.combining(c))
    return ' '.join(re.findall(r'[a-z0-9]+',text))
def match(title, terms):
    clean=' '+normalize(title)+' '
    return next((term for term in terms if ' '+normalize(term)+' ' in clean),None)
def get_news(item):
    sym,name=item
    aliases=[name]+ALTERNATES.get(sym,[])
    query='('+' OR '.join('"'+a+'"' for a in [sym]+aliases)+') when:30d'
    if sym in ['BIMAS','MGROS','SOKM']:query+=' -aktüel -katalog -broşür'
    if sym in ['FENER','GSRAY']:query+=' (hisse OR borsa OR finansal OR KAP)'
    url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query,'hl':'tr','gl':'TR','ceid':'TR:tr'})
    now=dt.datetime.now(dt.timezone.utc)
    result={'query':query,'searchUrl':url,'checkedAt':now.isoformat(timespec='seconds'),'items':[],'error':None,'coverage':'Google News RSS; 30 gün, başlık eşleşmesi, en fazla 12 kayıt'}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=25) as response:root=ET.fromstring(response.read())
        found=[];seen=set();counts={}
        for node in root.findall('./channel/item'):
            title=html.unescape(node.findtext('title','')).strip();source=node.find('source');publisher=source.text if source is not None else 'Yayıncı belirtilmemiş'
            if publisher and title.endswith(' - '+publisher):title=title[:-len(publisher)-3]
            matched=match(title,[sym]+aliases)
            if not matched:continue
            if sym in ['BIMAS','MGROS','SOKM'] and any(term in normalize(title) for term in ['aktuel','katalog','brosur']):continue
            if sym in ['FENER','GSRAY'] and not match(title,['hisse','borsa','sermaye','KAP','finansal','bilanço','kar','zarar']):continue
            try:date=parsedate_to_datetime(node.findtext('pubDate','')).astimezone(dt.timezone.utc)
            except (ValueError,TypeError):continue
            if date>now+dt.timedelta(minutes=5) or date<now-dt.timedelta(days=31):continue
            link=node.findtext('link','');source_url=source.attrib.get('url','') if source is not None else ''
            if urllib.parse.urlparse(link).scheme not in ('http','https'):continue
            key=normalize(title)
            if key in seen:continue
            seen.add(key)
            found.append({'title':title,'url':link,'publisher':publisher,'publisherUrl':source_url,'publishedAt':date.isoformat(timespec='seconds'),'matchedTerm':matched})
        for item in sorted(found,key=lambda a:a['publishedAt'],reverse=True):
            publisher=item['publisher']
            if counts.get(publisher,0)>=3:continue
            counts[publisher]=counts.get(publisher,0)+1;result['items'].append(item)
            if len(result['items'])==12:break
        return sym,result
    except Exception as exc:
        result['error']=str(exc);return sym,result

def main():
    universe=json.loads((ROOT/'market-universe.json').read_text())
    assets={s:ALIASES.get(s,c['name']) for s,c in universe['companies'].items()}
    assets.update({s:ALIASES[s] for s in ['ALTINS1','XAUUSD','GRAMALTIN','BRENT','WTI','USDTRY','EURTRY','EURUSD']})
    previous=json.loads((ROOT/'market-news.json').read_text()) if (ROOT/'market-news.json').exists() else {'assets':{}}
    results={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for symbol,result in pool.map(get_news,assets.items()):
            if result['error'] and symbol in previous['assets']:
                result['items']=previous['assets'][symbol]['items'];result['cached']=True
            results[symbol]=result
            print(symbol,len(result['items']),'ERROR '+result['error'] if result['error'] else 'headlines',flush=True)
    disclosures={};disclosure_errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for symbol,items,error in pool.map(get_kap,universe['companies'].items()):
            disclosures[symbol]=items
            if error:
                disclosure_errors[symbol]=error
                items=previous.get('disclosures',{}).get(symbol,[])
            print(symbol,'KAP decisions',len(items),'ERROR '+error if error else 'full-text reads',flush=True)
    data={'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),'provider':'Google News RSS + KAP official disclosures','usedInTechnicalScore':False,'assets':results,'disclosures':disclosures,'disclosureErrors':disclosure_errors}
    (ROOT/'market-news.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    (ROOT/'market-news.js').write_text('window.MARKET_NEWS='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
if __name__=='__main__':main()
