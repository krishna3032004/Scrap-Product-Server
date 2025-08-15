import express from 'express';
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';


puppeteerExtra.use(StealthPlugin());
// import puppeteer from 'puppeteer';


const app = express();
const PORT = process.env.PORT || 4000;
// const PORT = process.env.PORT || 4000;

// async function getBrowser() {
//   // if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.RENDER) {
//   //   console.log("ha abh btao chl rha kya")
//   //   // Production (serverless)
//   //   return puppeteer.launch({
//   //     args: chromium.args,
//   //     defaultViewport: chromium.defaultViewport,
//   //     executablePath: await chromium.executablePath,
//   //     headless: chromium.headless,
//   //   });
//   if (process.env.RENDER) {
//     // Use full puppeteer with its bundled Chromium
//     const puppeteerFull = await import('puppeteer');
//     return puppeteerFull.default.launch({ headless: true, args: ['--no-sandbox'] });
//   } else {
//     // Local development
//     // console.log(url)
//     const puppeteerLocal = await import('puppeteer');
//     return puppeteerLocal.default.launch({ headless: true });
//   }
// }


// async function getBrowser() {
//   return await puppeteer.launch({
//     args: chromium.args,
//     defaultViewport: chromium.defaultViewport,
//     executablePath: await chromium.executablePath(), // ✅ Chrome ka correct path
//     headless: chromium.headless, // ✅ Lambda-safe headless
//   });
// }

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteerExtra.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  return browser;
}

// async function getBrowser() {
//   if (!browser) {
//     browser = await puppeteer.launch({
//       args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
//       defaultViewport: chromium.defaultViewport,
//       executablePath: await chromium.executablePath(),
//       headless: chromium.headless,
//     });
//   }
//   return browser;
// }

// Retry helper
// async function safeGoto(page, url, retries = 3) {
//   for (let i = 0; i < retries; i++) {
//     try {
//       page.setDefaultNavigationTimeout(0);
//       page.setDefaultTimeout(0);
//       await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
//       return;
//     } catch (err) {
//       console.log(`Retry ${i + 1} failed: ${err.message}`);
//       if (i === retries - 1) throw err;
//     }
//   }
// }

async function safeGoto(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        // waitUntil: "domcontentloaded",
        timeout: 60000
      });
      return;
    } catch (err) {
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
async function safeGotoforamazon(page, url, retries = 3) {
  // for (let i = 0; i < retries; i++) {
  //   try {
  //     await page.goto(url, {
  //       waitUntil: "networkidle0", // jyada stable hota hai
  //       timeout: 60000 // timeout double kar diya
  //     });
  //     return;
  //   } catch (err) {
  //     console.log(`Retry ${i + 1} failed: ${err.message}`);
  //     if (i === retries - 1) throw err;
  //   }
  // }
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });
      return;
    } catch (err) {
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 3000)); // wait before next try
    }
  }
}


// Block only extra stuff, but keep product API & images
async function blockExtraResources(page) {
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    const url = req.url();

    const blockedTypes = ['stylesheet','font','media','websocket','manifest'];
    const blockedDomains = ['google-analytics.com','adsense','doubleclick.net','amazon-adsystem.com'];

    if (type === 'xhr' || type === 'fetch') {
      return req.continue();
    }

    if (blockedTypes.includes(type) || blockedDomains.some(d => url.includes(d))) {
      return req.abort();
    }

    req.continue();
  });
}

async function blockExtraResourceaaas(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    const url = req.url();

    const blockedTypes = ["stylesheet", "font", "media", "websocket", "manifest"];
    const blockedDomains = [
      "google-analytics.com",
      "adsense",
      "doubleclick.net",
      "amazon-adsystem.com"
      // ❌ flipkart.net is removed, otherwise API/images break
    ];

    // Never block product API requests
    if (type === "xhr" || type === "fetch") {
      return req.continue();
    }

    if (blockedTypes.includes(type) || blockedDomains.some(d => url.includes(d))) {
      return req.abort();
    }

    req.continue();
  });
}


// async function blockExtraResources(page) {
//   await page.setRequestInterception(true);
//   page.on("request", (req) => {
//     const blocked = [
//       "stylesheet",
//       "font",
//       "media",
//       "websocket",
//       "manifest"
//     ];
//     const blockedDomains = [
//       "google-analytics.com",
//       "adsense",
//       "doubleclick.net",
//       "amazon-adsystem.com",
//       "flipkart.net"
//     ];

