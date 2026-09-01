const NS = "http://www.w3.org/2000/svg";

const stage = document.querySelector("#stage");
const gooLayer = document.querySelector("#gooLayer");
const selectionLayer = document.querySelector("#selectionLayer");
const stageBackground = document.querySelector("#stageBackground");
const blurRange = document.querySelector("#blurRange");
const edgeRange = document.querySelector("#edgeRange");
const scaleRange = document.querySelector("#scaleRange");
const fillColor = document.querySelector("#fillColor");
const fillHex = document.querySelector("#fillHex");
const backgroundColor = document.querySelector("#backgroundColor");
const backgroundHex = document.querySelector("#backgroundHex");
const transparentToggle = document.querySelector("#transparentToggle");
const emptyState = document.querySelector("#emptyState");
const objectCount = document.querySelector("#objectCount");
const deleteButton = document.querySelector("#deleteButton");
const duplicateButton = document.querySelector("#duplicateButton");
const toast = document.querySelector("#toast");
const fontSelect = document.querySelector("#fontSelect");
const fontSizeInput = document.querySelector("#fontSizeInput");
const fontWeightSelect = document.querySelector("#fontWeightSelect");
const fontStyleSelect = document.querySelector("#fontStyleSelect");
const kerningRange = document.querySelector("#kerningRange");
const wordSpacingRange = document.querySelector("#wordSpacingRange");

const SYSTEM_FONTS = {
  "system-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "arial-black": '"Arial Black", Arial, sans-serif',
  "avenir-next": '"Avenir Next", Avenir, sans-serif',
  "helvetica-neue": '"Helvetica Neue", Helvetica, Arial, sans-serif',
  futura: 'Futura, "Trebuchet MS", sans-serif',
  "gill-sans": '"Gill Sans", "Gill Sans MT", sans-serif',
  optima: 'Optima, Candara, sans-serif',
  didot: 'Didot, "Bodoni 72", serif',
  baskerville: 'Baskerville, "Times New Roman", serif',
  georgia: 'Georgia, serif',
  "times-new-roman": '"Times New Roman", Times, serif',
  "american-typewriter": '"American Typewriter", "Courier New", serif',
  "courier-new": '"Courier New", Courier, monospace',
  copperplate: 'Copperplate, "Copperplate Gothic Light", fantasy'
};

const textMeasureContext = document.createElement("canvas").getContext("2d");

let selected = null;
let drag = null;
let nextId = 1;
let toastTimer;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function makeObject(content, x, y, options = {}) {
  const wrapper = svgElement("g", {
    "data-id": String(nextId++),
    "data-x": String(x),
    "data-y": String(y),
    "data-scale": String(options.scale ?? 1),
    "data-rotation": String(options.rotation ?? 0),
    tabindex: "0",
    role: "button",
    "aria-label": options.label || "Canvas piece"
  });
  wrapper.append(content);
  updateTransform(wrapper);
  gooLayer.append(wrapper);
  selectObject(wrapper);
  updateUiState();
  return wrapper;
}

function updateTransform(element) {
  const x = Number(element.dataset.x || 0);
  const y = Number(element.dataset.y || 0);
  const scale = Number(element.dataset.scale || 1);
  const rotation = Number(element.dataset.rotation || 0);
  element.setAttribute("transform", `translate(${x} ${y}) rotate(${rotation}) scale(${scale})`);
}

function createLetter(letter, styles) {
  const text = svgElement("text", {
    x: "0",
    y: "0",
    fill: "#000",
    "font-size": String(styles.fontSize),
    "font-weight": String(styles.fontWeight),
    "font-style": styles.fontStyle,
    "font-family": styles.fontFamily,
    "text-anchor": styles.textAnchor || "start",
    "dominant-baseline": "central"
  });
  text.textContent = letter;
  return text;
}

function addLetter(letter, x, y, rotation = 0) {
  const text = createLetter(letter, {
    fontSize: 250,
    fontWeight: 900,
    fontStyle: "normal",
    fontFamily: SYSTEM_FONTS["arial-black"],
    textAnchor: "middle"
  });
  return makeObject(text, x, y, { rotation, label: `Letter ${letter}` });
}

