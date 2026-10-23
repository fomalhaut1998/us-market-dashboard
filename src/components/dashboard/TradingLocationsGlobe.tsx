"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { unitedStatesLandPoints, worldLandPoints } from "@/data/globeLandPoints";
import type { TradingLocationData } from "@/data/mockData";

interface TradingLocationsGlobeProps {
  locations: TradingLocationData[];
}

interface GlobeView {
  longitude: number;
  latitude: number;
}

interface CanvasGeometry {
  centerX: number;
  centerY: number;
  radius: number;
  width: number;
  height: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  visible: boolean;
}

interface ProjectedLocation extends ProjectedPoint {
  id: string;
  leftPercent: number;
  topPercent: number;
  onScreen: boolean;
}

const INITIAL_VIEW: GlobeView = { longitude: -98, latitude: 38 };
const DEG_TO_RAD = Math.PI / 180;

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function projectPoint(
  longitude: number,
  latitude: number,
  view: GlobeView,
  geometry: CanvasGeometry,
): ProjectedPoint {
  const longitudeDelta = normalizeLongitude(longitude - view.longitude) * DEG_TO_RAD;
  const latitudeRadians = latitude * DEG_TO_RAD;
  const viewLatitudeRadians = view.latitude * DEG_TO_RAD;
  const cosineLatitude = Math.cos(latitudeRadians);
  const sineLatitude = Math.sin(latitudeRadians);
  const cosineViewLatitude = Math.cos(viewLatitudeRadians);
  const sineViewLatitude = Math.sin(viewLatitudeRadians);
  const cosineLongitudeDelta = Math.cos(longitudeDelta);
  const normalizedX = cosineLatitude * Math.sin(longitudeDelta);
  const normalizedY =
    sineLatitude * cosineViewLatitude -
    cosineLatitude * cosineLongitudeDelta * sineViewLatitude;
  const depth =
    sineLatitude * sineViewLatitude +
    cosineLatitude * cosineLongitudeDelta * cosineViewLatitude;

  return {
    x: geometry.centerX + geometry.radius * normalizedX,
    y: geometry.centerY - geometry.radius * normalizedY,
    depth,
    visible: depth > 0.015,
  };
}

function interpolateLongitude(start: number, end: number, progress: number) {
  let delta = end - start;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return normalizeLongitude(start + delta * progress);
}

function drawRoute(
  context: CanvasRenderingContext2D,
  start: TradingLocationData,
  end: TradingLocationData,
  view: GlobeView,
  geometry: CanvasGeometry,
) {
  let segmentOpen = false;
  context.beginPath();

  for (let index = 0; index <= 32; index += 1) {
    const progress = index / 32;
    const projected = projectPoint(
      interpolateLongitude(start.longitude, end.longitude, progress),
      start.latitude + (end.latitude - start.latitude) * progress,
      view,
      geometry,
    );

    if (!projected.visible) {
      segmentOpen = false;
      continue;
    }

    if (!segmentOpen) {
      context.moveTo(projected.x, projected.y);
      segmentOpen = true;
    } else {
      context.lineTo(projected.x, projected.y);
    }
  }

  context.stroke();
}