//     if (
//       blocked.includes(req.resourceType()) ||
//       blockedDomains.some(domain => req.url().includes(domain))
//     ) {
//       req.abort();
//     } else {
//       req.continue();
//     }
//   });
  // page.on('request', (req) => {
  //   const blocked = ['image', 'stylesheet', 'font', 'media'];
  //   if (blocked.includes(req.resourceType())) {
  //     req.abort();
  //   } else {
  //     req.continue();
  //   }
  // });





  // const blockedDomains = [
  //   'googletagmanager.com', 'google-analytics.com', 'doubleclick.net',
  //   'ads.yahoo.com', 'bat.bing.com', 'amazon-adsystem.com'
  // ];

  // await page.setRequestInterception(true);
  // page.on('request', req => {
  //   const url = req.url().toLowerCase();
  //   if (
  //     ['image', 'stylesheet', 'font', 'media', 'other'].includes(req.resourceType()) ||
  //     blockedDomains.some(domain => url.includes(domain))
  //   ) {
  //     req.abort();
  //   } else {
  //     req.continue();
  //   }
  // });
// }

// let page;

// async function getPage() {
//   if (!browser) browser = await getBrowser();
//   if (!page || page.isClosed()) {
//     page = await browser.newPage();
//     await blockExtraResources(page);
//     await page.setUserAgent(
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
//     );
//     await page.setViewport({ width: 1366, height: 768 });
//   }
//   return page;
// }


