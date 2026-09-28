# -*- coding: utf-8 -*-
"""
Sample LDEN noise values from the LfU WMS for a QGIS point layer.

Run this file INSIDE QGIS (Python Console), not with normal system Python.

Expected loaded layers:
- Point layer: noise_sample_points
- WMS layer: Straßen gesamt LDEN 2022

The script adds/updates a Double field named db_value and fills it from
WMS GetFeatureInfo / Identify responses containing "Pegel in dB(A)".
"""

import html
import re
import time

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    NULL,
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsField,
    QgsPointXY,
    QgsProject,
    QgsRaster,
    QgsRectangle,
    QgsWkbTypes,
)


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

POINT_LAYER_NAME = "noise_sample_points"
WMS_LAYER_NAME = "Straßen gesamt LDEN 2022"
OUTPUT_FIELD = "db_value"

# Request extents are created in a metric CRS so these values are meters.
REQUEST_CRS_AUTHID = "EPSG:25832"
REQUEST_RADIUS_M = 20.0
REQUEST_WIDTH_PX = 101
REQUEST_HEIGHT_PX = 101
REQUEST_DPI = 96

# Write changes in batches so a long run can be resumed after interruption.
SAVE_EVERY = 100

# Small delay between public WMS requests.
REQUEST_DELAY_SECONDS = 0.05

# Existing non-null db_value values are skipped when False.
OVERWRITE_EXISTING = False

# Safe first run. After checking the results, change 100 to None for all points.
MAX_POINTS = None

# Enable only when debugging a few missing values.
DEBUG_MISSING_VALUES = False


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

DB_PATTERNS = [
    re.compile(
        r"Pegel\s*in\s*dB\s*\(\s*A\s*\)\s*[:=]?\s*"
        r"(-?\d+(?:[.,]\d+)?)",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"Pegel\s*in\s*dB\s*\(\s*A\s*\).*?"
        r"(-?\d+(?:[.,]\d+)?)",
        flags=re.IGNORECASE,
    ),
]


def get_single_layer(layer_name):
    """Return exactly one loaded QGIS layer by name."""
    layers = QgsProject.instance().mapLayersByName(layer_name)

    if not layers:
        raise RuntimeError(
            f'Layer "{layer_name}" was not found in the current QGIS project.'
        )

    if len(layers) > 1:
        raise RuntimeError(
            f'More than one layer named "{layer_name}" was found. '
            "Rename layers so the target layer name is unique."
        )

    return layers[0]


def is_null(value):
    """Return True for QGIS/Python null values."""
    return value is None or value == NULL


def strip_html(value):
    """Convert an HTML response to searchable plain text."""
    text = html.unescape(str(value))
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def flatten_result(value):
    """Recursively flatten QGIS identify result values into strings."""
    items = []

    if isinstance(value, dict):
        for key, child in value.items():
            items.append(str(key))
            items.extend(flatten_result(child))
    elif isinstance(value, (list, tuple, set)):
        for child in value:
            items.extend(flatten_result(child))
    else:
        items.append(str(value))

    return items


def extract_db_value(results):
    """Extract 'Pegel in dB(A)' as float from a WMS identify response."""
    plain_text = " ".join(strip_html(part) for part in flatten_result(results))
    plain_text = re.sub(r"\s+", " ", plain_text).strip()

    for pattern in DB_PATTERNS:
        match = pattern.search(plain_text)
        if match:
            return float(match.group(1).replace(",", ".")), plain_text

    return None, plain_text


def feature_point(feature):
    """Return a single QgsPointXY from a Point/MultiPoint feature."""
    geometry = feature.geometry()

    if geometry is None or geometry.isEmpty():
        return None

    if QgsWkbTypes.geometryType(geometry.wkbType()) != QgsWkbTypes.PointGeometry:
        raise RuntimeError("Input geometry must be Point or MultiPoint.")

    if QgsWkbTypes.isMultiType(geometry.wkbType()):
        points = geometry.asMultiPoint()
        return QgsPointXY(points[0]) if points else None

    return QgsPointXY(geometry.asPoint())


def build_identify_extent(
    point_in_source_crs,
    source_crs,
    request_crs,
    request_to_wms,
):
    """Build a small metric request extent and transform it to the WMS CRS."""
    source_to_request = QgsCoordinateTransform(
        source_crs,
        request_crs,
        QgsProject.instance().transformContext(),
    )

    p = source_to_request.transform(point_in_source_crs)

    lower_left = QgsPointXY(
        p.x() - REQUEST_RADIUS_M,
        p.y() - REQUEST_RADIUS_M,
    )
    upper_right = QgsPointXY(
        p.x() + REQUEST_RADIUS_M,
        p.y() + REQUEST_RADIUS_M,
    )

    lower_left_wms = request_to_wms.transform(lower_left)
    upper_right_wms = request_to_wms.transform(upper_right)

    return QgsRectangle(
        min(lower_left_wms.x(), upper_right_wms.x()),
        min(lower_left_wms.y(), upper_right_wms.y()),
        max(lower_left_wms.x(), upper_right_wms.x()),
        max(lower_left_wms.y(), upper_right_wms.y()),
    )


