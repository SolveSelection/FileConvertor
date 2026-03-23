"use strict";

const path = require("path");
const express = require("express");
const multer = require("multer");
const JSZip = require("jszip");
const puppeteer = require("puppeteer");
const { buildPdfOptions, htmlBufferToPdfBuffer } = require("./html-to-pdf");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 100,
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/convert", upload.array("htmlFiles", 100), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const htmlFiles = files.filter((file) =>
      file.originalname.toLowerCase().endsWith(".html")
    );
    if (htmlFiles.length === 0) {
      return res
        .status(400)
        .json({ error: "Upload at least one .html file." });
    }

    const pdfOptions = buildPdfOptions({
      format: req.body.format,
      landscape: req.body.landscape,
      printBackground: req.body.printBackground,
      scale: req.body.scale,
      marginTop: req.body.marginTop,
      marginRight: req.body.marginRight,
      marginBottom: req.body.marginBottom,
      marginLeft: req.body.marginLeft,
    });

    const browser = await puppeteer.launch({ headless: "new" });
    try {
      const zip = new JSZip();
      for (const file of htmlFiles) {
        const baseName = path.parse(file.originalname).name;
        const pdfBuffer = await htmlBufferToPdfBuffer(
          browser,
          file.buffer,
          pdfOptions
        );
        zip.file(`${baseName}.pdf`, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="converted-pdfs.zip"'
      );
      return res.send(zipBuffer);
    } finally {
      await browser.close();
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`UI available at http://localhost:${port}`);
});
