import express from 'express';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

const app = express();
const PORT = process.env.PORT || 4000;

async function scrapeAmazon(url) {
  let browser;
  try {
    const executablePath = await chromium.executablePath;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#productTitle');
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
    await browser.close();
    return result;
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function scrapeFlipkart(url) {
  let browser;
  try {
    const executablePath = await chromium.executablePath;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('span.VU-ZEz');
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
    await browser.close();
    return result;
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

app.get('/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });

  try {
    let data;
    if (url.includes('amazon')) {
      data = await scrapeAmazon(url);
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
