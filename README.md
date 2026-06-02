<p align="center">
  <img src="screenshots/home.jpg" width="700">
</p>

<p align="center">
  Find the first archived version of any website.
</p>

# Aghazeh

<p align="center">
  <b>🌐 Language</b><br>
  🇬🇧 English | <a href="./README.fa.md">🇮🇷 فارسی</a>
</p>

A minimal web application for finding the earliest archived snapshot of a website using the Internet Archive (Wayback Machine).

Preview:
https://aghazeh.maskoot.ir

---

## Features

- Find the first archived version of any website
- Persian and English interface
- Responsive design
- Direct integration with Internet Archive CDX API
- Embedded preview inside the application
- No database required
- Runs entirely on Cloudflare Workers
- Lightweight and serverless

---

## How It Works

When a website address is entered:

1. The worker queries the Internet Archive CDX API.
2. The earliest available snapshot is retrieved.
3. Snapshot date is displayed.
4. The archived page is previewed inside the application.

---

## Technologies

- Cloudflare Workers
- JavaScript
- Internet Archive CDX API
- HTML/CSS

---

## Deployment

This project is designed to be deployed manually through the Cloudflare Workers dashboard.

### Create Worker

1. Login to Cloudflare Dashboard.
2. Navigate to:

Workers & Pages → Create Worker

3. Replace the default code with the contents of `worker.js`.
4. Save and Deploy.

### Custom Domain

Assign a custom domain or route from:

Workers & Pages → Triggers

Example:
aghazeh.example.com/*


---

## Free Resources Used

This project relies entirely on free public services:

### Internet Archive

https://archive.org

Used for retrieving historical website snapshots through the CDX API.

### Google Fonts

https://fonts.google.com

Used for loading the Vazirmatn font.

### Cloudflare Workers

https://workers.cloudflare.com

Used as the serverless execution platform.

---

## Limitations

Some archived websites may not render correctly because:

- Archived assets are missing.
- Modern browser security policies block embedding.
- Certain pages were not fully archived.

---

## Author

Radmehr

GitHub:
https://github.com/radmehr2025

---

## License

MIT License
