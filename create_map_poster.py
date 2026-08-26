#!/usr/bin/env python3
"""
City Map Poster Generator

This module generates beautiful, minimalist map posters for any city in the world.
It fetches OpenStreetMap data using OSMnx, applies customizable themes, and creates
high-quality poster-ready images with roads, water features, and parks.
"""

import argparse
import asyncio
import json
import math
import os
import pickle
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import cast

import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
import numpy as np
import osmnx as ox
from geopandas import GeoDataFrame
from geopy.geocoders import Nominatim
from lat_lon_parser import parse
from matplotlib.font_manager import FontProperties
from networkx import MultiDiGraph
from shapely import affinity
from shapely.geometry import LineString, MultiLineString, Point, box
from shapely.ops import polygonize, unary_union
from tqdm import tqdm

from font_management import load_fonts

# Optional bidirectional/RTL shaping support. These are used to correctly
# display Arabic, Hebrew and Farsi text, which matplotlib does not handle
# natively. If they are not installed we fall back to best-effort rendering.
try:
    from bidi.algorithm import get_display as _bidi_get_display

    _HAS_BIDI = True
except ImportError:  # pragma: no cover - optional dependency
    _HAS_BIDI = False

try:
    import arabic_reshaper as _arabic_reshaper

    _HAS_ARABIC_RESHAPER = True
except ImportError:  # pragma: no cover - optional dependency
    _HAS_ARABIC_RESHAPER = False


class CacheError(Exception):
    """Raised when a cache operation fails."""


CACHE_DIR_PATH = os.environ.get("CACHE_DIR", "cache")
CACHE_DIR = Path(CACHE_DIR_PATH)
CACHE_DIR.mkdir(exist_ok=True)

THEMES_DIR = "themes"
FONTS_DIR = "fonts"
POSTERS_DIR = "posters"

FILE_ENCODING = "utf-8"

FONTS = load_fonts()


def _cache_path(key: str) -> str:
    """
    Generate a safe cache file path from a cache key.

    Args:
        key: Cache key identifier

    Returns:
        Path to cache file with .pkl extension
    """
    safe = key.replace(os.sep, "_")
    return os.path.join(CACHE_DIR, f"{safe}.pkl")


def cache_get(key: str):
    """
    Retrieve a cached object by key.

    Args:
        key: Cache key identifier

    Returns:
        Cached object if found, None otherwise

    Raises:
        CacheError: If cache read operation fails
    """
    try:
        path = _cache_path(key)
        if not os.path.exists(path):
            return None
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        raise CacheError(f"Cache read failed: {e}") from e


def cache_set(key: str, value):
    """
    Store an object in the cache.

    Args:
        key: Cache key identifier
        value: Object to cache (must be picklable)

    Raises:
        CacheError: If cache write operation fails
    """
    try:
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)
        path = _cache_path(key)
        with open(path, "wb") as f:
            pickle.dump(value, f, protocol=pickle.HIGHEST_PROTOCOL)
    except Exception as e:
        raise CacheError(f"Cache write failed: {e}") from e


# Font loading now handled by font_management.py module


def is_latin_script(text):
    """
    Check if text is primarily Latin script.
    Used to determine if letter-spacing should be applied to city names.

    :param text: Text to analyze
    :return: True if text is primarily Latin script, False otherwise
    """
    if not text:
        return True

    latin_count = 0
    total_alpha = 0

    for char in text:
        if char.isalpha():
            total_alpha += 1
            # Latin Unicode ranges:
            # - Basic Latin: U+0000 to U+007F
            # - Latin-1 Supplement: U+0080 to U+00FF
            # - Latin Extended-A: U+0100 to U+017F
            # - Latin Extended-B: U+0180 to U+024F
            if ord(char) < 0x250:
                latin_count += 1

    # If no alphabetic characters, default to Latin (numbers, symbols, etc.)
    if total_alpha == 0:
        return True

    # Consider it Latin if >80% of alphabetic characters are Latin
    return (latin_count / total_alpha) > 0.8


def generate_output_filename(city, theme_name, output_format):
    """
    Generate unique output filename with city, theme, and datetime.
    """
    if not os.path.exists(POSTERS_DIR):
        os.makedirs(POSTERS_DIR)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    city_slug = city.lower().replace(" ", "_")
    ext = output_format.lower()
    filename = f"{city_slug}_{theme_name}_{timestamp}.{ext}"
    return os.path.join(POSTERS_DIR, filename)


def get_available_themes():
    """
    Scans the themes directory and returns a list of available theme names.
    """
    if not os.path.exists(THEMES_DIR):
        os.makedirs(THEMES_DIR)
        return []

    themes = []
    for file in sorted(os.listdir(THEMES_DIR)):
        if file.endswith(".json"):
            theme_name = file[:-5]  # Remove .json extension
            themes.append(theme_name)
    return themes


def load_theme(theme_name="terracotta"):
    """
    Load theme from JSON file in themes directory.
    """
    theme_file = os.path.join(THEMES_DIR, f"{theme_name}.json")

    if not os.path.exists(theme_file):
        print(f"⚠ Theme file '{theme_file}' not found. Using default terracotta theme.")
        # Fallback to embedded terracotta theme
        return {
            "name": "Terracotta",
            "description": "Mediterranean warmth - burnt orange and clay tones on cream",
            "bg": "#F5EDE4",
            "text": "#8B4513",
            "gradient_color": "#F5EDE4",
            "water": "#A8C4C4",
            "parks": "#E8E0D0",
            "road_motorway": "#A0522D",
            "road_primary": "#B8653A",
            "road_secondary": "#C9846A",
            "road_tertiary": "#D9A08A",
            "road_residential": "#E5C4B0",
            "road_default": "#D9A08A",
        }

    with open(theme_file, "r", encoding=FILE_ENCODING) as f:
        theme = json.load(f)
        print(f"✓ Loaded theme: {theme.get('name', theme_name)}")
        if "description" in theme:
            print(f"  {theme['description']}")
        return theme


# Load theme (can be changed via command line or input)
THEME = dict[str, str]()  # Will be loaded later


GRADIENT_RESOLUTION = 1024


