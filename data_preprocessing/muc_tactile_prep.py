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
import os


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

# Rename your three QuickOSM layers in QGIS to these names before running
# the script, or change the constants below to match your actual layer names.
POINTS_LAYER_NAME = "tactile_paving — tactile_points"
LINES_LAYER_NAME = "tactile_paving — tactile_lines"
POLYGONS_LAYER_NAME = "tactile_paving — tactile_polygons"

OUTPUT_DIR = Path(r"C:\Users\ritaMZ\Documents\CAT\muc_weights")

POINTS_OUTPUT_GPKG = OUTPUT_DIR / "muc_tactile_points_tmp_clean.gpkg"
LINES_OUTPUT_GPKG = OUTPUT_DIR / "muc_tactile_lines_tmp_clean.gpkg"
POLYGONS_OUTPUT_GPKG = OUTPUT_DIR / "muc_tactile_polygons_tmp_clean.gpkg"

POINTS_OUTPUT_LAYER_NAME = "muc_tactile_points_tmp_clean"
LINES_OUTPUT_LAYER_NAME = "muc_tactile_lines_tmp_clean"
POLYGONS_OUTPUT_LAYER_NAME = "muc_tactile_polygons_tmp_clean"

TARGET_CRS = QgsCoordinateReferenceSystem("EPSG:4326")


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

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
    # Pick the largest layer with the given name to avoid stale duplicate layers
    layers = QgsProject.instance().mapLayersByName(name)

    if not layers:
        raise Exception(
            f"Layer not found: {name}\n"
            f"Rename the corresponding QuickOSM layer to '{name}' "
            f"or change the constant at the top of the script."
        )

    return max(layers, key=lambda layer: layer.featureCount())


def make_transformer(source_layer):
    # Create a CRS transformer only when the source CRS differs from EPSG:4326
    if source_layer.crs().isValid() and source_layer.crs() != TARGET_CRS:
        return QgsCoordinateTransform(
            source_layer.crs(),
            TARGET_CRS,
            QgsProject.instance()
        )

    return None


def transform_geometry(geometry, transformer):
    # Return a copied geometry transformed to EPSG:4326
    if geometry is None or geometry.isNull():
        return None

    result = QgsGeometry(geometry)

    if transformer is not None:
        result.transform(transformer)

    return result


def normalize_osm_type(osm_type, full_id):
    # Normalize OSM object type from QuickOSM fields
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


def remove_file_if_exists(path):
    # Remove an old GeoPackage before writing a fresh one
    if path.exists():
        os.remove(str(path))


def geometry_memory_uri(source_layer, expected_geometry_type):
    # Preserve single/multi geometry where practical
    wkb_name = QgsWkbTypes.displayString(source_layer.wkbType())

    if expected_geometry_type == QgsWkbTypes.PointGeometry:
        return (
            "MultiPoint?crs=EPSG:4326"
            if "MultiPoint" in wkb_name
            else "Point?crs=EPSG:4326"
        )

    if expected_geometry_type == QgsWkbTypes.LineGeometry:
        return (
            "MultiLineString?crs=EPSG:4326"
            if "MultiLineString" in wkb_name
            else "LineString?crs=EPSG:4326"
        )

    if expected_geometry_type == QgsWkbTypes.PolygonGeometry:
        return (
            "MultiPolygon?crs=EPSG:4326"
            if "MultiPolygon" in wkb_name
            else "Polygon?crs=EPSG:4326"
        )

    raise Exception("Unsupported geometry type")