async function scrapeAmazon(url) {
  let browser;
  try {


    browser = await getBrowser();
    console.log(url)
    const page = await browser.newPage();

    await blockExtraResources(page);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });



    // const page = await getPage();
    await safeGotoforamazon(page, url);
    // await safeGoto(page, url);

    // await page.goto(url, { waitUntil: "domcontentloaded",timeout: 0  });
    // await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Check if captcha/bot block
    const pageContent = await page.content();
    if (pageContent.includes("Type the characters you see in this image")) {
      throw new Error("Amazon captcha triggered. Scraper blocked.");
    }

    try {
      // await page.waitForSelector('#productTitle', { timeout: 0 });
      await page.waitForFunction(() => {
        return document.querySelector('#productTitle') ||
          document.querySelector('#titleSection') ||
          document.querySelector('h1');
      }, { timeout: 30000 });
    } catch {
      console.log("Title not found in time, trying alternative selector...");
    }


    // await page.waitForSelector('#productTitle', { timeout: 10000 });
    // await page.waitForSelector('#productTitle');
    const result = await page.evaluate(() => {
      const getText = (selector) => document.querySelector(selector)?.innerText.trim() || null;
      const getAttr = (selector, attr) => document.querySelector(selector)?.getAttribute(attr) || null;

      const title = getText('#productTitle');

      const priceWhole = getText('.a-price-whole')?.replace(/[^\d]/g, '');
      const currentPrice = priceWhole ? parseInt(priceWhole) : null;

      const mrpText = document.querySelector('.a-text-price .a-offscreen')?.innerText || '';
      const mrp = mrpText ? parseInt(mrpText.replace(/[^\d]/g, '')) : null;

      const discountText = getText('.savingsPercentage');
      const discountMatch = discountText?.match(/\d+/);
      const discount = discountMatch ? parseInt(discountMatch[0]) : null;

      const image = getAttr('#landingImage', 'src');

      return { title, currentPrice, mrp, discount, image };
    });

    // await browser.close();
    await page.close();
    return {
      title: result.title,
      image: result.image,
      currentPrice: result.currentPrice,
      mrp: result.mrp,
      lowest: result.currentPrice,
      highest: result.currentPrice,
      average: result.currentPrice,
      discount: result.discount,
      rating: 4,
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      platform: "amazon",
      productLink: url,
      amazonLink: url,
      priceHistory: [
        { price: result.currentPrice, date: new Date().toLocaleDateString('en-CA') },
      ],
      predictionText: "Prediction data not available yet.",
    };
    // return {
    //   title: result.title,
    //   image: result.image,
    //   currentPrice: result.price,
    //   mrp: result.mrp,
    //   lowest: result.price,
    //   highest: result.price,
    //   average: result.price,
    //   discount: result.discount,
    //   rating: 4,
    //   time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    //   platform: "flipkart",
    //   productLink: url,
    //   amazonLink: "",
    //   priceHistory: [
    //     { price: result.price, date: new Date().toLocaleDateString('en-CA') },
    //   ],
    //   predictionText: "Prediction data not available yet.",
    // };;
  } catch (err) {
    if (browser) await page.close();
    throw err;
  }
}
async function scrapeFlipkart(url) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // ⚠️ Flipkart pe interception disable rakho
    try {
      await page.setRequestInterception(false);
      page.removeAllListeners('request');
    } catch {}

    await page.setJavaScriptEnabled(true);
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-IN,en;q=0.9',
      'referer': 'https://www.google.com/'
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1366, height: 768 });

    // ====== 1) API response listener (BEFORE navigation) ======
    let apiInfo = null;
    const apiMatcher = (u) =>
      u.includes('/api/3/page/dynamic/') ||               // primary
      (u.includes('/api/3/page/') && u.includes('PRODUCT')); // broader

    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (!apiMatcher(u)) return;
        if (res.request().method() !== 'GET') return;
        if (res.status() !== 200) return;

        const ct = res.headers()['content-type'] || '';
        if (!ct.includes('application/json')) return;

        const json = await res.json();
        // Deep find product info anywhere in JSON
        const info = deepFindProductInfo(json);
        if (info && !apiInfo) apiInfo = info; // take first hit
      } catch {}
    });

    console.log('Navigating to Flipkart product page…');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // quick anti-bot detection
    const html = await page.content();
    if (/captcha|unusual traffic|are you a human|enable javascript/i.test(html)) {
      throw new Error('Flipkart blocked the request (captcha/anti-bot).');
    }

    console.log('Page loaded, checking for API / JSON…');

    // Thoda time do API ko (agar fire hua ho)
    await page.waitForTimeout(3000);

    let productData = null;

    // Prefer API info if captured
    if (apiInfo) {
      productData = normalizeInfo(apiInfo);
    }

    // ====== 2) __NEXT_DATA__ / LD-JSON fallback ======
    if (!productData) {
      // Try window.__NEXT_DATA__ or <script id="__NEXT_DATA__">
      const nextJson = await page.evaluate(() => {
        const byId = document.getElementById('__NEXT_DATA__');
        if (byId?.textContent) return byId.textContent;
        if (window.__NEXT_DATA__) return JSON.stringify(window.__NEXT_DATA__);
        return null;
      });

      if (nextJson) {
        try {
          const json = JSON.parse(nextJson);
          const info = deepFindProductInfo(json);
          if (info) productData = normalizeInfo(info);
        } catch {}
      }
    }

    // Also scan any LD+JSON scripts
    if (!productData) {
      const ldJsonCandidates = await page.$$eval(
        'script[type="application/ld+json"]',
        els => els.map(e => e.textContent).filter(Boolean)
      );
      for (const txt of ldJsonCandidates) {
        try {
          const obj = JSON.parse(txt);
          const arr = Array.isArray(obj) ? obj : [obj];
          for (const it of arr) {
            if (it['@type'] === 'Product') {
              productData = {
                title: it.name || null,
                image: Array.isArray(it.image) ? it.image?.[0] : it.image || null,
                currentPrice: it.offers?.price ? parseInt(String(it.offers.price).replace(/[^\d]/g,''),10) : null,
                mrp: null,
                discount: null,
                rating: it.aggregateRating?.ratingValue ? parseFloat(it.aggregateRating.ratingValue) : null
              };
              break;
            }
          }
          if (productData) break;
        } catch {}
      }
    }

    // ====== 3) DOM fallback (wide selectors) ======
    if (!productData) {
      console.log('  DOM fallback…');
      productData = await page.evaluate(() => {
        const pickText = (sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.innerText?.trim()) return el.innerText.trim();
          }
          return null;
        };
        const pickSrc = (sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.src) return el.src;
          }
          return null;
        };
        const nums = (t) => {
          if (!t) return null;
          const n = t.replace(/[^\d]/g,'');
          return n ? parseInt(n,10) : null;
        };

        const title = pickText([
          'span.VU-ZEz',
          'span.B_NuCI',
          'h1._6EBuvT',
          'h1',
          'div.C7fEHH',
          '[data-testid="product-title"]',
          'h1[title]'
        ]);

        const priceText = pickText([
          'div.Nx9bqj',
          'div._30jeq3',
          'div._16Jk6d',
          '[data-testid="product-price"]'
        ]);

        const mrpText = pickText([
          'div.yRaY8j',
          'div._3I9_wc',
          '[data-testid="product-mrp"]'
        ]);

        const discountText = pickText([
          'div.UkUFwK span',
          'div._3Ay6Sb span'
        ]);

        const ratingText = pickText([
          'div._3LWZlK',
          '[itemprop="ratingValue"]'
        ]);

        const image = pickSrc([
          'img.DByuf4',
          'img._396cs4',
          'img[loading][src]',
          'img'
        ]);

        const price = nums(priceText);
        const mrp   = nums(mrpText);
        const disc  = discountText ? (discountText.match(/\d+/)?.[0] ? parseInt(discountText.match(/\d+/)[0],10) : null) : null;
        const rating= ratingText ? parseFloat(ratingText.replace(/[^\d.]/g,'')) : null;

        return { title, image, currentPrice: price, mrp, discount: disc, rating };
      });

      // If still no title, try a mobile UA + mobile URL fallback once
      if (!productData?.title) {
        // Mobile fallback
        const toMobile = (u) => {
          try {
            const urlObj = new URL(u);
            urlObj.hostname = 'm.flipkart.com';
            return urlObj.toString();
          } catch { return u; }
        };

        await page.setUserAgent(
          'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        );

        const mUrl = toMobile(url);
        console.log('  Mobile fallback…');
        await page.goto(mUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        const mobileData = await page.evaluate(() => {
          const pickText = (sels) => {
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.innerText?.trim()) return el.innerText.trim();
            }
            return null;
          };
          const pickSrc = (sels) => {
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.src) return el.src;
            }
            return null;
          };
          const nums = (t) => {
            if (!t) return null;
            const n = t.replace(/[^\d]/g,'');
            return n ? parseInt(n,10) : null;
          };

          const title = pickText(['h1','span[title]','[data-testid="product-title"]']);
          const priceText = pickText(['div.Nx9bqj','div._30jeq3','[data-testid="product-price"]']);
          const mrpText   = pickText(['div.yRaY8j','div._3I9_wc','[data-testid="product-mrp"]']);
          const discText  = pickText(['div.UkUFwK span','div._3Ay6Sb span']);
          const image     = pickSrc(['img[loading][src]','img']);

          return {
            title,
            image,
            currentPrice: nums(priceText),
            mrp: nums(mrpText),
            discount: discText ? (discText.match(/\d+/)?.[0] ? parseInt(discText.match(/\d+/)[0],10) : null) : null,
            rating: null
          };
        });

        if (mobileData?.title) productData = mobileData;
      }
    }

    if (!productData || !productData.title) {
      throw new Error('Flipkart product data not found');
    }

    await page.close();

    // normalize output format
    const cur = productData.currentPrice ?? null;
    return {
      title: productData.title || null,
      image: productData.image || null,
      currentPrice: cur,
      mrp: productData.mrp ?? null,
      lowest: cur,
      highest: cur,
      average: cur,
      discount: productData.discount ?? null,
      rating: productData.rating ?? null,
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      platform: 'flipkart',
      productLink: url,
      amazonLink: '',
      priceHistory: [{ price: cur, date: new Date().toLocaleDateString('en-CA') }],
      predictionText: 'Prediction data not available yet.'
    };

  } catch (err) {
    console.error('scrapeFlipkart error:', err.message);
    if (page && !page.isClosed()) { try { await page.close(); } catch {} }
    throw err;
  }
}

