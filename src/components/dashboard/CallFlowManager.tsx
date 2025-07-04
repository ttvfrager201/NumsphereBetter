import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Phone,
  Settings,
  Save,
  Trash2,
  Plus,
  Edit,
  Zap,
  Wand2,
  Volume2,
} from "lucide-react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useCallFlowStore } from "@/stores/callFlowStore";
import BlockPalette from "./FlowBuilder/BlockPalette";
import FlowCanvas from "./FlowBuilder/FlowCanvas";
import BlockProperties from "./FlowBuilder/BlockProperties";

interface TwilioNumber {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  status: string;
  minutes_used: number;
  minutes_allocated: number;
  plan_id: string;
}

const VOICE_OPTIONS = [
  { value: "alice", label: "Alice (Female, English)", accent: "US" },
  { value: "man", label: "Man (Male, English)", accent: "US" },
  { value: "woman", label: "Woman (Female, English)", accent: "US" },
  { value: "Polly.Joanna", label: "Joanna (Female, Neural)", accent: "US" },
  { value: "Polly.Matthew", label: "Matthew (Male, Neural)", accent: "US" },
  { value: "Polly.Amy", label: "Amy (Female, British)", accent: "UK" },
  { value: "Polly.Brian", label: "Brian (Male, British)", accent: "UK" },
  { value: "Polly.Emma", label: "Emma (Female, British)", accent: "UK" },
  { value: "Polly.Olivia", label: "Olivia (Female, Australian)", accent: "AU" },
];

