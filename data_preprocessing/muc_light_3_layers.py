from qgis.core import (
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsFeature,
    QgsGeometry,
    QgsField,
    QgsCoordinateReferenceSystem
)
from qgis.PyQt.QtCore import QVariant
import os


OUTPUT_DIR = r"C:\Users\ritaMZ\WebstormProjects\InclusiveSpace\public\data\munich"

LINES_LAYER_NAME = "muc_osm_lit_highways_visual"
LAMPS_LAYER_NAME = "muc_street_lamps_visual"

SIMPLIFY_TOLERANCE = 0.00001


def get_layer(name):
    layers = QgsProject.instance().mapLayersByName(name)

    if not layers:
        raise RuntimeError(f"Layer not found: {name}")

    return layers[0]


def normalize_lighting(feature):
    lighting = feature["lighting"] if "lighting" in feature.fields().names() else None
    lit = feature["lit"] if "lit" in feature.fields().names() else None

    value = lighting if lighting not in (None, "") else lit

    if value is None:
        return "unlit"

    value = str(value).strip().lower()

    if value in {"lit", "yes"}:
        return "lit"

    return "unlit"


def export_multiline(features, output_path, crs):
    line_parts = []

    for feature in features:
        geom = feature.geometry()

        if not geom or geom.isEmpty():
            continue

        simplified = geom.simplify(SIMPLIFY_TOLERANCE)

        if simplified.isMultipart():
            for part in simplified.asMultiPolyline():
                if len(part) >= 2:
                    line_parts.append(part)
        else:
            part = simplified.asPolyline()

            if len(part) >= 2:
                line_parts.append(part)

    layer = QgsVectorLayer(
        f"MultiLineString?crs={crs.authid()}",
        "optimized",
        "memory"
    )

    provider = layer.dataProvider()

    feature = QgsFeature()
    feature.setGeometry(QgsGeometry.fromMultiPolylineXY(line_parts))

    provider.addFeature(feature)

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"

    QgsVectorFileWriter.writeAsVectorFormatV3(
        layer,
        output_path,
        QgsProject.instance().transformContext(),
        options
    )


def export_points_without_attributes(source_layer, output_path):
    output_layer = QgsVectorLayer(
        f"Point?crs={source_layer.crs().authid()}",
        "street_lamps",
        "memory"
    )

    provider = output_layer.dataProvider()

    output_features = []

    for source_feature in source_layer.getFeatures():
        geom = source_feature.geometry()

        if not geom or geom.isEmpty():
            continue

        feature = QgsFeature()
        feature.setGeometry(geom)
        output_features.append(feature)

    provider.addFeatures(output_features)

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"

    QgsVectorFileWriter.writeAsVectorFormatV3(
        output_layer,
        output_path,
        QgsProject.instance().transformContext(),
        options
    )


os.makedirs(OUTPUT_DIR, exist_ok=True)

lines_layer = get_layer(LINES_LAYER_NAME)
lamps_layer = get_layer(LAMPS_LAYER_NAME)

lit_features = []
unlit_features = []

for feature in lines_layer.getFeatures():
    lighting_type = normalize_lighting(feature)

    if lighting_type == "lit":
        lit_features.append(feature)
    else:
        unlit_features.append(feature)


export_multiline(
    lit_features,
    os.path.join(OUTPUT_DIR, "muc_lighting_lit.geojson"),
    lines_layer.crs()
)

export_multiline(
    unlit_features,
    os.path.join(OUTPUT_DIR, "muc_lighting_unlit.geojson"),
    lines_layer.crs()
)

export_points_without_attributes(
    lamps_layer,
    os.path.join(OUTPUT_DIR, "muc_street_lamps_visual.geojson")
)

print("Done")
print(f"Lit source features: {len(lit_features)}")
print(f"Unlit source features: {len(unlit_features)}")