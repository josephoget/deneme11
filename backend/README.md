# Şanslı Kedi piyasa API’si

Bu Worker yalnız projedeki varlıkların Yahoo Finance chart API fiyat serisini getirir. Rastgele URL proxy’si değildir. Günlük barlar gecikmeli olabilir; gerçek zaman garantisi yoktur. ALTIN.S1 kaynakta bulunmadığı için 404 açıkça korunur. API kaynak hatasını veri olarak sunmaz.

Kurulum: Resmî Wrangler CLI ile Cloudflare hesabına giriş yapın, bu klasörde `wrangler deploy` çalıştırın. Worker adresini sitedeki canlı veri bağlantısı penceresine yazın veya `market-config.js` içindeki `MARKET_API_URL` değerini adresle doldurup siteyi yayımlayın. Token veya şifreyi site dosyalarına yazmayın.

Worker GET `/health` ve GET `/chart?symbol=ASELS` uçlarını sağlar. İzinli tarayıcı origin’i wrangler.toml içinde `SITE_ORIGIN` ile tanımlanır. Varsayılan `https://josephoget.github.io`.

Düğme varlık sayfasında seçili varlığı; ana sayfada bütün varlıkları eşzamanlı dört istekle çeker. Fiyat satırları tarayıcıda doğrulanır, analiz yeniden hesaplanır ve paket sekme oturumu boyunca saklanır. Kaynak erişim hatasında son geçerli kayıt korunur ve karar geçersizleştirilir. Statik dosyaların kalıcı yenilenmesi ayrıca mevcut Actions zamanlamasıyla devam eder.
