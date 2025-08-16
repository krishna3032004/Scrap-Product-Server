import express from 'express';
import chromium from "@sparticuz/chromium";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';

// import vanillaPuppeteer from "puppeteer"; // to get correct executablePath


puppeteerExtra.use(StealthPlugin());
// import puppeteer from 'puppeteer';


const app = express();
const PORT = process.env.PORT || 4000;
// const PORT = process.env.PORT || 4000;

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteerExtra.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(), // Render par yeh hi chalega
      headless: chromium.headless, // Render par hamesha headless rakho
    });
  }
  return browser;
}

// async function getBrowser() {
//   if (!browser) {
//     browser = await puppeteerExtra.launch({
//       args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
//       defaultViewport: chromium.defaultViewport,
//       executablePath: await chromium.executablePath(),
//       // headless: false,
//       headless: chromium.headless,
//     });
//   }
//   return browser;
// }

async function safeGoto(page, url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        // waitUntil: "domcontentloaded",
        timeout: 30000
      });
      return;
    } catch (err) {
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      // await new Promise(r => setTimeout(r, 3000));
    }
  }
}
async function safeGotoforamazon(page, url, retries = 3) {
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

async function blockExtraResourcesflipkart(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const blocked = ['stylesheet', 'font', 'media'];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else { req.continue(); }
  });
}

async function blockExtraResources(page) {
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
async function scrapeFlipkartyy(url) {
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      executablePath: vanillaPuppeteer.executablePath(), // use bundled chromium path
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

    // Try internal JSON first
    let data = await page.evaluate(() => {
      try {
        const jsonText = document.querySelector("#__NEXT_DATA__")?.textContent;
        if (jsonText) {
          const jsonData = JSON.parse(jsonText);
          const productInfo =
            jsonData?.props?.pageProps?.pageData?.productInfo?.value || {};
          const title = productInfo?.title;
          const price =
            productInfo?.pricing?.price?.finalPrice ||
            productInfo?.priceInfo?.finalPrice;
          const image = productInfo?.media?.images?.[0]?.url;
          if (title && price && image) {
            return { title, price: `₹${price}`, image };
          }
        }
      } catch { }
      return null;
    });

    // Fallback to DOM scraping
    if (!data) {
      data = await page.evaluate(() => {
        const title =
          document.querySelector("span.B_NuCI")?.innerText?.trim() ||
          document.querySelector("span.VU-ZEz")?.innerText?.trim();

        const price =
          document.querySelector("div._30jeq3._16Jk6d")?.innerText?.trim() ||
          document.querySelector("div.Nx9bqj.CxhGGd")?.innerText?.trim();

        const image =
          document.querySelector("img._396cs4._2amPTt._3qGmMb")?.src ||
          document.querySelector("img.DByuf4")?.src;

        return { title, price, image };
      });
    }

    if (!data?.title || !data?.price || !data?.image) {
      throw new Error("Could not extract product details");
    }

    return data;
  } catch (err) {
    throw new Error("Flipkart scraping failed: " + err.message);
  }
}



