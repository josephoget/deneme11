# Şanslı Kedi — analiz motoru 3

BIST 100 hisseleri, altın, petrol ve döviz için günlük fiyatlardan açıklanabilir senaryolar üretir. Tarayıcı ve geçmiş işlem ölçümü **aynı `analysis-engine.js` motorunu** kullanır. Kusursuz karar, kâr veya belirli bir başarı oranı vaat etmez. Mevcut geçmiş raporunda negatif sonuçlar da açıkça gösterilir.

## Analiz

- Günlük SMA20/50/200, RSI14, MACD12/26/9, Wilder ATR14 ve ADX14.
- Son mum hariç 20 günlük yatay eşikler; iki sağ barla teyit edilmiş tepelerden eğik direnç. Gelecekteki tepeler geçmiş sinyale dahil edilmez.
- Tamamlanmış haftalarla SMA10 eğilimi; günlük ve haftalık görüş ayrılığı açıklanır.
- Tarihleri eşleşen mevcut BIST 100 üyelerinin SMA50 üzerindeki oranı ve medyan 20 günlük getiriye göre göreli güç. Bu resmî BIST endeksi değildir; en az 30 emsal gerekir.
- Kırılım, kırılım adayı, trend içi toparlanma, erken momentum dönüşü, hacimli toparlanma, başarısız kırılım ve zayıf trend ayrı değerlendirilir.
- Kanıt puanı: trend 25, momentum 20, fiyat yapısı 15, hacim 15, göreli güç 15, piyasa katılımı 10. Puan başarı olasılığı değildir. Eksik bileşenlere olumlu varsayım atanmaz.
- Fiyatın iyi görünmesi ile işlem planının uygunluğu ayrıdır. Erken aday yakın direnç veya maliyet nedeniyle elverişsiz olabilir.

## Veri kalitesi

En az 60 geçerli, benzersiz ve tarih sıralı günlük bar gerekir. Bozuk OHLC, eski/kaynak hatalı seri, gelecek tarih, türetilmiş gram altın ve son 60 barda açıklanmamış %40 üzeri açılış boşluğu işlem planını durdurur. Bu son kontrol kurumsal işlem düzeltmesi değildir; inceleme bayrağıdır.

Bugünkü mum, sağlayıcının seans sonu ile bundan en az 15 dakika sonraki çekim birlikte doğrulanmadıkça ön izleme sayılır. Seans bitmeden saklanan mum, ertesi gün otomatik olarak kapanmış sayılmaz. Eski metadatasız geçmiş günlük barlar tarihsel kayıt kabul edilir; ikinci kaynakla doğrulanmış değildir. Hacim eksikse fiyat evresi gösterilebilir, hisse için işleme uygunluk verilmez.

`scripts/refresh_market.py` ve Worker 5 yıllık günlük seri ister. Bu değişiklik mevcut veri dosyasını geriye dönük olarak genişletmez; sonraki başarılı kaynak yenilemesi gerekir. Sağlayıcı seans bitişi ve kurumsal olay bilgileri saklanır. Fiyatların temettü/sermaye işlemlerine göre tam düzeltilmiş olduğu iddia edilmez. Emtia sürekli vadeli serilerinde kontrat devri etkileri olabilir.

## İşlem planı

Olumlu teknik adayda günlük fiyat çevresinde örnek giriş bölgesi, ATR ve yakın diplerle geçersizlik/stop, ilk yukarı engel veya 2R hedefi gösterilir. Hedef fiyat tahmini değildir. Maliyet sonrası en az 1,5R, tamamlanmış mum ve gerekli hacim verisi planın işleme uygunluk koşullarıdır. Varsayılan tek yön komisyon + kayma %0,20'dir.

Risk hesabı kullanıcının sermayesini, işlem riski yüzdesini ve tek hisse sermaye sınırını birlikte uygular. Varsayılanlar %1 risk, %20 tek hisse sınırıdır; kişiselleştirilmiş öneri değildir. Hesap giriş bölgesinin üstünü ve iki yön maliyeti kullanır. Stopta fiyat boşluğu varsa kayıp bütçeyi aşabilir. Otomatik adet yalnız BIST paylarında verilir. Döviz/emtia kontrat büyüklüğü modellenmez.

