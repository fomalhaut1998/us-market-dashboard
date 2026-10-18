"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
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
  tooltipX: "left" | "right" | "center";
  tooltipY: "above" | "below";
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [projectedLocations, setProjectedLocations] = useState<ProjectedLocation[]>([]);
  const globeRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GlobeView>(INITIAL_VIEW);
  const inertiaFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    longitudeVelocity: number;
    latitudeVelocity: number;
  } | null>(null);
  const activeId = hoveredId ?? pinnedId;

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
          const tooltipWidth = Math.min(window.innerWidth <= 767 ? 188 : 216, window.innerWidth - 32);
          const tooltipHeight = 148;
          const tooltipGap = 28;
          const hasRoomOnRight =
            viewportX + tooltipGap + tooltipWidth <= window.innerWidth - 16;
          const hasRoomOnLeft = viewportX - tooltipGap - tooltipWidth >= 16;
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
            tooltipX: hasRoomOnRight ? "right" : hasRoomOnLeft ? "left" : "center",
            tooltipY:
              viewportY + tooltipGap + tooltipHeight <= window.innerHeight - 16
                ? "below"
                : "above",
          };
        }),
      );
    },
    [locations],
  );

  const applyView = useCallback(
    (longitude: number, latitude: number) => {
      const nextView = {
        longitude: normalizeLongitude(longitude),
        latitude: Math.max(-70, Math.min(70, latitude)),
      };
      viewRef.current = nextView;
      globeRef.current?.setAttribute("data-view-longitude", nextView.longitude.toFixed(2));
      globeRef.current?.setAttribute("data-view-latitude", nextView.latitude.toFixed(2));
      renderGlobe(nextView);
    },
    [renderGlobe],
  );

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
    globeRef.current?.removeAttribute("data-inertia");
  }, []);

  const startInertia = useCallback(
    (initialLongitudeVelocity: number, initialLatitudeVelocity: number) => {
      stopInertia();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      let longitudeVelocity = Math.max(-0.25, Math.min(0.25, initialLongitudeVelocity));
      let latitudeVelocity = Math.max(-0.18, Math.min(0.18, initialLatitudeVelocity));
      if (Math.hypot(longitudeVelocity, latitudeVelocity) < 0.012) return;

      let previousTime = performance.now();
      globeRef.current?.setAttribute("data-inertia", "true");

      const animate = (currentTime: number) => {
        const elapsed = Math.min(32, currentTime - previousTime);
        previousTime = currentTime;
        const nextLatitude = viewRef.current.latitude + latitudeVelocity * elapsed;

        applyView(
          viewRef.current.longitude + longitudeVelocity * elapsed,
          nextLatitude,
        );

        if (nextLatitude <= -70 || nextLatitude >= 70) latitudeVelocity = 0;
        const damping = Math.pow(0.92, elapsed / 16.667);
        longitudeVelocity *= damping;
        latitudeVelocity *= damping;

        if (Math.hypot(longitudeVelocity, latitudeVelocity) < 0.003) {
          inertiaFrameRef.current = null;
          globeRef.current?.removeAttribute("data-inertia");
          return;
        }

        inertiaFrameRef.current = requestAnimationFrame(animate);
      };

      inertiaFrameRef.current = requestAnimationFrame(animate);
    },
    [applyView, stopInertia],
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
      stopInertia();
    };
  }, [renderGlobe, stopInertia]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    stopInertia();
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      longitudeVelocity: 0,
      latitudeVelocity: 0,
    };
    globeRef.current?.setAttribute("data-dragging", "true");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const elapsed = Math.max(8, event.timeStamp - drag.lastTime);
    const longitudeDelta = -(event.clientX - drag.lastX) * 0.32;
    const latitudeDelta = (event.clientY - drag.lastY) * 0.25;
    const longitudeVelocity = longitudeDelta / elapsed;
    const latitudeVelocity = latitudeDelta / elapsed;

    drag.longitudeVelocity = drag.longitudeVelocity * 0.62 + longitudeVelocity * 0.38;
    drag.latitudeVelocity = drag.latitudeVelocity * 0.62 + latitudeVelocity * 0.38;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;

    applyView(
      viewRef.current.longitude + longitudeDelta,
      viewRef.current.latitude + latitudeDelta,
    );
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    const drag = dragRef.current;
    dragRef.current = null;
    globeRef.current?.removeAttribute("data-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (event.type === "pointerup") {
      startInertia(drag.longitudeVelocity, drag.latitudeVelocity);
    }
  }

  function resetRotation() {
    stopInertia();
    applyView(INITIAL_VIEW.longitude, INITIAL_VIEW.latitude);
  }

  return (
    <aside
      ref={globeRef}
      className="ambient-trading-globe"
      aria-label="可拖动旋转的三维交易地点地球"
      data-renderer="spherical-canvas"
      data-map-resolution="natural-earth-50m"
      data-world-land-points={worldLandPoints.length}
      data-us-land-points={unitedStatesLandPoints.length}
      data-view-longitude={INITIAL_VIEW.longitude.toFixed(2)}
      data-view-latitude={INITIAL_VIEW.latitude.toFixed(2)}
    >
      <canvas ref={canvasRef} className="ambient-trading-globe__visual" aria-hidden="true" />

      <div className="ambient-trading-globe__markers" aria-hidden="true">
        {locations.map((location) => {
          const projected = projectedLocations.find((point) => point.id === location.id);
          const visible = Boolean(projected?.visible && projected.onScreen && projected.depth > 0.08);

          return (
            <span
              key={location.id}
              className="ambient-trading-location__marker"
              data-active={location.id === activeId}
              style={{
                left: projected ? `${projected.leftPercent}%` : "50%",
                top: projected ? `${projected.topPercent}%` : "50%",
                opacity: visible ? Math.min(1, Math.max(0.25, (projected?.depth ?? 0) * 1.5)) : 0,
              }}
            />
          );
        })}
      </div>

      <div className="ambient-trading-globe__hotspots">
        {locations.map((location) => {
          const active = location.id === activeId;
          const pinned = location.id === pinnedId;
          const projected = projectedLocations.find((point) => point.id === location.id);
          const visible = Boolean(projected?.visible && projected.onScreen && projected.depth > 0.08);

          return (
            <button
              key={location.id}
              type="button"
              aria-label={`${location.city}，${location.institution}。${location.detail}`}
              aria-pressed={pinned}
              data-active={active}
              onMouseEnter={() => setHoveredId(location.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(location.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() =>
                setPinnedId((current) => (current === location.id ? null : location.id))
              }
              className="ambient-trading-location__hotspot"
              style={{
                left: projected ? `${projected.leftPercent}%` : "50%",
                top: projected ? `${projected.topPercent}%` : "50%",
                opacity: visible ? Math.min(1, Math.max(0.25, (projected?.depth ?? 0) * 1.5)) : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
            />
          );
        })}
      </div>

      <div className="ambient-trading-globe__tooltip-layer" aria-hidden="true">
        {locations.map((location) => {
          const projected = projectedLocations.find((point) => point.id === location.id);
          const visible = Boolean(projected?.visible && projected.onScreen && projected.depth > 0.08);
          const active = location.id === activeId && visible;

          return (
            <div
              key={location.id}
              className="ambient-trading-location__tooltip-anchor"
              data-active={active}
              data-tooltip-x={projected?.tooltipX ?? "center"}
              data-tooltip-y={projected?.tooltipY ?? "below"}
              style={{
                left: projected ? `${projected.leftPercent}%` : "50%",
                top: projected ? `${projected.topPercent}%` : "50%",
              }}
            >
              <span className="ambient-trading-location__tooltip">
                <span className="ambient-trading-location__city">
                  {location.city}
                  <span>{location.region}</span>
                </span>
                <span className="ambient-trading-location__institution">
                  {location.institution}
                </span>
                <span className="ambient-trading-location__detail">{location.detail}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="ambient-trading-globe__drag-surface"
        aria-hidden="true"
        title="拖动旋转三维地球，双击回到美国视角"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={resetRotation}
      />
    </aside>
  );
}
