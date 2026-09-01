const NS = "http://www.w3.org/2000/svg";
const LEGACY_DESIGN_STORAGE_KEY = "metatype.design.v1";
const DESIGN_STORAGE_KEY = "metatype.design.v2";
const DESIGN_SNAPSHOT_VERSION = 1;
const DESIGN_STORAGE_VERSION = 2;

/* Iris Gleam, the one chromatic signal allowed on the canvas. See DESIGN.md. */
const SELECTION_COLOR = "#847dff";
const SELECTION_FILL = "rgba(132, 125, 255, .16)";

const stage = document.querySelector("#stage");
const gooLayer = document.querySelector("#gooLayer");
const selectionLayer = document.querySelector("#selectionLayer");
const stageBackground = document.querySelector("#stageBackground");
const canvasWrap = document.querySelector("#canvasWrap");
const blurRange = document.querySelector("#blurRange");
const edgeRange = document.querySelector("#edgeRange");
const scaleRange = document.querySelector("#scaleRange");
const rotationRange = document.querySelector("#rotationRange");
const fillColor = document.querySelector("#fillColor");
const fillHex = document.querySelector("#fillHex");
const backgroundColor = document.querySelector("#backgroundColor");
const backgroundHex = document.querySelector("#backgroundHex");
const transparentToggle = document.querySelector("#transparentToggle");
const emptyState = document.querySelector("#emptyState");
const objectCount = document.querySelector("#objectCount");
const deleteButton = document.querySelector("#deleteButton");
const duplicateButton = document.querySelector("#duplicateButton");
const groupButton = document.querySelector("#groupButton");
const ungroupButton = document.querySelector("#ungroupButton");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const toast = document.querySelector("#toast");
const fontSelect = document.querySelector("#fontSelect");
const fontSizeInput = document.querySelector("#fontSizeInput");
const fontWeightSelect = document.querySelector("#fontWeightSelect");
const fontStyleSelect = document.querySelector("#fontStyleSelect");
const kerningRange = document.querySelector("#kerningRange");
const wordSpacingRange = document.querySelector("#wordSpacingRange");
const localFontOptions = document.querySelector("#localFontOptions");
const googleFontOptions = document.querySelector("#googleFontOptions");
const loadLocalFontsButton = document.querySelector("#loadLocalFontsButton");
const localFontsStatus = document.querySelector("#localFontsStatus");
const googleFontInput = document.querySelector("#googleFontInput");
const importGoogleFontButton = document.querySelector("#importGoogleFontButton");
const canvasPreset = document.querySelector("#canvasPreset");
const canvasWidthInput = document.querySelector("#canvasWidthInput");
const canvasHeightInput = document.querySelector("#canvasHeightInput");
const applyCanvasSizeButton = document.querySelector("#applyCanvasSizeButton");
const canvasDimensions = document.querySelector("#canvasDimensions");
const selectionCount = document.querySelector("#selectionCount");

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
const selected = new Set();
const history = [];
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

let pointerAction = null;
let nextId = 1;
let nextGroupId = 1;
let historyIndex = -1;
let keyboardNudgePending = false;
let storageWarningShown = false;
let toastTimer;
let canvasWidth = 1200;
let canvasHeight = 760;
let inspectorTransform = null;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function allObjects() {
  return [...gooLayer.querySelectorAll(":scope > [data-id]")];
}

function cssFontFamily(name) {
  return JSON.stringify(name);
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
  return wrapper;
}

function updateTransform(element) {
  const x = Number(element.dataset.x || 0);
  const y = Number(element.dataset.y || 0);
  const scale = Number(element.dataset.scale || 1);
  const rotation = Number(element.dataset.rotation || 0);
  element.setAttribute("transform", `translate(${x} ${y}) rotate(${rotation}) scale(${scale})`);
}

function canvasCenter() {
  return { x: canvasWidth / 2, y: canvasHeight / 2 };
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
  setCanvasSize(1200, 760);
  gooLayer.replaceChildren();
  selected.clear();
  nextId = 1;
  nextGroupId = 1;
  const letters = [
    ["C", 290, 380, -2],
    ["I", 450, 380, -7],
    ["R", 600, 380, 2],
    ["C", 790, 380, -2],
    ["A", 965, 380, 3]
  ];
  letters.forEach(([letter, x, y, rotation]) => addLetter(letter, x, y, rotation));
  updateUiState();
}

function graphemes(value) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(value)].map(({ segment }) => segment);
  }
  return Array.from(value);
}

function selectedFontFamily() {
  const option = fontSelect.selectedOptions[0];
  return option?.dataset.fontFamily || SYSTEM_FONTS[fontSelect.value] || SYSTEM_FONTS["system-sans"];
}

