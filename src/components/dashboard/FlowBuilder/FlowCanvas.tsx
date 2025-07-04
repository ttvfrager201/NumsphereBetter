import React, { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { FlowBlock } from "@/stores/callFlowStore";
import FlowBlockComponent from "./FlowBlockComponent";
import ConnectionLine from "./ConnectionLine";

interface FlowCanvasProps {
  blocks: FlowBlock[];
  selectedBlock: FlowBlock | null;
  connectingFrom: string | null;
  onBlockSelect: (block: FlowBlock) => void;
  onBlockUpdate: (id: string, updates: Partial<FlowBlock>) => void;
  onBlockDelete: (id: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  onSetConnecting: (id: string | null) => void;
}

export default function FlowCanvas({
  blocks,
  selectedBlock,
  connectingFrom,
  onBlockSelect,
  onBlockUpdate,
  onBlockDelete,
  onConnect,
  onSetConnecting,
}: FlowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const draggedBlock = useRef<{
    id: string;
    offset: { x: number; y: number };
  } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastPanOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const rect = e.currentTarget.getBoundingClientRect();
      draggedBlock.current = {
        id: blockId,
        offset: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      };

      e.preventDefault();
      e.stopPropagation();
    },
    [blocks],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.target === e.currentTarget ||
        (e.target as HTMLElement).closest(".canvas-background")
      ) {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        lastPanOffset.current = { ...panOffset };
        e.preventDefault();
      }
    },
    [panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        const deltaX = e.clientX - panStart.current.x;
        const deltaY = e.clientY - panStart.current.y;
        setPanOffset({
          x: lastPanOffset.current.x + deltaX,
          y: lastPanOffset.current.y + deltaY,
        });
        return;
      }

      if (!draggedBlock.current || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX =
        (e.clientX -
          canvasRect.left -
          draggedBlock.current.offset.x -
          panOffset.x) /
        zoom;
      const newY =
        (e.clientY -
          canvasRect.top -
          draggedBlock.current.offset.y -
          panOffset.y) /
        zoom;

      onBlockUpdate(draggedBlock.current.id, {
        position: { x: Math.max(0, newX), y: Math.max(0, newY) },
      });
    },
    [onBlockUpdate, zoom, panOffset],
  );

  const handleMouseUp = useCallback(() => {
    draggedBlock.current = null;
    isPanning.current = false;
  }, []);

  const handleBlockClick = useCallback(
    (block: FlowBlock) => {
      if (connectingFrom && connectingFrom !== block.id) {
        onConnect(connectingFrom, block.id);
        onSetConnecting(null);
      } else {
        onBlockSelect(block);
      }
    },
    [connectingFrom, onConnect, onSetConnecting, onBlockSelect],
  );

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.2, 0.4));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={canvasRef}
      className="relative bg-gray-50 rounded-lg h-full border border-gray-200 overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        cursor: isPanning.current ? "grabbing" : "grab",
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 bg-white rounded-lg shadow-md border p-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleZoomIn}
          className="h-8 w-8 p-0"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleZoomOut}
          className="h-8 w-8 p-0"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleResetZoom}
          className="h-8 w-8 p-0"
          title="Reset Zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex items-center px-2 text-xs text-gray-600 border-l">
          {Math.round(zoom * 100)}%
        </div>
      </div>
      <div
        className="absolute inset-0 overflow-hidden canvas-background"
        style={{
          minHeight: "2000px",
          minWidth: "3000px",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Connection Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {blocks.map((block) =>
            block.connections.map((connectedId) => {
              const connectedBlock = blocks.find((b) => b.id === connectedId);
              if (!connectedBlock) return null;

              return (
                <ConnectionLine
                  key={`${block.id}-${connectedId}`}
                  connectionId={`${block.id}-${connectedId}`}
                  from={{
                    x: block.position.x + 160, // block width
                    y: block.position.y + 40, // block center
                  }}
                  to={{
                    x: connectedBlock.position.x,
                    y: connectedBlock.position.y + 40,
                  }}
                />
              );
            }),
          )}
        </svg>

        {/* Blocks */}
        {blocks.map((block) => (
          <FlowBlockComponent
            key={block.id}
            block={block}
            isSelected={selectedBlock?.id === block.id}
            isConnecting={connectingFrom === block.id}
            onClick={() => handleBlockClick(block)}
            onMouseDown={(e) => handleMouseDown(e, block.id)}
            onDelete={() => onBlockDelete(block.id)}
            onStartConnecting={() => onSetConnecting(block.id)}
            onStopConnecting={() => onSetConnecting(null)}
          />
        ))}

        {/* Empty State */}
        {blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500 bg-white p-8 rounded-lg shadow border border-dashed border-gray-300">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700">
                Start Building Your Flow
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Drag blocks from the palette to create your interactive call
                flow. Connect them together to build amazing experiences!
              </p>
            </div>
          </div>
        )}

        {/* Connection Mode Overlay */}
        {connectingFrom && (
          <div className="absolute top-4 left-4 bg-green-100 border border-green-300 rounded-lg p-3 text-green-800 z-10 shadow">
            <div className="font-medium mb-1 text-sm">
              Connection Mode Active
            </div>
            <div className="text-xs">
              Click another block to connect, or click the link icon again to
              cancel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