def clean_tactile_layer(
    source_layer,
    output_layer_name,
    output_path,
    expected_geometry_type,
):
    # Build a minimal clean staging layer for Supabase/PostGIS
    fields = source_layer.fields()
    transformer = make_transformer(source_layer)

    memory_uri = geometry_memory_uri(source_layer, expected_geometry_type)

    output_layer = QgsVectorLayer(
        memory_uri,
        output_layer_name,
        "memory"
    )

    provider = output_layer.dataProvider()

    # Do not create a field literally named "fid".
    # GeoPackage already uses FID internally as its primary feature id.
    # source_fid preserves the original QGIS feature id safely.
    provider.addAttributes([
        QgsField("source_fid", QVariant.LongLong),
        QgsField("full_id", QVariant.String),
        QgsField("osm_id", QVariant.String),
        QgsField("osm_type", QVariant.String),
        QgsField("level", QVariant.String),
    ])

    output_layer.updateFields()

    source_count = 0
    kept_count = 0
    skipped_bad_geometry_count = 0
    skipped_not_yes_count = 0

    output_features = []

    tactile_field_exists = fields.indexFromName("tactile_paving") != -1

    for source_feature in source_layer.getFeatures():
        source_count += 1

        # Keep only tactile_paving=yes when the field exists.
        # This protects against accidentally cleaning an unfiltered QuickOSM layer.
        if tactile_field_exists:
            tactile_value = get_attr(
                source_feature,
                fields,
                "tactile_paving"
            ).lower()

            if tactile_value != "yes":
                skipped_not_yes_count += 1
                continue

        geometry = transform_geometry(
            source_feature.geometry(),
            transformer
        )

        if geometry is None or geometry.isNull():
            skipped_bad_geometry_count += 1
            continue

        if QgsWkbTypes.geometryType(geometry.wkbType()) != expected_geometry_type:
            skipped_bad_geometry_count += 1
            continue

        full_id = get_attr(source_feature, fields, "full_id")
        osm_id = get_attr(source_feature, fields, "osm_id")
        raw_osm_type = get_attr(source_feature, fields, "osm_type")
        osm_type = normalize_osm_type(raw_osm_type, full_id)
        level = get_attr(source_feature, fields, "level")

        # Apply a reasonable fallback when QuickOSM does not provide osm_type.
        if not osm_type:
            if expected_geometry_type == QgsWkbTypes.PointGeometry:
                osm_type = "node"
            else:
                osm_type = "way"

        output_feature = QgsFeature(output_layer.fields())
        output_feature.setGeometry(geometry)

        output_feature["source_fid"] = source_feature.id()
        output_feature["full_id"] = full_id
        output_feature["osm_id"] = osm_id
        output_feature["osm_type"] = osm_type
        output_feature["level"] = level

        output_features.append(output_feature)
        kept_count += 1

    provider.addFeatures(output_features)
    output_layer.updateExtents()

    remove_file_if_exists(output_path)

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.fileEncoding = "UTF-8"
    options.actionOnExistingFile = QgsVectorFileWriter.CreateOrOverwriteFile
    options.layerName = output_layer_name

    writer_result = QgsVectorFileWriter.writeAsVectorFormatV3(
        output_layer,
        str(output_path),
        QgsProject.instance().transformContext(),
        options
    )

    QgsProject.instance().addMapLayer(output_layer)

    return {
        "source_count": source_count,
        "kept_count": kept_count,
        "skipped_bad_geometry_count": skipped_bad_geometry_count,
        "skipped_not_yes_count": skipped_not_yes_count,
        "output_path": output_path,
        "writer_result": writer_result,
    }


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

points_layer = get_layer_by_name(POINTS_LAYER_NAME)
lines_layer = get_layer_by_name(LINES_LAYER_NAME)
polygons_layer = get_layer_by_name(POLYGONS_LAYER_NAME)

points_result = clean_tactile_layer(
    points_layer,
    POINTS_OUTPUT_LAYER_NAME,
    POINTS_OUTPUT_GPKG,
    QgsWkbTypes.PointGeometry,
)

lines_result = clean_tactile_layer(
    lines_layer,
    LINES_OUTPUT_LAYER_NAME,
    LINES_OUTPUT_GPKG,
    QgsWkbTypes.LineGeometry,
)

polygons_result = clean_tactile_layer(
    polygons_layer,
    POLYGONS_OUTPUT_LAYER_NAME,
    POLYGONS_OUTPUT_GPKG,
    QgsWkbTypes.PolygonGeometry,
)


print("Tactile paving cleanup finished.")
print("")

for label, result in [
    ("Points", points_result),
    ("Lines", lines_result),
    ("Polygons", polygons_result),
]:
    print(f"{label}:")
    print(f"  Source features: {result['source_count']}")
    print(f"  Kept tactile_paving=yes: {result['kept_count']}")
    print(f"  Skipped non-yes: {result['skipped_not_yes_count']}")
    print(f"  Skipped bad geometry: {result['skipped_bad_geometry_count']}")
    print(f"  Output GPKG: {result['output_path']}")
    print(f"  Writer result: {result['writer_result']}")
    print("")