function selectedTextStyles() {
  return {
    fontFamily: selectedFontFamily(),
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
  const center = canvasCenter();
  const startX = center.x - run.width / 2;
  const pieces = run.placements.map(({ letter, x, index }) => {
    const text = createLetter(letter, styles);
    return makeObject(text, startX + x, center.y, {
      label: `Letter ${letter}, character ${index + 1} of ${graphemes(value).length}`
    });
  });

  setSelection(pieces);
  updateUiState();
  commitHistory();
  showToast(`${pieces.length} ${pieces.length === 1 ? "letter" : "letters"} added and selected`);
}

function addCircle() {
  const circle = svgElement("circle", { cx: "0", cy: "0", r: "85", fill: "#000" });
  const center = canvasCenter();
  const object = makeObject(circle, center.x, center.y, { label: "Circle" });
  setSelection([object]);
  updateUiState();
  commitHistory();
}

function addSquare() {
  const rect = svgElement("rect", { x: "-85", y: "-85", width: "170", height: "170", rx: "26", fill: "#000" });
  const center = canvasCenter();
  const object = makeObject(rect, center.x, center.y, { rotation: -6, label: "Block" });
  setSelection([object]);
  updateUiState();
  commitHistory();
}

function groupedObjects(objects) {
  const result = new Set(objects.filter((object) => gooLayer.contains(object)));
  const groupIds = new Set([...result].map((object) => object.dataset.group).filter(Boolean));
  if (groupIds.size) {
    allObjects().forEach((object) => {
      if (groupIds.has(object.dataset.group)) result.add(object);
    });
  }
  return result;
}

function setSelection(objects) {
  selected.clear();
  groupedObjects(objects).forEach((object) => selected.add(object));
  updateSelectionControls();
  drawSelection();
}

function toggleSelection(objects) {
  const targets = groupedObjects(objects);
  const shouldRemove = [...targets].every((object) => selected.has(object));
  targets.forEach((object) => {
    if (shouldRemove) selected.delete(object);
    else selected.add(object);
  });
  updateSelectionControls();
  drawSelection();
}

function updateSelectionControls() {
  const hasSelection = selected.size > 0;
  scaleRange.disabled = !hasSelection;
  rotationRange.disabled = !hasSelection;
  deleteButton.disabled = !hasSelection;
  duplicateButton.disabled = !hasSelection;
  groupButton.disabled = selected.size < 2;
  ungroupButton.disabled = ![...selected].some((object) => object.dataset.group);
  selectionCount.textContent = hasSelection ? `${selected.size} selected` : "None";

  if (hasSelection) {
    const [first] = selected;
    scaleRange.value = Math.round(Number(first.dataset.scale || 1) * 100);
    document.querySelector("#scaleOutput").value = `${scaleRange.value}%`;
    rotationRange.value = normalizeRotation(Number(first.dataset.rotation || 0));
    document.querySelector("#rotationOutput").value = `${rotationRange.value}°`;
  } else {
    document.querySelector("#scaleOutput").value = "100%";
    document.querySelector("#rotationOutput").value = "0°";
  }
}

function normalizeRotation(value) {
  return Math.round(((value + 180) % 360 + 360) % 360 - 180);
}

function objectCorners(object) {
  const box = object.getBBox();
  const x = Number(object.dataset.x || 0);
  const y = Number(object.dataset.y || 0);
  const scale = Number(object.dataset.scale || 1);
  const radians = Number(object.dataset.rotation || 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height]
  ].map(([localX, localY]) => ({
    x: x + scale * (localX * cosine - localY * sine),
    y: y + scale * (localX * sine + localY * cosine)
  }));
}

function selectionBounds() {
  const points = [...selected].flatMap((object) => {
    try {
      return objectCorners(object);
    } catch {
      return [];
    }
  });
  if (!points.length) return null;
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2
  };
}

function captureSelectionTransform() {
  const bounds = selectionBounds();
  if (!bounds) return null;
  return {
    bounds,
    objects: new Map([...selected].map((object) => [object, {
      x: Number(object.dataset.x || 0),
      y: Number(object.dataset.y || 0),
      scale: Number(object.dataset.scale || 1),
      rotation: Number(object.dataset.rotation || 0)
    }]))
  };
}

function applySelectionScale(transform, factor) {
  const { centerX, centerY } = transform.bounds;
  transform.objects.forEach((initial, object) => {
    object.dataset.x = String(centerX + (initial.x - centerX) * factor);
    object.dataset.y = String(centerY + (initial.y - centerY) * factor);
    object.dataset.scale = String(initial.scale * factor);
    updateTransform(object);
  });
  drawSelection();
}

function selectionScaleLimits(transform) {
  const scales = [...transform.objects.values()].map(({ scale }) => scale);
  return {
    minimum: Math.max(...scales.map((scale) => 0.2 / scale)),
    maximum: Math.min(...scales.map((scale) => 4 / scale))
  };
}

function applySelectionRotation(transform, degrees) {
  const { centerX, centerY } = transform.bounds;
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  transform.objects.forEach((initial, object) => {
    const dx = initial.x - centerX;
    const dy = initial.y - centerY;
    object.dataset.x = String(centerX + dx * cosine - dy * sine);
    object.dataset.y = String(centerY + dx * sine + dy * cosine);
    object.dataset.rotation = String(initial.rotation + degrees);
    updateTransform(object);
  });
  drawSelection();
}