// ---------- helpers ----------
function normalizeInfo(info) {
  const num = (v) => (v==null ? null : parseInt(String(v).replace(/[^\d]/g,''),10) || null);
  return {
    title: info?.title ?? null,
    image: info?.media?.images?.[0]?.url ?? null,
    currentPrice: num(info?.pricing?.finalPrice?.value),
    mrp: num(info?.pricing?.strikeOffPrice?.value),
    discount: info?.pricing?.discountPercentage != null ? parseInt(info.pricing.discountPercentage,10) : null,
    rating: info?.rating?.average != null ? parseFloat(info.rating.average) : null
  };
}

function deepFindProductInfo(root) {
  const seen = new WeakSet();
  const isObj = (x) => x && typeof x === 'object';
  function walk(node) {async function scrapeFlipkart(url) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // ⚠️ Flipkart pe interception disable rakho
    try {
      await page.setRequestInterception(false);
      page.removeAllListeners('request');
    } catch {}

    await page.setJavaScriptEnabled(true);
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-IN,en;q=0.9',
      'referer': 'https://www.google.com/'
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1366, height: 768 });

    // ====== 1) API response listener (BEFORE navigation) ======
    let apiInfo = null;
    const apiMatcher = (u) =>
      u.includes('/api/3/page/dynamic/') ||               // primary
      (u.includes('/api/3/page/') && u.includes('PRODUCT')); // broader

    page.on('response', async (res) => {
      try {
        const u = res.url();
        if (!apiMatcher(u)) return;
        if (res.request().method() !== 'GET') return;
        if (res.status() !== 200) return;

        const ct = res.headers()['content-type'] || '';
        if (!ct.includes('application/json')) return;

        const json = await res.json();
        // Deep find product info anywhere in JSON
        const info = deepFindProductInfo(json);
        if (info && !apiInfo) apiInfo = info; // take first hit
      } catch {}
    });

    console.log('Navigating to Flipkart product page…');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // quick anti-bot detection
    const html = await page.content();
    if (/captcha|unusual traffic|are you a human|enable javascript/i.test(html)) {
      throw new Error('Flipkart blocked the request (captcha/anti-bot).');
    }

    console.log('Page loaded, checking for API / JSON…');

    // Thoda time do API ko (agar fire hua ho)
    await page.waitForTimeout(3000);

    let productData = null;

    // Prefer API info if captured
    if (apiInfo) {
      productData = normalizeInfo(apiInfo);
    }

    // ====== 2) __NEXT_DATA__ / LD-JSON fallback ======
    if (!productData) {
      // Try window.__NEXT_DATA__ or <script id="__NEXT_DATA__">
      const nextJson = await page.evaluate(() => {
        const byId = document.getElementById('__NEXT_DATA__');
        if (byId?.textContent) return byId.textContent;
        if (window.__NEXT_DATA__) return JSON.stringify(window.__NEXT_DATA__);
        return null;
      });

      if (nextJson) {
        try {
          const json = JSON.parse(nextJson);
          const info = deepFindProductInfo(json);
          if (info) productData = normalizeInfo(info);
        } catch {}
      }
    }

    // Also scan any LD+JSON scripts
    if (!productData) {
      const ldJsonCandidates = await page.$$eval(
        'script[type="application/ld+json"]',
        els => els.map(e => e.textContent).filter(Boolean)
      );
      for (const txt of ldJsonCandidates) {
        try {
          const obj = JSON.parse(txt);
          const arr = Array.isArray(obj) ? obj : [obj];
          for (const it of arr) {
            if (it['@type'] === 'Product') {
              productData = {
                title: it.name || null,
                image: Array.isArray(it.image) ? it.image?.[0] : it.image || null,
                currentPrice: it.offers?.price ? parseInt(String(it.offers.price).replace(/[^\d]/g,''),10) : null,
                mrp: null,
                discount: null,
                rating: it.aggregateRating?.ratingValue ? parseFloat(it.aggregateRating.ratingValue) : null
              };
              break;
            }
          }
          if (productData) break;
        } catch {}
      }
    }

    // ====== 3) DOM fallback (wide selectors) ======
    if (!productData) {
      console.log('  DOM fallback…');
      productData = await page.evaluate(() => {
        const pickText = (sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.innerText?.trim()) return el.innerText.trim();
          }
          return null;
        };
        const pickSrc = (sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.src) return el.src;
          }
          return null;
        };
        const nums = (t) => {
          if (!t) return null;
          const n = t.replace(/[^\d]/g,'');
          return n ? parseInt(n,10) : null;
        };

        const title = pickText([
          'span.VU-ZEz',
          'span.B_NuCI',
          'h1._6EBuvT',
          'h1',
          'div.C7fEHH',
          '[data-testid="product-title"]',
          'h1[title]'
        ]);

        const priceText = pickText([
          'div.Nx9bqj',
          'div._30jeq3',
          'div._16Jk6d',
          '[data-testid="product-price"]'
        ]);

        const mrpText = pickText([
          'div.yRaY8j',
          'div._3I9_wc',
          '[data-testid="product-mrp"]'
        ]);

        const discountText = pickText([
          'div.UkUFwK span',
          'div._3Ay6Sb span'
        ]);

        const ratingText = pickText([
          'div._3LWZlK',
          '[itemprop="ratingValue"]'
        ]);

        const image = pickSrc([
          'img.DByuf4',
          'img._396cs4',
          'img[loading][src]',
          'img'
        ]);

        const price = nums(priceText);
        const mrp   = nums(mrpText);
        const disc  = discountText ? (discountText.match(/\d+/)?.[0] ? parseInt(discountText.match(/\d+/)[0],10) : null) : null;
        const rating= ratingText ? parseFloat(ratingText.replace(/[^\d.]/g,'')) : null;

        return { title, image, currentPrice: price, mrp, discount: disc, rating };
      });

      // If still no title, try a mobile UA + mobile URL fallback once
      if (!productData?.title) {
        // Mobile fallback
        const toMobile = (u) => {
          try {
            const urlObj = new URL(u);
            urlObj.hostname = 'm.flipkart.com';
            return urlObj.toString();
          } catch { return u; }
        };

        await page.setUserAgent(
          'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        );

        const mUrl = toMobile(url);
        console.log('  Mobile fallback…');
        await page.goto(mUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        const mobileData = await page.evaluate(() => {
          const pickText = (sels) => {
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.innerText?.trim()) return el.innerText.trim();
            }
            return null;
          };
          const pickSrc = (sels) => {
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.src) return el.src;
            }
            return null;
          };
          const nums = (t) => {
            if (!t) return null;
            const n = t.replace(/[^\d]/g,'');
            return n ? parseInt(n,10) : null;
          };

          const title = pickText(['h1','span[title]','[data-testid="product-title"]']);
          const priceText = pickText(['div.Nx9bqj','div._30jeq3','[data-testid="product-price"]']);
          const mrpText   = pickText(['div.yRaY8j','div._3I9_wc','[data-testid="product-mrp"]']);
          const discText  = pickText(['div.UkUFwK span','div._3Ay6Sb span']);
          const image     = pickSrc(['img[loading][src]','img']);

          return {
            title,
            image,
            currentPrice: nums(priceText),
            mrp: nums(mrpText),
            discount: discText ? (discText.match(/\d+/)?.[0] ? parseInt(discText.match(/\d+/)[0],10) : null) : null,
            rating: null
          };
        });

        if (mobileData?.title) productData = mobileData;
      }
    }

    if (!productData || !productData.title) {
      throw new Error('Flipkart product data not found');
    }

    await page.close();

    // normalize output format
    const cur = productData.currentPrice ?? null;
    return {
      title: productData.title || null,
      image: productData.image || null,
      currentPrice: cur,
      mrp: productData.mrp ?? null,
      lowest: cur,
      highest: cur,
      average: cur,
      discount: productData.discount ?? null,
      rating: productData.rating ?? null,
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      platform: 'flipkart',
      productLink: url,
      amazonLink: '',
      priceHistory: [{ price: cur, date: new Date().toLocaleDateString('en-CA') }],
      predictionText: 'Prediction data not available yet.'
    };

  } catch (err) {
    console.error('scrapeFlipkart error:', err.message);
    if (page && !page.isClosed()) { try { await page.close(); } catch {} }
    throw err;
  }
}