def create_gradient_fade(ax, color, location="bottom", zorder=10):
    """
    Creates a smooth fade effect at the top or bottom of the map.

    Instead of a 256-entry ``ListedColormap`` (which produces visible color
    banding on dark themes), this builds a high-resolution float32 RGBA image
    and lets matplotlib's bilinear interpolation smooth it out. The result is
    free of the stair-stepping artifacts that plagued the old approach.
    """
    rgb = mcolors.to_rgb(color)

    # Build a tall (GRADIENT_RESOLUTION x 1) RGBA image in float32. Only the
    # alpha channel varies, going from fully opaque (touching the edge) to
    # fully transparent (fading into the map).
    image = np.empty((GRADIENT_RESOLUTION, 1, 4), dtype=np.float32)
    image[:, 0, 0] = rgb[0]
    image[:, 0, 1] = rgb[1]
    image[:, 0, 2] = rgb[2]

    if location == "bottom":
        # Opaque at the very bottom (row 0) fading to transparent upward.
        alpha = np.linspace(1.0, 0.0, GRADIENT_RESOLUTION, dtype=np.float32)
        extent_y_start = 0.0
        extent_y_end = 0.25
    else:
        # Transparent at the bottom of the band fading to opaque at the top.
        alpha = np.linspace(0.0, 1.0, GRADIENT_RESOLUTION, dtype=np.float32)
        extent_y_start = 0.75
        extent_y_end = 1.0

    image[:, 0, 3] = alpha

    xlim = ax.get_xlim()
    ylim = ax.get_ylim()
    y_range = ylim[1] - ylim[0]

    y_bottom = ylim[0] + y_range * extent_y_start
    y_top = ylim[0] + y_range * extent_y_end

    ax.imshow(
        image,
        extent=[xlim[0], xlim[1], y_bottom, y_top],
        aspect="auto",
        zorder=zorder,
        origin="lower",
        interpolation="bilinear",
    )


def rotate_graph(g_proj, angle_deg, origin):
    """
    Rotate a projected graph in place around an origin point.

    Both node coordinates and any precomputed edge geometries are rotated so
    that ``ox.plot_graph`` renders the map turned by ``angle_deg`` degrees
    (counter-clockwise). Used to align a city to a more pleasing angle, e.g.
    squaring up Manhattan or San Francisco's grid.

    Args:
        g_proj: Projected MultiDiGraph (modified in place).
        angle_deg: Rotation angle in degrees (counter-clockwise).
        origin: (x, y) tuple in the projected CRS to rotate around.
    """
    if not angle_deg:
        return g_proj

    theta = math.radians(angle_deg)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    ox0, oy0 = origin

    def _rotate_xy(x, y):
        dx, dy = x - ox0, y - oy0
        return (
            ox0 + dx * cos_t - dy * sin_t,
            oy0 + dx * sin_t + dy * cos_t,
        )

    for _node, data in g_proj.nodes(data=True):
        if "x" in data and "y" in data:
            data["x"], data["y"] = _rotate_xy(data["x"], data["y"])

    for _u, _v, data in g_proj.edges(data=True):
        geom = data.get("geometry")
        if geom is not None:
            data["geometry"] = affinity.rotate(
                geom, angle_deg, origin=origin, use_radians=False
            )

    return g_proj


def rotate_gdf(gdf, angle_deg, origin):
    """Return a copy of a GeoDataFrame with geometries rotated around origin."""
    if gdf is None or gdf.empty or not angle_deg:
        return gdf
    rotated = gdf.copy()
    rotated["geometry"] = rotated.geometry.apply(
        lambda geom: affinity.rotate(geom, angle_deg, origin=origin, use_radians=False)
    )
    return rotated


def scale_factor_for(width, height):
    """Return the poster scale factor relative to the 12-inch reference width."""
    return min(height, width) / 12.0


def _river_linewidth(row):
    """Line width (at reference scale) for a linear waterway based on its type."""
    waterway = row.get("waterway") if hasattr(row, "get") else None
    if isinstance(waterway, list):
        waterway = waterway[0] if waterway else None
    if waterway == "river":
        return 1.6
    if waterway == "canal":
        return 1.1
    return 0.6  # streams and everything else


def _project_points_to_crs(latlon_points, target_crs, rotation, origin):
    """
    Project a list of (lat, lon) points to ``target_crs`` and apply rotation.

    Returns two lists (xs, ys) suitable for matplotlib ``plot``/``scatter``.
    """
    xs, ys = [], []
    for lat, lon in latlon_points:
        pt = ox.projection.project_geometry(
            Point(lon, lat), crs="EPSG:4326", to_crs=target_crs
        )[0]
        if rotation:
            pt = affinity.rotate(pt, rotation, origin=origin, use_radians=False)
        xs.append(pt.x)
        ys.append(pt.y)
    return xs, ys


def _plot_gpx_route(ax, gpx_points, target_crs, rotation, origin, theme):
    """Overlay a GPX track as a bold accent line on top of the map."""
    if not gpx_points:
        return
    xs, ys = _project_points_to_crs(gpx_points, target_crs, rotation, origin)
    if not xs:
        return
    route_color = theme.get("route", theme.get("road_motorway", theme["text"]))
    ax.plot(
        xs, ys,
        color=route_color,
        linewidth=2.4,
        solid_capstyle="round",
        solid_joinstyle="round",
        zorder=9,
    )
    # Start (circle) and finish (square) markers for the route.
    ax.scatter([xs[0]], [ys[0]], s=40, color=route_color, marker="o", zorder=9.1)
    ax.scatter([xs[-1]], [ys[-1]], s=40, color=route_color, marker="s", zorder=9.1)


def _plot_markers(ax, markers, target_crs, rotation, origin, theme, scale_factor, active_fonts=None):
    """Plot custom point-of-interest pins with optional labels."""
    if not markers:
        return
    marker_color = theme.get("marker", theme.get("text"))
    label_font = None
    if active_fonts:
        label_font = FontProperties(fname=active_fonts["bold"], size=12 * scale_factor)

    pts = [(lat, lon) for lat, lon, _label in markers]
    xs, ys = _project_points_to_crs(pts, target_crs, rotation, origin)

    for (x, y), (_lat, _lon, label) in zip(zip(xs, ys), markers):
        ax.scatter(
            [x], [y],
            s=90 * scale_factor,
            color=marker_color,
            edgecolors=theme.get("bg", "#FFFFFF"),
            linewidths=1.2 * scale_factor,
            marker="o",
            zorder=9.5,
        )
        if label:
            text_kwargs = dict(
                color=marker_color,
                ha="center",
                va="bottom",
                zorder=9.6,
            )
            if label_font is not None:
                text_kwargs["fontproperties"] = label_font
            else:
                text_kwargs["fontsize"] = 12 * scale_factor
                text_kwargs["fontweight"] = "bold"
            ax.annotate(
                shape_display_text(label),
                xy=(x, y),
                xytext=(0, 10 * scale_factor),
                textcoords="offset points",
                **text_kwargs,
            )