function drawSelection() {
  selectionLayer.replaceChildren();
  selected.forEach((object) => {
    let box;
    try {
      box = object.getBBox();
    } catch {
      return;
    }
    const x = Number(object.dataset.x || 0);
    const y = Number(object.dataset.y || 0);
    const scale = Number(object.dataset.scale || 1);
    const rotation = Number(object.dataset.rotation || 0);
    const outlineGroup = svgElement("g", { transform: `translate(${x} ${y}) rotate(${rotation}) scale(${scale})` });
    const padding = 8 / Math.max(scale, 0.1);
    outlineGroup.append(svgElement("rect", {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
      fill: "none",
      stroke: SELECTION_COLOR,
      "stroke-width": String(2 / Math.max(scale, 0.1)),
      "stroke-dasharray": `${7 / scale} ${5 / scale}`,
      "vector-effect": "non-scaling-stroke"
    }));
    selectionLayer.append(outlineGroup);
  });

  const bounds = selectionBounds();
  if (bounds && !pointerAction?.type?.startsWith("marquee")) {
    const stagePixels = stage.getBoundingClientRect().width || canvasWidth;
    const unit = canvasWidth / stagePixels;
    const strokeWidth = 1.5 * unit;
    const handleRadius = 7 * unit;
    const rotationOffset = 34 * unit;
    selectionLayer.append(svgElement("rect", {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
      fill: "none",
      stroke: SELECTION_COLOR,
      "stroke-width": String(strokeWidth),
      "vector-effect": "non-scaling-stroke"
    }));
    const handleAbove = bounds.top - rotationOffset - handleRadius >= 0;
    const rotationY = handleAbove ? bounds.top - rotationOffset : bounds.bottom + rotationOffset;
    selectionLayer.append(svgElement("line", {
      x1: bounds.centerX,
      y1: handleAbove ? bounds.top : bounds.bottom,
      x2: bounds.centerX,
      y2: rotationY,
      stroke: SELECTION_COLOR,
      "stroke-width": String(strokeWidth),
      "vector-effect": "non-scaling-stroke"
    }));
    selectionLayer.append(svgElement("circle", {
      cx: bounds.centerX,
      cy: rotationY,
      r: handleRadius,
      fill: SELECTION_COLOR,
      stroke: "#171717",
      "stroke-width": String(strokeWidth),
      "data-handle": "rotate"
    }));
    selectionLayer.append(svgElement("rect", {
      x: bounds.right - handleRadius,
      y: bounds.bottom - handleRadius,
      width: handleRadius * 2,
      height: handleRadius * 2,
      fill: SELECTION_COLOR,
      stroke: "#171717",
      "stroke-width": String(strokeWidth),
      "data-handle": "resize"
    }));
  }

  if (pointerAction?.type === "marquee" && pointerAction.moved) {
    const x = Math.min(pointerAction.startX, pointerAction.endX);
    const y = Math.min(pointerAction.startY, pointerAction.endY);
    selectionLayer.append(svgElement("rect", {
      x,
      y,
      width: Math.abs(pointerAction.endX - pointerAction.startX),
      height: Math.abs(pointerAction.endY - pointerAction.startY),
      fill: SELECTION_FILL,
      stroke: SELECTION_COLOR,
      "stroke-width": "2",
      "stroke-dasharray": "8 5",
      "vector-effect": "non-scaling-stroke"
    }));
  }
}

function clientToStage(event) {
  const point = new DOMPoint(event.clientX, event.clientY);
  return point.matrixTransform(stage.getScreenCTM().inverse());
}