Mevcut adet ve maliyet kullanıcı tarafından girilir; varlık bazında yalnız açık sayfanın belleğinde tutulur. Siteden emir gönderilmez. Çıkış koşulları mevcut pozisyonu gözden geçirme senaryosudur.

## Geçmiş ölçüm

```sh
node scripts/test-technical.cjs
node scripts/test-data-pipeline.cjs
node scripts/evaluate-engine.cjs
```

Son komut `analysis-report.json` ve tarayıcı için `analysis-report.js` üretir. Her hissede:

- Sinyal t kapanışında; giriş en erken t+1 açılışında ve tanımlı fiyat bölgesi içinde.
- Tek hisse için aynı anda bir uzun pozisyon; en fazla 10 bar tutma.
- Stop altı açılışta daha kötü açılış fiyatı; aynı mumda stop/hedef varsa stop önce.
- %0,20 tek yön maliyet; son %30 tarih aralığında ayrıca %0,40 maliyet testi.
- İşlem sayısı, kazanan oranı, net işlem ortalaması, kâr/zarar toplamı ve örnek işlemler.
- Aynı son tarih aralığı için alıp tutma karşılaştırması. Piyasada kalma süreleri farklıdır.

Son %30 tarih aralığı bağımsız ileri test değildir: kurallar geçmiş veriler görüldükten sonra geliştirilmiştir. Şu anki endeks üyeleri kullanıldığından seçim/hayatta kalma yanlılığı vardır. Toplam rapor, bağımsız hisse işlemlerini birleştirir; portföy getirisi değildir. Vergi, temettü, gerçek emir dolumu ve limitli piyasa koşulları modellenmez. Gerileme yalnız kapanmış işlemlerden ölçülür; gün içi/daily maksimum kayıp değildir. 30'dan az işlemler sınırlı örneklem olarak işaretlenir. Sonuçlar geleceğe ilişkin olasılık değildir.

Rapor, motor sürümü ve fiyat serisi parmak izi eşleşirse gösterilir. Doğrudan API yenilemesi raporla uyuşmazsa eski rapor güncel gibi sunulmaz.

## Kaynaklar ve temel bilgiler

Üyelik `scripts/refresh_universe.py` ile [KAP endeks sayfasından](https://kap.org.tr/tr/Endeksler) alınır; 100/30 adet ve alt küme ilişkisi kontrol edilir. Worker sembol listesi de yenilenir. Bileşen değişikliği Worker'a ancak yeniden dağıtılınca yansır.

Haberler `scripts/refresh_news.py` ile Google News başlıkları ve sınırlı KAP tam metinlerinden derlenir. Başlıklar tam makale veya doğrulanmış fiyat etkisi değildir. Haberler teknik puanı kendiliğinden değiştirmez. Sektör çarpanları ayrı BilancoVeri kaynağından alınır; sektör medyanına göre tahmin kesin adil fiyat değildir.

Gösterge referansı: [Fidelity Technical Indicator Guide](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide). Geçmiş test sınırlamaları: [CFA Institute — Backtesting and Simulation](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation).

## Çalıştırma ve yayın

Giriş `index.html`; eski ASELSAN adresi buraya yönlenir. Yerel önizleme:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

GitHub Pages kaynağı **GitHub Actions** olmalıdır. `.github/workflows/refresh-market.yml` testleri çalıştırır, geçmiş raporu yeniden üretir ve bütün motor dosyalarını Pages paketine kopyalar. Zamanlanmış fiyat çekimi iş günleri 07:00–15:50 UTC; haber taraması 07:17 ve 13:17 UTC'dir. GitHub zamanlaması gecikebilir. Manuel çalıştırma bütün veri kaynaklarını yeniler.

Tarayıcı statik fiyat/haber paketini ve endeks üyeliğini yeniler. HTTPS yayında yapılandırılmış Worker üzerinden doğrudan kaynak yenilemesi çalışır. Yerel HTTP önizlemede otomatik Worker çağrısı yapılmaz; Worker yalnız yapılandırılmış site origin'ine izin verir. Worker adresi `market-config.js`; dağıtım yönergesi `backend/README.md`. Yeni Worker kodu ayrıca dağıtılmalıdır; dosya düzenlemek canlı Worker'ı değiştirmez.

Yayınlanan dosyalar: mevcut site dosyalarına ek olarak `analysis-engine.js`, `engine-ui.js`, `analysis-report.js` ve `analysis-report.json`.