def get_edge_colors_by_type(g):
    """
    Assigns colors to edges based on road type hierarchy.
    Returns a list of colors corresponding to each edge in the graph.
    """
    edge_colors = []

    for _u, _v, data in g.edges(data=True):
        # Get the highway type (can be a list or string)
        highway = data.get('highway', 'unclassified')

        # Handle list of highway types (take the first one)
        if isinstance(highway, list):
            highway = highway[0] if highway else 'unclassified'

        # Assign color based on road type
        if highway in ["motorway", "motorway_link"]:
            color = THEME["road_motorway"]
        elif highway in ["trunk", "trunk_link", "primary", "primary_link"]:
            color = THEME["road_primary"]
        elif highway in ["secondary", "secondary_link"]:
            color = THEME["road_secondary"]
        elif highway in ["tertiary", "tertiary_link"]:
            color = THEME["road_tertiary"]
        elif highway in ["residential", "living_street", "unclassified"]:
            color = THEME["road_residential"]
        else:
            color = THEME['road_default']

        edge_colors.append(color)

    return edge_colors


def get_edge_widths_by_type(g):
    """
    Assigns line widths to edges based on road type.
    Major roads get thicker lines.
    """
    edge_widths = []

    for _u, _v, data in g.edges(data=True):
        highway = data.get('highway', 'unclassified')

        if isinstance(highway, list):
            highway = highway[0] if highway else 'unclassified'

        # Assign width based on road importance
        if highway in ["motorway", "motorway_link"]:
            width = 1.2
        elif highway in ["trunk", "trunk_link", "primary", "primary_link"]:
            width = 1.0
        elif highway in ["secondary", "secondary_link"]:
            width = 0.8
        elif highway in ["tertiary", "tertiary_link"]:
            width = 0.6
        else:
            width = 0.4

        edge_widths.append(width)

    return edge_widths


def get_coordinates(city, country):
    """
    Fetches coordinates for a given city and country using geopy.
    Includes rate limiting to be respectful to the geocoding service.
    """
    coords = f"coords_{city.lower()}_{country.lower()}"
    cached = cache_get(coords)
    if cached:
        print(f"✓ Using cached coordinates for {city}, {country}")
        return cached

    print("Looking up coordinates...")
    geolocator = Nominatim(user_agent="city_map_poster", timeout=10)

    # Add a small delay to respect Nominatim's usage policy
    time.sleep(1)

    try:
        location = geolocator.geocode(f"{city}, {country}")
    except Exception as e:
        raise ValueError(f"Geocoding failed for {city}, {country}: {e}") from e

    # If geocode returned a coroutine in some environments, run it to get the result.
    if asyncio.iscoroutine(location):
        try:
            location = asyncio.run(location)
        except RuntimeError as exc:
            # If an event loop is already running, try using it to complete the coroutine.
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Running event loop in the same thread; raise a clear error.
                raise RuntimeError(
                    "Geocoder returned a coroutine while an event loop is already running. "
                    "Run this script in a synchronous environment."
                ) from exc
            location = loop.run_until_complete(location)

    if location:
        # Use getattr to safely access address (helps static analyzers)
        addr = getattr(location, "address", None)
        if addr:
            print(f"✓ Found: {addr}")
        else:
            print("✓ Found location (address not available)")
        print(f"✓ Coordinates: {location.latitude}, {location.longitude}")
        try:
            cache_set(coords, (location.latitude, location.longitude))
        except CacheError as e:
            print(e)
        return (location.latitude, location.longitude)

    raise ValueError(f"Could not find coordinates for {city}, {country}")


def get_crop_limits(g_proj, center_lat_lon, fig, dist, offset_x=0.0, offset_y=0.0):
    """
    Crop inward to preserve aspect ratio while guaranteeing
    full coverage of the requested radius.

    ``offset_x`` / ``offset_y`` shift the crop window (in meters) so the most
    interesting part of a city can be centered instead of the raw geocoded
    centroid. Positive x shifts the view east (right); positive y shifts it
    north (up).
    """
    lat, lon = center_lat_lon

    # Project center point into graph CRS
    center = (
        ox.projection.project_geometry(
            Point(lon, lat),
            crs="EPSG:4326",
            to_crs=g_proj.graph["crs"]
        )[0]
    )
    center_x, center_y = center.x + offset_x, center.y + offset_y

    fig_width, fig_height = fig.get_size_inches()
    aspect = fig_width / fig_height

    # Start from the *requested* radius
    half_x = dist
    half_y = dist

    # Cut inward to match aspect
    if aspect > 1:  # landscape → reduce height
        half_y = half_x / aspect
    else:  # portrait → reduce width
        half_x = half_y * aspect

    return (
        (center_x - half_x, center_x + half_x),
        (center_y - half_y, center_y + half_y),
    )


def fetch_graph(point, dist) -> MultiDiGraph | None:
    """
    Fetch street network graph from OpenStreetMap.

    Uses caching to avoid redundant downloads. Fetches all network types
    within the specified distance from the center point.

    Args:
        point: (latitude, longitude) tuple for center point
        dist: Distance in meters from center point

    Returns:
        MultiDiGraph of street network, or None if fetch fails
    """
    lat, lon = point
    graph = f"graph_{lat}_{lon}_{dist}"
    cached = cache_get(graph)
    if cached is not None:
        print("✓ Using cached street network")
        return cast(MultiDiGraph, cached)

    try:
        g = ox.graph_from_point(point, dist=dist, dist_type='bbox', network_type='all', truncate_by_edge=True)
        # Rate limit between requests
        time.sleep(0.5)
        try:
            cache_set(graph, g)
        except CacheError as e:
            print(e)
        return g
    except Exception as e:
        print(f"OSMnx error while fetching graph: {e}")
        return None


def fetch_features(point, dist, tags, name) -> GeoDataFrame | None:
    """
    Fetch geographic features (water, parks, etc.) from OpenStreetMap.

    Uses caching to avoid redundant downloads. Fetches features matching
    the specified OSM tags within distance from center point.

    Args:
        point: (latitude, longitude) tuple for center point
        dist: Distance in meters from center point
        tags: Dictionary of OSM tags to filter features
        name: Name for this feature type (for caching and logging)

    Returns:
        GeoDataFrame of features, or None if fetch fails
    """
    lat, lon = point
    tag_str = "_".join(tags.keys())
    features = f"{name}_{lat}_{lon}_{dist}_{tag_str}"
    cached = cache_get(features)
    if cached is not None:
        print(f"✓ Using cached {name}")
        return cast(GeoDataFrame, cached)

    try:
        data = ox.features_from_point(point, tags=tags, dist=dist)
        # Rate limit between requests
        time.sleep(0.3)
        try:
            cache_set(features, data)
        except CacheError as e:
            print(e)
        return data
    except Exception as e:
        print(f"OSMnx error while fetching features: {e}")
        return None