def flush_changes(layer, changes):
    """Write accumulated attribute changes to the point layer."""
    if not changes:
        return

    ok = layer.dataProvider().changeAttributeValues(changes)
    if not ok:
        raise RuntimeError(
            "Could not write attribute changes. Export the point layer to a local "
            "GeoPackage and run the script on that layer."
        )

    changes.clear()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main():
    project = QgsProject.instance()

    points_layer = get_single_layer(POINT_LAYER_NAME)
    wms_layer = get_single_layer(WMS_LAYER_NAME)

    if not points_layer.isValid():
        raise RuntimeError("The point layer is invalid.")

    if not wms_layer.isValid():
        raise RuntimeError("The WMS layer is invalid.")

    if QgsWkbTypes.geometryType(points_layer.wkbType()) != QgsWkbTypes.PointGeometry:
        raise RuntimeError(f'"{POINT_LAYER_NAME}" must be a point layer.')

    # Add the output field if it does not already exist.
    field_index = points_layer.fields().indexOf(OUTPUT_FIELD)

    if field_index == -1:
        ok = points_layer.dataProvider().addAttributes(
            [QgsField(OUTPUT_FIELD, QVariant.Double, len=20, prec=3)]
        )
        if not ok:
            raise RuntimeError(
                f'Could not add field "{OUTPUT_FIELD}". '
                "Use a writable local GeoPackage point layer."
            )

        points_layer.updateFields()
        field_index = points_layer.fields().indexOf(OUTPUT_FIELD)

    point_crs = points_layer.crs()
    wms_crs = wms_layer.crs()
    request_crs = QgsCoordinateReferenceSystem(REQUEST_CRS_AUTHID)

    if not point_crs.isValid():
        raise RuntimeError("The point layer CRS is invalid.")

    if not wms_crs.isValid():
        raise RuntimeError("The WMS layer CRS is invalid.")

    point_to_wms = QgsCoordinateTransform(
        point_crs,
        wms_crs,
        project.transformContext(),
    )
    request_to_wms = QgsCoordinateTransform(
        request_crs,
        wms_crs,
        project.transformContext(),
    )

    provider = wms_layer.dataProvider()

    print("=" * 72)
    print("LfU LDEN WMS sampling started")
    print(f"Point layer: {POINT_LAYER_NAME}")
    print(f"Point CRS: {point_crs.authid()}")
    print(f"WMS layer: {WMS_LAYER_NAME}")
    print(f"WMS CRS: {wms_crs.authid()}")
    print(f"Point count: {points_layer.featureCount()}")
    print(f"Output field: {OUTPUT_FIELD}")
    print(f"MAX_POINTS: {MAX_POINTS}")
    print("=" * 72)

    processed = 0
    sampled = 0
    missing = 0
    skipped = 0
    errors = 0
    changes = {}

    for feature in points_layer.getFeatures():
        if MAX_POINTS is not None and processed >= MAX_POINTS:
            break

        existing = feature[OUTPUT_FIELD]
        if not OVERWRITE_EXISTING and not is_null(existing):
            skipped += 1
            processed += 1
            continue

        try:
            source_point = feature_point(feature)

            if source_point is None:
                changes[feature.id()] = {field_index: None}
                missing += 1
                processed += 1
                continue

            wms_point = point_to_wms.transform(source_point)
            request_extent = build_identify_extent(
                source_point,
                point_crs,
                request_crs,
                request_to_wms,
            )

            identify_result = provider.identify(
                wms_point,
                QgsRaster.IdentifyFormatHtml,
                request_extent,
                REQUEST_WIDTH_PX,
                REQUEST_HEIGHT_PX,
                REQUEST_DPI,
            )

            if not identify_result.isValid():
                changes[feature.id()] = {field_index: None}
                missing += 1
            else:
                db_value, raw_text = extract_db_value(identify_result.results())

                if db_value is None:
                    changes[feature.id()] = {field_index: None}
                    missing += 1

                    if DEBUG_MISSING_VALUES:
                        print(
                            f"[No dB value] fid={feature.id()} "
                            f"response={raw_text[:1000]}"
                        )
                else:
                    changes[feature.id()] = {field_index: db_value}
                    sampled += 1

        except Exception as exc:
            changes[feature.id()] = {field_index: None}
            errors += 1
            print(f"[Error] fid={feature.id()}: {exc}")

        processed += 1

        if len(changes) >= SAVE_EVERY:
            flush_changes(points_layer, changes)
            points_layer.updateFields()
            QgsApplication.processEvents()

            print(
                f"Processed {processed} | dB {sampled} | "
                f"missing {missing} | errors {errors} | skipped {skipped}"
            )

        if REQUEST_DELAY_SECONDS > 0:
            time.sleep(REQUEST_DELAY_SECONDS)

    flush_changes(points_layer, changes)
    points_layer.updateFields()
    points_layer.triggerRepaint()

    print("=" * 72)
    print("LfU LDEN WMS sampling finished")
    print(f"Processed: {processed}")
    print(f"dB values written: {sampled}")
    print(f"No value returned: {missing}")
    print(f"Errors: {errors}")
    print(f"Skipped existing values: {skipped}")
    print("=" * 72)

    if MAX_POINTS is not None:
        print(
            f"TEST MODE is active: MAX_POINTS={MAX_POINTS}. "
            "After checking the result, set MAX_POINTS = None for the full layer."
        )


main()