async function scrapeFlipkarts(url) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });

    console.log("Navigating to Flipkart page...");
    await safeGoto(page, url);
    // await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    // await page.waitForTimeout(5000); // wait for JS load
    console.log("safegoto ho gya");
    // Close any login/location popup
    try {
      await page.waitForSelector('button._2KpZ6l._2doB4z', { timeout: 5000 });
      await page.click('button._2KpZ6l._2doB4z');
      console.log("Closed popup");
    } catch { /* popup not found */
      console.log("popup not found")
    }


    // await page.evaluate(() => window.scrollBy(0, 500));
    // await new Promise(r => setTimeout(r, 5000));

    // const result = await page.evaluate(() => {
    //   const title = document.querySelector("span.VU-ZEz")?.innerText || null;
    //   const image = document.querySelector("img.DByuf4")?.src || null;
    //   const priceText = document.querySelector("div.Nx9bqj")?.innerText || "";
    //   const price = parseInt(priceText.replace(/[^\d]/g, "")) || null;
    //   return { title, image, price };
    // });
    console.log("wait for function")
    await page.waitForFunction(() => {
      return document.querySelector("span.VU-ZEz") ||
        document.querySelector("span.B_NuCI") ||
        document.querySelector("h1");
    }, { timeout: 40000 });
    console.log("wait for function ho gya")
    // await page.waitForSelector("span.VU-ZEz", { timeout: 60000 });
    let result = await page.evaluate(() => {
      const title =
        document.querySelector("span.VU-ZEz")?.innerText ||
        document.querySelector("span.B_NuCI")?.innerText ||
        document.querySelector("h1 span")?.innerText ||
        document.querySelector("meta[property='og:title']")?.content ||
        null;
      // let title = document.querySelector("span.VU-ZEz")?.innerText || null;
      const image =
        document.querySelector("img.DByuf4")?.src ||
        document.querySelector("img._396cs4")?.src ||
        document.querySelector("meta[property='og:image']")?.content ||
        null;
      // let image = document.querySelector("img.DByuf4")?.src || null;
      let priceText =
        document.querySelector("div.Nx9bqj")?.innerText ||
        document.querySelector("div._30jeq3")?.innerText ||
        "";
      const price = parseInt(priceText.replace(/[^\d]/g, "")) || null;
      // let priceText = document.querySelector("div.Nx9bqj")?.innerText || "";
      // let price = parseInt(priceText.replace(/[^\d]/g, "")) || null;
      return { title, image, price };
    });

    if (!result || !result.title) throw new Error("Product data not found");

    await page.close();
    return {
      title: result.title,
      image: result.image,
      currentPrice: result.price,
      time: new Date().toLocaleString("en-IN"),
      platform: "flipkart",
      productLink: url,
    };
  } catch (err) {
    if (page) await page.close();
    throw err;
  }
}




async function scrapeFlipkart(url) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await blockExtraResourcesflipkart(page);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8'
    });
    // await page.setUserAgent(
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    // );
    await page.setViewport({ width: 1366, height: 768 });




    // const page = await getPage();
    console.log("safegoto pai ja rha")
    await safeGoto(page, url);
    console.log("safegoto ho gya")
    // const im =await page.screenshot({ path: "debug.png"});
    console.log("Screenshot captured: debug.png");
    // console.log(im)

    // await new Promise(r => setTimeout(r, 5000));
    // // Optional: scroll a bit to avoid lazy-loading
    // await page.evaluate(() => window.scrollBy(0, 500));


    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(r => setTimeout(r, 1500));

    await page.waitForSelector('span.VU-ZEz', { timeout: 20000 });
    // await safeGoto(page, url);
    // Wait for Next.js data script
    // console.log("waitforselector pai ja rahe")
    // Try to extract JSON from __NEXT_DATA__ (Next.js embedded data)
    // Try extracting title from common places
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

    await page.close();

    // return null;
    return {
      title: result.title,
      image: result.image,
      currentPrice: result.price,
      mrp: result.mrp,
      lowest: result.price,
      highest: result.price,
      average: result.price,
      discount: result.discount,
      rating: 4, time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),

      platform: "flipkart", productLink: url,
      amazonLink: "",
      priceHistory: [{ price: result.price, date: new Date().toLocaleDateString('en-CA') },],

      predictionText: "Prediction data not available yet.",
    };
  } catch (err) {
    if (page) await page.close();
    throw err;
  }
}

app.get('/scrape', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ error: "No URL provided" });
  }

  const url = rawUrl; // ye encoding hata dega
  if (url.includes('%2F')) { // agar encoded hai toh decode kar
    url = decodeURIComponent(url);
  }
  // const url = decodeURIComponent(rawUrl); // ye encoding hata dega
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
