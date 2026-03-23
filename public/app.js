"use strict";

const form = document.getElementById("convertForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const addFilesBtn = document.getElementById("addFilesBtn");
const removeFilesBtn = document.getElementById("removeFilesBtn");
const filePicker = document.getElementById("htmlFilesPicker");
const fileListEl = document.getElementById("fileList");
const emptyStateEl = document.getElementById("emptyState");

const selectedFiles = new Map();

function fileKey(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateFileControls() {
  const hasFiles = selectedFiles.size > 0;
  emptyStateEl.style.display = hasFiles ? "none" : "block";
  removeFilesBtn.disabled = !hasFiles;
}

function renderFiles() {
  fileListEl.innerHTML = "";

  for (const [key, file] of selectedFiles.entries()) {
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "file-check";
    checkbox.value = key;
    checkbox.setAttribute("aria-label", `Select ${file.name}`);

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;

    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = formatSize(file.size);

    li.appendChild(checkbox);
    li.appendChild(name);
    li.appendChild(meta);
    fileListEl.appendChild(li);
  }

  updateFileControls();
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#475569";
}

addFilesBtn.addEventListener("click", () => {
  filePicker.click();
});

filePicker.addEventListener("change", () => {
  const files = Array.from(filePicker.files || []);
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".html")) {
      continue;
    }
    selectedFiles.set(fileKey(file), file);
  }

  filePicker.value = "";
  renderFiles();
  setStatus("", false);
});

removeFilesBtn.addEventListener("click", () => {
  const checked = fileListEl.querySelectorAll(".file-check:checked");
  for (const item of checked) {
    selectedFiles.delete(item.value);
  }
  renderFiles();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (selectedFiles.size === 0) {
    setStatus("Select at least one HTML file.", true);
    return;
  }

  const formData = new FormData();
  for (const file of selectedFiles.values()) {
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

    const disposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    anchor.download = filenameMatch ? filenameMatch[1] : "converted-pdfs.zip";

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