function rectanglesIntersect(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  commitKeyboardNudge();
  const object = event.target.closest?.("[data-id]");
  const handle = event.target.closest?.("[data-handle]");
  const point = clientToStage(event);

  if (handle && selected.size) {
    event.preventDefault();
    const transform = captureSelectionTransform();
    const { centerX, centerY } = transform.bounds;
    pointerAction = {
      type: handle.dataset.handle,
      id: event.pointerId,
      transform,
      startDistance: Math.max(1, Math.hypot(point.x - centerX, point.y - centerY)),
      startAngle: Math.atan2(point.y - centerY, point.x - centerX),
      moved: false
    };
    stage.setPointerCapture(event.pointerId);
    return;
  }

  if (!object || !gooLayer.contains(object)) {
    if (!event.shiftKey) setSelection([]);
    pointerAction = {
      type: "marquee",
      id: event.pointerId,
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
      clientStartX: event.clientX,
      clientStartY: event.clientY,
      baseSelection: event.shiftKey ? new Set(selected) : new Set(),
      moved: false
    };
    stage.classList.add("is-selecting");
    stage.setPointerCapture(event.pointerId);
    return;
  }

  if (isTextEditingTarget(document.activeElement)) document.activeElement.blur();
  event.preventDefault();
  const objectSelection = groupedObjects([object]);
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    toggleSelection([...objectSelection]);
    if (!selected.has(object)) return;
  } else if (!selected.has(object)) {
    setSelection([...objectSelection]);
  }

  pointerAction = {
    type: "drag",
    id: event.pointerId,
    startX: point.x,
    startY: point.y,
    moved: false,
    positions: new Map([...selected].map((selectedObject) => [
      selectedObject,
      { x: Number(selectedObject.dataset.x || 0), y: Number(selectedObject.dataset.y || 0) }
    ]))
  };
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", (event) => {
  if (!pointerAction || pointerAction.id !== event.pointerId) return;
  const point = clientToStage(event);

  if (pointerAction.type === "drag") {
    const dx = point.x - pointerAction.startX;
    const dy = point.y - pointerAction.startY;
    if (Math.hypot(dx, dy) > 1) pointerAction.moved = true;
    pointerAction.positions.forEach((position, object) => {
      object.dataset.x = String(position.x + dx);
      object.dataset.y = String(position.y + dy);
      updateTransform(object);
    });
    drawSelection();
    return;
  }

  if (pointerAction.type === "resize") {
    const { centerX, centerY } = pointerAction.transform.bounds;
    const limits = selectionScaleLimits(pointerAction.transform);
    const factor = Math.min(limits.maximum, Math.max(limits.minimum, Math.hypot(point.x - centerX, point.y - centerY) / pointerAction.startDistance));
    if (Math.abs(factor - 1) > 0.002) pointerAction.moved = true;
    applySelectionScale(pointerAction.transform, factor);
    const [first] = selected;
    scaleRange.value = Math.round(Number(first.dataset.scale) * 100);
    document.querySelector("#scaleOutput").value = `${scaleRange.value}%`;
    return;
  }

  if (pointerAction.type === "rotate") {
    const { centerX, centerY } = pointerAction.transform.bounds;
    const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);
    let degrees = (currentAngle - pointerAction.startAngle) * 180 / Math.PI;
    if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
    if (Math.abs(degrees) > 0.2) pointerAction.moved = true;
    applySelectionRotation(pointerAction.transform, degrees);
    const [first] = selected;
    rotationRange.value = normalizeRotation(Number(first.dataset.rotation));
    document.querySelector("#rotationOutput").value = `${rotationRange.value}°`;
    return;
  }

  pointerAction.endX = point.x;
  pointerAction.endY = point.y;
  const distance = Math.hypot(event.clientX - pointerAction.clientStartX, event.clientY - pointerAction.clientStartY);
  if (distance > 3) pointerAction.moved = true;
  if (!pointerAction.moved) return;

  const marqueeRect = {
    left: Math.min(pointerAction.clientStartX, event.clientX),
    right: Math.max(pointerAction.clientStartX, event.clientX),
    top: Math.min(pointerAction.clientStartY, event.clientY),
    bottom: Math.max(pointerAction.clientStartY, event.clientY)
  };
  const matches = groupedObjects(allObjects().filter((candidate) => rectanglesIntersect(marqueeRect, candidate.getBoundingClientRect())));
  selected.clear();
  pointerAction.baseSelection.forEach((candidate) => selected.add(candidate));
  matches.forEach((candidate) => selected.add(candidate));
  updateSelectionControls();
  drawSelection();
});

function finishPointerAction(event) {
  if (!pointerAction || pointerAction.id !== event.pointerId) return;
  const shouldCommit = ["drag", "resize", "rotate"].includes(pointerAction.type) && pointerAction.moved;
  pointerAction = null;
  stage.classList.remove("is-selecting");
  drawSelection();
  if (shouldCommit) commitHistory();
}

stage.addEventListener("pointerup", finishPointerAction);
stage.addEventListener("pointercancel", finishPointerAction);

function deleteSelected() {
  if (!selected.size) return;
  const count = selected.size;
  selected.forEach((object) => object.remove());
  setSelection([]);
  updateUiState();
  commitHistory();
  showToast(`${count} ${count === 1 ? "piece" : "pieces"} deleted`);
}

function duplicateSelected() {
  if (!selected.size) return;
  const groupMap = new Map();
  const clones = [...selected].map((object) => {
    const clone = object.cloneNode(true);
    clone.dataset.id = String(nextId++);
    clone.dataset.x = String(Number(object.dataset.x) + 28);
    clone.dataset.y = String(Number(object.dataset.y) + 28);
    if (object.dataset.group) {
      if (!groupMap.has(object.dataset.group)) groupMap.set(object.dataset.group, String(nextGroupId++));
      clone.dataset.group = groupMap.get(object.dataset.group);
    }
    updateTransform(clone);
    gooLayer.append(clone);
    return clone;
  });
  setSelection(clones);
  updateUiState();
  commitHistory();
}

function groupSelected() {
  if (selected.size < 2) return;
  const groupId = String(nextGroupId++);
  selected.forEach((object) => { object.dataset.group = groupId; });
  drawSelection();
  updateSelectionControls();
  commitHistory();
  showToast(`${selected.size} pieces grouped`);
}

function ungroupSelected() {
  const grouped = [...selected].filter((object) => object.dataset.group);
  if (!grouped.length) return;
  grouped.forEach((object) => { delete object.dataset.group; });
  updateSelectionControls();
  drawSelection();
  commitHistory();
  showToast("Group released");
}

function moveSelection(dx, dy) {
  if (!selected.size) return;
  selected.forEach((object) => {
    object.dataset.x = String(Number(object.dataset.x) + dx);
    object.dataset.y = String(Number(object.dataset.y) + dy);
    updateTransform(object);
  });
  drawSelection();
}

