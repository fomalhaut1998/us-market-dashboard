import type { VixPeHistoryData } from "@/types/dashboard";

interface VixPeHistoryChartProps {
  data: VixPeHistoryData;
}

// 两套几何：桌面端 900×320 铺满整行；手机端单独一套 360 宽的图，缩到 390 屏（约 318px）后
// 字号仍接近 11–12px。若继续复用 900 宽的 viewBox，整体压缩会把 12px 文字压成 4px。
interface ChartGeometry {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  axisFontSize: number;
  monthFontSize: number;
  monthOffset: number;
  leftLabelGap: number;
  rightLabelGap: number;
  strokeWidth: number;
  pointRadius: number;
}

const desktopChart: ChartGeometry = {
  width: 900,
  height: 320,
  left: 66,
  right: 834,
  top: 30,
  bottom: 266,
  axisFontSize: 12,
  monthFontSize: 13,
  monthOffset: 34,
  leftLabelGap: 13,
  rightLabelGap: 12,
  strokeWidth: 4,
  pointRadius: 6,
};

const mobileChart: ChartGeometry = {
  width: 360,
  height: 288,
  left: 34,
  right: 300,
  top: 32,
  bottom: 232,
  axisFontSize: 12,
  monthFontSize: 13,
  monthOffset: 23,
  leftLabelGap: 9,
  rightLabelGap: 8,
  strokeWidth: 3,
  pointRadius: 4.5,
};

function xPosition(index: number, total: number, geo: ChartGeometry) {
  if (total <= 1) return (geo.left + geo.right) / 2;
  return geo.left + (index * (geo.right - geo.left)) / (total - 1);
}

function peY(value: number, geo: ChartGeometry) {
  return geo.bottom - (value / 100) * (geo.bottom - geo.top);
}

