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

    console.log("Navigating to product page...");
    await safeGoto(page, url);
    console.log("Page loaded, waiting for API data...");

    let productData = null;

    // API capture using waitForResponse
    try {
      const apiResponse = await page.waitForResponse(
        res => res.url().includes("/api/3/page/dynamic/product") && res.status() === 200,
        { timeout: 5000 }
      );
      const json = await apiResponse.json();
      const info = json?.RESPONSE?.data?.productInfo?.value;
      if (info) {
        productData = {
          title: info?.title || null,
          image: info?.media?.images?.[0]?.url || null,
          currentPrice: parseInt(info?.pricing?.finalPrice?.value) || null,
          mrp: parseInt(info?.pricing?.strikeOffPrice?.value) || null,
          discount: info?.pricing?.discountPercentage || null,
          rating: info?.rating?.average || null
        };
      }
    } catch {
      console.log("API not found, falling back to DOM scraping...");
    }

    // Fallback DOM scraping
    if (!productData) {
      await page.waitForSelector('span.VU-ZEz, span.B_NuCI', { timeout: 10000 }).catch(() => {});

      productData = {
        title: await page.$eval('span.VU-ZEz, span.B_NuCI', el => el.innerText.trim()).catch(() => null),
        image: await page.$eval('img.DByuf4, img._396cs4', el => el.src).catch(() => null),
        mrp: await page.$eval('div.yRaY8j, div._3I9_wc', el => parseInt(el.innerText.replace(/[^\d]/g, ''))).catch(() => null),
        currentPrice: await page.$eval('div.Nx9bqj, div._30jeq3', el => parseInt(el.innerText.replace(/[^\d]/g, ''))).catch(() => null),
        discount: await page.$eval("div[class*='UkUFwK'] span, div._3Ay6Sb span", el => {
          const match = el.innerText.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        }).catch(() => null),
        rating: await page.$eval("div._3LWZlK", el => parseFloat(el.innerText)).catch(() => null)
      };
    }

    await page.close();

    if (!productData || !productData.title) {
      throw new Error("Flipkart product data not found");
    }

    return {
      ...productData,
      lowest: productData.currentPrice,
      highest: productData.currentPrice,
      average: productData.currentPrice,
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      platform: "flipkart",
      productLink: url,
      amazonLink: "",
      priceHistory: [
        { price: productData.currentPrice, date: new Date().toLocaleDateString('en-CA') },
      ],
      predictionText: "Prediction data not available yet.",
    };

  } catch (error) {
    console.error("scrapeFlipkart error:", error.message);
    throw error;
  } 
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
