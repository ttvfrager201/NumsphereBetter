import React from "react";

interface ConnectionLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  connectionId: string;
}

export default function ConnectionLine({
  from,
  to,
  connectionId,
}: ConnectionLineProps) {
  // Calculate control points for a smooth curve
  const midX = (from.x + to.x) / 2;
  const controlPoint1 = { x: midX, y: from.y };
  const controlPoint2 = { x: midX, y: to.y };

  const pathData = `M ${from.x} ${from.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${to.x} ${to.y}`;
  const arrowId = `arrowhead-${connectionId}`;

  return (
    <g>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={arrowId}
          markerWidth="12"
          markerHeight="8"
          refX="10"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 12 4, 0 8"
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth="0.5"
          />
        </marker>

        {/* Glow filter */}
        <filter
          id={`glow-${connectionId}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow background line */}
      <path
        d={pathData}
        stroke="#3b82f6"
        strokeWidth="6"
        fill="none"
        opacity="0.3"
        filter={`url(#glow-${connectionId})`}
      />

      {/* Main connection line with dotted style */}
      <path
        d={pathData}
        stroke="#3b82f6"
        strokeWidth="3"
        fill="none"
        strokeDasharray="6,6"
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        className="drop-shadow-sm"
      />

      {/* Animated flow indicator with dotted pattern */}
      <path
        d={pathData}
        stroke="#60a5fa"
        strokeWidth="2"
        fill="none"
        strokeDasharray="4,8"
        strokeLinecap="round"
        className="animate-pulse"
        opacity="0.6"
      />
    </g>
  );
}
