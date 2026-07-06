const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const EXPORT_PIXEL_RATIO = 150 / 72;

const getExportScale = () => {
  const deviceScale = window.devicePixelRatio || 1;
  return Math.max(deviceScale, EXPORT_PIXEL_RATIO);
};

const waitForPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

const buildFilename = (city) => {
  const date = new Date().toISOString().slice(0, 10);
  return `cat-catchment-area-${city || "map"}-${date}.png`;
};

const saveBlob = async ({ blob, city }) => {
  const suggestedName = buildFilename(city);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to create screenshot blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });

const copyComputedStyles = (sourceNode, targetNode) => {
  if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) return;

  const computed = window.getComputedStyle(sourceNode);
  for (const property of Array.from(computed)) {
    targetNode.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property)
    );
  }
};

const cloneWithStyles = (sourceNode) => {
  const clone = sourceNode.cloneNode(false);
  copyComputedStyles(sourceNode, clone);

  for (const child of Array.from(sourceNode.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      clone.appendChild(child.cloneNode(true));
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    clone.appendChild(cloneWithStyles(child));
  }

  return clone;
};

const renderElementToCanvas = async (element) => {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const scale = getExportScale();

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is unavailable");
  }

  ctx.scale(scale, scale);

  const clone = cloneWithStyles(element);
  clone.setAttribute("xmlns", XHTML_NAMESPACE);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.boxSizing = "border-box";

  const wrapper = document.createElementNS(SVG_NAMESPACE, "svg");
  wrapper.setAttribute("xmlns", SVG_NAMESPACE);
  wrapper.setAttribute("width", `${width}`);
  wrapper.setAttribute("height", `${height}`);
  const sourceViewBox =
    element instanceof SVGSVGElement ? element.getAttribute("viewBox") : null;
  wrapper.setAttribute("viewBox", sourceViewBox || `0 0 ${width} ${height}`);

  const foreignObject = document.createElementNS(SVG_NAMESPACE, "foreignObject");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.appendChild(clone);
  wrapper.appendChild(foreignObject);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  ctx.drawImage(image, 0, 0, width, height);
  return { canvas, rect };
};

const hideDuringExport = (selectors) => {
  const nodes = Array.from(document.querySelectorAll(selectors.join(",")));
  const previous = nodes.map((node) => ({
    node,
    display: node.style.display,
    visibility: node.style.visibility,
    pointerEvents: node.style.pointerEvents,
  }));

  for (const node of nodes) {
    node.style.display = "none";
    node.style.visibility = "hidden";
    node.style.pointerEvents = "none";
  }

  return () => {
    for (const item of previous) {
      item.node.style.display = item.display;
      item.node.style.visibility = item.visibility;
      item.node.style.pointerEvents = item.pointerEvents;
    }
  };
};

const renderLegend = async (canvas, rootElement, baseRect) => {
  const legend = rootElement.querySelector("#legend");
  if (!legend) return;

  try {
    const { canvas: legendCanvas, rect: legendRect } = await renderElementToCanvas(legend);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      legendCanvas,
      Math.round(legendRect.left - baseRect.left),
      Math.round(legendRect.top - baseRect.top),
      legendRect.width,
      legendRect.height
    );
  } catch (err) {
    console.warn("Legend rendering skipped during screenshot export", err);
  }
};

const drawRing = (ctx, map, ring) => {
  if (!Array.isArray(ring) || ring.length === 0) return;
  const first = map.latLngToContainerPoint([ring[0][1], ring[0][0]]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i += 1) {
    const point = map.latLngToContainerPoint([ring[i][1], ring[i][0]]);
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
};

const drawGeometry = (ctx, map, geometry) => {
  if (!geometry) return;

  if (geometry.type === "Polygon") {
    ctx.beginPath();
    for (const ring of geometry.coordinates || []) {
      drawRing(ctx, map, ring);
    }
    ctx.fill("evenodd");
    ctx.stroke();
    return;
  }

  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates || []) {
      ctx.beginPath();
      for (const ring of polygon || []) {
        drawRing(ctx, map, ring);
      }
      ctx.fill("evenodd");
      ctx.stroke();
    }
  }
};

