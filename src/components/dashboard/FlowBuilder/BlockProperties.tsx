import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlowBlock } from "@/stores/callFlowStore";
import { Settings, Plus, X, Link } from "lucide-react";

interface BlockPropertiesProps {
  block: FlowBlock | null;
  allBlocks: FlowBlock[];
  onUpdateBlock: (id: string, updates: Partial<FlowBlock>) => void;
  onConnect: (fromId: string, toId: string) => void;
  onDisconnect: (fromId: string, toId: string) => void;
  onStartConnecting: (id: string) => void;
}

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

export default function BlockProperties({
  block,
  allBlocks,
  onUpdateBlock,
  onConnect,
  onDisconnect,
  onStartConnecting,
}: BlockPropertiesProps) {
  if (!block) {
    return (
      <Card className="bg-white">
        <CardContent className="text-center py-8">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a Block
          </h3>
          <p className="text-gray-500">
            Click on a block in the canvas to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const updateConfig = (updates: any) => {
    onUpdateBlock(block.id, {
      config: { ...block.config, ...updates },
    });
  };

  const addMenuOption = () => {
    const currentOptions = block.config.options || [];
    updateConfig({
      options: [...currentOptions, { digit: "", text: "", action: "say" }],
    });
  };

  const updateMenuOption = (index: number, updates: any) => {
    const currentOptions = [...(block.config.options || [])];
    currentOptions[index] = { ...currentOptions[index], ...updates };
    updateConfig({ options: currentOptions });
  };

  const removeMenuOption = (index: number) => {
    const currentOptions = [...(block.config.options || [])];
    currentOptions.splice(index, 1);
    updateConfig({ options: currentOptions });
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {BLOCK_LABELS[block.type]} Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Management */}
        <div className="space-y-2">
          <Label>Connections</Label>
          <div className="text-sm text-gray-600 mb-2">
            This block connects to {block.connections.length} other block
            {block.connections.length !== 1 ? "s" : ""}
          </div>
          {block.connections.map((connId) => {
            const connectedBlock = allBlocks.find((b) => b.id === connId);
            return connectedBlock ? (
              <div
                key={connId}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {BLOCK_LABELS[connectedBlock.type]}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDisconnect(block.id, connId)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : null;
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStartConnecting(block.id)}
            className="w-full"
          >
            <Link className="h-4 w-4 mr-2" />
            Connect to Another Block
          </Button>
        </div>

        {/* Block-specific configuration */}
        {block.type === "say" && (
          <div className="space-y-2">
            <Label>Message Text</Label>
            <Textarea
              value={block.config.text || ""}
              onChange={(e) => updateConfig({ text: e.target.value })}
              placeholder="Enter the message to speak..."
              rows={4}
            />
          </div>
        )}

        {block.type === "gather" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Menu Prompt</Label>
              <Textarea
                value={block.config.prompt || ""}
                onChange={(e) => updateConfig({ prompt: e.target.value })}
                placeholder="Enter the menu prompt..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Menu Options</Label>
              {(block.config.options || []).map(
                (option: any, index: number) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      value={option.digit}
                      onChange={(e) =>
                        updateMenuOption(index, { digit: e.target.value })
                      }
                      placeholder="Key"
                      className="w-16"
                    />
                    <Input
                      value={option.text}
                      onChange={(e) =>
                        updateMenuOption(index, { text: e.target.value })
                      }
                      placeholder="Action description"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMenuOption(index)}
                      className="h-10 w-10 p-0 text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={addMenuOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {block.type === "forward" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={block.config.number || ""}
                onChange={(e) => updateConfig({ number: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Timeout (seconds)</Label>
              <Input
                type="number"
                value={block.config.timeout || 30}
                onChange={(e) =>
                  updateConfig({ timeout: parseInt(e.target.value) })
                }
                min="5"
                max="300"
              />
            </div>
          </div>
        )}

        {block.type === "record" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recording Prompt</Label>
              <Textarea
                value={block.config.prompt || ""}
                onChange={(e) => updateConfig({ prompt: e.target.value })}
                placeholder="Please leave your message after the beep..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Length (seconds)</Label>
              <Input
                type="number"
                value={block.config.maxLength || 300}
                onChange={(e) =>
                  updateConfig({ maxLength: parseInt(e.target.value) })
                }
                min="10"
                max="600"
              />
            </div>
          </div>
        )}

        {block.type === "pause" && (
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              value={block.config.duration || 2}
              onChange={(e) =>
                updateConfig({ duration: parseInt(e.target.value) })
              }
              min="1"
              max="10"
            />
          </div>
        )}

        {block.type === "play" && (
          <div className="space-y-2">
            <Label>Audio URL</Label>
            <Input
              value={block.config.url || ""}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="https://example.com/audio.mp3"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