def _explode_lines(geom):
    """Yield individual LineString objects from any (multi)line geometry."""
    if geom is None or geom.is_empty:
        return
    if isinstance(geom, LineString):
        yield geom
    elif isinstance(geom, MultiLineString):
        for part in geom.geoms:
            if not part.is_empty:
                yield part


def _polygon_is_water(poly, coastlines):
    """
    Decide whether a polygon represents sea/water using OSM coastline winding.

    OSM convention: walking along a coastline way in node order, land is on the
    LEFT and water is on the RIGHT. We find a coastline segment lying on the
    polygon's boundary, step a tiny amount toward its right-hand side, and check
    whether that probe point falls inside the polygon. If it does, the polygon
    is on the water side.
    """
    boundary = poly.exterior
    for line in coastlines:
        coords = list(line.coords)
        for i in range(len(coords) - 1):
            x0, y0 = coords[i][0], coords[i][1]
            x1, y1 = coords[i + 1][0], coords[i + 1][1]
            mx, my = (x0 + x1) / 2.0, (y0 + y1) / 2.0

            # Only consider segments that actually lie on this polygon edge.
            if boundary.distance(Point(mx, my)) > 1e-6:
                continue

            dx, dy = x1 - x0, y1 - y0
            length = math.hypot(dx, dy)
            if length == 0:
                continue

            # Right-hand normal of the direction vector (rotate by -90 degrees).
            nx, ny = dy / length, -dx / length
            eps = max(length * 0.05, 1.0)
            probe = Point(mx + nx * eps, my + ny * eps)
            return poly.contains(probe)

    return False


def reconstruct_sea_polygons(coastline_gdf, bbox):
    """
    Reconstruct open-sea water polygons from OSM coastline lines.

    OSM stores oceans/seas as ``natural=coastline`` *lines* rather than filled
    water polygons, so coastal cities (Istanbul, San Francisco, Sydney...) would
    otherwise render the sea as blank background. This clips the coastlines to
    the visible bounding box, splits the box along them, and keeps the pieces
    that fall on the water side of the coastline.

    Args:
        coastline_gdf: Projected GeoDataFrame containing coastline geometries.
        bbox: shapely Polygon describing the visible (projected) crop window.

    Returns:
        List of shapely Polygons representing sea/water areas (possibly empty).
    """
    if coastline_gdf is None or coastline_gdf.empty:
        return []

    raw_lines = []
    for geom in coastline_gdf.geometry:
        raw_lines.extend(_explode_lines(geom))

    if not raw_lines:
        return []

    # Clip coastlines to the visible window.
    clipped = []
    for line in raw_lines:
        inter = line.intersection(bbox)
        clipped.extend(_explode_lines(inter))

    if not clipped:
        return []

    # Polygonize the arrangement formed by the coastlines and the box boundary.
    try:
        merged = unary_union(clipped + [bbox.boundary])
        candidate_polys = list(polygonize(merged))
    except Exception as e:
        print(f"⚠ Could not reconstruct sea polygons: {e}")
        return []

    return [poly for poly in candidate_polys if _polygon_is_water(poly, clipped)]


def load_gpx_track(gpx_path):
    """
    Parse a GPX file and return its track/route points as (lat, lon) tuples.

    Supports track points (``trkpt``), route points (``rtept``) and standalone
    waypoints (``wpt``). Namespaces are handled generically so both GPX 1.0 and
    1.1 files work.

    Args:
        gpx_path: Path to a .gpx file.

    Returns:
        List of (latitude, longitude) float tuples in file order.
    """
    tree = ET.parse(gpx_path)
    root = tree.getroot()

    points = []
    for elem in root.iter():
        tag = elem.tag.split("}")[-1]  # strip namespace
        if tag in ("trkpt", "rtept", "wpt"):
            lat = elem.get("lat")
            lon = elem.get("lon")
            if lat is not None and lon is not None:
                points.append((float(lat), float(lon)))

    return points


# Unicode ranges for right-to-left scripts (Arabic, Hebrew, and their
# supplements / presentation forms). Used to flip text direction.
_RTL_RANGES = (
    (0x0590, 0x05FF),  # Hebrew
    (0x0600, 0x06FF),  # Arabic
    (0x0700, 0x074F),  # Syriac
    (0x0750, 0x077F),  # Arabic Supplement
    (0x08A0, 0x08FF),  # Arabic Extended-A
    (0xFB1D, 0xFB4F),  # Hebrew presentation forms
    (0xFB50, 0xFDFF),  # Arabic presentation forms-A
    (0xFE70, 0xFEFF),  # Arabic presentation forms-B
)


def is_rtl_script(text):
    """
    Return True if the text is predominantly a right-to-left script.

    Used to fix display direction for Arabic, Hebrew and Farsi city names
    (e.g. Dubai, Abu Dhabi, Jerusalem) which otherwise render left-to-right.
    """
    if not text:
        return False

    rtl_count = 0
    total_alpha = 0
    for char in text:
        if not char.isalpha():
            continue
        total_alpha += 1
        code = ord(char)
        if any(lo <= code <= hi for lo, hi in _RTL_RANGES):
            rtl_count += 1

    if total_alpha == 0:
        return False

    return (rtl_count / total_alpha) > 0.5


def shape_display_text(text):
    """
    Prepare text for correct visual display, including RTL handling.

    For right-to-left scripts we reshape Arabic letters into their contextual
    forms (when ``arabic_reshaper`` is available) and apply the Unicode
    bidirectional algorithm (when ``python-bidi`` is available) so matplotlib,
    which lays glyphs out strictly left-to-right, shows them in the correct
    order. If those optional libraries are missing we fall back to reversing
    the logical character order, which is a reasonable approximation for pure
    RTL strings.

    Args:
        text: Logical-order display string.

    Returns:
        A visually-ordered string ready to hand to matplotlib.
    """
    if not text or not is_rtl_script(text):
        return text

    shaped = text
    if _HAS_ARABIC_RESHAPER:
        try:
            shaped = _arabic_reshaper.reshape(shaped)
        except Exception:
            shaped = text

    if _HAS_BIDI:
        try:
            return _bidi_get_display(shaped)
        except Exception:
            pass

    # Fallback: reverse the (reshaped) string so a pure-RTL label at least
    # reads in the correct direction without the bidi library.
    return shaped[::-1]


