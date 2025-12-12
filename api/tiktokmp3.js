const express = require('express');
const { ApifyClient } = require('apify-client'); // Contoh pustaka API
const app = express();
const port = 3000;

module.exports = {
  name: "TikTok MP3",
  desc: "TikTok song downloader",
  category: "Downloader",
  path: "/download/tiktokmp3?apikey=&url=",
  async run(req, res) {
    const { apikey, url } = req.query;

    if (!global.apikey.includes(apikey)) {
      return res.json({ status: false, error: "Apikey invalid" });
    }

app.use(express.json());

app.post('/convert', async (req, res) => {
    const tiktokUrl = req.body.url;

    if (!tiktokUrl) {
        return res.status(400).send({ error: 'URL TikTok diperlukan' });
    }

    try {
        // Logika untuk memanggil API Downloader TikTok
        // Ini adalah langkah kunci yang menangani ekstraksi dan konversi
        const run = await client.actor('scrapearchitect/tiktok-video-audio-mp3-downloader').call({
            video_urls: [{ url: tiktokUrl }]
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // Asumsi hasil berisi tautan langsung ke file MP3
        const mp3Link = items[0]?.audioUrl; // Ganti dengan path data yang benar

        if (mp3Link) {
            // Mengirimkan tautan unduhan kembali ke klien
            res.send({ success: true, downloadUrl: mp3Link });
        } else {
            res.status(404).send({ error: 'Gagal mengekstrak audio' });
        }

    } catch (error) {
        console.error('Error:', error);
        res.status(404).send({ error: 'Terjadi kesalahan pada server.' });
    }
});

app.listen(port, () => {
    console.log(`https://api-junzz-iy.vercel.app/download/tiktok?apikey=junzz&url=${url}`);
});