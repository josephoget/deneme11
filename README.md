# Şanslı Kedi

GitHub Pages giriş dosyası `index.html` dosyasıdır. Eski `aselsan-teknik-analiz.html` ana sayfaya yönlenir. Dosyaları birlikte yayınlayın.

## Arayüz ve kapsam

- Soldan açılan Varlıklar paneli: BIST 30, BIST 100’ün diğer hisseleri, altın, petrol ve döviz. Gruplar açılır/kapanır; ad veya kodla aranır. Ana sayfa yalnız seçilen varlığı gösterir.
- Endeks üyelikleri [KAP Endeksler](https://kap.org.tr/tr/Endeksler) sayfasından alınır. İlk sürümde 100 hisse ve 8 ek varlık, toplam 108 varlık vardır. BIST 30, BIST 100’ün alt kümesidir; listede tekrar edilmez.
- OHLC fiyatları ve hacim; SMA20/50/200, RSI14, MACD12/26/9, basit ATR14, Bollinger ve destek/direnç seviyeleri.
- Günlük mum grafiğinde aralık seçimi, mum ayrıntısı, hacim ve ortalamalar; seçilen varlık için sermaye senaryosu.

## Veriler ve haberler

`scripts/refresh_universe.py` KAP listesini alır, 100/30 adet kontrolü yapar. Kaynak yapısı değişirse eski listeyi korur ve hata yazar.

`scripts/refresh_market.py` Yahoo Finance chart API üzerinden 1 yıllık günlük veri alır. Son kontrol ve son fiyat değişimi zamanları ayrıdır. Boş OHLC günleri, tutarsız satırlar ve kullanılan satır sayısı raporlanır. Kaynak hatasında son kayıt korunur. Fiyatların tarih sırası, benzersizliği, pozitifliği ve OHLC ilişkileri tarayıcıda da kontrol edilir. Bu kontroller kaynak fiyatının ikinci bir sağlayıcı tarafından doğrulandığı anlamına gelmez; borsa takvimiyle eksiksizlik karşılaştırması yapılmaz.

`scripts/refresh_news.py` Google News RSS üzerinden medya başlıklarını bulur; bunları tam makale diye sunmaz. Ayrıca BIST şirketlerinin son 31 günlük KAP bildirim sayfalarını ve her şirkete ait en çok beş bildirimin resmî tam metnini açar. KAP kaydında tam metin okunamadıysa doğrulanmış gibi işaretlenmez; erişim hatasında önceki KAP sonucu korunur. Tam metin kanıt özeti, açıklama türü, olası finansal kanal ve metinde bulunan tutarlar arayüzde gösterilir. Yorum kural tabanlı sınıflandırmadır: açıklanan sözleşme/yatırım tutarı gerçekleşmiş kâr sayılmaz, karar otomatik teknik puana katılmaz ve fiyat etkisi iddia edilmez. Kapsam son 31 gün ve en fazla beş bildirim/şirkettir; tüm siteleri veya tüm haberleri kapsamaz.

Her varlığın Haberler sekmesi ve analiz altındaki kaynak dökümü ayrıdır. Resmî KAP şirket kararları tam metin kontrolüyle medya başlıklarından ayrılır. Medya yayıncısının tüm makalesi bu statik akıştan doğrulanmış sayılmaz. KAP karar özeti ve sınıflandırması izah edilebilir, kural tabanlı ön okumadır; şirket finansallarının ve gerçek fiyat etkisinin tam değerleme çalışması değildir. Haberler teknik puanı otomatik değiştirmez.

ALTIN.S1 fiyat kaynağı 404 verdiği için eski kayıt korunur; otomatik güncel karar verilmez. Teorik gram altın, vadeli ons altın × USD/TRY ÷ 31,1034768 hesabıdır; fiziki altın alış/satış fiyatı değildir. Altın ons, Brent ve WTI vadeli sözleşme referanslarıdır.

## Teknik kararın kapsamı

Puan: eğilim 25, momentum 20, MACD 15, hacim 10, geçmiş performans 15, oynaklık 15. Hisseler grup içinde puana göre sıralanır. Güncel ve yeterli veride `ALINABİLİR`, `BEKLE` veya `ALINMAZ`; eksik/bozuk/eski veride `KARAR VERİLEMEZ` gösterilir. En az 200 günlük seri, hisselerde hacim, olumlu puan, ortalama eğilimi, RSI/MACD, hacim ve dirence mesafe birlikte değerlendirilir. Son günlük bar seans içinde tamamlanmamış olabilir. Modelin başarı olasılığı ölçülmemiştir; puan olasılık değildir. Bilanço, değerleme ve kişisel risk profili hesaplanmaz.

## GitHub Pages ve yenileme

1. Dosyaları GitHub deponuzun `main` dalına gönderin.
2. Settings → Pages → Source: **GitHub Actions** seçin.
3. Actions → **Refresh market data and deploy** → Run workflow ile ilk yenilemeyi başlatın. Gerekirse Actions → General → Workflow permissions bölümünde Read and write permissions seçin.
4. Workflow fiyatları iş günleri 06:00–16:50 UTC arasında 10 dakikada bir yeniler; KAP ve medya haberlerini 07:17 ve 13:17 UTC'de tarar. Manuel çalıştırma bütün kaynakları yeniler. GitHub zamanlaması gecikebilir; anlık fiyat garantisi yoktur.
5. Sayfa açılışında ve sekmeye dönüldüğünde fiyat ve haber JSON dosyaları önbellek atlanarak okunur. Kaynakların gecikmesi ayrıca devam edebilir.

Yerel `file://` açılışında paketlenmiş JS verileri kullanılır. Otomatik yenileme için yayımlanmış HTTP(S) adresini açın. Yerelde `python3 scripts/refresh_universe.py`, ardından `python3 scripts/refresh_market.py` ve `python3 scripts/refresh_news.py` ile dosyalar yenilenebilir; Python standart kütüphanesi yeterlidir.

## Yeni ana sayfa ve doğrudan kaynak yenilemesi

Ana sayfa alınabilir, teyit bekleyen ve verisi sınırlı gruplara ayrı liste adresleriyle bağlanır. Adres içindeki `#varlik/THYAO` seçili varlığı sayfa yenilemede korur. Teknik sıralama, piyasa hareketleri ve mini eğilim grafikleri mevcut fiyat serisinden hesaplanır.

Cloudflare Worker kurulumu `backend/README.md` içinde. Yeni kaynak düğmesi dışarı yönlendirmez: Worker üzerinden kaynak verisini alır ve analizi yeniden hesaplar. API adresi `market-config.js` içinde yapılandırılır; bağlantı kurulmadan düğme bunu açıkça bildirir. Kaynak hataları varlık bazında gösterilir. ALTIN.S1 Yahoo Finance tarafından sağlanmadığı için kaynak hatası ve eski veri uyarısı korunur.