function loadPreset() {
  gooLayer.replaceChildren();
  selected = null;
  nextId = 1;
  const letters = [
    ["C", 290, 380, -2],
    ["I", 450, 380, -7],
    ["R", 600, 380, 2],
    ["C", 790, 380, -2],
    ["A", 965, 380, 3]
  ];
  letters.forEach(([letter, x, y, rotation]) => addLetter(letter, x, y, rotation));
  selectObject(null);
  updateUiState();
}

function graphemes(value) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(value)].map(({ segment }) => segment);
  }
  return Array.from(value);
}

function selectedTextStyles() {
  return {
    fontFamily: SYSTEM_FONTS[fontSelect.value] || SYSTEM_FONTS["system-sans"],
    fontSize: Math.min(320, Math.max(40, Number(fontSizeInput.value) || 170)),
    fontWeight: Number(fontWeightSelect.value),
    fontStyle: fontStyleSelect.value === "italic" ? "italic" : "normal",
    kerning: Number(kerningRange.value),
    wordSpacing: Number(wordSpacingRange.value)
  };
}

function measureTextRun(value, styles) {
  const segments = graphemes(value);
  const widths = new Map();
  textMeasureContext.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize}px ${styles.fontFamily}`;
  textMeasureContext.fontKerning = "normal";

  const measure = (text) => {
    if (!widths.has(text)) widths.set(text, textMeasureContext.measureText(text).width);
    return widths.get(text);
  };

  const placements = [];
  let cursor = 0;
  let previous = null;

  segments.forEach((letter, index) => {
    if (previous !== null) {
      const naturalPairKerning = measure(previous + letter) - measure(previous) - measure(letter);
      cursor += naturalPairKerning + styles.kerning;
    }

    if (/\s/u.test(letter)) {
      cursor += measure(letter) + styles.wordSpacing;
    } else {
      placements.push({ letter, x: cursor, index });
      cursor += measure(letter);
    }
    previous = letter;
  });

  return { placements, width: cursor };
}

function addText() {
  const value = document.querySelector("#textInput").value.trim().replace(/\s+/gu, " ");
  if (!value) return;

  const styles = selectedTextStyles();
  const run = measureTextRun(value, styles);
  const startX = 600 - run.width / 2;
  let lastLetter = null;

  run.placements.forEach(({ letter, x, index }) => {
    const text = createLetter(letter, styles);
    lastLetter = makeObject(text, startX + x, 380, {
      label: `Letter ${letter}, character ${index + 1} of ${graphemes(value).length}`
    });
  });

  if (lastLetter) selectObject(lastLetter);
  showToast(`${run.placements.length} ${run.placements.length === 1 ? "letter" : "letters"} added separately`);
}

function addCircle() {
  const circle = svgElement("circle", { cx: "0", cy: "0", r: "85", fill: "#000" });
  makeObject(circle, 600, 380, { label: "Circle" });
}

function addSquare() {
  const rect = svgElement("rect", { x: "-85", y: "-85", width: "170", height: "170", rx: "26", fill: "#000" });
  makeObject(rect, 600, 380, { rotation: -6, label: "Block" });
}

function selectObject(element) {
  selected = element && gooLayer.contains(element) ? element : null;
  scaleRange.disabled = !selected;
  deleteButton.disabled = !selected;
  duplicateButton.disabled = !selected;
  if (selected) {
    scaleRange.value = Math.round(Number(selected.dataset.scale || 1) * 100);
    document.querySelector("#scaleOutput").value = `${scaleRange.value}%`;
  }
  drawSelection();
}

function drawSelection() {
  selectionLayer.replaceChildren();
  if (!selected) return;
  let box;
  try { box = selected.getBBox(); } catch { return; }
  const x = Number(selected.dataset.x || 0);
  const y = Number(selected.dataset.y || 0);
  const scale = Number(selected.dataset.scale || 1);
  const rotation = Number(selected.dataset.rotation || 0);
  const outlineGroup = svgElement("g", { transform: `translate(${x} ${y}) rotate(${rotation}) scale(${scale})` });
  const padding = 8 / Math.max(scale, .1);
  outlineGroup.append(svgElement("rect", {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
    fill: "none",
    stroke: "#7da600",
    "stroke-width": String(2 / Math.max(scale, .1)),
    "stroke-dasharray": `${7 / scale} ${5 / scale}`,
    "vector-effect": "non-scaling-stroke"
  }));
  selectionLayer.append(outlineGroup);
}

function clientToStage(event) {
  const point = new DOMPoint(event.clientX, event.clientY);
  return point.matrixTransform(stage.getScreenCTM().inverse());
}

stage.addEventListener("pointerdown", (event) => {
  const object = event.target.closest?.("[data-id]");
  if (!object || !gooLayer.contains(object)) {
    selectObject(null);
    return;
  }
  event.preventDefault();
  selectObject(object);
  const point = clientToStage(event);
  drag = {
    id: event.pointerId,
    startX: point.x,
    startY: point.y,
    objectX: Number(object.dataset.x || 0),
    objectY: Number(object.dataset.y || 0)
  };
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", (event) => {
  if (!drag || drag.id !== event.pointerId || !selected) return;
  const point = clientToStage(event);
  selected.dataset.x = String(drag.objectX + point.x - drag.startX);
  selected.dataset.y = String(drag.objectY + point.y - drag.startY);
  updateTransform(selected);
  drawSelection();
});

function finishDrag(event) {
  if (drag?.id === event.pointerId) drag = null;
}
stage.addEventListener("pointerup", finishDrag);
stage.addEventListener("pointercancel", finishDrag);

function deleteSelected() {
  if (!selected) return;
  selected.remove();
  selectObject(null);
  updateUiState();
}

function duplicateSelected() {
  if (!selected) return;
  const clone = selected.cloneNode(true);
  clone.dataset.id = String(nextId++);
  clone.dataset.x = String(Number(selected.dataset.x) + 28);
  clone.dataset.y = String(Number(selected.dataset.y) + 28);
  updateTransform(clone);
  gooLayer.append(clone);
  selectObject(clone);
  updateUiState();
}

window.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if ((event.key === "Backspace" || event.key === "Delete") && selected) {
    event.preventDefault();
    deleteSelected();
  }
  if (selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
    const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    selected.dataset.x = String(Number(selected.dataset.x) + dx);
    selected.dataset.y = String(Number(selected.dataset.y) + dy);
    updateTransform(selected);
    drawSelection();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && selected) {
    event.preventDefault();
    duplicateSelected();
  }
});

function updateFilter() {
  const blur = Number(blurRange.value);
  const edge = Number(edgeRange.value);
  const bias = -(edge * 0.48);
  document.querySelector("#gooBlur").setAttribute("stdDeviation", blur);
  document.querySelector("#gooMatrix").setAttribute(
    "values",
    `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${edge} ${bias}`
  );
  document.querySelector("#blurOutput").value = blur;
  document.querySelector("#edgeOutput").value = edge;
}

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function setFill(value) {
  if (!validHex(value)) return;
  const normalized = value.toUpperCase();
  fillColor.value = normalized;
  fillHex.value = normalized;
  document.querySelector("#gooColor").setAttribute("flood-color", normalized);
}

function setBackground(value) {
  if (!validHex(value)) return;
  const normalized = value.toUpperCase();
  backgroundColor.value = normalized;
  backgroundHex.value = normalized;
  stageBackground.setAttribute("fill", normalized);
}

function updateTransparency() {
  stageBackground.style.display = transparentToggle.checked ? "none" : "";
}

function updateUiState() {
  const count = gooLayer.querySelectorAll(":scope > [data-id]").length;
  objectCount.textContent = `${count} ${count === 1 ? "piece" : "pieces"}`;
  emptyState.hidden = count > 0;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1900);
}

function sanitizeImportedSvg(source) {
  source.querySelectorAll("script, foreignObject, iframe, audio, video").forEach((node) => node.remove());
  source.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name) || /javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name === "xlink:href") && !attribute.value.startsWith("#")) node.removeAttribute(attribute.name);
    });
  });
}

async function importSvg(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid SVG");
  const source = doc.documentElement;
  sanitizeImportedSvg(source);

  const group = svgElement("g");
  [...source.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.localName !== "script") group.append(document.importNode(node, true));
  });

  const viewBox = source.getAttribute("viewBox")?.split(/[ ,]+/).map(Number);
  const width = viewBox?.[2] || Number.parseFloat(source.getAttribute("width")) || 500;
  const height = viewBox?.[3] || Number.parseFloat(source.getAttribute("height")) || 500;
  const originX = viewBox?.[0] || 0;
  const originY = viewBox?.[1] || 0;
  group.setAttribute("transform", `translate(${-originX - width / 2} ${-originY - height / 2})`);
  const scale = Math.min(1, 480 / Math.max(width, height));
  makeObject(group, 600, 380, { scale, label: `Imported ${file.name}` });
  showToast(`${file.name} imported`);
}

function prepareExportSvg() {
  const clone = stage.cloneNode(true);
  clone.querySelector("#selectionLayer")?.remove();
  clone.setAttribute("xmlns", NS);
  clone.setAttribute("width", "1200");
  clone.setAttribute("height", "760");
  clone.removeAttribute("role");
  clone.removeAttribute("aria-label");
  clone.querySelectorAll("[tabindex], [role], [aria-label], [data-id], [data-x], [data-y], [data-scale], [data-rotation]").forEach((element) => {
    ["tabindex", "role", "aria-label", "data-id", "data-x", "data-y", "data-scale", "data-rotation"].forEach((attribute) => element.removeAttribute(attribute));
  });
  if (transparentToggle.checked) clone.querySelector("#stageBackground")?.remove();
  return clone;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvg() {
  const source = new XMLSerializer().serializeToString(prepareExportSvg());
  downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), "metatype.svg");
  showToast("SVG exported");
}

function exportPng() {
  const source = new XMLSerializer().serializeToString(prepareExportSvg());
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1520;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, "metatype@2x.png");
      showToast("2× PNG exported");
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    showToast("PNG export failed. Try SVG instead.");
  };
  image.src = url;
}

document.querySelector("#addTextButton").addEventListener("click", addText);
document.querySelector("#textInput").addEventListener("keydown", (event) => { if (event.key === "Enter") addText(); });
document.querySelector("#addCircleButton").addEventListener("click", addCircle);
document.querySelector("#addSquareButton").addEventListener("click", addSquare);
document.querySelector("#emptyAddButton").addEventListener("click", addText);
document.querySelector("#resetButton").addEventListener("click", loadPreset);
document.querySelector("#deleteButton").addEventListener("click", deleteSelected);
document.querySelector("#duplicateButton").addEventListener("click", duplicateSelected);
document.querySelector("#exportSvgButton").addEventListener("click", exportSvg);
document.querySelector("#exportPngButton").addEventListener("click", exportPng);
document.querySelector("#svgInput").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try { await importSvg(file); } catch { showToast("That SVG could not be imported"); }
  event.target.value = "";
});

function updateTextStyleOutputs() {
  document.querySelector("#kerningOutput").value = `${kerningRange.value} px`;
  document.querySelector("#wordSpacingOutput").value = `${wordSpacingRange.value} px`;
}

blurRange.addEventListener("input", updateFilter);
edgeRange.addEventListener("input", updateFilter);
kerningRange.addEventListener("input", updateTextStyleOutputs);
wordSpacingRange.addEventListener("input", updateTextStyleOutputs);
scaleRange.addEventListener("input", () => {
  if (!selected) return;
  selected.dataset.scale = String(Number(scaleRange.value) / 100);
  document.querySelector("#scaleOutput").value = `${scaleRange.value}%`;
  updateTransform(selected);
  drawSelection();
});
fillColor.addEventListener("input", () => setFill(fillColor.value));
fillHex.addEventListener("change", () => setFill(fillHex.value));
backgroundColor.addEventListener("input", () => setBackground(backgroundColor.value));
backgroundHex.addEventListener("change", () => setBackground(backgroundHex.value));
transparentToggle.addEventListener("change", updateTransparency);

updateFilter();
updateTextStyleOutputs();
setFill(fillColor.value);
setBackground(backgroundColor.value);
loadPreset();
