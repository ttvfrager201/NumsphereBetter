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
      default:
        return "Configure block";
    }
  };

  return (
    <div
      className={`absolute w-48 min-h-[100px] p-4 bg-white border-2 rounded-lg shadow-sm cursor-pointer transition-all z-10 select-none ${
        isSelected
          ? "border-blue-500 shadow-lg scale-105"
          : isConnecting
            ? "border-green-500 shadow-lg bg-green-50"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
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
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1 rounded ${color} text-white`}>
          <IconComponent className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm flex-1">{label}</span>
        <div className="flex gap-1">
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
            className={`h-6 w-6 p-0 ${
              isConnecting
                ? "text-green-600 bg-green-100"
                : "text-blue-500 hover:text-blue-700"
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
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            title="Delete block"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="text-xs text-gray-600 mb-2">{getPreviewText()}</div>

      {/* Connection Info */}
      {block.connections.length > 0 && (
        <div className="text-xs text-blue-600">
          → Connected to {block.connections.length} block
          {block.connections.length > 1 ? "s" : ""}
        </div>
      )}

      {/* Connection Points */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-300 rounded-full border-2 border-white shadow-sm" />
    </div>
  );
}
