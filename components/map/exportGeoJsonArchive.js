const textEncoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value) => {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value, true);
  return new Uint8Array(buffer);
};

const uint32 = (value) => {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value >>> 0, true);
  return new Uint8Array(buffer);
};

const concatBytes = (parts) => {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const safeName = (value) =>
  String(value || "layer")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "layer";

const cloneFeatureCollection = (geojson, properties = {}) => ({
  ...geojson,
  features: (geojson.features || []).map((feature) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      ...properties,
    },
  })),
});

const isValidGeoJsonFeatureCollection = (geojson) =>
  geojson &&
  geojson.type === "FeatureCollection" &&
  Array.isArray(geojson.features) &&
  geojson.features.length > 0;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const createZipBlob = (files) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = textEncoder.encode(file.content);
    const checksum = crc32(dataBytes);

    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(dataBytes.length),
      uint32(dataBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, dataBytes);

    centralParts.push(concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(dataBytes.length),
      uint32(dataBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBytes,
    ]));

    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  return new Blob([...localParts, centralDirectory, endRecord], {
    type: "application/zip",
  });
};

const buildCalculationFiles = ({ reachableHullData, reachableRoadsData, resultMetadata, city }) => {
  const files = [];
  const maxLength = Math.max(reachableHullData.length, reachableRoadsData.length);

  for (let index = 0; index < maxLength; index += 1) {
    const metadata = resultMetadata[index] || {};
    const label = metadata.isDefault
      ? `standard-area-${metadata.groupIndex || index + 1}`
      : `weighted-area-${metadata.groupIndex || index + 1}-${metadata.subIndex || 1}`;
    const baseProperties = {
      cat_export_type: metadata.isDefault ? "standard_calculation" : "weighted_calculation",
      cat_city: city,
      cat_group_index: metadata.groupIndex ?? null,
      cat_sub_index: metadata.subIndex ?? null,
      cat_walking_time_minutes: metadata.time ?? null,
      cat_walking_speed_kmh: metadata.speed ?? null,
      cat_area_hectares: metadata.area ?? null,
      cat_weighted_ratio: metadata.weightedRatio ?? null,
      cat_enabled_layers: metadata.layers || [],
      cat_layer_values: metadata.values || {},
      cat_color: metadata.color || null,
    };

    if (isValidGeoJsonFeatureCollection(reachableHullData[index])) {
      files.push({
        name: `calculation-areas/${safeName(label)}-polygon.geojson`,
        content: JSON.stringify(
          cloneFeatureCollection(reachableHullData[index], {
            ...baseProperties,
            cat_geometry_role: "catchment_polygon",
          }),
          null,
          2
        ),
      });
    }

    if (isValidGeoJsonFeatureCollection(reachableRoadsData[index])) {
      files.push({
        name: `calculation-roads/${safeName(label)}-roads.geojson`,
        content: JSON.stringify(
          cloneFeatureCollection(reachableRoadsData[index], {
            ...baseProperties,
            cat_geometry_role: "reachable_road_network",
          }),
          null,
          2
        ),
      });
    }
  }

  return files;
};

export const exportGeoJsonArchive = ({
  city,
  visibleGeoJsonLayers,
  reachableHullData,
  reachableRoadsData,
  resultMetadata,
  cityBoundaries,
}) => {
  const files = [];

  for (const [layer, data] of Object.entries(visibleGeoJsonLayers || {})) {
    if (!isValidGeoJsonFeatureCollection(data)) continue;
    files.push({
      name: `data-information-layers/${safeName(layer)}.geojson`,
      content: JSON.stringify(data, null, 2),
    });
  }

  const cityBoundary = cityBoundaries?.[city];
  if (isValidGeoJsonFeatureCollection(cityBoundary)) {
    files.push({
      name: `city-boundaries/${safeName(city)}-boundary.geojson`,
      content: JSON.stringify(cityBoundary, null, 2),
    });
  }

  files.push(...buildCalculationFiles({
    reachableHullData: reachableHullData || [],
    reachableRoadsData: reachableRoadsData || [],
    resultMetadata: resultMetadata || [],
    city,
  }));

  if (files.length === 0) {
    const error = new Error("No GeoJSON data is available for export.");
    error.name = "NoGeoJsonDataError";
    throw error;
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    city,
    fileCount: files.length,
    files: files.map((file) => file.name),
  };

  files.unshift({
    name: "manifest.json",
    content: JSON.stringify(manifest, null, 2),
  });

  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    createZipBlob(files),
    `cat-geojson-${safeName(city)}-${date}.zip`
  );
};
