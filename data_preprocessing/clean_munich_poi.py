from __future__ import annotations

import json
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd


BASE_DIR = Path(
    r"C:\path\to\your\project\public\data\POI"
)

OUTPUT_DIR = BASE_DIR / "_cleaned"

FILES = {
    "gastronomy": "poi_muc_gastronomy.geojson",
    "health": "poi_muc_health.geojson",
    "kita_schule": "poi_muc_kita_schule.geojson",
    "uni_fh": "poi_muc_uni_fh.geojson",
    "park_spiel": "poi_muc_park_spiel.geojson",
    "supermarket": "poi_muc_supermarket.geojson",
}

CHECKPOINT_FILE = OUTPUT_DIR / "_checkpoint.json"
REPORT_FILE = OUTPUT_DIR / "_report.json"
SUPABASE_FILE = OUTPUT_DIR / "poi_muc_amenities_supabase.geojson"

EMPTY_TEXT_VALUES = {
    "",
    "null",
    "none",
    "nan",
    "<null>",
}


def load_checkpoint() -> dict:
    if not CHECKPOINT_FILE.exists():
        return {"files": {}}

    with CHECKPOINT_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_checkpoint(state: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    temp_file = CHECKPOINT_FILE.with_suffix(".tmp")

    with temp_file.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    os.replace(temp_file, CHECKPOINT_FILE)


def get_fingerprint(path: Path) -> dict:
    stat = path.stat()

    return {
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
    }


def is_effectively_empty(series: pd.Series) -> bool:
    if series.isna().all():
        return True

    as_text = (
        series
        .astype("string")
        .str.strip()
        .str.lower()
    )

    empty_mask = (
        series.isna()
        | as_text.isin(EMPTY_TEXT_VALUES)
    )

    return bool(empty_mask.all())


def atomic_write_geojson(
    gdf: gpd.GeoDataFrame,
    output_path: Path,
) -> None:
    temp_path = output_path.with_name(
        f"{output_path.stem}.tmp.geojson"
    )

    if temp_path.exists():
        temp_path.unlink()

    gdf.to_file(
        temp_path,
        driver="GeoJSON",
        engine="pyogrio",
    )

    os.replace(temp_path, output_path)


def normalize_crs(
    gdf: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        # GeoJSON coordinates are expected to be WGS84 here.
        return gdf.set_crs(
            "EPSG:4326",
            allow_override=True,
        )

    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs("EPSG:4326")

    return gdf


def clean_layer(
    input_path: Path,
    output_path: Path,
) -> tuple[gpd.GeoDataFrame, dict]:
    print(f"\nReading: {input_path.name}")

    gdf = gpd.read_file(
        input_path,
        engine="pyogrio",
    )

    original_feature_count = len(gdf)
    original_geometry_count = int(gdf.geometry.notna().sum())

    gdf = normalize_crs(gdf)

    geometry_column = gdf.geometry.name

    empty_columns = []

    for column in gdf.columns:
        if column == geometry_column:
            continue

        if is_effectively_empty(gdf[column]):
            empty_columns.append(column)

    cleaned = gdf.drop(
        columns=empty_columns,
        errors="ignore",
    )

    if len(cleaned) != original_feature_count:
        raise RuntimeError(
            f"Feature count changed for {input_path.name}"
        )

    if int(cleaned.geometry.notna().sum()) != original_geometry_count:
        raise RuntimeError(
            f"Geometry count changed for {input_path.name}"
        )

    print(
        f"Features: {original_feature_count}"
    )
    print(
        f"Columns before: {len(gdf.columns)}"
    )
    print(
        f"Empty columns removed: {len(empty_columns)}"
    )
    print(
        f"Columns after: {len(cleaned.columns)}"
    )

    atomic_write_geojson(
        cleaned,
        output_path,
    )

    # Re-open the saved file to verify that no features were lost.
    verified = gpd.read_file(
        output_path,
        engine="pyogrio",
    )

    if len(verified) != original_feature_count:
        raise RuntimeError(
            f"Saved GeoJSON lost features: {output_path.name}"
        )

    stats = {
        "input": input_path.name,
        "output": output_path.name,
        "features": original_feature_count,
        "geometry_features": original_geometry_count,
        "columns_before": len(gdf.columns),
        "columns_after": len(cleaned.columns),
        "removed_columns": empty_columns,
    }

    return cleaned, stats


def get_string_column(
    gdf: gpd.GeoDataFrame,
    column: str,
) -> pd.Series:
    if column not in gdf.columns:
        return pd.Series(
            pd.NA,
            index=gdf.index,
            dtype="string",
        )

    return gdf[column].astype("string")


def build_supabase_layer(
    layers: list[tuple[str, gpd.GeoDataFrame]],
) -> tuple[gpd.GeoDataFrame, int]:
    frames = []

    for poi_group, gdf in layers:
        frame = gpd.GeoDataFrame(
            {
                "poi_group": poi_group,
                "full_id": get_string_column(
                    gdf,
                    "full_id",
                ),
                "osm_id": get_string_column(
                    gdf,
                    "osm_id",
                ),
                "osm_type": get_string_column(
                    gdf,
                    "osm_type",
                ),
                "name": get_string_column(
                    gdf,
                    "name",
                ),
            },
            geometry=gdf.geometry.copy(),
            crs="EPSG:4326",
        )

        frames.append(frame)

    combined = gpd.GeoDataFrame(
        pd.concat(
            frames,
            ignore_index=True,
        ),
        geometry="geometry",
        crs="EPSG:4326",
    )

    # Create a fallback full_id only when stable OSM identifiers exist.
    full_id_missing = (
        combined["full_id"].isna()
        | combined["full_id"].str.strip().eq("")
    )

    has_osm_identity = (
        combined["osm_type"].notna()
        & combined["osm_id"].notna()
        & combined["osm_type"].str.strip().ne("")
        & combined["osm_id"].str.strip().ne("")
    )

    fallback_mask = (
        full_id_missing
        & has_osm_identity
    )

    combined.loc[
        fallback_mask,
        "full_id",
    ] = (
        combined.loc[
            fallback_mask,
            "osm_type",
        ].str.strip()
        + ":"
        + combined.loc[
            fallback_mask,
            "osm_id",
        ].str.strip()
    )

    # Only deduplicate rows that have a stable OSM identity.
    has_key = (
        combined["full_id"].notna()
        & combined["full_id"].str.strip().ne("")
    )

    with_key = combined.loc[
        has_key
    ].copy()

    without_key = combined.loc[
        ~has_key
    ].copy()

    original_count = len(combined)

    if not with_key.empty:
        category_map = (
            with_key
            .groupby("full_id")["poi_group"]
            .agg(
                lambda values: "|".join(
                    sorted(set(values))
                )
            )
        )

        with_key = (
            with_key
            .drop_duplicates(
                subset=["full_id"],
                keep="first",
            )
            .copy()
        )

        with_key["poi_group"] = (
            with_key["full_id"]
            .map(category_map)
        )

    result = gpd.GeoDataFrame(
        pd.concat(
            [
                with_key,
                without_key,
            ],
            ignore_index=True,
        ),
        geometry="geometry",
        crs="EPSG:4326",
    )

    duplicates_removed = (
        original_count - len(result)
    )

    return result, duplicates_removed


def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    checkpoint = load_checkpoint()

    cleaned_layers = []
    report = {
        "layers": {},
    }

    for poi_group, filename in FILES.items():
        input_path = BASE_DIR / filename

        if not input_path.exists():
            raise FileNotFoundError(
                f"Missing input file: {input_path}"
            )

        output_path = (
            OUTPUT_DIR
            / f"{input_path.stem}_clean.geojson"
        )

        fingerprint = get_fingerprint(
            input_path
        )

        previous = (
            checkpoint
            .get("files", {})
            .get(filename)
        )

        if (
            previous
            and previous.get("fingerprint")
            == fingerprint
            and output_path.exists()
        ):
            print(
                f"\nSkipping already processed file: "
                f"{filename}"
            )

            cleaned = gpd.read_file(
                output_path,
                engine="pyogrio",
            )

            stats = previous.get(
                "stats",
                {},
            )

        else:
            cleaned, stats = clean_layer(
                input_path,
                output_path,
            )

            checkpoint.setdefault(
                "files",
                {},
            )[filename] = {
                "fingerprint": fingerprint,
                "stats": stats,
            }

            # Save progress after every layer.
            save_checkpoint(
                checkpoint
            )

        cleaned_layers.append(
            (
                poi_group,
                cleaned,
            )
        )

        report["layers"][
            filename
        ] = stats

    print(
        "\nBuilding minimal Supabase layer..."
    )

    supabase_layer, duplicates_removed = (
        build_supabase_layer(
            cleaned_layers
        )
    )

    atomic_write_geojson(
        supabase_layer,
        SUPABASE_FILE,
    )

    report["supabase"] = {
        "file": SUPABASE_FILE.name,
        "features": len(
            supabase_layer
        ),
        "duplicates_collapsed": (
            duplicates_removed
        ),
        "columns": list(
            supabase_layer.columns
        ),
    }

    with REPORT_FILE.open(
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            report,
            f,
            ensure_ascii=False,
            indent=2,
        )

    print("\nDone.")
    print(
        f"Supabase features: "
        f"{len(supabase_layer)}"
    )
    print(
        f"Duplicate OSM objects collapsed: "
        f"{duplicates_removed}"
    )
    print(
        f"Supabase file: "
        f"{SUPABASE_FILE}"
    )


if __name__ in ("__main__", "__console__"):
    main()