export function TradingLocationsGlobe({ locations }: TradingLocationsGlobeProps) {
  const [projectedLocations, setProjectedLocations] = useState<ProjectedLocation[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GlobeView>(INITIAL_VIEW);

  const renderGlobe = useCallback(
    (view: GlobeView) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounds = canvas.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(bounds.width * pixelRatio);
      const pixelHeight = Math.round(bounds.height * pixelRatio);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const geometry: CanvasGeometry = {
        centerX: bounds.width * 0.5,
        centerY: bounds.height * 0.5,
        radius: Math.min(bounds.width, bounds.height) * 0.43,
        width: bounds.width,
        height: bounds.height,
      };
      const darkMode = document.documentElement.dataset.theme === "dark";
      const accent = darkMode ? "112, 157, 255" : "62, 108, 206";

      const sphereFill = context.createRadialGradient(
        geometry.centerX - geometry.radius * 0.24,
        geometry.centerY - geometry.radius * 0.18,
        geometry.radius * 0.08,
        geometry.centerX,
        geometry.centerY,
        geometry.radius,
      );
      sphereFill.addColorStop(0, `rgba(${accent}, ${darkMode ? 0.055 : 0.025})`);
      sphereFill.addColorStop(0.72, `rgba(${accent}, ${darkMode ? 0.025 : 0.012})`);
      sphereFill.addColorStop(1, `rgba(${accent}, ${darkMode ? 0.11 : 0.065})`);
      context.fillStyle = sphereFill;
      context.beginPath();
      context.arc(geometry.centerX, geometry.centerY, geometry.radius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = `rgba(${accent}, ${darkMode ? 0.18 : 0.1})`;
      for (let latitude = -75; latitude <= 75; latitude += 15) {
        for (let longitude = -180; longitude < 180; longitude += 5) {
          const point = projectPoint(longitude, latitude, view, geometry);
          if (!point.visible) continue;
          const size = 0.45 + point.depth * 0.42;
          context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        }
      }
      for (let longitude = -165; longitude <= 180; longitude += 15) {
        for (let latitude = -87; latitude <= 87; latitude += 4) {
          const point = projectPoint(longitude, latitude, view, geometry);
          if (!point.visible) continue;
          const size = 0.45 + point.depth * 0.4;
          context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        }
      }

      for (const [longitude, latitude] of worldLandPoints) {
        const point = projectPoint(longitude, latitude, view, geometry);
        if (!point.visible) continue;
        const size = 0.75 + point.depth * 0.9;
        context.fillStyle = `rgba(${accent}, ${
          (darkMode ? 0.16 : 0.11) + point.depth * (darkMode ? 0.34 : 0.25)
        })`;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, Math.PI * 2);
        context.fill();
      }

      for (const [longitude, latitude] of unitedStatesLandPoints) {
        const point = projectPoint(longitude, latitude, view, geometry);
        if (!point.visible) continue;
        const size = 0.42 + point.depth * 0.58;
        context.fillStyle = `rgba(${accent}, ${
          (darkMode ? 0.2 : 0.15) + point.depth * (darkMode ? 0.38 : 0.29)
        })`;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, Math.PI * 2);
        context.fill();
      }

      context.strokeStyle = `rgba(${accent}, ${darkMode ? 0.32 : 0.2})`;
      context.lineWidth = 0.8;
      const locationById = new Map(locations.map((location) => [location.id, location]));
      const routePairs = [
        ["san-francisco", "chicago"],
        ["chicago", "new-york"],
        ["chicago", "atlanta"],
        ["new-york", "philadelphia"],
        ["new-york", "mahwah"],
      ] as const;

      for (const [startId, endId] of routePairs) {
        const start = locationById.get(startId);
        const end = locationById.get(endId);
        if (start && end) drawRoute(context, start, end, view, geometry);
      }

      context.strokeStyle = `rgba(${accent}, ${darkMode ? 0.34 : 0.21})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(geometry.centerX, geometry.centerY, geometry.radius - 0.5, 0, Math.PI * 2);
      context.stroke();

      setProjectedLocations(
        locations.map((location) => {
          const point = projectPoint(location.longitude, location.latitude, view, geometry);
          const viewportX = bounds.left + point.x;
          const viewportY = bounds.top + point.y;
          return {
            id: location.id,
            ...point,
            leftPercent: (point.x / geometry.width) * 100,
            topPercent: (point.y / geometry.height) * 100,
            onScreen:
              viewportX >= 8 &&
              viewportX <= window.innerWidth - 8 &&
              viewportY >= 8 &&
              viewportY <= window.innerHeight - 8,
          };
        }),
      );
    },
    [locations],
  );


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let redrawTimer: number | null = null;
    const renderCurrentView = () => renderGlobe(viewRef.current);
    // 移动端切后台或锁屏后，浏览器可能回收 canvas 的后备存储；回到前台时补画一次。
    const scheduleRedraw = () => {
      if (redrawTimer !== null) window.clearTimeout(redrawTimer);
      redrawTimer = window.setTimeout(() => {
        redrawTimer = null;
        renderCurrentView();
      }, 120);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleRedraw();
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
    };

    // 兜底：部分移动浏览器在页面可见时也可能回收 canvas，定时补画一次。
    const redrawWatchdog = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRedraw();
    }, 60_000);

    const resizeObserver = new ResizeObserver(renderCurrentView);
    const themeObserver = new MutationObserver(renderCurrentView);

    resizeObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", scheduleRedraw);
    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", scheduleRedraw);
    renderCurrentView();
    // 挂载时布局可能还没稳定；补画一次，避免首次尺寸为 0 时留下空白画布。
    scheduleRedraw();

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", scheduleRedraw);
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", scheduleRedraw);
      window.clearInterval(redrawWatchdog);
      if (redrawTimer !== null) window.clearTimeout(redrawTimer);
    };
  }, [renderGlobe]);


  return (
    <aside
      className="ambient-trading-globe"
      aria-label="三维交易地点地球（装饰背景）"
      data-renderer="spherical-canvas"
      data-map-resolution="natural-earth-50m"
      data-world-land-points={worldLandPoints.length}
      data-us-land-points={unitedStatesLandPoints.length}
    >
      <canvas ref={canvasRef} className="ambient-trading-globe__visual" aria-hidden="true" />
      {/* 移动端用静态位图兜底：浏览器长时间挂起后可能回收 canvas 后备存储，导致整块画布变灰。 */}
      <div className="ambient-trading-globe__still" aria-hidden="true" />

      <div className="ambient-trading-globe__markers" aria-hidden="true">
        {locations.map((location) => {
          const projected = projectedLocations.find((point) => point.id === location.id);
          const visible = Boolean(projected?.visible && projected.onScreen && projected.depth > 0.08);

          return (
            <span
              key={location.id}
              className="ambient-trading-location__marker"
              style={{
                left: projected ? `${projected.leftPercent}%` : "50%",
                top: projected ? `${projected.topPercent}%` : "50%",
                opacity: visible ? Math.min(1, Math.max(0.25, (projected?.depth ?? 0) * 1.5)) : 0,
              }}
            />
          );
        })}
      </div>

    </aside>
  );
}
