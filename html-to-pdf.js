#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { launchBrowser } = require("./browser-launcher");

function printUsage() {
  console.log(`Usage:
  node html-to-pdf.js --input <file.html> --output <file.pdf> [options]
  node html-to-pdf.js --inputDir <html-directory> --outputDir <pdf-directory> [options]

Options:
  --format <value>              Page format (default: A4)
  --landscape <true|false>      Landscape mode (default: false)
  --printBackground <true|false> Print background graphics (default: true)
  --scale <0.1..2>              PDF scale (default: 1)
  --marginTop <css-unit>        Margin top (default: 10mm)
  --marginRight <css-unit>      Margin right (default: 10mm)
  --marginBottom <css-unit>     Margin bottom (default: 10mm)
  --marginLeft <css-unit>       Margin left (default: 10mm)
  --inputDir <path>             Convert all .html files in a directory
  --outputDir <path>            Output directory for batch mode
  --help                        Show this help message`);
}

function parseArgs(argv) {
  const args = {};

  if (argv.length === 0 || argv.includes("--help")) {
    return { help: true };
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    i += 1;
  }

  return args;
}

function parseBoolean(name, value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean for --${name}: ${value}. Use true or false.`);
}

function buildPdfOptions(rawArgs) {
  const scale = rawArgs.scale !== undefined ? Number(rawArgs.scale) : 1;
  if (Number.isNaN(scale) || scale < 0.1 || scale > 2) {
    throw new Error("--scale must be a number between 0.1 and 2.");
  }

  return {
    format: rawArgs.format || "A4",
    landscape: parseBoolean("landscape", rawArgs.landscape, false),
    printBackground: parseBoolean(
      "printBackground",
      rawArgs.printBackground,
      true
    ),
    scale,
    margin: {
      top: rawArgs.marginTop || "10mm",
      right: rawArgs.marginRight || "10mm",
      bottom: rawArgs.marginBottom || "10mm",
      left: rawArgs.marginLeft || "10mm",
    },
  };
}

function normalizeSingleMode(rawArgs, pdfOptions) {
  const input = rawArgs.input;
  const output = rawArgs.output;

  if (!input) throw new Error("--input is required in single-file mode.");
  if (!output) throw new Error("--output is required in single-file mode.");
  if (rawArgs.inputDir || rawArgs.outputDir) {
    throw new Error("Do not mix single-file args with batch args.");
  }

  const inputPath = path.resolve(input);
  const outputPath = path.resolve(output);

  if (!inputPath.toLowerCase().endsWith(".html")) {
    throw new Error("--input must be a local .html file.");
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }
  if (!outputPath.toLowerCase().endsWith(".pdf")) {
    throw new Error("--output must end with .pdf");
  }

  return {
    mode: "single",
    inputPath,
    outputPath,
    pdfOptions,
  };
}

function normalizeBatchMode(rawArgs, pdfOptions) {
  const inputDir = rawArgs.inputDir;
  const outputDir = rawArgs.outputDir;

  if (!inputDir) throw new Error("--inputDir is required in batch mode.");
  if (!outputDir) throw new Error("--outputDir is required in batch mode.");
  if (rawArgs.input || rawArgs.output) {
    throw new Error("Do not mix batch args with single-file args.");
  }

  const inputDirPath = path.resolve(inputDir);
  const outputDirPath = path.resolve(outputDir);

  if (!fs.existsSync(inputDirPath) || !fs.statSync(inputDirPath).isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputDirPath}`);
  }

  return {
    mode: "batch",
    inputDirPath,
    outputDirPath,
    pdfOptions,
  };
}

function normalizeOptions(rawArgs) {
  const pdfOptions = buildPdfOptions(rawArgs);
  if (rawArgs.inputDir || rawArgs.outputDir) {
    return normalizeBatchMode(rawArgs, pdfOptions);
  }
  return normalizeSingleMode(rawArgs, pdfOptions);
}

async function convertFile(browser, inputPath, outputPath, pdfOptions) {
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const page = await browser.newPage();
  try {
    const fileUrl = pathToFileURL(inputPath).toString();
    await page.goto(fileUrl, { waitUntil: "networkidle0" });
    await page.pdf({ path: outputPath, ...pdfOptions });
  } finally {
    await page.close();
  }
}

async function convertSingle(options) {
  const browser = await launchBrowser();
  try {
    await convertFile(
      browser,
      options.inputPath,
      options.outputPath,
      options.pdfOptions
    );
  } finally {
    await browser.close();
  }
}

function getBatchPairs(inputDirPath, outputDirPath) {
  const files = fs
    .readdirSync(inputDirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name);

  if (files.length === 0) {
    throw new Error(`No .html files found in: ${inputDirPath}`);
  }

  return files.map((fileName) => {
    const baseName = path.parse(fileName).name;
    return {
      inputPath: path.join(inputDirPath, fileName),
      outputPath: path.join(outputDirPath, `${baseName}.pdf`),
    };
  });
}

async function convertBatch(options) {
  fs.mkdirSync(options.outputDirPath, { recursive: true });
  const pairs = getBatchPairs(options.inputDirPath, options.outputDirPath);
  const browser = await launchBrowser();
  try {
    for (const pair of pairs) {
      await convertFile(
        browser,
        pair.inputPath,
        pair.outputPath,
        options.pdfOptions
      );
      console.log(`PDF created: ${pair.outputPath}`);
    }
  } finally {
    await browser.close();
  }
}

async function htmlBufferToPdfBuffer(browser, htmlBuffer, pdfOptions) {
  const page = await browser.newPage();
  try {
    await page.setContent(htmlBuffer.toString("utf8"), { waitUntil: "networkidle0" });
    return await page.pdf({ ...pdfOptions });
  } finally {
    await page.close();
  }
}

async function main() {
  try {
    const rawArgs = parseArgs(process.argv.slice(2));
    if (rawArgs.help) {
      printUsage();
      process.exit(0);
    }
    const options = normalizeOptions(rawArgs);
    if (options.mode === "batch") {
      await convertBatch(options);
    } else {
      await convertSingle(options);
      console.log(`PDF created: ${options.outputPath}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  normalizeOptions,
  buildPdfOptions,
  convertSingle,
  convertBatch,
  htmlBufferToPdfBuffer,
};
