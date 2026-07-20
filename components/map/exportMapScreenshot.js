const EXPORT_PIXEL_RATIO = 150 / 72;
const LEGEND_FALLBACK_WIDTH = 300;

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

const ensureLegendFullyExpandedForExport = async (legend) => {
  const clickedButtons = [];

  const clickIfCollapsed = (button) => {
    if (button?.getAttribute("aria-expanded") !== "false") return;
    button.click();
    clickedButtons.push(button);
  };

  clickIfCollapsed(legend.querySelector("#legend-heading"));
  await waitForPaint();

  for (const toggle of Array.from(legend.querySelectorAll('button[aria-controls][aria-expanded="false"]'))) {
    clickIfCollapsed(toggle);
  }

  await waitForPaint();

  return () => {
    for (const button of clickedButtons.reverse()) {
      button.click();
    }
  };
};

const normalizeText = (text) => (text || "").replace(/\s+/g, " ").trim();

const wrapText = (ctx, text, maxWidth) => {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      continue;
    }

    if (line) lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const normalizeToggleLabel = (text) => normalizeText(text).replace(/^\S+\s+/, "").replace(/\s*:\s*$/, "");

const isNoneLine = (text) => /^none$/i.test(normalizeText(text));

const getPanelLines = (panel) => {
  if (!panel) return [];

  return Array.from(panel.children)
    .flatMap((child) => {
      if (child.tagName === "UL") {
        return Array.from(child.querySelectorAll("li")).map((item) => normalizeText(item.textContent));
      }

      return [normalizeText(child.textContent)];
    })
    .filter(Boolean);
};

const getLegendEntries = (legend, resultMetadata) => {
  const sections = Array.from(legend.querySelectorAll('[class*="legend-section"]'));
  if (!sections.length) {
    return resultMetadata.map((entry, index) => ({
      color: entry?.color || "#0072bd",
      title: entry?.isDefault
        ? `Standard Walking Area ${entry?.groupIndex ?? index + 1}`
        : `Comfort-Adjusted Walking Area ${entry?.groupIndex ?? ""}.${entry?.subIndex ?? ""}`,
      lines: [
        `Time: ${entry?.time ?? ""} minutes`,
        `Speed: ${entry?.speed ?? ""} km/h`,
        `Area: ${entry?.area ?? ""} ha`,
        ...(!entry?.isDefault && entry?.weightedRatio ? [`Comfort Area Ratio: ${entry.weightedRatio}`] : []),
      ],
    }));
  }

  return sections.map((section, index) => {
    const colorNode = section.querySelector('[role="presentation"]');
    const titleNode = section.querySelector('[class*="legend-title"] button');
    const detailButtons = Array.from(section.querySelectorAll('button[aria-controls]')).filter(
      (button) => button.id !== "legend-heading"
    );
    const controlledPanelIds = new Set(
      detailButtons.map((button) => button.getAttribute("aria-controls")).filter(Boolean)
    );
    const color =
      colorNode?.style?.backgroundColor ||
      (colorNode ? window.getComputedStyle(colorNode).backgroundColor : null) ||
      resultMetadata[index]?.color ||
      "#0072bd";
    const directDetailLines = Array.from(section.children)
      .filter(
        (child) =>
          child.tagName === "DIV" &&
          !child.hidden &&
          !child.querySelector("button") &&
          !controlledPanelIds.has(child.id)
      )
      .map((child) => normalizeText(child.textContent))
      .filter(Boolean);
    const expandedDetailLines = detailButtons.flatMap((button) => {
        const panel = document.getElementById(button.getAttribute("aria-controls"));
        const panelLines = getPanelLines(panel);
        const label = normalizeToggleLabel(button.textContent);

        if (panelLines.length === 1 && isNoneLine(panelLines[0])) {
          return label ? [`${label}: None`] : ["None"];
        }

        return [label, ...panelLines].filter(Boolean);
      });

    return {
      color,
      title: normalizeText(titleNode?.textContent) || `Area ${index + 1}`,
      lines: [...directDetailLines, ...expandedDetailLines],
    };
  });
};