export default function CallFlowManager() {
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Zustand store
  const {
    flows,
    blocks,
    selectedBlock,
    connectingFrom,
    voice,
    flowName,
    selectedNumberId,
    isSaving,
    currentFlow,
    loadFlows,
    saveFlow,
    deleteFlow,
    setBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    connectBlocks,
    disconnectBlocks,
    setSelectedBlock,
    setConnectingFrom,
    setVoice,
    setFlowName,
    setSelectedNumberId,
    setCurrentFlow,
    resetEditor,
  } = useCallFlowStore();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      loadFlows(user.id);
    }
  }, [user, loadFlows]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: numbersData, error: numbersError } = await supabase
        .from("twilio_numbers")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (numbersError) {
        console.error("Error fetching numbers:", numbersError);
      } else {
        setTwilioNumbers(numbersData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlow = () => {
    resetEditor();
    setShowFlowEditor(true);
  };

  const handleEditFlow = (flow: any) => {
    setCurrentFlow(flow);
    setFlowName(flow.flow_name);
    setVoice(flow.flow_config.voice || "alice");
    setSelectedNumberId(flow.twilio_number_id || "");

    if (flow.flow_config.blocks) {
      setBlocks(flow.flow_config.blocks);
    } else {
      // Convert legacy format to blocks
      const legacyBlocks = convertLegacyToBlocks(flow.flow_config);
      setBlocks(legacyBlocks);
    }

    setShowFlowEditor(true);
  };

  const convertLegacyToBlocks = (config: any) => {
    const blocks = [];
    let yPos = 100;

    if (config.greeting) {
      blocks.push({
        id: "1",
        type: "say",
        config: { text: config.greeting },
        position: { x: 100, y: yPos },
        connections: [],
      });
      yPos += 150;
    }

    if (config.menu) {
      blocks.push({
        id: "2",
        type: "gather",
        config: {
          prompt: config.menu.prompt,
          options: config.menu.options || [],
        },
        position: { x: 100, y: yPos },
        connections: [],
      });
      yPos += 150;
    }

    return blocks;
  };

  const handleAddBlock = (block: any) => {
    // Calculate proper positioning
    let newX = 100;
    let newY = 100;

    if (connectingFrom) {
      const parentBlock = blocks.find((b) => b.id === connectingFrom);
      if (parentBlock) {
        newX = parentBlock.position.x + 200;
        newY = parentBlock.position.y;
        // Connect the blocks
        connectBlocks(connectingFrom, block.id);
        setConnectingFrom(null);
      }
    } else {
      // Find free position
      const gridSize = 100;
      const maxCols = 6;
      let row = 0;
      let col = 0;

      while (true) {
        newX = 50 + col * 180;
        newY = 50 + row * gridSize;

        const occupied = blocks.some(
          (b) =>
            Math.abs(b.position.x - newX) < 160 &&
            Math.abs(b.position.y - newY) < 80,
        );

        if (!occupied) break;

        col++;
        if (col >= maxCols) {
          col = 0;
          row++;
        }
      }
    }

    const newBlock = {
      ...block,
      position: { x: newX, y: newY },
    };

    addBlock(newBlock);
  };

  const handleSaveFlow = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save flows.",
        variant: "destructive",
      });
      return;
    }

    // Validation
    if (!flowName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a flow name.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedNumberId) {
      toast({
        title: "Validation Error",
        description: "Please select a phone number.",
        variant: "destructive",
      });
      return;
    }

    if (blocks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one block to your flow.",
        variant: "destructive",
      });
      return;
    }

    const success = await saveFlow(user.id);
    if (success) {
      toast({
        title: "Success! 🎉",
        description: `Call flow "${flowName}" ${currentFlow ? "updated" : "created"} successfully! Your Twilio number is now configured.`,
      });
      setShowFlowEditor(false);
      resetEditor();
    } else {
      toast({
        title: "Error",
        description:
          "Failed to save call flow. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!user) return;

    const success = await deleteFlow(flowId, user.id);
    if (success) {
      toast({
        title: "Success",
        description: "Call flow deleted successfully!",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to delete call flow.",
        variant: "destructive",
      });
    }
  };

  const playVoiceDemo = async (voiceOption: string) => {
    setIsPlayingVoice(voiceOption);

    const demoText =
      "Hello! This is how I sound. Thank you for choosing our service.";

    try {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(demoText);
        utterance.rate = 0.9;
        utterance.pitch = voiceOption.includes("Polly") ? 1.1 : 1.0;

        utterance.onend = () => {
          setIsPlayingVoice(null);
        };

        speechSynthesis.speak(utterance);
      } else {
        toast({
          title: `${voiceOption} Voice Demo`,
          description: `"${demoText}"`,
        });
        setTimeout(() => setIsPlayingVoice(null), 3000);
      }
    } catch (error) {
      console.error("Voice demo error:", error);
      setIsPlayingVoice(null);
    }
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    return phoneNumber;
  };

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Call Flow Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (twilioNumbers.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Call Flow Manager
          </CardTitle>
          <CardDescription>
            Create and manage call flows for your phone numbers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
              <Phone className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                📞 No Phone Numbers Yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You need to purchase a phone number first before creating call
                flows. Go to the "Select Number" tab to get started.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Phone className="h-4 w-4 mr-2" />
                Get Phone Number
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Call Flow Manager
              </CardTitle>
              <CardDescription>
                Design custom call flows with drag-and-drop blocks
              </CardDescription>
            </div>
            <Button
              onClick={handleCreateFlow}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Create Flow
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
                <Zap className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  🎨 No Call Flows Yet
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Create your first interactive call flow with our visual
                  editor! Drag and drop blocks to build amazing call
                  experiences.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-500 mb-4">
                  <Badge variant="outline">🎯 Drag & Drop</Badge>
                  <Badge variant="outline">🎵 Voice Demos</Badge>
                  <Badge variant="outline">📞 Live Preview</Badge>
                  <Badge variant="outline">🔄 Unlimited Flows</Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center justify-between p-6 border rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200 transition-all duration-200 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-lg text-gray-900 group-hover:text-blue-900">
                          {flow.flow_name}
                        </div>
                        <div className="flex items-center gap-2">
                          {flow.is_active && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              ✅ Active
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            📞{" "}
                            {formatPhoneNumber(
                              flow.twilio_numbers?.phone_number || "",
                            )}
                          </Badge>
                          {flow.flow_config.voice && (
                            <Badge variant="outline" className="text-xs">
                              🎵 {flow.flow_config.voice}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {flow.flow_config.blocks ? (
                        <span>
                          📦 {flow.flow_config.blocks.length} interactive blocks
                        </span>
                      ) : (
                        <span>Legacy flow configuration</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditFlow(flow)}
                      className="hover:bg-blue-50 hover:border-blue-300"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit Flow
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flow Editor Dialog */}
      <Dialog
        open={showFlowEditor}
        onOpenChange={(open) => {
          if (!open) {
            setShowFlowEditor(false);
            resetEditor();
          }
        }}
      >
        <DialogContent className="max-w-[95vw] h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {currentFlow ? "Edit Call Flow" : "Create Call Flow"}
            </DialogTitle>
            <DialogDescription>
              Design your interactive call flow with drag-and-drop blocks
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-full gap-2 overflow-hidden">
            {/* Left Sidebar - Settings & Blocks */}
            <div className="w-64 space-y-2 overflow-y-auto flex-shrink-0">
              {/* Flow Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Flow Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="flowName" className="text-sm">
                      Flow Name
                    </Label>
                    <Input
                      id="flowName"
                      placeholder="e.g., Business Hours Flow"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberSelect" className="text-sm">
                      Phone Number
                    </Label>
                    <Select
                      value={selectedNumberId}
                      onValueChange={setSelectedNumberId}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select a phone number" />
                      </SelectTrigger>
                      <SelectContent>
                        {twilioNumbers.map((number) => (
                          <SelectItem key={number.id} value={number.id}>
                            {formatPhoneNumber(number.phone_number)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voiceSelect" className="text-sm">
                      Voice
                    </Label>
                    <Select value={voice} onValueChange={setVoice}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center justify-between w-full">
                              <span>{option.label}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playVoiceDemo(option.value);
                                }}
                                className="h-6 w-6 p-0 ml-2"
                                disabled={isPlayingVoice === option.value}
                              >
                                {isPlayingVoice === option.value ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  <Volume2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Block Palette */}
              <BlockPalette
                onAddBlock={handleAddBlock}
                connectingFrom={connectingFrom}
              />
            </div>

            {/* Main Canvas */}
            <div className="flex-1 min-w-0">
              <FlowCanvas
                blocks={blocks}
                selectedBlock={selectedBlock}
                connectingFrom={connectingFrom}
                onBlockSelect={setSelectedBlock}
                onBlockUpdate={updateBlock}
                onBlockDelete={deleteBlock}
                onConnect={connectBlocks}
                onSetConnecting={setConnectingFrom}
              />
            </div>

            {/* Right Sidebar - Block Properties */}
            <div className="w-64 overflow-y-auto flex-shrink-0">
              <BlockProperties
                block={selectedBlock}
                allBlocks={blocks}
                onUpdateBlock={updateBlock}
                onConnect={connectBlocks}
                onDisconnect={disconnectBlocks}
                onStartConnecting={setConnectingFrom}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center gap-4 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline">
                {formatPhoneNumber(
                  twilioNumbers.find((n) => n.id === selectedNumberId)
                    ?.phone_number || "Select Number",
                )}
              </Badge>
              <Badge variant="outline">{voice}</Badge>
              <Badge variant="outline">{blocks.length} blocks</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFlowEditor(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveFlow}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {currentFlow ? "Update Flow" : "Save Flow"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
