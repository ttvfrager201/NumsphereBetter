import React from "react";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Hash,
  PhoneForwarded,
  Mic,
  Pause,
  Play,
  Phone,
  X,
  Link,
  Clock,
} from "lucide-react";
import { FlowBlock } from "@/stores/callFlowStore";

const BLOCK_ICONS = {
  say: MessageSquare,
  gather: Hash,
  forward: PhoneForwarded,
  record: Mic,
  pause: Pause,
  play: Play,
  hangup: Phone,
  sms: MessageSquare,
  hold: Clock,
};

const BLOCK_COLORS = {
  say: "bg-blue-500",
  gather: "bg-green-500",
  forward: "bg-purple-500",
  record: "bg-red-500",
  pause: "bg-yellow-500",
  play: "bg-indigo-500",
  hangup: "bg-gray-500",
  sms: "bg-pink-500",
  hold: "bg-orange-500",
};

const BLOCK_LABELS = {
  say: "Say Text",
  gather: "Menu/Gather",
  forward: "Forward Call",
  record: "Record Message",
  pause: "Pause/Wait",
  play: "Play Audio",
  hangup: "End Call",
  sms: "Send SMS",
  hold: "Hold Call",
};

interface FlowBlockComponentProps {
  block: FlowBlock;
  isSelected: boolean;
  isConnecting: boolean;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onStartConnecting: () => void;
  onStopConnecting: () => void;
}

export default function FlowBlockComponent({
  block,
  isSelected,
  isConnecting,
  onClick,
  onMouseDown,
  onDelete,
  onStartConnecting,
  onStopConnecting,
}: FlowBlockComponentProps) {
  const IconComponent = BLOCK_ICONS[block.type] || Phone;
  const color = BLOCK_COLORS[block.type] || "bg-gray-500";
  const label = BLOCK_LABELS[block.type] || "Block";

  const getPreviewText = () => {
    switch (block.type) {
      case "say":
        return block.config.text
          ? `"${block.config.text.substring(0, 30)}..."`
          : "No text set";
      case "gather":
        return block.config.prompt
          ? `"${block.config.prompt.substring(0, 30)}..."`
          : "No prompt set";
      case "forward":
        return block.config.number
          ? `→ ${block.config.number}`
          : "No number set";
      case "record":
        return "🎤 Record message";
      case "pause":
        return `⏸️ Wait ${block.config.duration || 2}s`;
      case "play":
        return block.config.url ? "🎵 Play audio" : "No audio URL";
      case "hangup":
        return "📞 End call";
      case "hold":
        return "🎵 Hold with music";
      default:
        return "Configure block";
    }
  };

  return (
    <div
      className={`absolute w-40 min-h-[80px] p-2 bg-white border-2 rounded-lg shadow-sm cursor-pointer transition-all z-10 select-none ${
        isSelected
          ? "border-blue-500 shadow-lg scale-105 bg-blue-50"
          : isConnecting
            ? "border-green-500 shadow-lg bg-green-50"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-102"
      }`}
      style={{
        left: block.position.x,
        top: block.position.y,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div className="flex items-center gap-1 mb-1">
        <div className={`p-1 rounded ${color} text-white shadow-sm`}>
          <IconComponent className="h-3 w-3" />
        </div>
        <span className="font-semibold text-xs flex-1 text-gray-800 truncate">
          {label}
        </span>
        <div className="flex gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              if (isConnecting) {
                onStopConnecting();
              } else {
                onStartConnecting();
              }
            }}
            className={`h-5 w-5 p-0 ${
              isConnecting
                ? "text-green-600 bg-green-100 hover:bg-green-200"
                : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
            }`}
            title={
              isConnecting ? "Cancel connection" : "Connect to another block"
            }
          >
            <Link className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            title="Delete block"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="text-xs text-gray-700 mb-1 p-1 bg-gray-50 rounded border">
        <div className="truncate">{getPreviewText()}</div>
      </div>

      {/* Connection Info */}
      {block.connections.length > 0 && (
        <div className="text-xs text-blue-700 font-medium bg-blue-50 px-1 py-0.5 rounded">
          → {block.connections.length}
        </div>
      )}

      {/* Connection Points */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm" />
    </div>
  );
}
