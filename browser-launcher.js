"use strict";

async function launchBrowser() {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    const chromium = require("@sparticuz/chromium");
    const puppeteerCore = require("puppeteer-core");

    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  const puppeteer = require("puppeteer");
  return puppeteer.launch({ headless: "new" });
}

module.exports = {
  launchBrowser,
};

