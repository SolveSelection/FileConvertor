# HTML to PDF Converter Specification

## 1. Purpose
Build a toolset that converts HTML to PDF with consistent print settings:
- CLI for single and batch conversion from local files.
- Simple web UI for uploading multiple HTML files and downloading PDFs.

## 2. Scope
In scope:
- Convert one local HTML file to one PDF file.
- Batch convert many local `.html` files from a directory to matching `.pdf` files.
- Web UI for uploading multiple HTML files and downloading converted PDFs as ZIP.
- Support common print options (page size, margins, orientation, scale, background graphics).
- Fail with clear error messages when input is invalid.

Out of scope:
- Remote URL fetching.
- Authenticated pages.
- Rich desktop UI frameworks.

## 3. Users
Developers and automation scripts that need deterministic HTML-to-PDF output.

## 4. Functional Requirements
1. The tool must run from CLI:
   - `node html-to-pdf.js --input <htmlFile> --output <pdfFile> [options]`
   - `node html-to-pdf.js --inputDir <htmlDir> --outputDir <pdfDir> [options]`
2. In single mode:
   - `--input` is required and must point to an existing local `.html` file.
   - `--output` is required and must end with `.pdf`.
3. In batch mode:
   - `--inputDir` and `--outputDir` are required.
   - Tool must convert all `.html` files in `inputDir` (non-recursive).
   - Each output file must keep the same base name with `.pdf` extension.
     - `1.html` -> `1.pdf`, `2.html` -> `2.pdf`, etc.
4. Optional flags:
   - `--format` (`A4`, `Letter`, etc.), default `A4`
   - `--landscape` (`true|false`), default `false`
   - `--printBackground` (`true|false`), default `true`
   - `--scale` (0.1 to 2), default `1`
   - `--marginTop`, `--marginRight`, `--marginBottom`, `--marginLeft` (CSS units), default `10mm`
5. The converter must wait for page readiness before rendering (`networkidle` equivalent).
6. The tool must create parent directories for output if they do not exist.
7. On success, exit code must be `0` and print output path(s).
8. On failure, exit code must be non-zero and print a concise error.
9. The tool must expose a simple web UI:
   - `npm start` starts an HTTP server.
   - UI allows selecting multiple `.html` files and basic options.
   - UI posts files to backend, backend converts each file.
   - Backend returns a ZIP file containing converted PDFs.

## 5. Non-Functional Requirements
- Runtime: should complete typical single-page conversion in under 10 seconds on a modern machine.
- Reliability: deterministic output for same HTML and options.
- Portability: must run on Windows/macOS/Linux with Node.js 18+.

## 6. Technical Design
- Language: Node.js.
- Renderer:
  - Local/dev: `puppeteer`.
  - Vercel/serverless: `puppeteer-core` + `@sparticuz/chromium`.
  - Shared launcher abstraction in `browser-launcher.js` chooses runtime automatically via `VERCEL` env.
- Implementation files:
  - `browser-launcher.js` (runtime-aware Chromium launcher)
  - `html-to-pdf.js` (CLI + reusable conversion logic)
  - `server.js` (web server + upload endpoint)
  - `public/index.html`, `public/styles.css`, `public/app.js` (UI)
  - `package.json` (dependencies + scripts)

## 6.1 Vercel Deployment Notes
- For Vercel runtime, launch options must use Chromium values from `@sparticuz/chromium`:
  - `executablePath`
  - `args`
  - `headless`
  - `defaultViewport`
- Browser launch must use `puppeteer-core` in Vercel runtime and avoid relying on bundled desktop Chrome.
- Local runtime should continue to use standard `puppeteer` for easiest development setup.

## 7. CLI Contract
Single-file example:
`node html-to-pdf.js --input ./sample.html --output ./dist/sample.pdf --format A4 --printBackground true`

Batch example:
`node html-to-pdf.js --inputDir ./html --outputDir ./pdf --format A4`

Expected behavior:
- Loads `sample.html` via `file://` URL.
- Generates `dist/sample.pdf`.
- Prints success message:
  - `PDF created: <absolute-output-path>`

Batch expected behavior:
- Loads each `*.html` from input directory.
- Generates corresponding `*.pdf` in output directory.
- Prints one success line per generated file.

Web UI expected behavior:
- User opens `http://localhost:3000`.
- Uploads multiple `.html` files.
- Clicks convert.
- Browser downloads `converted-pdfs.zip` with matching PDF names.

## 8. Validation Rules
- Missing required arg -> error.
- Nonexistent input -> error.
- Nonexistent input directory -> error.
- Wrong output extension -> error.
- Invalid scale (outside 0.1..2) -> error.
- Invalid boolean values -> error.
- Empty batch input directory -> error.

## 9. Future Enhancements
- Header/footer templates.
- Read options from JSON config.
- Remote URL support.
- Recursive batch mode.
