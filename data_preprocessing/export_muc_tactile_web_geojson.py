from qgis.core import (
    QgsProject,
    QgsVectorLayer,
    QgsFeature,
    QgsGeometry,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsVectorFileWriter,
    QgsWkbTypes,
)
from pathlib import Path


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

POINTS_LAYER_NAME = "muc_tactile_points_tmp_clean"
LINES_LAYER_NAME = "muc_tactile_lines_tmp_clean"
POLYGONS_LAYER_NAME = "muc_tactile_polygons_tmp_clean"

OUTPUT_DIR = Path(
    r"C:\Users\ritaMZ\WebstormProjects\InclusiveSpace\public\data\munich"
)

TARGET_CRS = QgsCoordinateReferenceSystem("EPSG:4326")


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def get_layer(name):
    # Pick the largest matching layer to avoid stale duplicate layers
    layers = QgsProject.instance().mapLayersByName(name)

    if not layers:
        raise Exception(f"Layer not found in QGIS project: {name}")

    return max(layers, key=lambda layer: layer.featureCount())


def transformed_geometries(layer, expected_type):
    # Copy valid geometries and transform them to EPSG:4326 when necessary
    transformer = None

    if layer.crs().isValid() and layer.crs() != TARGET_CRS:
        transformer = QgsCoordinateTransform(
            layer.crs(),
            TARGET_CRS,
            QgsProject.instance(),
        )

    geometries = []

    for feature in layer.getFeatures():
        geometry = feature.geometry()

        if geometry is None or geometry.isNull() or geometry.isEmpty():
            continue

        geometry = QgsGeometry(geometry)

        if transformer is not None:
            geometry.transform(transformer)

        if QgsWkbTypes.geometryType(geometry.wkbType()) != expected_type:
            continue

        geometries.append(geometry)

    return geometries


def write_single_feature_geojson(
    source_layer,
    expected_type,
    output_name,
):
    # Combine all source features into one homogeneous multi-geometry feature.
    # No source attributes are copied because this layer is visualization-only.
    geometries = transformed_geometries(source_layer, expected_type)

    if not geometries:
        raise Exception(f"No valid geometries found in {source_layer.name()}")

    combined = QgsGeometry.collectGeometry(geometries)

    if combined is None or combined.isNull() or combined.isEmpty():
        raise Exception(f"Could not combine geometries for {source_layer.name()}")

    if expected_type == QgsWkbTypes.PointGeometry:
        uri = "MultiPoint?crs=EPSG:4326"
    elif expected_type == QgsWkbTypes.LineGeometry:
        uri = "MultiLineString?crs=EPSG:4326"
    elif expected_type == QgsWkbTypes.PolygonGeometry:
        uri = "MultiPolygon?crs=EPSG:4326"
    else:
        raise Exception("Unsupported geometry type")

    output_layer = QgsVectorLayer(uri, output_name, "memory")
    provider = output_layer.dataProvider()

    feature = QgsFeature(output_layer.fields())
    feature.setGeometry(combined)

    provider.addFeature(feature)
    output_layer.updateExtents()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{output_name}.geojson"

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"
    options.fileEncoding = "UTF-8"
    options.actionOnExistingFile = QgsVectorFileWriter.CreateOrOverwriteFile

    # RFC 7946 produces standard web-friendly GeoJSON.
    # Seven decimal places are about centimetre-level precision at Munich's latitude.
    options.layerOptions = [
        "RFC7946=YES",
        "COORDINATE_PRECISION=7",
    ]

    result = QgsVectorFileWriter.writeAsVectorFormatV3(
        output_layer,
        str(output_path),
        QgsProject.instance().transformContext(),
        options,
    )

    print(
        f"{source_layer.name()}: "
        f"{source_layer.featureCount()} source features -> "
        f"1 web feature -> {output_path}"
    )
    print(f"Writer result: {result}")
    print("")

    return output_path


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

points_layer = get_layer(POINTS_LAYER_NAME)
lines_layer = get_layer(LINES_LAYER_NAME)
polygons_layer = get_layer(POLYGONS_LAYER_NAME)

write_single_feature_geojson(
    points_layer,
    QgsWkbTypes.PointGeometry,
    "muc_tactile_points",
)

write_single_feature_geojson(
    lines_layer,
    QgsWkbTypes.LineGeometry,
    "muc_tactile_lines",
)

write_single_feature_geojson(
    polygons_layer,
    QgsWkbTypes.PolygonGeometry,
    "muc_tactile_polygons",
)

print("Tactile web GeoJSON export finished.")