function commitKeyboardNudge() {
  if (!keyboardNudgePending) return;
  keyboardNudgePending = false;
  commitHistory();
}

function isTextEditingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
}

window.addEventListener("keydown", (event) => {
  if (isTextEditingTarget(document.activeElement)) return;
  const commandKey = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (!ARROW_KEYS.has(event.key)) commitKeyboardNudge();

  if (commandKey && key === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (commandKey && key === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (commandKey && key === "a") {
    event.preventDefault();
    setSelection(allObjects());
    return;
  }
  if (commandKey && key === "d" && selected.size) {
    event.preventDefault();
    duplicateSelected();
    return;
  }
  if (commandKey && key === "g") {
    event.preventDefault();
    if (event.shiftKey) ungroupSelected();
    else groupSelected();
    return;
  }
  if ((event.key === "Backspace" || event.key === "Delete") && selected.size) {
    event.preventDefault();
    deleteSelected();
    return;
  }
  if (selected.size && ARROW_KEYS.has(event.key)) {
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
    const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    moveSelection(dx, dy);
    keyboardNudgePending = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (ARROW_KEYS.has(event.key)) commitKeyboardNudge();
});
window.addEventListener("blur", commitKeyboardNudge);
window.addEventListener("resize", drawSelection);
window.addEventListener("pagehide", () => persistDesign(captureHistoryState(), { notify: false }));

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
  if (!validHex(value)) return false;
  const normalized = value.toUpperCase();
  fillColor.value = normalized;
  fillHex.value = normalized;
  document.querySelector("#gooColor").setAttribute("flood-color", normalized);
  return true;
}

function setBackground(value) {
  if (!validHex(value)) return false;
  const normalized = value.toUpperCase();
  backgroundColor.value = normalized;
  backgroundHex.value = normalized;
  stageBackground.setAttribute("fill", normalized);
  return true;
}

function clampCanvasDimension(value) {
  return Math.min(4096, Math.max(240, Math.round(Number(value) || 0)));
}

function setCanvasSize(width, height) {
  canvasWidth = clampCanvasDimension(width);
  canvasHeight = clampCanvasDimension(height);
  canvasWrap.style.setProperty("--canvas-ratio", String(canvasWidth / canvasHeight));
  stage.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  stage.setAttribute("width", String(canvasWidth));
  stage.setAttribute("height", String(canvasHeight));
  stageBackground.setAttribute("width", String(canvasWidth));
  stageBackground.setAttribute("height", String(canvasHeight));
  canvasWidthInput.value = String(canvasWidth);
  canvasHeightInput.value = String(canvasHeight);
  canvasDimensions.textContent = `${canvasWidth} × ${canvasHeight}`;
  const matchingPreset = [...canvasPreset.options].find((option) => option.value === `${canvasWidth}x${canvasHeight}`);
  canvasPreset.value = matchingPreset?.value || "custom";
  drawSelection();
  requestAnimationFrame(drawSelection);
}

function applyCanvasSize() {
  const width = Number(canvasWidthInput.value);
  const height = Number(canvasHeightInput.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || width > 4096 || height < 240 || height > 4096) {
    showToast("Canvas dimensions must be between 240 and 4096 px");
    return;
  }
  setCanvasSize(width, height);
  commitHistory();
  showToast(`Canvas set to ${canvasWidth} × ${canvasHeight}`);
}

function updateTransparency() {
  stageBackground.style.display = transparentToggle.checked ? "none" : "";
  canvasWrap.classList.toggle("is-transparent", transparentToggle.checked);
}

function updateUiState() {
  const count = allObjects().length;
  objectCount.textContent = `${count} ${count === 1 ? "piece" : "pieces"}`;
  emptyState.hidden = count > 0;
  updateSelectionControls();
  drawSelection();
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1900);
}

function captureHistoryState() {
  return JSON.stringify({
    version: DESIGN_SNAPSHOT_VERSION,
    markup: gooLayer.innerHTML,
    nextId,
    nextGroupId,
    blur: blurRange.value,
    edge: edgeRange.value,
    canvasWidth,
    canvasHeight,
    fill: fillColor.value,
    background: backgroundColor.value,
    transparent: transparentToggle.checked,
    googleFonts: [...document.querySelectorAll("link[data-google-font]")].map((link) => ({
      url: link.href,
      families: googleFontFamiliesFromUrl(link.href)
    }))
  });
}

function isIntegerAtLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

function isRangeValue(value, minimum, maximum) {
  const number = Number(value);
  return typeof value === "string" && Number.isFinite(number) && number >= minimum && number <= maximum;
}

function validGoogleFontState(font) {
  if (!font || typeof font.url !== "string" || !Array.isArray(font.families)) return false;
  if (!font.families.every((family) => typeof family === "string" && family.length > 0)) return false;

  try {
    const url = new URL(font.url);
    return url.protocol === "https:" && url.hostname === "fonts.googleapis.com";
  } catch {
    return false;
  }
}

function parseDesignState(serializedState) {
  const state = JSON.parse(serializedState);
  state.canvasWidth ??= 1200;
  state.canvasHeight ??= 760;
  const isValid = state
    && state.version === DESIGN_SNAPSHOT_VERSION
    && typeof state.markup === "string"
    && isIntegerAtLeast(state.nextId, 1)
    && isIntegerAtLeast(state.nextGroupId, 1)
    && isRangeValue(state.blur, Number(blurRange.min), Number(blurRange.max))
    && isRangeValue(state.edge, Number(edgeRange.min), Number(edgeRange.max))
    && isIntegerAtLeast(state.canvasWidth, 240)
    && state.canvasWidth <= 4096
    && isIntegerAtLeast(state.canvasHeight, 240)
    && state.canvasHeight <= 4096
    && validHex(state.fill)
    && validHex(state.background)
    && typeof state.transparent === "boolean"
    && Array.isArray(state.googleFonts)
    && state.googleFonts.every(validGoogleFontState);

  if (!isValid) throw new Error("Invalid saved design");
  return state;
}

function serializeDesignHistory(serializedState) {
  const savedHistory = [...history];
  let savedHistoryIndex = historyIndex;

  if (savedHistory[savedHistoryIndex] !== serializedState) {
    savedHistory.splice(savedHistoryIndex + 1);
    savedHistory.push(serializedState);
    if (savedHistory.length > 100) savedHistory.shift();
    savedHistoryIndex = savedHistory.length - 1;
  }

  return JSON.stringify({
    version: DESIGN_STORAGE_VERSION,
    history: savedHistory,
    historyIndex: savedHistoryIndex
  });
}

function parseDesignHistory(serializedDesign) {
  const savedDesign = JSON.parse(serializedDesign);

  if (savedDesign?.version === DESIGN_SNAPSHOT_VERSION && typeof savedDesign.markup === "string") {
    return { history: [JSON.stringify(parseDesignState(serializedDesign))], historyIndex: 0 };
  }

  const hasValidHistory = savedDesign
    && savedDesign.version === DESIGN_STORAGE_VERSION
    && Array.isArray(savedDesign.history)
    && savedDesign.history.length > 0
    && savedDesign.history.length <= 100
    && isIntegerAtLeast(savedDesign.historyIndex, 0)
    && savedDesign.historyIndex < savedDesign.history.length;
  if (!hasValidHistory) throw new Error("Invalid saved design history");

  return {
    history: savedDesign.history.map((entry) => JSON.stringify(parseDesignState(entry))),
    historyIndex: savedDesign.historyIndex
  };
}

function restoreMarkup(markup) {
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("Invalid saved design markup");
  sanitizeImportedSvg(parsed);
  gooLayer.replaceChildren(...[...parsed.documentElement.childNodes].map((node) => document.importNode(node, true)));
}

function persistDesign(serializedState, { notify = true } = {}) {
  try {
    window.localStorage.setItem(DESIGN_STORAGE_KEY, serializeDesignHistory(serializedState));
    window.localStorage.removeItem(LEGACY_DESIGN_STORAGE_KEY);
  } catch {
    if (notify && !storageWarningShown) {
      storageWarningShown = true;
      showToast("This browser could not save the design locally");
    }
  }
}

function loadSavedDesign() {
  let serializedDesign;
  try {
    serializedDesign = window.localStorage.getItem(DESIGN_STORAGE_KEY)
      || window.localStorage.getItem(LEGACY_DESIGN_STORAGE_KEY);
  } catch {
    return false;
  }
  if (!serializedDesign) return false;

  try {
    const savedDesign = parseDesignHistory(serializedDesign);
    history.push(...savedDesign.history);
    historyIndex = savedDesign.historyIndex;
    restoreHistoryState(history[historyIndex]);
    persistDesign(history[historyIndex], { notify: false });
    return true;
  } catch {
    try {
      window.localStorage.removeItem(DESIGN_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_DESIGN_STORAGE_KEY);
    } catch {
      // A blocked storage API needs no further cleanup.
    }
    return false;
  }
}

function updateHistoryControls() {
  if (undoButton) undoButton.disabled = historyIndex <= 0;
  if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
}

function commitHistory() {
  const state = captureHistoryState();
  if (history[historyIndex] === state) {
    persistDesign(state);
    return;
  }
  history.splice(historyIndex + 1);
  history.push(state);
  if (history.length > 100) history.shift();
  historyIndex = history.length - 1;
  updateHistoryControls();
  persistDesign(state);
}

function restoreHistoryState(serializedState) {
  const state = parseDesignState(serializedState);
  restoreGoogleFonts(state.googleFonts);
  restoreMarkup(state.markup);
  nextId = state.nextId;
  nextGroupId = state.nextGroupId;
  blurRange.value = state.blur;
  edgeRange.value = state.edge;
  setCanvasSize(state.canvasWidth, state.canvasHeight);
  fillColor.value = state.fill;
  backgroundColor.value = state.background;
  transparentToggle.checked = state.transparent;
  selected.clear();
  updateFilter();
  setFill(state.fill);
  setBackground(state.background);
  updateTransparency();
  updateUiState();
  updateHistoryControls();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreHistoryState(history[historyIndex]);
  persistDesign(history[historyIndex]);
  showToast("Undone");
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreHistoryState(history[historyIndex]);
  persistDesign(history[historyIndex]);
  showToast("Redone");
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
  const center = canvasCenter();
  const object = makeObject(group, center.x, center.y, { scale, label: `Imported ${file.name}` });
  setSelection([object]);
  updateUiState();
  commitHistory();
  showToast(`${file.name} imported`);
}

function addFontOption(group, source, family) {
  const value = `${source}:${family}`;
  let option = [...group.querySelectorAll(":scope > option")].find((candidate) => candidate.value === value);
  if (!option) {
    option = document.createElement("option");
    option.value = value;
    option.textContent = family;
    option.dataset.fontFamily = cssFontFamily(family);
    group.append(option);
  }
  return option;
}

async function loadLocalFonts({ silent = false } = {}) {
  if (typeof window.queryLocalFonts !== "function") {
    localFontsStatus.textContent = "Not supported in this browser";
    loadLocalFontsButton.disabled = true;
    if (!silent) showToast("Local fonts need Chrome or Edge on localhost");
    return;
  }

  loadLocalFontsButton.disabled = true;
  if (!silent) localFontsStatus.textContent = "Reading font library...";
  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second));
    localFontOptions.replaceChildren();
    families.forEach((family) => addFontOption(localFontOptions, "local", family));
    localFontsStatus.textContent = `${families.length} families loaded`;
    loadLocalFontsButton.textContent = "Reload local fonts";
    if (!silent) showToast(`${families.length} local font families loaded`);
  } catch {
    if (!silent) {
      localFontsStatus.textContent = "Permission denied or unavailable";
      showToast("Allow local font access, then try again");
    }
  } finally {
    loadLocalFontsButton.disabled = false;
  }
}

