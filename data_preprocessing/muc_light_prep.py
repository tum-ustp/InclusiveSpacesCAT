from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    NULL,
    QgsProject,
    QgsVectorLayer,
    QgsField,
    QgsFeature,
    QgsGeometry,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsWkbTypes,
    QgsVectorFileWriter,
    QgsVariantUtils,
)
from pathlib import Path
import csv
import os


POINTS_LAYER_NAME = "raw_osm_lighting_points"
LINES_LAYER_NAME = "raw_osm_lit_highways"

OUTPUT_DIR = Path(r"C:\Users\ritaMZ\Documents\CAT")

LAMPS_OUTPUT_GPKG = OUTPUT_DIR / "muc_street_lamps_tmp_clean.gpkg"
LIT_WAYS_OUTPUT_GPKG = OUTPUT_DIR / "muc_lit_highway_ways_tmp_clean.gpkg"
LIT_WAYS_OUTPUT_CSV = OUTPUT_DIR / "muc_lit_highway_ways_tmp_clean.csv"

LAMPS_OUTPUT_LAYER_NAME = "muc_street_lamps_tmp_clean"
LIT_WAYS_OUTPUT_LAYER_NAME = "muc_lit_highway_ways_tmp_clean"

TARGET_CRS = QgsCoordinateReferenceSystem("EPSG:4326")


def is_qgis_null(value):
    # Detect QGIS NULL, QVariant NULL, Python None, and string-like NULL values
    if value is None:
        return True

    try:
        if QgsVariantUtils.isNull(value):
            return True
    except Exception:
        pass

    try:
        if value == NULL:
            return True
    except Exception:
        pass

    text = str(value).strip()

    return text == "" or text.upper() in ("NULL", "<NULL>", "NONE")


def clean_value(value):
    # Convert QGIS values to clean strings
    if is_qgis_null(value):
        return ""

    return str(value).strip()


def get_attr(feature, fields, name):
    # Read an attribute by field name safely
    index = fields.indexFromName(name)

    if index == -1:
        return ""

    return clean_value(feature.attribute(index))


def get_layer_by_name(name):
    # Pick the largest layer with the given name to avoid old duplicate temporary layers
    layers = QgsProject.instance().mapLayersByName(name)

    if not layers:
        raise Exception(f"Layer not found: {name}")

    return max(layers, key=lambda layer: layer.featureCount())


def make_transformer(source_layer):
    # Create CRS transformer only if needed
    if source_layer.crs().isValid() and source_layer.crs() != TARGET_CRS:
        return QgsCoordinateTransform(
            source_layer.crs(),
            TARGET_CRS,
            QgsProject.instance()
        )

    return None


def transform_geometry(geometry, transformer):
    # Return geometry in EPSG:4326 without mutating the source feature
    if geometry is None or geometry.isNull():
        return None

    result = QgsGeometry(geometry)

    if transformer is not None:
        result.transform(transformer)

    return result


def normalize_osm_type(osm_type, full_id):
    # Normalize OSM object type
    osm_type = clean_value(osm_type).lower()
    full_id = clean_value(full_id).lower()

    if osm_type in ("node", "way", "relation"):
        return osm_type

    if osm_type == "n":
        return "node"

    if osm_type == "w":
        return "way"

    if osm_type == "r":
        return "relation"

    if full_id.startswith("n"):
        return "node"

    if full_id.startswith("w"):
        return "way"

    if full_id.startswith("r"):
        return "relation"

    return ""


def build_object_id(prefix, full_id, osm_type, osm_id, fallback_id):
    # Build a stable id where possible, with a QGIS feature id fallback
    full_id = clean_value(full_id)
    osm_type = clean_value(osm_type)
    osm_id = clean_value(osm_id)

    if full_id:
        return f"osm:{full_id}"

    if osm_type and osm_id:
        return f"osm:{osm_type}:{osm_id}"

    if osm_id:
        return f"osm:{osm_id}"

    return f"{prefix}:qgis:{fallback_id}"


def remove_file_if_exists(path):
    # Remove existing output file before writing a fresh layer
    if path.exists():
        os.remove(str(path))


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

points_layer = get_layer_by_name(POINTS_LAYER_NAME)
lines_layer = get_layer_by_name(LINES_LAYER_NAME)