function buildSegments(
  data: VixPeHistoryData,
  selector: (point: VixPeHistoryData["points"][number]) => number | null,
  yPosition: (value: number) => number,
  geo: ChartGeometry,
) {
  const segments: string[] = [];
  let current: string[] = [];

  data.points.forEach((point, index) => {
    const value = selector(point);
    if (value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${xPosition(index, data.points.length, geo)},${yPosition(value)}`);
  });

  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

interface ChartSvgProps {
  data: VixPeHistoryData;
  geo: ChartGeometry;
  variant: string;
  vixMax: number;
  availableVix: number;
  availablePe: number;
}

function ChartSvg({ data, geo, variant, vixMax, availableVix, availablePe }: ChartSvgProps) {
  const vixY = (value: number) =>
    geo.bottom - (Math.max(0, Math.min(value, vixMax)) / vixMax) * (geo.bottom - geo.top);
  const vixSegments = buildSegments(data, (point) => point.vix, vixY, geo);
  const peSegments = buildSegments(
    data,
    (point) => point.pePercentile,
    (value) => peY(value, geo),
    geo,
  );
  const titleId = `vix-pe-chart-title-${variant}`;
  const descriptionId = `vix-pe-chart-description-${variant}`;

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      className="h-auto w-full"
    >
      <title id={titleId}>过去六个月 VIX 与 PE 分位变化</title>
      <desc id={descriptionId}>
        六个月中有 {availableVix} 个 VIX 有效点和 {availablePe} 个 PE分位有效点；缺失数据不以零补齐。
      </desc>

      {[0, 25, 50, 75, 100].map((value) => {
        const y = peY(value, geo);
        return (
          <g key={value}>
            <line
              x1={geo.left}
              x2={geo.right}
              y1={y}
              y2={y}
              stroke="var(--color-chart-grid)"
              strokeDasharray="5 7"
            />
            <text
              x={geo.right + geo.rightLabelGap}
              y={y + 4}
              fontSize={geo.axisFontSize}
              fill="var(--color-chart-label)"
            >
              {value}%
            </text>
            <text
              x={geo.left - geo.leftLabelGap}
              y={y + 4}
              textAnchor="end"
              fontSize={geo.axisFontSize}
              fill="var(--color-chart-label)"
            >
              {Math.round((vixMax * value) / 100)}
            </text>
          </g>
        );
      })}

      <text
        x={geo.left - geo.leftLabelGap}
        y={17}
        textAnchor="end"
        fontSize={geo.axisFontSize}
        fontWeight="700"
        fill="var(--color-brand)"
      >
        VIX
      </text>
      <text
        x={geo.right + geo.rightLabelGap}
        y={17}
        fontSize={geo.axisFontSize}
        fontWeight="700"
        fill="var(--color-warning-strong)"
      >
        PE分位
      </text>

      {peSegments.map((points, index) => (
        <polyline
          key={`pe-${index}`}
          points={points}
          fill="none"
          stroke="var(--color-warning-strong)"
          strokeWidth={geo.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {vixSegments.map((points, index) => (
        <polyline
          key={`vix-${index}`}
          points={points}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={geo.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {data.points.map((point, index) => {
        const x = xPosition(index, data.points.length, geo);
        return (
          <g key={`${point.month}-${index}`}>
            {point.pePercentile !== null ? (
              <circle
                cx={x}
                cy={peY(point.pePercentile, geo)}
                r={geo.pointRadius}
                fill="var(--color-chart-point)"
                stroke="var(--color-warning-strong)"
                strokeWidth={geo.strokeWidth}
              />
            ) : null}
            {point.vix !== null ? (
              <circle
                cx={x}
                cy={vixY(point.vix)}
                r={geo.pointRadius}
                fill="var(--color-chart-point)"
                stroke="var(--color-brand)"
                strokeWidth={geo.strokeWidth}
              />
            ) : null}
            <text
              x={x}
              y={geo.bottom + geo.monthOffset}
              textAnchor="middle"
              fontSize={geo.monthFontSize}
              fontWeight="600"
              fill="var(--color-chart-label)"
            >
              {point.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function VixPeHistoryChart({ data }: VixPeHistoryChartProps) {
  const vixValues = data.points.flatMap((point) => (point.vix === null ? [] : [point.vix]));
  const vixMax = Math.max(30, Math.ceil((Math.max(...vixValues, 0) + 5) / 10) * 10);
  const availableVix = data.points.filter((point) => point.vix !== null).length;
  const availablePe = data.points.filter((point) => point.pePercentile !== null).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface-soft px-3.5 py-2.5 text-[0.72rem] font-semibold text-muted sm:gap-x-5 sm:px-4 sm:py-3 sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-brand sm:w-7" aria-hidden="true" />
          {data.vixLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-warning-strong sm:w-7" aria-hidden="true" />
          {data.peLabel}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[18px] border border-line bg-surface px-1 py-2.5 sm:mt-4 sm:rounded-[20px] sm:px-4 sm:py-5">
        <div className="hidden sm:block">
          <ChartSvg
            data={data}
            geo={desktopChart}
            variant="desktop"
            vixMax={vixMax}
            availableVix={availableVix}
            availablePe={availablePe}
          />
        </div>
        <div className="sm:hidden">
          <ChartSvg
            data={data}
            geo={mobileChart}
            variant="mobile"
            vixMax={vixMax}
            availableVix={availableVix}
            availablePe={availablePe}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5">
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
          <div className="rounded-2xl border border-soft-blue-line bg-soft-blue px-3.5 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[0.7rem] text-muted sm:text-xs">当前 VIX</p>
            <p className="mt-1 text-lg font-black tabular-nums text-brand sm:text-xl">{data.currentVix}</p>
          </div>
          <div className="rounded-2xl border border-warning/50 bg-soft-yellow px-3.5 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[0.7rem] text-muted sm:text-xs">当前 PE分位</p>
            <p className="mt-1 text-[0.8rem] leading-5 font-black text-warning-strong sm:max-w-40 sm:text-xl sm:leading-6">
              {data.currentPePercentile}
            </p>
          </div>
        </div>
        <p className="rounded-2xl bg-surface-soft px-4 py-3 text-[0.8rem] leading-6 text-secondary sm:px-5 sm:text-sm">
          {data.analysis}
        </p>
      </div>
    </div>
  );
}