function parseGoogleFontInput(rawValue) {
  const raw = rawValue.trim().replaceAll("&amp;", "&");
  if (!raw) throw new Error("Enter a font name or URL");

  const cssUrlMatch = raw.match(/https:\/\/fonts\.googleapis\.com\/css2?\?[^\s"'<>]+/i);
  const candidate = cssUrlMatch?.[0] || raw;
  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate);
    if (url.hostname === "fonts.google.com" && url.pathname.startsWith("/specimen/")) {
      const family = decodeURIComponent(url.pathname.slice("/specimen/".length)).replaceAll("+", " ").trim();
      if (!family) throw new Error("No font family found");
      return {
        families: [family],
        url: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}&display=swap`
      };
    }
    if (url.hostname !== "fonts.googleapis.com") throw new Error("Use a Google Fonts URL");
    const families = url.searchParams.getAll("family")
      .flatMap((value) => value.split("|"))
      .map((family) => family.split(":")[0].replaceAll("+", " ").trim())
      .filter(Boolean);
    if (!families.length) throw new Error("No font family found");
    return { families, url: url.href };
  }

  const family = raw.replace(/^['"]|['"]$/g, "").trim();
  if (!family) throw new Error("Enter a font name");
  return {
    families: [family],
    url: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}&display=swap`
  };
}

function googleFontFamiliesFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "fonts.googleapis.com") return [];
    return url.searchParams.getAll("family")
      .flatMap((value) => value.split("|"))
      .map((family) => family.split(":")[0].replaceAll("+", " ").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function restoreGoogleFonts(fonts) {
  fonts.forEach(({ url, families }) => {
    let link = [...document.querySelectorAll("link[data-google-font]")].find((candidate) => candidate.href === url);
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.googleFont = "";
      document.head.append(link);
    }
    families.forEach((family) => addFontOption(googleFontOptions, "google", family));
  });
}