const getLegendTitle = (legend) => {
  const titleNode = legend.querySelector("#legend-heading span");
  return normalizeText(titleNode?.textContent) || "Catchment Area Results";
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
};

const renderLegendPanel = ({ canvas, baseRect, legend, resultMetadata }) => {
  if (!resultMetadata.length) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const padding = 14;
  const headerHeight = 36;
  const sectionGap = 10;
  const lineHeight = 18;
  const width = Math.min(
    Math.max(Math.round(legend.getBoundingClientRect().width || 0), LEGEND_FALLBACK_WIDTH),
    Math.max(LEGEND_FALLBACK_WIDTH, baseRect.width - 24)
  );
  const contentWidth = width - padding * 2;
  const title = getLegendTitle(legend);
  const entries = getLegendEntries(legend, resultMetadata);

  ctx.save();
  ctx.font = "14px sans-serif";

  const measuredSections = entries.map((entry) => {
    ctx.font = "700 14px sans-serif";
    const titleLines = wrapText(ctx, entry.title, contentWidth - 20);
    ctx.font = "14px sans-serif";
    const detailLines = entry.lines.flatMap((line) => wrapText(ctx, line, contentWidth));

    return {
      ...entry,
      titleLines,
      detailLines,
      height: 12 + titleLines.length * lineHeight + 4 + detailLines.length * lineHeight + sectionGap,
    };
  });

  const height = Math.min(
    headerHeight + padding * 2 + measuredSections.reduce((sum, section) => sum + section.height, 0),
    baseRect.height - 24
  );
  const legendRect = legend.getBoundingClientRect();
  const hasVisibleLegendPosition = legendRect.width > 0 && legendRect.height > 0;
  const x = hasVisibleLegendPosition
    ? Math.min(Math.max(Math.round(legendRect.left - baseRect.left), 12), baseRect.width - width - 12)
    : baseRect.width - width - 12;
  const y = hasVisibleLegendPosition
    ? Math.min(Math.max(Math.round(legendRect.top - baseRect.top), 12), baseRect.height - height - 12)
    : baseRect.height - height - 60;

  ctx.fillStyle = "#f5f5f5";
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();

  ctx.fillStyle = "rgba(131, 107, 251, 0.79)";
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, width, headerHeight, 6);
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.font = "700 15px sans-serif";
  ctx.fillText(title, x + padding, y + 23);

  let cursorY = y + headerHeight + padding;
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  for (const section of measuredSections) {
    if (cursorY > y + height - padding) break;

    ctx.fillStyle = section.color;
    ctx.beginPath();
    ctx.arc(x + padding + 6, cursorY + 7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.font = "700 14px sans-serif";
    let titleY = cursorY + 12;
    for (const line of section.titleLines) {
      ctx.fillText(line, x + padding + 20, titleY);
      titleY += lineHeight;
    }

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#111111";
    let detailY = titleY + 4;
    for (const line of section.detailLines) {
      if (detailY > y + height - padding) break;
      ctx.fillText(line, x + padding, detailY);
      detailY += lineHeight;
    }

    cursorY = detailY + sectionGap;
    ctx.strokeStyle = "#413190";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + padding, cursorY - 5);
    ctx.lineTo(x + width - padding, cursorY - 5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
};

const renderLegend = async (canvas, rootElement, baseRect, resultMetadata) => {
  const legend = rootElement.querySelector("#legend") || document.getElementById("legend");
  if (!legend) return;

  const restoreLegend = await ensureLegendFullyExpandedForExport(legend);

  try {
    renderLegendPanel({ canvas, baseRect, legend, resultMetadata });
  } catch (err) {
    console.warn("Legend rendering skipped during screenshot export", err);
  } finally {
    restoreLegend();
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

  await renderLegend(canvas, mapViewport, rect, resultMetadata);

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