def create_poster(
    city,
    country,
    point,
    dist,
    output_file,
    output_format,
    width=12,
    height=16,
    dpi=300,
    country_label=None,
    name_label=None,
    display_city=None,
    display_country=None,
    date_line="",
    show_coordinates=True,
    fonts=None,
    rotation=0.0,
    no_text=False,
    offset_x=0.0,
    offset_y=0.0,
    gpx_points=None,
    markers=None,
):
    """
    Generate a complete map poster with roads, water, parks, and typography.

    Creates a high-quality poster by fetching OSM data, rendering map layers,
    applying the current theme, and adding text labels with coordinates.

    Args:
        city: City name for display on poster
        country: Country name for display on poster
        point: (latitude, longitude) tuple for map center
        dist: Map radius in meters
        output_file: Path where poster will be saved
        output_format: File format ('png', 'svg', or 'pdf')
        width: Poster width in inches (default: 12)
        height: Poster height in inches (default: 16)
        country_label: Optional override for country text on poster
        _name_label: Optional override for city name (unused, reserved for future use)
        rotation: Rotate the map by this many degrees counter-clockwise
        no_text: If True, omit all text (city/country/coords/attribution)
        offset_x: Shift the crop window east/west in meters
        offset_y: Shift the crop window north/south in meters
        gpx_points: Optional list of (lat, lon) points to overlay as a route
        markers: Optional list of (lat, lon, label) custom point-of-interest pins

    Raises:
        RuntimeError: If street network data cannot be retrieved
    """
    # Handle display names for i18n support
    # Priority: display_city/display_country > name_label/country_label > city/country
    display_city = (name_label or city) if display_city is None else display_city
    display_country = (country_label or country) if display_country is None else display_country

    print(f"\nGenerating map for {city}, {country}...")

    # Progress bar for data fetching
    with tqdm(
        total=5,
        desc="Fetching map data",
        unit="step",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
    ) as pbar:
        # 1. Fetch Street Network
        pbar.set_description("Downloading street network")
        compensated_dist = dist * (max(height, width) / min(height, width)) / 4  # To compensate for viewport crop
        g = fetch_graph(point, compensated_dist)
        if g is None:
            raise RuntimeError("Failed to retrieve street network data.")
        pbar.update(1)

        # 2. Fetch Water Features (polygons) + coastlines (lines)
        pbar.set_description("Downloading water features")
        water = fetch_features(
            point,
            compensated_dist,
            tags={"natural": ["water", "bay", "strait"], "waterway": "riverbank"},
            name="water",
        )
        # Coastlines are stored as lines in OSM; we reconstruct open sea below.
        coastline = fetch_features(
            point,
            compensated_dist,
            tags={"natural": "coastline"},
            name="coastline",
        )
        pbar.update(1)

        # 3. Fetch Rivers and other linear waterways
        pbar.set_description("Downloading rivers/waterways")
        rivers = fetch_features(
            point,
            compensated_dist,
            tags={"waterway": ["river", "canal", "stream"]},
            name="rivers",
        )
        pbar.update(1)

        # 4. Fetch Parks and richer green spaces
        pbar.set_description("Downloading parks/green spaces")
        parks = fetch_features(
            point,
            compensated_dist,
            tags={
                "leisure": ["park", "garden", "golf_course", "nature_reserve"],
                "landuse": [
                    "grass",
                    "cemetery",
                    "allotments",
                    "meadow",
                    "farmland",
                    "forest",
                    "recreation_ground",
                    "village_green",
                    "orchard",
                    "vineyard",
                ],
                "natural": ["wood", "grassland", "scrub", "heath"],
            },
            name="parks",
        )
        pbar.update(1)
        pbar.update(1)

    print("✓ All data retrieved successfully!")

    # 2. Setup Plot
    print("Rendering map...")
    fig, ax = plt.subplots(figsize=(width, height), facecolor=THEME["bg"])
    ax.set_facecolor(THEME["bg"])
    ax.set_position((0.0, 0.0, 1.0, 1.0))

    # Project graph to a metric CRS so distances and aspect are linear (meters)
    g_proj = ox.project_graph(g)
    target_crs = g_proj.graph["crs"]

    # Projected center point (used for rotation origin and crop window).
    proj_center = ox.projection.project_geometry(
        Point(point[1], point[0]), crs="EPSG:4326", to_crs=target_crs
    )[0]
    rotation_origin = (proj_center.x + offset_x, proj_center.y + offset_y)

    def _project_gdf(gdf):
        """Project a GeoDataFrame to the graph CRS, with a robust fallback."""
        try:
            return ox.projection.project_gdf(gdf)
        except Exception:
            return gdf.to_crs(target_crs)

    # Apply optional rotation to the street network up front so node/edge
    # geometry is already turned before plotting.
    if rotation:
        print(f"Rotating map by {rotation}°...")
        g_proj = rotate_graph(g_proj, rotation, rotation_origin)

    # Determine cropping limits to maintain the poster aspect ratio. The crop is
    # computed on the (post-rotation) center so the requested point stays put.
    crop_xlim, crop_ylim = get_crop_limits(
        g_proj, point, fig, compensated_dist, offset_x=offset_x, offset_y=offset_y
    )
    crop_box = box(crop_xlim[0], crop_ylim[0], crop_xlim[1], crop_ylim[1])

    # 3. Plot Layers
    # Layer 0: Reconstructed open sea from coastlines (drawn beneath everything).
    if coastline is not None and not coastline.empty:
        coast_lines = coastline[coastline.geometry.type.isin(["LineString", "MultiLineString"])]
        if not coast_lines.empty:
            coast_proj = _project_gdf(coast_lines)
            coast_proj = rotate_gdf(coast_proj, rotation, rotation_origin)
            try:
                sea_polys = reconstruct_sea_polygons(coast_proj, crop_box)
            except Exception as e:
                print(f"⚠ Sea reconstruction failed: {e}")
                sea_polys = []
            if sea_polys:
                sea_gdf = GeoDataFrame(geometry=sea_polys, crs=target_crs)
                sea_gdf.plot(ax=ax, facecolor=THEME['water'], edgecolor='none', zorder=0.3)

    # Layer 1: Polygons (filter to only plot polygon/multipolygon geometries, not points)
    if water is not None and not water.empty:
        # Filter to only polygon/multipolygon geometries to avoid point features showing as dots
        water_polys = water[water.geometry.type.isin(["Polygon", "MultiPolygon"])]
        if not water_polys.empty:
            water_polys = _project_gdf(water_polys)
            water_polys = rotate_gdf(water_polys, rotation, rotation_origin)
            water_polys.plot(ax=ax, facecolor=THEME['water'], edgecolor='none', zorder=0.5)

    # Layer 1b: Linear rivers/waterways (most rivers are lines, not polygons).
    if rivers is not None and not rivers.empty:
        river_lines = rivers[rivers.geometry.type.isin(["LineString", "MultiLineString"])]
        if not river_lines.empty:
            river_lines = _project_gdf(river_lines)
            river_lines = rotate_gdf(river_lines, rotation, rotation_origin)
            # Wider lines for rivers, narrower for canals/streams.
            river_widths = river_lines.apply(_river_linewidth, axis=1) * scale_factor_for(width, height)
            river_lines.plot(
                ax=ax,
                color=THEME['water'],
                linewidth=list(river_widths),
                zorder=0.6,
                capstyle='round',
            )

    if parks is not None and not parks.empty:
        # Filter to only polygon/multipolygon geometries to avoid point features showing as dots
        parks_polys = parks[parks.geometry.type.isin(["Polygon", "MultiPolygon"])]
        if not parks_polys.empty:
            parks_polys = _project_gdf(parks_polys)
            parks_polys = rotate_gdf(parks_polys, rotation, rotation_origin)
            parks_polys.plot(ax=ax, facecolor=THEME['parks'], edgecolor='none', zorder=0.8)
    # Layer 2: Roads with hierarchy coloring
    print("Applying road hierarchy colors...")
    edge_colors = get_edge_colors_by_type(g_proj)
    edge_widths = get_edge_widths_by_type(g_proj)

    # Plot the projected graph and then apply the cropped limits
    ox.plot_graph(
        g_proj, ax=ax, bgcolor=THEME['bg'],
        node_size=0,
        edge_color=edge_colors,
        edge_linewidth=edge_widths,
        show=False,
        close=False,
    )
    ax.set_xlim(crop_xlim)
    ax.set_ylim(crop_ylim)

    # Layer 2b: GPX route overlay (marathon route, hiking trail, road trip...).
    if gpx_points:
        _plot_gpx_route(ax, gpx_points, target_crs, rotation, rotation_origin, THEME)

    # Layer 2c: Custom point-of-interest markers.
    if markers:
        _plot_markers(
            ax, markers, target_crs, rotation, rotation_origin, THEME,
            scale_factor_for(width, height), active_fonts=fonts or FONTS,
        )

    # Calculate scale factor based on smaller dimension (reference 12 inches)
    # This ensures text scales properly for both portrait and landscape orientations
    scale_factor = min(height, width) / 12.0

    # Base font sizes (at 12 inches width)
    base_main = 60
    base_sub = 22
    base_coords = 14
    base_attr = 8

    # 4. Typography - use custom fonts if provided, otherwise use default FONTS
    # Skipped entirely in --no-text "clean" mode for a pure map aesthetic.
    active_fonts = fonts or FONTS
    if not no_text:
        if active_fonts:
            # font_main is calculated dynamically later based on length
            font_sub = FontProperties(
                fname=active_fonts["light"], size=base_sub * scale_factor
            )
            font_coords = FontProperties(
                fname=active_fonts["regular"], size=base_coords * scale_factor
            )
            font_attr = FontProperties(
                fname=active_fonts["light"], size=base_attr * scale_factor
            )
        else:
            # Fallback to system fonts
            font_sub = FontProperties(
                family="monospace", weight="normal", size=base_sub * scale_factor
            )
            font_coords = FontProperties(
                family="monospace", size=base_coords * scale_factor
            )
            font_attr = FontProperties(family="monospace", size=base_attr * scale_factor)

        # Format city name based on script type
        # Latin scripts: apply uppercase and letter spacing for aesthetic
        # RTL scripts (Arabic, Hebrew, Farsi): shape + reorder, no spacing/upper
        # Other non-Latin (CJK, Thai...): preserve case structure, no spacing
        if is_rtl_script(display_city):
            spaced_city = shape_display_text(display_city)
        elif is_latin_script(display_city):
            spaced_city = " ".join(list(display_city.upper()))
        else:
            spaced_city = display_city

        # Dynamically adjust font size based on rendered text width to prevent overflow.
        # Use spaced_city length since that's what actually gets rendered.
        base_adjusted_main = base_main * scale_factor
        visual_length = len(spaced_city)

        if visual_length > 20:
            length_factor = 20 / visual_length
            adjusted_font_size = max(base_adjusted_main * length_factor, 10 * scale_factor)
        else:
            adjusted_font_size = base_adjusted_main

        if active_fonts:
            font_main_adjusted = FontProperties(
                fname=active_fonts["bold"], size=adjusted_font_size
            )
        else:
            font_main_adjusted = FontProperties(
                family="monospace", weight="bold", size=adjusted_font_size
            )

        # --- BOTTOM TEXT ---
        if display_city:
            ax.text(
                0.5,
                0.14,
                spaced_city,
                transform=ax.transAxes,
                color=THEME["text"],
                ha="center",
                fontproperties=font_main_adjusted,
                zorder=11,
            )

        # Country: uppercase for Latin, shaped/reordered for RTL.
        if is_latin_script(display_country):
            country_text = shape_display_text(display_country.upper())
        else:
            country_text = shape_display_text(display_country)

        if display_country:
            ax.text(
                0.5,
                0.10,
                country_text,
                transform=ax.transAxes,
                color=THEME["text"],
                ha="center",
                fontproperties=font_sub,
                zorder=11,
            )

        if date_line:
            ax.text(
                0.5,
                0.075,
                shape_display_text(date_line.upper()),
                transform=ax.transAxes,
                color=THEME["text"],
                alpha=0.8,
                ha="center",
                fontproperties=font_coords,
                zorder=11,
            )

        lat, lon = point
        coords = (
            f"{lat:.4f}° N / {lon:.4f}° E"
            if lat >= 0
            else f"{abs(lat):.4f}° S / {lon:.4f}° E"
        )
        if lon < 0:
            coords = coords.replace("E", "W")

        if show_coordinates:
            ax.text(
                0.5,
                0.045 if date_line else 0.07,
                coords,
                transform=ax.transAxes,
                color=THEME["text"],
                alpha=0.7,
                ha="center",
                fontproperties=font_coords,
                zorder=11,
            )

        if display_city and (display_country or date_line or show_coordinates):
            ax.plot(
                [0.4, 0.6],
                [0.125, 0.125],
                transform=ax.transAxes,
                color=THEME["text"],
                linewidth=1 * scale_factor,
                zorder=11,
            )

        # --- ATTRIBUTION (bottom right) ---
        if FONTS:
            font_attr = FontProperties(fname=FONTS["light"], size=4)
        else:
            font_attr = FontProperties(family="monospace", size=4)

        ax.text(
            0.99,
            0.008,
            "© OpenStreetMap contributors",
            transform=ax.transAxes,
            color=THEME["text"],
            alpha=0.25,
            ha="right",
            va="bottom",
            fontproperties=font_attr,
            zorder=11,
        )

    # 5. Save — ensure axes fills the entire figure with zero margins
    ax.set_position([0, 0, 1, 1])
    ax.margins(0)
    ax.set_xlim(crop_xlim)
    ax.set_ylim(crop_ylim)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

    print(f"Saving to {output_file}...")

    fmt = output_format.lower()
    save_kwargs = dict(
        facecolor=THEME["bg"],
        bbox_inches=None,
        pad_inches=0,
    )

    # DPI matters mainly for raster formats
    if fmt == "png":
        save_kwargs["dpi"] = dpi if dpi and dpi > 0 else 300

    plt.savefig(output_file, format=fmt, **save_kwargs)

    plt.close()
    print(f"✓ Done! Poster saved as {output_file}")