async function importGoogleFont() {
  let parsed;
  try {
    parsed = parseGoogleFontInput(googleFontInput.value);
  } catch (error) {
    showToast(error.message);
    return;
  }

  importGoogleFontButton.disabled = true;
  try {
    let link = [...document.querySelectorAll("link[data-google-font]")].find((candidate) => candidate.href === parsed.url);
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = parsed.url;
      link.dataset.googleFont = "";
      const loaded = new Promise((resolve, reject) => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", reject, { once: true });
      });
      document.head.append(link);
      try {
        await loaded;
      } catch (error) {
        link.remove();
        throw error;
      }
    }

    let lastOption;
    parsed.families.forEach((family) => { lastOption = addFontOption(googleFontOptions, "google", family); });
    if (lastOption) fontSelect.value = lastOption.value;
    googleFontInput.value = "";
    showToast(`${parsed.families.join(", ")} imported`);
  } catch {
    showToast("Google Fonts could not load that font");
  } finally {
    importGoogleFontButton.disabled = false;
  }
}

function prepareExportSvg() {
  const clone = stage.cloneNode(true);
  clone.querySelector("#selectionLayer")?.remove();
  clone.setAttribute("xmlns", NS);
  clone.setAttribute("width", String(canvasWidth));
  clone.setAttribute("height", String(canvasHeight));
  clone.removeAttribute("role");
  clone.removeAttribute("aria-label");
  clone.querySelectorAll("[tabindex], [role], [aria-label], [data-id], [data-x], [data-y], [data-scale], [data-rotation], [data-group]").forEach((element) => {
    ["tabindex", "role", "aria-label", "data-id", "data-x", "data-y", "data-scale", "data-rotation", "data-group"].forEach((attribute) => element.removeAttribute(attribute));
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
    URL.revokeObjectURL(url);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth * 2;
      canvas.height = canvasHeight * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unsupported canvas size");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (!png) {
          showToast("PNG export failed. Try SVG instead.");
          return;
        }
        downloadBlob(png, "metatype@2x.png");
        showToast("2× PNG exported");
      }, "image/png");
    } catch {
      showToast("PNG export failed. Try SVG instead.");
    }
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
document.querySelector("#resetButton").addEventListener("click", () => {
  loadPreset();
  commitHistory();
  showToast("Canvas reset");
});
deleteButton.addEventListener("click", deleteSelected);
duplicateButton.addEventListener("click", duplicateSelected);
groupButton.addEventListener("click", groupSelected);
ungroupButton.addEventListener("click", ungroupSelected);
undoButton?.addEventListener("click", undo);
redoButton?.addEventListener("click", redo);
document.querySelector("#exportSvgButton").addEventListener("click", exportSvg);
document.querySelector("#exportPngButton").addEventListener("click", exportPng);
loadLocalFontsButton.addEventListener("click", () => loadLocalFonts());
importGoogleFontButton.addEventListener("click", importGoogleFont);
googleFontInput.addEventListener("keydown", (event) => { if (event.key === "Enter") importGoogleFont(); });
document.querySelector("#svgInput").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    await importSvg(file);
  } catch {
    showToast("That SVG could not be imported");
  }
  event.target.value = "";
});

