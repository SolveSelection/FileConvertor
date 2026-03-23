"use strict";

const form = document.getElementById("convertForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#475569";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fileInput = document.getElementById("htmlFiles");
  if (!fileInput.files || fileInput.files.length === 0) {
    setStatus("Select at least one HTML file.", true);
    return;
  }

  const formData = new FormData();
  for (const file of fileInput.files) {
    formData.append("htmlFiles", file);
  }

  const format = document.getElementById("format").value;
  const scale = document.getElementById("scale").value;
  const landscape = document.getElementById("landscape").checked;
  const printBackground = document.getElementById("printBackground").checked;

  formData.append("format", format);
  formData.append("scale", scale);
  formData.append("landscape", String(landscape));
  formData.append("printBackground", String(printBackground));

  submitBtn.disabled = true;
  setStatus("Converting files...", false);

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Conversion failed.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "converted-pdfs.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    setStatus("Done. Download started.", false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});