// ---------- helpers ----------
function normalizeInfo(info) {
  const num = (v) => (v==null ? null : parseInt(String(v).replace(/[^\d]/g,''),10) || null);
  return {
    title: info?.title ?? null,
    image: info?.media?.images?.[0]?.url ?? null,
    currentPrice: num(info?.pricing?.finalPrice?.value),
    mrp: num(info?.pricing?.strikeOffPrice?.value),
    discount: info?.pricing?.discountPercentage != null ? parseInt(info.pricing.discountPercentage,10) : null,
    rating: info?.rating?.average != null ? parseFloat(info.rating.average) : null
  };
}

function deepFindProductInfo(root) {
  const seen = new WeakSet();
  const isObj = (x) => x && typeof x === 'object';
  function walk(node) {
    if (!isObj(node) || seen.has(node)) return null;
    seen.add(node);

    // Direct known shapes
    if (node.productInfo?.value) return node.productInfo.value;
    if (node.title && node.pricing && node.media) return node;

    for (const k in node) {
      const v = node[k];
      if (isObj(v)) {
        const hit = walk(v);
        if (hit) return hit;
      } else if (Array.isArray(v)) {
        for (const it of v) {
          const hit = walk(it);
          if (hit) return hit;
        }
      }
    }
    return null;
  }
  return walk(root);
}

    if (!isObj(node) || seen.has(node)) return null;
    seen.add(node);

    // Direct known shapes
    if (node.productInfo?.value) return node.productInfo.value;
    if (node.title && node.pricing && node.media) return node;

    for (const k in node) {
      const v = node[k];
      if (isObj(v)) {
        const hit = walk(v);
        if (hit) return hit;
      } else if (Array.isArray(v)) {
        for (const it of v) {
          const hit = walk(it);
          if (hit) return hit;
        }
      }
    }
    return null;
  }
  return walk(root);
}