points_fields = points_layer.fields()
lines_fields = lines_layer.fields()

points_transformer = make_transformer(points_layer)
lines_transformer = make_transformer(lines_layer)


# -------------------------
# Build clean street lamps
# -------------------------

lamps_layer = QgsVectorLayer(
    "Point?crs=EPSG:4326",
    LAMPS_OUTPUT_LAYER_NAME,
    "memory"
)

lamps_provider = lamps_layer.dataProvider()

lamps_provider.addAttributes([
    QgsField("lamp_id", QVariant.String),
    QgsField("full_id", QVariant.String),
    QgsField("osm_id", QVariant.String),
    QgsField("osm_type", QVariant.String),
    QgsField("source", QVariant.String),
])

lamps_layer.updateFields()

lamp_features = []
seen_lamp_ids = set()

source_point_count = 0
kept_lamp_count = 0
skipped_not_lamp_count = 0
skipped_bad_point_geometry_count = 0

for source_feature in points_layer.getFeatures():
    source_point_count += 1

    highway = get_attr(source_feature, points_fields, "highway")

    if highway != "street_lamp":
        skipped_not_lamp_count += 1
        continue

    geometry = transform_geometry(source_feature.geometry(), points_transformer)

    if geometry is None or geometry.isNull():
        skipped_bad_point_geometry_count += 1
        continue

    if QgsWkbTypes.geometryType(geometry.wkbType()) != QgsWkbTypes.PointGeometry:
        skipped_bad_point_geometry_count += 1
        continue

    full_id = get_attr(source_feature, points_fields, "full_id")
    osm_id = get_attr(source_feature, points_fields, "osm_id")
    raw_osm_type = get_attr(source_feature, points_fields, "osm_type")
    osm_type = normalize_osm_type(raw_osm_type, full_id)

    if not osm_type:
        osm_type = "node"

    lamp_id = build_object_id("lamp", full_id, osm_type, osm_id, source_feature.id())

    if lamp_id in seen_lamp_ids:
        lamp_id = f"{lamp_id}:fid:{source_feature.id()}"

    seen_lamp_ids.add(lamp_id)

    output_feature = QgsFeature(lamps_layer.fields())
    output_feature.setGeometry(geometry)

    output_feature["lamp_id"] = lamp_id
    output_feature["full_id"] = full_id
    output_feature["osm_id"] = osm_id
    output_feature["osm_type"] = osm_type
    output_feature["source"] = "osm"

    lamp_features.append(output_feature)
    kept_lamp_count += 1

lamps_provider.addFeatures(lamp_features)
lamps_layer.updateExtents()
QgsProject.instance().addMapLayer(lamps_layer)


# -------------------------
# Build clean lit highway ways
# -------------------------

line_wkb_name = QgsWkbTypes.displayString(lines_layer.wkbType())

if "MultiLineString" in line_wkb_name:
    line_memory_uri = "MultiLineString?crs=EPSG:4326"
else:
    line_memory_uri = "LineString?crs=EPSG:4326"

lit_ways_layer = QgsVectorLayer(
    line_memory_uri,
    LIT_WAYS_OUTPUT_LAYER_NAME,
    "memory"
)

lit_ways_provider = lit_ways_layer.dataProvider()

lit_ways_provider.addAttributes([
    QgsField("way_id", QVariant.String),
    QgsField("full_id", QVariant.String),
    QgsField("osm_id", QVariant.String),
    QgsField("osm_type", QVariant.String),
    QgsField("highway", QVariant.String),
    QgsField("lit", QVariant.String),
    QgsField("source", QVariant.String),
])

lit_ways_layer.updateFields()

lit_way_features = []
lit_way_csv_rows = []
seen_way_ids = set()

source_line_count = 0
kept_lit_way_count = 0
skipped_no_lit_count = 0
skipped_bad_line_geometry_count = 0