function updateTextStyleOutputs() {
  document.querySelector("#kerningOutput").value = `${kerningRange.value} px`;
  document.querySelector("#wordSpacingOutput").value = `${wordSpacingRange.value} px`;
}

blurRange.addEventListener("input", updateFilter);
blurRange.addEventListener("change", commitHistory);
edgeRange.addEventListener("input", updateFilter);
edgeRange.addEventListener("change", commitHistory);
kerningRange.addEventListener("input", updateTextStyleOutputs);
wordSpacingRange.addEventListener("input", updateTextStyleOutputs);
scaleRange.addEventListener("input", () => {
  if (!selected.size) return;
  inspectorTransform ||= captureSelectionTransform();
  const [firstInitial] = inspectorTransform.objects.values();
  const limits = selectionScaleLimits(inspectorTransform);
  const requestedFactor = Number(scaleRange.value) / 100 / firstInitial.scale;
  const factor = Math.min(limits.maximum, Math.max(limits.minimum, requestedFactor));
  applySelectionScale(inspectorTransform, factor);
  scaleRange.value = Math.round(firstInitial.scale * factor * 100);
  document.querySelector("#scaleOutput").value = `${scaleRange.value}%`;
});
scaleRange.addEventListener("pointerdown", () => { inspectorTransform = captureSelectionTransform(); });
scaleRange.addEventListener("keydown", () => { inspectorTransform ||= captureSelectionTransform(); });
scaleRange.addEventListener("change", () => {
  inspectorTransform = null;
  commitHistory();
});
rotationRange.addEventListener("input", () => {
  if (!selected.size) return;
  inspectorTransform ||= captureSelectionTransform();
  const [firstInitial] = inspectorTransform.objects.values();
  const degrees = Number(rotationRange.value) - normalizeRotation(firstInitial.rotation);
  applySelectionRotation(inspectorTransform, degrees);
  document.querySelector("#rotationOutput").value = `${rotationRange.value}°`;
});
rotationRange.addEventListener("pointerdown", () => { inspectorTransform = captureSelectionTransform(); });
rotationRange.addEventListener("keydown", () => { inspectorTransform ||= captureSelectionTransform(); });
rotationRange.addEventListener("change", () => {
  inspectorTransform = null;
  commitHistory();
});
canvasPreset.addEventListener("change", () => {
  if (canvasPreset.value === "custom") {
    canvasWidthInput.focus();
    return;
  }
  const [width, height] = canvasPreset.value.split("x").map(Number);
  setCanvasSize(width, height);
  commitHistory();
  showToast(`Canvas set to ${width} × ${height}`);
});
[canvasWidthInput, canvasHeightInput].forEach((input) => {
  input.addEventListener("input", () => { canvasPreset.value = "custom"; });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") applyCanvasSize(); });
});
applyCanvasSizeButton.addEventListener("click", applyCanvasSize);
fillColor.addEventListener("input", () => setFill(fillColor.value));
fillColor.addEventListener("change", commitHistory);
fillHex.addEventListener("change", () => { if (setFill(fillHex.value)) commitHistory(); });
backgroundColor.addEventListener("input", () => setBackground(backgroundColor.value));
backgroundColor.addEventListener("change", commitHistory);
backgroundHex.addEventListener("change", () => { if (setBackground(backgroundHex.value)) commitHistory(); });
transparentToggle.addEventListener("change", () => {
  updateTransparency();
  commitHistory();
});

updateFilter();
updateTextStyleOutputs();
setFill(fillColor.value);
setBackground(backgroundColor.value);
updateTransparency();
if (!loadSavedDesign()) {
  loadPreset();
  commitHistory();
}
loadLocalFonts({ silent: true });