async function scrapeFlipkartaaaa(url) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await blockExtraResources(page);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });



    // const page = await getPage();
    console.log("safegoto pai ja rha")
    await safeGoto(page, url);
    console.log("safegoto ho gya")
    await new Promise(r => setTimeout(r, 2000));

    // await safeGoto(page, url);
    // Wait for Next.js data script
    console.log("waitforselector pai ja rahe")
    
    //  let productData = null;

    // // Listen for product API response
    // page.on("response", async (response) => {
    //   try {
    //     const reqUrl = response.url();
    //     if (reqUrl.includes("/api/3/page/dynamic/product")) {
    //       const json = await response.json();
    //       const info = json?.RESPONSE?.data?.productInfo?.value;
    //       if (info) {
    //         console.log("✅ Product API data found");
    //         productData = {
    //           title: info?.title || null,
    //           image: info?.media?.images?.[0]?.url || null,
    //           currentPrice: parseInt(info?.pricing?.finalPrice?.value) || null,
    //           mrp: parseInt(info?.pricing?.strikeOffPrice?.value) || null,
    //           discount: info?.pricing?.discountPercentage || null,
    //           rating: info?.rating?.average || null
    //         };
    //       }
    //     }
    //   } catch (e) {
    //     console.log("API parse error:", e.message);
    //   }
    // });

    // await safeGoto(page, url);
    // console.log("safegoto done");

    // // Wait a bit for API intercept
    // await page.waitForTimeout(5000);

    // // DOM fallback if API fails
    // if (!productData) {
    //   console.log("⚠️ API not found, falling back to DOM scrape...");
    //   await page.waitForSelector('span.VU-ZEz', { timeout: 15000 }).catch(() => {});
    //   productData = {
    //     title: await page.$eval('span.VU-ZEz', el => el.innerText.trim()).catch(() => null),
    //     image: await page.$eval('img.DByuf4', el => el.src).catch(() => null),
    //     mrp: await page.$eval('div.yRaY8j', el => parseInt(el.innerText.replace(/[^\d]/g, ''))).catch(() => null),
    //     currentPrice: await page.$eval('div.Nx9bqj', el => parseInt(el.innerText.replace(/[^\d]/g, ''))).catch(() => null),
    //     discount: await page.$eval("div[class*='UkUFwK'] span", el => {
    //       const match = el.innerText.match(/\d+/);
    //       return match ? parseInt(match[0]) : null;
    //     }).catch(() => null),
    //     rating: null
    //   };
    // }

    // await page.close();

    // if (!productData || !productData.title) throw new Error("Flipkart product data not found");

    // return {
    //   ...productData,
    //   lowest: productData.currentPrice,
    //   highest: productData.currentPrice,
    //   average: productData.currentPrice,
    //   time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    //   platform: "flipkart",
    //   productLink: url,
    //   amazonLink: "",
    //   priceHistory: [
    //     { price: productData.currentPrice, date: new Date().toLocaleDateString('en-CA') },
    //   ],
    //   predictionText: "Prediction data not available yet.",
    // };

    try {
      console.log("waitforselector pai ja rahe")
      await page.waitForSelector('span.VU-ZEz, div.Nx9bqj', { timeout: 60000 });
      console.log("waitForSelector completed: title or price found");
      // Wait for either title or embedded JSON
      // Wait until title or price loads
      // Wait for the Next.js JSON script
      // await page.waitForSelector('script#__NEXT_DATA__', { timeout: 45000 });
      // await page.waitForFunction(() => {
      //   return document.querySelector('span.VU-ZEz') ||
      //     document.querySelector('h1._6EBuvT') ||
      //     document.querySelector('h1 span') ||
      //     document.querySelector('#__NEXT_DATA__');
      // }, { timeout: 45000 });
      // await page.waitForFunction(() => {
      //   return (
      //     document.querySelector("h1 span") ||
      //     document.querySelector("div.Nx9bqj") ||
      //     document.querySelector("script#__NEXT_DATA__")
      //   );
      // }, { timeout: 45000 });
      // await page.waitForSelector('#productTitle', { timeout: 0 });
      //   await page.waitForFunction(() => {
      //     return document.querySelector('span.VU-ZEz') ||
      //       document.querySelector('h1._6EBuvT') ||
      //       document.querySelector('.C7fEHH');
      //   }, { timeout: 40000 });
      console.log("waitforselector ho gya")
    } catch {
      console.log("Title not found in time, trying alternative selector...");
    }

    // await page.goto(url, { waitUntil: 'networkidle2' });
    // await page.waitForSelector('span.VU-ZEz');
    const result = await page.evaluate(() => {
      const title = document.querySelector('span.VU-ZEz')?.innerText.trim() || null;
      const image = document.querySelector('img.DByuf4')?.src || null;
      const mrpText = document.querySelector('div.yRaY8j')?.innerText || '';
      const mrp = parseInt(mrpText.replace(/[^\d]/g, '')) || null;
      const priceText = document.querySelector('div.Nx9bqj')?.innerText || '';
      const price = parseInt(priceText.replace(/[^\d]/g, '')) || null;
      const discountText = document.querySelector("div[class*='UkUFwK'] span")?.innerText || '';
      const discountMatch = discountText.match(/\d+/);
      const discount = discountMatch ? parseInt(discountMatch[0]) : null;
      return { title, image, mrp, price, discount };
    });
    // await browser.close();
    // console.log(result)
    await page.close();
    return {
      title: result.title,
      image: result.image,
      currentPrice: result.price,
      mrp: result.mrp,
      lowest: result.price,
      highest: result.price,
      average: result.price,
      discount: result.discount,
      rating: 4,
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      platform: "flipkart",
      productLink: url,
      amazonLink: "",
      priceHistory: [
        { price: result.price, date: new Date().toLocaleDateString('en-CA') },
      ],
      predictionText: "Prediction dat00a not available yet.",
    };;
  } catch (err) {
    if (browser) await page.close();
    throw err;
  }
}

