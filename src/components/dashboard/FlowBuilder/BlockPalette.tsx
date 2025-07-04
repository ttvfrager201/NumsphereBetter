import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare,
  Hash,
  PhoneForwarded,
  Mic,
  Pause,
  Play,
  Phone,
  MessageCircle,
} from "lucide-react";
import { FlowBlock } from "@/stores/callFlowStore";

const BLOCK_TYPES = [
  {
    type: "say",
    icon: MessageSquare,
    label: "Say Text",
    description: "Speak a message to the caller",
    color: "bg-blue-500",
    config: { text: "Hello! Welcome to our service." },
  },
  {
    type: "gather",
    icon: Hash,
    label: "Menu/Gather",
    description: "Present options and gather input",
    color: "bg-green-500",
    config: {
      prompt: "Press 1 for option A, or 2 for option B.",
      options: [
        { digit: "1", action: "say", text: "You selected option A" },
        { digit: "2", action: "say", text: "You selected option B" },
      ],
    },
  },
  {
    type: "forward",
    icon: PhoneForwarded,
    label: "Forward Call",
    description: "Transfer call to another number",
    color: "bg-purple-500",
    config: { number: "+1234567890", timeout: 30 },
  },
  {
    type: "record",
    icon: Mic,
    label: "Record Message",
    description: "Record caller's voicemail",
    color: "bg-red-500",
    config: {
      prompt: "Please leave your message after the beep.",
      maxLength: 300,
      finishOnKey: "#",
    },
  },
  {
    type: "pause",
    icon: Pause,
    label: "Pause/Wait",
    description: "Add a pause in the flow",
    color: "bg-yellow-500",
    config: { duration: 2 },
  },
  {
    type: "play",
    icon: Play,
    label: "Play Audio",
    description: "Play an audio file",
    color: "bg-indigo-500",
    config: { url: "https://example.com/audio.mp3" },
  },
  {
    type: "hangup",
    icon: Phone,
    label: "End Call",
    description: "Hang up the call",
    color: "bg-gray-500",
    config: {},
  },
];

interface BlockPaletteProps {
  onAddBlock: (blockType: any) => void;
  connectingFrom?: string | null;
}

export default function BlockPalette({
  onAddBlock,
  connectingFrom,
}: BlockPaletteProps) {
  const generateBlockId = () => Date.now().toString();

  const handleAddBlock = (blockType: any) => {
    const newBlock: FlowBlock = {
      id: generateBlockId(),
      type: blockType.type,
      config: { ...blockType.config },
      position: { x: 100, y: 100 },
      connections: [],
    };

    onAddBlock(newBlock);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          🧩 Building Blocks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {BLOCK_TYPES.map((blockType) => {
          const IconComponent = blockType.icon;
          return (
            <div
              key={blockType.type}
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-all group"
              onClick={() => handleAddBlock(blockType)}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`p-1 rounded ${blockType.color} text-white group-hover:scale-110 transition-transform`}
                >
                  <IconComponent className="h-3 w-3" />
                </div>
                <span className="font-medium text-sm">{blockType.label}</span>
              </div>
              <div className="text-xs text-gray-500">
                {blockType.description}
              </div>
            </div>
          );
        })}

        {connectingFrom && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800 mb-1">
              🔗 Connection Mode
            </div>
            <div className="text-xs text-green-600">
              Click any block above to auto-connect from the selected block.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
