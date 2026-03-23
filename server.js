"use strict";

const path = require("path");
const express = require("express");
const multer = require("multer");
const JSZip = require("jszip");
const { launchBrowser } = require("./browser-launcher");
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

function buildArchiveName(htmlFiles) {
  const firstBaseName = path.parse(htmlFiles[0].originalname).name;
  const words = firstBaseName.trim().split(/\s+/).filter(Boolean);
  const normalizedBase = words.length > 2 ? words.slice(0, 2).join(" ") : firstBaseName;
  const safeBase = normalizedBase.replace(/[\\/:*?"<>|]/g, "-").trim() || "converted-pdfs";
  return `${safeBase}.zip`;
}

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

    const browser = await launchBrowser();
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
      const archiveName = buildArchiveName(htmlFiles);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${archiveName}"`
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