app.get('/scrape', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  const url = decodeURIComponent(rawUrl); // ye encoding hata dega
  // console.log("Scraping URL:", decodedUrl);   


  // const { url } = req.query;
  console.log(url)
  // if (!url) return res.status(400).json({ error: 'url query param required' });

  try {
    let data;
    if (url.includes('amazon')) {
      data = await scrapeAmazon(url);
      console.log(data)
    } else if (url.includes('flipkart')) {
      data = await scrapeFlipkart(url);
    } else {
      return res.status(400).json({ error: 'Only Amazon and Flipkart supported' });
    }
    console.log(data)
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.use(express.json());
app.post('/api/scrape-prices', async (req, res) => {
  const { urls } = req.body;
  console.log("run huakya")

  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: "URLs array is required" });
  }

  const results = [];
  let browser;
  // let page;

  try {
    browser = await getBrowser();

    // browser = await puppeteer.launch({
    //   headless: true,
    //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // });


    for (const item of urls) {
      const url = item.productLink;
      try {

        const page = await browser.newPage();
        // await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        if (!url) {
          results.push({ url: null, price: null });
          continue;
        }
        let price = null;

        if (url.includes("amazon")) {
          console.log(url)
          await safeGotoforamazon(page, url)
          price = await page
            .$eval(
              ".a-price-whole",
              el => el.innerText
            )
            .catch(() => null);
          console.log(price)
        } else if (url.includes("flipkart")) {
          console.log(url)
          await safeGoto(page, url)
          price = await page
            .$eval(".Nx9bqj", el => el.innerText)
            .catch(() => null);
          console.log(price)
        }

        if (price) {
          price = parseInt(price.replace(/[₹,]/g, ""));
        }

        results.push({ url, price: price || null });

        await page.close();
      } catch (err) {
        console.error(`Error scraping ${url}:`, err);
        results.push({ url, price: null });
      }
    }
    console.log(results)

    // await page.close();
    res.json({ results });
  } catch (err) {
    console.error("Scraping error:", err);
    res.status(500).json({ error: "Failed to scrape URLs" });

    // if (browser) await page.close();
  }
});

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => {
//   console.log(`Scraping server running on port ${PORT}`);
// });

app.listen(PORT, () => {
  console.log(`Scraping server running on port ${PORT}`);
});