def print_examples():
    """Print usage examples."""
    print("""
City Map Poster Generator
=========================

Usage:
  python create_map_poster.py --city <city> --country <country> [options]

Examples:
  # Iconic grid patterns
  python create_map_poster.py -c "New York" -C "USA" -t noir -d 12000           # Manhattan grid
  python create_map_poster.py -c "Barcelona" -C "Spain" -t warm_beige -d 8000   # Eixample district grid

  # Waterfront & canals
  python create_map_poster.py -c "Venice" -C "Italy" -t blueprint -d 4000       # Canal network
  python create_map_poster.py -c "Amsterdam" -C "Netherlands" -t ocean -d 6000  # Concentric canals
  python create_map_poster.py -c "Dubai" -C "UAE" -t midnight_blue -d 15000     # Palm & coastline

  # Radial patterns
  python create_map_poster.py -c "Paris" -C "France" -t pastel_dream -d 10000   # Haussmann boulevards
  python create_map_poster.py -c "Moscow" -C "Russia" -t noir -d 12000          # Ring roads

  # Organic old cities
  python create_map_poster.py -c "Tokyo" -C "Japan" -t japanese_ink -d 15000    # Dense organic streets
  python create_map_poster.py -c "Marrakech" -C "Morocco" -t terracotta -d 5000 # Medina maze
  python create_map_poster.py -c "Rome" -C "Italy" -t warm_beige -d 8000        # Ancient street layout

  # Coastal cities
  python create_map_poster.py -c "San Francisco" -C "USA" -t sunset -d 10000    # Peninsula grid
  python create_map_poster.py -c "Sydney" -C "Australia" -t ocean -d 12000      # Harbor city
  python create_map_poster.py -c "Mumbai" -C "India" -t contrast_zones -d 18000 # Coastal peninsula

  # River cities
  python create_map_poster.py -c "London" -C "UK" -t noir -d 15000              # Thames curves
  python create_map_poster.py -c "Budapest" -C "Hungary" -t copper_patina -d 8000  # Danube split

  # List themes
  python create_map_poster.py --list-themes

Options:
  --city, -c        City name (required)
  --country, -C     Country name (required)
  --country-label   Override country text displayed on poster
  --theme, -t       Theme name (default: terracotta)
  --all-themes      Generate posters for all themes
  --distance, -d    Map radius in meters (default: 18000)
  --rotation, -r    Rotate the map by N degrees counter-clockwise
  --no-text         Clean mode: strip all text for a pure map look
  --offset-x, -mx   Shift crop window east(+)/west(-) in meters
  --offset-y, -my   Shift crop window north(+)/south(-) in meters
  --gpx             Overlay a GPX route (marathon, hike, road trip)
  --marker          Pin a POI: 'lat,lon,label' (repeatable)
  --list-themes     List all available themes

Distance guide:
  4000-6000m   Small/dense cities (Venice, Amsterdam old center)
  8000-12000m  Medium cities, focused downtown (Paris, Barcelona)
  15000-20000m Large metros, full city view (Tokyo, Mumbai)

Available themes can be found in the 'themes/' directory.
Generated posters are saved to 'posters/' directory.
""")


