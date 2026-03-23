"use strict";

function withSandboxArgs(args = []) {
  const result = [...args];
  const isRootUser =
    typeof process.getuid === "function" && process.getuid() === 0;
  const forceNoSandbox = process.env.PUPPETEER_NO_SANDBOX === "true";

  if (isRootUser || forceNoSandbox) {
    if (!result.includes("--no-sandbox")) {
      result.push("--no-sandbox");
    }
    if (!result.includes("--disable-setuid-sandbox")) {
      result.push("--disable-setuid-sandbox");
    }
  }

  return result;
}

async function launchBrowser() {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    const chromium = require("@sparticuz/chromium");
    const puppeteerCore = require("puppeteer-core");

    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      args: withSandboxArgs(chromium.args),
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  const puppeteer = require("puppeteer");
  return puppeteer.launch({
    headless: "new",
    args: withSandboxArgs(),
  });
}

module.exports = {
  launchBrowser,
};