for source_feature in lines_layer.getFeatures():
    source_line_count += 1

    highway = get_attr(source_feature, lines_fields, "highway")
    lit = get_attr(source_feature, lines_fields, "lit").lower()

    if not highway or not lit:
        skipped_no_lit_count += 1
        continue

    geometry = transform_geometry(source_feature.geometry(), lines_transformer)

    if geometry is None or geometry.isNull():
        skipped_bad_line_geometry_count += 1
        continue

    if QgsWkbTypes.geometryType(geometry.wkbType()) != QgsWkbTypes.LineGeometry:
        skipped_bad_line_geometry_count += 1
        continue

    full_id = get_attr(source_feature, lines_fields, "full_id")
    osm_id = get_attr(source_feature, lines_fields, "osm_id")
    raw_osm_type = get_attr(source_feature, lines_fields, "osm_type")
    osm_type = normalize_osm_type(raw_osm_type, full_id)

    if not osm_type:
        osm_type = "way"

    way_id = build_object_id("way", full_id, osm_type, osm_id, source_feature.id())

    if way_id in seen_way_ids:
        way_id = f"{way_id}:fid:{source_feature.id()}"

    seen_way_ids.add(way_id)

    output_feature = QgsFeature(lit_ways_layer.fields())
    output_feature.setGeometry(geometry)

    output_feature["way_id"] = way_id
    output_feature["full_id"] = full_id
    output_feature["osm_id"] = osm_id
    output_feature["osm_type"] = osm_type
    output_feature["highway"] = highway
    output_feature["lit"] = lit
    output_feature["source"] = "osm"

    lit_way_features.append(output_feature)

    lit_way_csv_rows.append({
        "way_id": way_id,
        "full_id": full_id,
        "osm_id": osm_id,
        "osm_type": osm_type,
        "highway": highway,
        "lit": lit,
        "source": "osm",
    })

    kept_lit_way_count += 1

lit_ways_provider.addFeatures(lit_way_features)
lit_ways_layer.updateExtents()
QgsProject.instance().addMapLayer(lit_ways_layer)


# -------------------------
# Write output files
# -------------------------

remove_file_if_exists(LAMPS_OUTPUT_GPKG)
remove_file_if_exists(LIT_WAYS_OUTPUT_GPKG)
remove_file_if_exists(LIT_WAYS_OUTPUT_CSV)

gpkg_options = QgsVectorFileWriter.SaveVectorOptions()
gpkg_options.driverName = "GPKG"
gpkg_options.fileEncoding = "UTF-8"
gpkg_options.actionOnExistingFile = QgsVectorFileWriter.CreateOrOverwriteFile

gpkg_options.layerName = LAMPS_OUTPUT_LAYER_NAME
lamps_write_result = QgsVectorFileWriter.writeAsVectorFormatV3(
    lamps_layer,
    str(LAMPS_OUTPUT_GPKG),
    QgsProject.instance().transformContext(),
    gpkg_options
)

gpkg_options.layerName = LIT_WAYS_OUTPUT_LAYER_NAME
lit_ways_write_result = QgsVectorFileWriter.writeAsVectorFormatV3(
    lit_ways_layer,
    str(LIT_WAYS_OUTPUT_GPKG),
    QgsProject.instance().transformContext(),
    gpkg_options
)

with open(LIT_WAYS_OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(
        file,
        fieldnames=["way_id", "full_id", "osm_id", "osm_type", "highway", "lit", "source"]
    )
    writer.writeheader()
    writer.writerows(lit_way_csv_rows)


print("Lighting staging cleanup finished.")
print("")
print("Street lamps:")
print(f"  Source point features: {source_point_count}")
print(f"  Kept lamps: {kept_lamp_count}")
print(f"  Skipped non-lamps: {skipped_not_lamp_count}")
print(f"  Skipped bad point geometry: {skipped_bad_point_geometry_count}")
print(f"  Output GPKG: {LAMPS_OUTPUT_GPKG}")
print(f"  Writer result: {lamps_write_result}")
print("")
print("Lit highway ways:")
print(f"  Source line features: {source_line_count}")
print(f"  Kept lit ways: {kept_lit_way_count}")
print(f"  Skipped without highway/lit: {skipped_no_lit_count}")
print(f"  Skipped bad line geometry: {skipped_bad_line_geometry_count}")
print(f"  Output GPKG: {LIT_WAYS_OUTPUT_GPKG}")
print(f"  Output CSV: {LIT_WAYS_OUTPUT_CSV}")
print(f"  Writer result: {lit_ways_write_result}")