def list_themes():
    """List all available themes with descriptions."""
    available_themes = get_available_themes()
    if not available_themes:
        print("No themes found in 'themes/' directory.")
        return

    print("\nAvailable Themes:")
    print("-" * 60)
    for theme_name in available_themes:
        theme_path = os.path.join(THEMES_DIR, f"{theme_name}.json")
        try:
            with open(theme_path, "r", encoding=FILE_ENCODING) as f:
                theme_data = json.load(f)
                display_name = theme_data.get('name', theme_name)
                description = theme_data.get('description', '')
        except (OSError, json.JSONDecodeError):
            display_name = theme_name
            description = ""
        print(f"  {theme_name}")
        print(f"    {display_name}")
        if description:
            print(f"    {description}")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate beautiful map posters for any city",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_map_poster.py --city "New York" --country "USA"
  python create_map_poster.py --city "New York" --country "USA" -l 40.776676 -73.971321 --theme neon_cyberpunk
  python create_map_poster.py --city Tokyo --country Japan --theme midnight_blue
  python create_map_poster.py --city Paris --country France --theme noir --distance 15000
  python create_map_poster.py --list-themes
        """,
    )

    parser.add_argument("--city", "-c", type=str, help="City name")
    parser.add_argument("--country", "-C", type=str, help="Country name")
    parser.add_argument(
        "--latitude",
        "-lat",
        dest="latitude",
        type=str,
        help="Override latitude center point",
    )
    parser.add_argument(
        "--longitude",
        "-long",
        dest="longitude",
        type=str,
        help="Override longitude center point",
    )
    parser.add_argument(
        "--country-label",
        dest="country_label",
        type=str,
        help="Override country text displayed on poster",
    )
    parser.add_argument(
        "--theme",
        "-t",
        type=str,
        default="terracotta",
        help="Theme name (default: terracotta)",
    )
    parser.add_argument(
        "--all-themes",
        "--All-themes",
        dest="all_themes",
        action="store_true",
        help="Generate posters for all themes",
    )
    parser.add_argument(
        "--distance",
        "-d",
        type=int,
        default=18000,
        help="Map radius in meters (default: 18000)",
    )
    parser.add_argument(
        "--width",
        "-W",
        type=float,
        default=12,
        help="Image width in inches (default: 12, max: 20 )",
    )
    parser.add_argument(
        "--height",
        "-H",
        type=float,
        default=16,
        help="Image height in inches (default: 16, max: 20)",
    )
    parser.add_argument(
        "--list-themes", action="store_true", help="List all available themes"
    )
    parser.add_argument(
        "--display-city",
        "-dc",
        type=str,
        help="Custom display name for city (for i18n support)",
    )
    parser.add_argument(
        "--display-country",
        "-dC",
        type=str,
        help="Custom display name for country (for i18n support)",
    )
    parser.add_argument(
        "--date-line",
        type=str,
        default="",
        help="Optional date or dedication line displayed beneath the subtitle",
    )
    parser.add_argument(
        "--hide-coordinates",
        dest="show_coordinates",
        action="store_false",
        default=True,
        help="Hide the latitude and longitude line",
    )
    parser.add_argument(
        "--font-family",
        type=str,
        help='Google Fonts family name (e.g., "Noto Sans JP", "Open Sans"). If not specified, uses local Roboto fonts.',
    )
    parser.add_argument(
        "--format",
        "-f",
        default="png",
        choices=["png", "svg", "pdf"],
        help="Output format for the poster (default: png)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=300,
        help="Raster output resolution in DPI (default: 300). Used for PNG.",
    )
    parser.add_argument(
        "--rotation",
        "-r",
        type=float,
        default=0.0,
        help="Rotate the map by this many degrees counter-clockwise (default: 0)",
    )
    parser.add_argument(
        "--no-text",
        dest="no_text",
        action="store_true",
        help="Clean mode: omit all city/country/coordinate/attribution text",
    )
    parser.add_argument(
        "--offset-x",
        "-mx",
        dest="offset_x",
        type=float,
        default=0.0,
        help="Shift the crop window east(+)/west(-) in meters",
    )
    parser.add_argument(
        "--offset-y",
        "-my",
        dest="offset_y",
        type=float,
        default=0.0,
        help="Shift the crop window north(+)/south(-) in meters",
    )
    parser.add_argument(
        "--gpx",
        type=str,
        help="Path to a GPX file to overlay as a route (marathon, hike, road trip)",
    )
    parser.add_argument(
        "--marker",
        action="append",
        default=None,
        metavar="LAT,LON[,LABEL]",
        help=(
            "Pin a point of interest. Format: 'lat,lon,label'. "
            "Repeatable, e.g. --marker '40.7,-74.0,Home' --marker '40.8,-73.9,Work'"
        ),
    )

    args = parser.parse_args()

    # If no arguments provided, show examples
    if len(sys.argv) == 1:
        print_examples()
        sys.exit(0)

    # List themes if requested
    if args.list_themes:
        list_themes()
        sys.exit(0)

    # Validate required arguments
    if not args.city or not args.country:
        print("Error: --city and --country are required.\n")
        print_examples()
        sys.exit(1)

    # Enforce maximum dimensions
    if args.width > 20:
        print(
            f"⚠ Width {args.width} exceeds the maximum allowed limit of 20. It's enforced as max limit 20."
        )
        args.width = 20.0
    if args.height > 20:
        print(
            f"⚠ Height {args.height} exceeds the maximum allowed limit of 20. It's enforced as max limit 20."
        )
        args.height = 20.0

    available_themes = get_available_themes()
    if not available_themes:
        print("No themes found in 'themes/' directory.")
        sys.exit(1)

    if args.all_themes:
        themes_to_generate = available_themes
    else:
        if args.theme not in available_themes:
            print(f"Error: Theme '{args.theme}' not found.")
            print(f"Available themes: {', '.join(available_themes)}")
            sys.exit(1)
        themes_to_generate = [args.theme]

    print("=" * 50)
    print("City Map Poster Generator")
    print("=" * 50)

    # Load custom fonts if specified
    custom_fonts = None
    if args.font_family:
        custom_fonts = load_fonts(args.font_family)
        if not custom_fonts:
            print(f"⚠ Failed to load '{args.font_family}', falling back to Roboto")

    # Load GPX route overlay if specified
    gpx_points = None
    if args.gpx:
        if not os.path.exists(args.gpx):
            print(f"Error: GPX file '{args.gpx}' not found.")
            sys.exit(1)
        try:
            gpx_points = load_gpx_track(args.gpx)
        except Exception as e:
            print(f"Error: Failed to parse GPX file '{args.gpx}': {e}")
            sys.exit(1)
        if not gpx_points:
            print(f"⚠ No track/route points found in '{args.gpx}'. Skipping overlay.")
            gpx_points = None
        else:
            print(f"✓ Loaded {len(gpx_points)} route points from {args.gpx}")

    # Parse custom markers ("lat,lon,label")
    markers = None
    if args.marker:
        markers = []
        for raw in args.marker:
            parts = raw.split(",")
            if len(parts) < 2:
                print(f"⚠ Ignoring invalid marker '{raw}' (expected 'lat,lon[,label]')")
                continue
            try:
                m_lat = parse(parts[0].strip())
                m_lon = parse(parts[1].strip())
            except Exception:
                print(f"⚠ Ignoring marker with unparseable coordinates: '{raw}'")
                continue
            label = ",".join(parts[2:]).strip() if len(parts) > 2 else ""
            markers.append((m_lat, m_lon, label))
        if not markers:
            markers = None

    # Get coordinates and generate poster
    try:
        if args.latitude and args.longitude:
            lat = parse(args.latitude)
            lon = parse(args.longitude)
            coords = [lat, lon]
            print(f"✓ Coordinates: {', '.join([str(i) for i in coords])}")
        else:
            coords = get_coordinates(args.city, args.country)

        for theme_name in themes_to_generate:
            THEME = load_theme(theme_name)
            output_file = generate_output_filename(args.city, theme_name, args.format)
            create_poster(
                args.city,
                args.country,
                coords,
                args.distance,
                output_file,
                args.format,
                args.width,
                args.height,
                dpi=args.dpi,
                country_label=args.country_label,
                display_city=args.display_city,
                display_country=args.display_country,
                date_line=args.date_line,
                show_coordinates=args.show_coordinates,
                fonts=custom_fonts,
                rotation=args.rotation,
                no_text=args.no_text,
                offset_x=args.offset_x,
                offset_y=args.offset_y,
                gpx_points=gpx_points,
                markers=markers,
            )

        print("\n" + "=" * 50)
        print("✓ Poster generation complete!")
        print("=" * 50)

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