const drawReachabilityOverlay = ({ ctx, map, reachableHullData, resultMetadata, highlightedIndex }) => {
  if (!map || !Array.isArray(reachableHullData)) return;

  reachableHullData.forEach((hull, index) => {
    if (!hull?.features || typeof map.latLngToContainerPoint !== "function") return;

    const isHighlighted = highlightedIndex === index;
    const metaColor = resultMetadata?.[index]?.color || "#0072bd";

    ctx.save();
    ctx.lineWidth = isHighlighted ? 3 : 2;
    ctx.strokeStyle = isHighlighted ? "#e63946" : metaColor;
    ctx.fillStyle = isHighlighted ? "rgba(230, 57, 70, 0.7)" : metaColor;
    ctx.globalAlpha = isHighlighted ? 1 : 0.1;

    for (const feature of hull.features) {
      drawGeometry(ctx, map, feature?.geometry);
    }

    ctx.restore();
  });
};

const exportMapLayer = async ({
  mapElement,
  map,
  city,
  reachableHullData,
  resultMetadata,
  highlightedIndex,
  startPoint,
}) => {
  const mapViewport =
    map?.getContainer?.() ||
    mapElement?.querySelector?.(".leaflet-container") ||
    mapElement;

  if (!mapViewport) {
    throw new Error("Leaflet map container not found");
  }

  const rect = mapViewport.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const scale = getExportScale();
  const canvas = document.createElement("canvas");

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is unavailable");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, width, height);

  const tiles = Array.from(mapViewport.querySelectorAll(".leaflet-tile-pane img.leaflet-tile"));
  for (const tile of tiles) {
    if (!tile.complete || !tile.naturalWidth) continue;
    const tileRect = tile.getBoundingClientRect();
    ctx.drawImage(
      tile,
      tileRect.left - rect.left,
      tileRect.top - rect.top,
      tileRect.width,
      tileRect.height
    );
  }

  const leafletMap = map || mapViewport._leaflet_map || mapViewport._leafletMap || null;
  const hasStartPoint = Array.isArray(startPoint) && startPoint.length === 2;
  if (hasStartPoint && leafletMap && typeof leafletMap.latLngToContainerPoint === "function") {
    leafletMap.latLngToContainerPoint([startPoint[1], startPoint[0]]);
  }

  drawReachabilityOverlay({
    ctx,
    map: leafletMap,
    reachableHullData,
    resultMetadata,
    highlightedIndex,
  });

  const markers = Array.from(mapViewport.querySelectorAll(".leaflet-marker-pane img"));
  for (const marker of markers) {
    if (!marker.complete || !marker.naturalWidth) continue;
    const markerRect = marker.getBoundingClientRect();
    ctx.drawImage(
      marker,
      markerRect.left - rect.left,
      markerRect.top - rect.top,
      markerRect.width,
      markerRect.height
    );
  }

  await renderLegend(canvas, mapViewport, rect);

  const blob = await canvasToBlob(canvas);
  await saveBlob({ blob, city });
};

export const exportMapScreenshot = async ({
  mapElement,
  map,
  city,
  reachableHullData = [],
  resultMetadata = [],
  highlightedIndex = null,
  startPoint = null,
}) => {
  if (!mapElement) {
    throw new Error("Map element not found");
  }

  await waitForPaint();

  const restore = hideDuringExport([
    ".surveyOverlay",
    ".surveyReopenButton",
    "#profile",
    ".profilePanel",
    ".profileMainBox",
    ".profileBarExpanded",
    "#sidebar",
    ".sideBarBox",
    ".arrowToggleContainer",
    ".leaflet-control-zoom",
    ".leaflet-control-attribution",
  ]);

  try {
    await exportMapLayer({
      mapElement,
      map,
      city,
      reachableHullData,
      resultMetadata,
      highlightedIndex,
      startPoint,
    });
  } finally {
    restore();
  }
};
