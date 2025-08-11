import express from 'express';
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
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

async function safeGoto(page, url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20000
      });
      return;
    } catch (err) {
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
    }
  }
}


async function blockExtraResources(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const blocked = ['image', 'stylesheet', 'font', 'media'];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
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
}

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
    await safeGoto(page, url);
    // await safeGoto(page, url);

    // await page.goto(url, { waitUntil: "domcontentloaded",timeout: 0  });
    // await page.goto(url, { waitUntil: 'networkidle2' });

    try {
    await page.waitForSelector('#productTitle', { timeout: 0 });
    } catch {
      console.log("Title not found in time, trying alternative selector...");
    }
    // await page.waitForSelector('#productTitle', { timeout: 10000 });
    // await page.waitForSelector('#productTitle');
    const result = await page.evaluate(() => {
      const getText = (sel) => document.querySelector(sel)?.innerText.trim() || null;
      const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || null;

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
      predictionText: "Prediction data not available yet.",
    };;
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function scrapeFlipkart(url) {
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
    await safeGoto(page, url);
    // await safeGoto(page, url);


    await page.waitForSelector('span.VU-ZEz', { timeout: 0 });
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
      predictionText: "Prediction data not available yet.",
    };;
  } catch (err) {
    if (browser) await browser.close();
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
  // console.log(url)
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
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Scraping server running on port ${PORT}`);
});
