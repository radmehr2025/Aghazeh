addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  const lang = url.searchParams.get('lang') || 'fa'

  if (path === '/' || path === '') {
    return new Response(getHomePage(lang), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  if (path === '/search') {
    const siteUrl = url.searchParams.get('url')
    if (!siteUrl) {
      return new Response(getErrorPage(lang, lang === 'fa' ? 'لطفاً آدرس وبسایت را وارد کنید' : 'Please enter a website address'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }
    return await searchFirstSnapshot(siteUrl, lang, url.origin)
  }

  if (path === '/proxy') {
    const targetUrl = url.searchParams.get('url')
    if (!targetUrl) {
      return new Response('Invalid proxy request', { status: 400 })
    }
    return proxyContent(targetUrl)
  }

  return Response.redirect(url.origin, 302)
}

async function proxyContent(targetUrl) {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    const contentType = response.headers.get('content-type') || ''
    let body = response.body

    if (contentType.includes('text/html')) {
      let html = await response.text()
      const baseUrl = new URL(targetUrl)
      
      html = html.replace(/(href|src)="\/\//g, '$1="https://')
      html = html.replace(/(href|src)="\//g, `$1="${baseUrl.origin}/`)
      html = html.replace(/(href|src)="(?!http|\/\/|data:|#)/g, `$1="${baseUrl.origin}/`)
      
      return new Response(html, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'ALLOWALL'
        }
      })
    }

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    return new Response('Proxy error', { status: 500 })
  }
}

async function searchFirstSnapshot(siteUrl, lang, origin) {
  try {
    let cleanUrl = siteUrl.trim().replace(/^https?:\/\//, '')
    cleanUrl = cleanUrl.replace(/\/.*$/, '')
    
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}&matchType=domain&limit=1&filter=statuscode:200&fl=timestamp,original`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(cdxUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error('Archive request failed')
    }

    const text = await response.text()
    
    if (!text || text.trim() === '') {
      return new Response(getErrorPage(lang, lang === 'fa' ? 'هیچ نسخه‌ای از این وبسایت در آرشیو یافت نشد' : 'No archived version found'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const lines = text.trim().split('\n')
    const parts = lines[0].split(' ')
    
    if (parts.length < 2) {
      throw new Error('Invalid response')
    }

    const timestamp = parts[0]
    const original = parts[1]
    const archiveUrl = `https://web.archive.org/web/${timestamp}/${original}`
    
    const date = parseTimestamp(timestamp)
    const displayDate = lang === 'fa' ? toJalali(date) : toGregorian(date)

    return new Response(getResultPage(archiveUrl, original, displayDate, lang, origin), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (error) {
    const errorMsg = lang === 'fa' 
      ? 'خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید'
      : 'Error fetching data. Please try again'
    
    return new Response(getErrorPage(lang, errorMsg), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}

function parseTimestamp(ts) {
  return new Date(
    ts.substring(0, 4),
    parseInt(ts.substring(4, 6)) - 1,
    ts.substring(6, 8),
    ts.substring(8, 10) || '00',
    ts.substring(10, 12) || '00',
    ts.substring(12, 14) || '00'
  )
}

function toJalali(date) {
  let gy = date.getFullYear()
  let gm = date.getMonth() + 1
  let gd = date.getDate()
  
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const jy = (gy <= 1600) ? 0 : 979
  gy -= (gy <= 1600) ? 621 : 1600
  
  const gy2 = (gm > 2) ? (gy + 1) : gy
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + 
             (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1]
  
  let jy_final = jy + 33 * Math.floor(days / 12053)
  days %= 12053
  jy_final += 4 * Math.floor(days / 1461)
  days %= 1461
  
  if (days > 365) {
    jy_final += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30))
  
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
  
  return `${jd} ${months[jm - 1]} ${jy_final}`
}

function toGregorian(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function getHomePage(lang) {
  const isFa = lang === 'fa'
  
  return `<!DOCTYPE html>
<html lang="${isFa ? 'fa' : 'en'}" dir="${isFa ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isFa ? 'آغازه - جستجوگر اولین نسخه وبسایت‌ها' : 'Aghazeh - First Snapshot Finder'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Vazirmatn',sans-serif;background:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:520px;width:100%}
.lang-switch{text-align:${isFa ? 'left' : 'right'};margin-bottom:40px}
.lang-switch a{color:#666;text-decoration:none;font-size:13px;font-weight:400;transition:.3s}
.lang-switch a:hover{color:#000}
.header{text-align:center;margin-bottom:50px}
h1{font-size:42px;color:#000;font-weight:600;margin-bottom:8px;letter-spacing:-1px}
.slogan{font-size:15px;color:#666;font-weight:300}
.form input{width:100%;padding:16px 20px;border:1px solid #ddd;border-radius:8px;font-size:15px;font-family:'Vazirmatn',sans-serif;transition:.3s;direction:ltr;text-align:${isFa ? 'right' : 'left'};background:#fafafa}
.form input:focus{outline:none;border-color:#000;background:#fff}
.form button{width:100%;padding:16px;background:#000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;font-family:'Vazirmatn',sans-serif;transition:.3s}
.form button:hover{background:#333}
.form button:active{transform:scale(.98)}
.footer{text-align:center;margin-top:60px}
.footer a{display:inline-flex;align-items:center;gap:8px;color:#666;text-decoration:none;font-size:13px;transition:.3s}
.footer a:hover{color:#000}
.footer svg{width:18px;height:18px;fill:currentColor}
@media(max-width:600px){
h1{font-size:32px}
.header{margin-bottom:40px}
}
</style>
</head>
<body>
<div class="container">
<div class="lang-switch">
<a href="?lang=${isFa ? 'en' : 'fa'}">${isFa ? 'English' : 'فارسی'}</a>
</div>
<div class="header">
<h1>${isFa ? 'آغازه' : 'Aghazeh'}</h1>
<p class="slogan">${isFa ? 'جستجوگر اولین نسخه وبسایت‌ها' : 'First Snapshot Finder'}</p>
</div>
<form class="form" action="/search" method="GET">
<input type="hidden" name="lang" value="${lang}">
<input type="text" name="url" placeholder="${isFa ? 'آدرس وبسایت (مثال: google.com)' : 'Website address (e.g., google.com)'}" required autocomplete="off">
<button type="submit">${isFa ? 'جستجو' : 'Search'}</button>
</form>
<div class="footer">
<a href="https://github.com/radmehr2025" target="_blank">
<svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
${isFa ? 'گیت‌هاب' : 'GitHub'}
</a>
</div>
</div>
</body>
</html>`
}

function getResultPage(archiveUrl, originalUrl, displayDate, lang, origin) {
  const isFa = lang === 'fa'
  const proxyUrl = `${origin}/proxy?url=${encodeURIComponent(archiveUrl)}`
  
  return `<!DOCTYPE html>
<html lang="${isFa ? 'fa' : 'en'}" dir="${isFa ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isFa ? 'نتیجه جستجو - آغازه' : 'Search Result - Aghazeh'}</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Vazirmatn',sans-serif;background:#fff;min-height:100vh}
.topbar{background:#fff;padding:16px 24px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.logo-section{display:flex;flex-direction:column}
.logo-title{font-size:20px;font-weight:600;color:#000;letter-spacing:-.5px}
.logo-sub{font-size:11px;color:#666;font-weight:300;margin-top:2px}
.actions{display:flex;gap:8px}
.btn{padding:9px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;transition:.3s;border:none;cursor:pointer;font-family:'Vazirmatn',sans-serif}
.btn-primary{background:#000;color:#fff}
.btn-primary:hover{background:#333}
.btn-secondary{background:#f5f5f5;color:#000}
.btn-secondary:hover{background:#eee}
.info{background:#fafafa;margin:24px;padding:16px 20px;border-radius:8px;border:1px solid #eee;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:14px}
.info-item{display:flex;align-items:center;gap:6px}
.info-label{color:#666;font-weight:400}
.info-value{color:#000;font-weight:500}
.info-sep{color:#ddd;font-weight:300}
.frame-wrap{margin:24px;background:#fff;border-radius:8px;border:1px solid #eee;overflow:hidden;height:calc(100vh - 200px);min-height:500px;position:relative}
iframe{width:100%;height:100%;border:none;display:none}
.loading{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#666;font-size:14px}
.spinner{width:32px;height:32px;border:2px solid #eee;border-top-color:#000;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:12px}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){
.topbar{flex-direction:column;align-items:stretch}
.actions{justify-content:center}
.info{margin:16px;padding:14px 16px;flex-direction:column;align-items:flex-start;gap:8px}
.info-sep{display:none}
.frame-wrap{margin:16px;height:calc(100vh - 280px)}
}
</style>
</head>
<body>
<div class="topbar">
<div class="logo-section">
<div class="logo-title">${isFa ? 'آغازه' : 'Aghazeh'}</div>
<div class="logo-sub">${isFa ? 'جستجوگر اولین نسخه وبسایت‌ها' : 'First Snapshot Finder'}</div>
</div>
<div class="actions">
<a href="/?lang=${lang}" class="btn btn-secondary">${isFa ? 'جستجوی مجدد' : 'New Search'}</a>
<a href="${archiveUrl}" target="_blank" class="btn btn-primary">${isFa ? 'Web Archive' : 'Web Archive'}</a>
</div>
</div>
<div class="info">
<div class="info-item">
<span class="info-label">${isFa ? 'وبسایت:' : 'Website:'}</span>
<span class="info-value">${originalUrl}</span>
</div>
<span class="info-sep">|</span>
<div class="info-item">
<span class="info-label">${isFa ? 'تاریخ:' : 'Date:'}</span>
<span class="info-value">${displayDate}</span>
</div>
</div>
<div class="frame-wrap">
<div class="loading" id="load">
<div style="text-align:center">
<div class="spinner"></div>
<div>${isFa ? 'در حال بارگذاری...' : 'Loading...'}</div>
</div>
</div>
<iframe src="${proxyUrl}" onload="document.getElementById('load').remove();this.style.display='block'"></iframe>
</div>
</body>
</html>`
}

function getErrorPage(lang, message) {
  const isFa = lang === 'fa'
  
  return `<!DOCTYPE html>
<html lang="${isFa ? 'fa' : 'en'}" dir="${isFa ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isFa ? 'خطا - آغازه' : 'Error - Aghazeh'}</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Vazirmatn',sans-serif;background:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:450px;width:100%;text-align:center}
h1{font-size:24px;color:#000;margin-bottom:12px;font-weight:600}
.message{color:#666;font-size:15px;margin-bottom:30px;line-height:1.6}
.btn{display:inline-block;padding:12px 28px;background:#000;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;transition:.3s}
.btn:hover{background:#333}
.lang{margin-top:20px;font-size:13px}
.lang a{color:#666;text-decoration:none}
.lang a:hover{color:#000}
</style>
</head>
<body>
<div class="container">
<h1>${isFa ? 'خطا' : 'Error'}</h1>
<div class="message">${message}</div>
<a href="/?lang=${lang}" class="btn">${isFa ? 'بازگشت به صفحه اصلی' : 'Back to Home'}</a>
<div class="lang">
<a href="?lang=${isFa ? 'en' : 'fa'}">${isFa ? 'English' : 'فارسی'}</a>
</div>
</div>
</body>
</html>`
}