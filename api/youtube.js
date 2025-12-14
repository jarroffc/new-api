// const cheerio = require("cheerio"); <-- Dihapus karena tidak digunakan

const yt = {
    get baseUrl() {
        return {
            // Menggunakan domain baru: https://ytmp3.gg
            origin: 'https://ytmp3.gg'
        }
    },

    get baseHeaders() {
        return {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': this.baseUrl.origin,
            'referer': this.baseUrl.origin + '/youtube-to-mp3'
        }
    },

    validateFormat: function (userFormat) {
        const validFormat = ['mp3', '360p', '720p', '1080p']
        if (!validFormat.includes(userFormat)) throw new Error(`Invalid format!. available formats: ${validFormat.join(', ')}`)
    },

    handleFormat: function (userFormat, searchJson) {
        this.validateFormat(userFormat)
        let result

        if (userFormat == 'mp3') {
            result = searchJson.links?.mp3?.mp3128?.k
        } else {
            // PENYEMPURNAAN: Cek apakah format MP4 tersedia
            if (!searchJson.links?.mp4) {
                throw new Error(`Format MP4 (${userFormat}) tidak tersedia untuk video ini.`)
            }
            
            let selectedFormat
            const allFormats = Object.entries(searchJson.links.mp4)

            const quality = allFormats.map(v => v[1].q)
                .filter(v => /\d+p/.test(v))
                .map(v => parseInt(v))
                .sort((a, b) => b - a)
                .map(v => v + 'p')

            if (!quality.includes(userFormat)) {
                selectedFormat = quality[0]
                console.log(`Format ${userFormat} tidak tersedia. Auto fallback ke best available yaitu ${selectedFormat}`)
            } else {
                selectedFormat = userFormat
            }
            
            const find = allFormats.find(v => v[1].q == selectedFormat)
            result = find?.[1]?.k
        }
        
        if (!result) throw new Error(`${userFormat} link kunci download tidak ditemukan.`)
        return result
    },

    hit: async function (path, payload) {
        try {
            const body = new URLSearchParams(payload)
            const opts = { headers: this.baseHeaders, body, 'method': 'post' }
            const r = await fetch(`${this.baseUrl.origin}${path}`, opts)
            console.log('hit', path)
            
            if (!r.ok) {
                // PENYEMPURNAAN: Melempar error dengan status dan teks respons
                const textError = await r.text()
                throw new Error(`${r.status} ${r.statusText}\n${textError}`)
            }
            
            const contentType = r.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // PENYEMPURNAAN: Jika respons bukan JSON, ini adalah penyebab error yang Anda lihat
                throw new Error(`Expected JSON but received ${contentType} from ${path}. Server may have changed its API or is sending HTML error page.`)
            }
            
            const j = await r.json()
            return j
        } catch (e) {
            // Melempar error yang lebih jelas
            throw new Error(`API Call Failed on ${path}: ${e.message}`)
        }
    },

    download: async function (queryOrYtUrl, userFormat = 'mp3') {
        this.validateFormat(userFormat)

        // first hit
        let search
        search = await this.hit('/api/ajax/search', {
            "query": queryOrYtUrl,
            "cf_token": "", // cf_token ini sering jadi masalah, mungkin perlu diekstrak
            "vt": "youtube"
        })

        if (search.p == 'search') {
            if (!search?.items?.length) throw new Error(`Hasil pencarian ${queryOrYtUrl} tidak ada`)
            const { v, t } = search.items[0]
            const videoUrl = 'https://www.youtube.com/watch?v=' + v
            console.log(`[found]\ntitle : ${t}\nurl   : ${videoUrl}`)

            // second hit: menggunakan URL video hasil pencarian
            search = await this.hit('/api/ajax/search', {
                "query": videoUrl,
                "cf_token": "",
                "vt": "youtube"
            })
        }

        const vid = search.vid
        const k = this.handleFormat(userFormat, search)

        // third hit: convert
        const convert = await this.hit('/api/ajax/convert', {
            k, vid
        })

        if (convert.c_status == 'CONVERTING') {
            let convert2
            const limit = 5
            let attempt = 0
            do {
                attempt++
                // fourth hit: check status
                console.log (`cek convert ${attempt}/${limit}`)
                convert2 = await this.hit('/api/convert/check?hl=en', {
                    vid,
                    b_id: convert.b_id
                })
                if (convert2.c_status == 'CONVERTED') {
                    return convert2
                }
                // Tunggu 5 detik sebelum cek lagi
                await new Promise(re => setTimeout(re, 5000)) 
            } while (attempt < limit && convert2.c_status == 'CONVERTING')
            
            throw new Error('Proses konversi gagal atau file belum siap dalam batas waktu yang ditentukan.')

        } else {
            return convert
        }
    },

}

module.exports = [
  {
    name: "Ytmp4",
    desc: "Download video youtube",
    category: "Downloader",
    path: "/download/ytmp4?apikey=&url=",
    async run(req, res) {
      try {
        // Asumsi `global.apikey` sudah didefinisikan di lingkungan Anda
        const { apikey, url } = req.query;
        if (!apikey || !global.apikey || !global.apikey.includes(apikey))
          return res.status(401).json({ status: false, error: "Apikey invalid" });
        if (!url)
          return res.status(400).json({ status: false, error: "Url is required" });

        // PERBAIKAN: Hapus argumen ketiga ("mp4") karena fungsi yt.download hanya menerima 2 argumen
        const videoQuality = req.query.quality || "360p"; // Opsional: ambil quality dari query
        const results = await yt.download(url, videoQuality) 
        
        // Cek apakah dlink tersedia sebelum merespons
        if (!results.dlink) {
             throw new Error("Link download (dlink) tidak ditemukan setelah konversi.")
        }
        
        res.status(200).json({
          status: true,
          result: results.dlink,
        });
      } catch (error) {
        // Kirim respons 500 dengan pesan error yang spesifik dari fungsi yt.download
        res.status(500).json({ status: false, error: error.message });
      }
    },
  },

  {
    name: "Ytmp3",
    desc: "Download audio youtube",
    category: "Downloader",
    path: "/download/ytmp3?apikey=&url=",
    async run(req, res) {
      try {
        const { apikey, url } = req.query;
        if (!apikey || !global.apikey || !global.apikey.includes(apikey))
          return res.status(401).json({ status: false, error: "Apikey invalid" });
        if (!url)
          return res.status(400).json({ status: false, error: "Url is required" });

        const results = await yt.download(url, "mp3")

        if (!results.dlink) {
             throw new Error("Link download (dlink) tidak ditemukan setelah konversi.")
        }
        
        res.status(200).json({
          status: true,
          result: results.dlink
        });
      } catch (error) {
        res.status(500).json({ status: false, error: error.message });
      }
    },
  }
];
