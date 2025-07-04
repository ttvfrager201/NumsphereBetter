import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  Play,
  Save,
  Trash2,
  Plus,
  MessageSquare,
  PhoneForwarded,
  Mic,
  Volume2,
  Edit,
  Zap,
  Hash,
  Pause,
  X,
  ChevronDown,
  ChevronUp,
  Wand2,
  ArrowDown,
  Link,
} from "lucide-react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

interface TwilioNumber {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  status: string;
  minutes_used: number;
  minutes_allocated: number;
  plan_id: string;
}

interface CallFlow {
  id: string;
  flow_name: string;
  flow_config: any;
  is_active: boolean;
  created_at: string;
  twilio_number_id: string;
  twilio_numbers?: {
    phone_number: string;
    friendly_name: string;
  };
}

interface FlowBlock {
  id: string;
  type:
    | "say"
    | "gather"
    | "forward"
    | "hangup"
    | "pause"
    | "record"
    | "play"
    | "sms";
  config: any;
  position: { x: number; y: number };
  connections: string[];
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

const FLOW_PRESETS = [
  {
    id: "business-hours",
    name: "🏢 Business Hours",
    description: "Professional greeting with business hours info",
    blocks: [
      {
        id: "1",
        type: "say",
        config: {
          text: "Thank you for calling! Our business hours are Monday through Friday, 9 AM to 5 PM.",
        },
        position: { x: 100, y: 100 },
        connections: ["2"],
      },
      {
        id: "2",
        type: "gather",
        config: {
          prompt: "Press 1 to leave a message, or press 2 to hear our address.",
          options: [
            { digit: "1", action: "record", text: "Leave Message" },
            {
              digit: "2",
              action: "say",
              text: "Our address is 123 Main Street, Anytown USA.",
            },
          ],
        },
        position: { x: 100, y: 200 },
        connections: [],
      },
    ],
  },
  {
    id: "customer-support",
    name: "🎧 Customer Support",
    description: "Multi-level support menu with escalation",
    blocks: [
      {
        id: "1",
        type: "say",
        config: {
          text: "Welcome to customer support! Your call is important to us.",
        },
        position: { x: 100, y: 100 },
        connections: ["2"],
      },
      {
        id: "2",
        type: "gather",
        config: {
          prompt:
            "Press 1 for technical support, 2 for billing, 3 for sales, or 0 for an operator.",
          options: [
            { digit: "1", action: "forward", text: "Technical Support" },
            { digit: "2", action: "forward", text: "Billing Department" },
            { digit: "3", action: "forward", text: "Sales Team" },
            { digit: "0", action: "forward", text: "Operator" },
          ],
        },
        position: { x: 100, y: 200 },
        connections: [],
      },
    ],
  },
];

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

export default function CallFlowManager() {
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [flows, setFlows] = useState<CallFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [editingFlow, setEditingFlow] = useState<CallFlow | null>(null);
  const [selectedNumberId, setSelectedNumberId] = useState<string>("");
  const [flowName, setFlowName] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alice");
  const [flowBlocks, setFlowBlocks] = useState<FlowBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<FlowBlock | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showBlockPalette, setShowBlockPalette] = useState(true);
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<FlowBlock | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch Twilio numbers
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

      // Fetch call flows
      const { data: flowsData, error: flowsError } = await supabase
        .from("call_flows")
        .select(
          `
          *,
          twilio_numbers(
            phone_number,
            friendly_name
          )
        `,
        )
        .eq("user_id", user.id);

      if (flowsError) {
        console.error("Error fetching flows:", flowsError);
      } else {
        setFlows(flowsData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetEditor = () => {
    setFlowName("");
    setSelectedVoice("alice");
    setFlowBlocks([]);
    setSelectedBlock(null);
    setEditingFlow(null);
    setSelectedNumberId("");
  };

  const handleCreateFlow = () => {
    resetEditor();
    setShowFlowEditor(true);
  };

  const handleEditFlow = (flow: CallFlow) => {
    setEditingFlow(flow);
    setFlowName(flow.flow_name);
    setSelectedVoice(flow.flow_config.voice || "alice");
    setSelectedNumberId(flow.twilio_number_id || "");

    // Convert existing flow config to blocks
    if (flow.flow_config.blocks) {
      setFlowBlocks(flow.flow_config.blocks);
    } else {
      // Convert legacy format to blocks
      const legacyBlocks = convertLegacyToBlocks(flow.flow_config);
      setFlowBlocks(legacyBlocks);
    }

    setShowFlowEditor(true);
  };

  const convertLegacyToBlocks = (config: any): FlowBlock[] => {
    const blocks: FlowBlock[] = [];
    let yPos = 100;

    if (config.greeting) {
      blocks.push({
        id: "1",
        type: "say",
        config: { text: config.greeting },
        position: { x: 100, y: yPos },
        connections: [],
      });
      yPos += 100;
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
      yPos += 100;
    }

    if (config.forward) {
      blocks.push({
        id: "3",
        type: "forward",
        config: { number: config.forward.number, timeout: 30 },
        position: { x: 100, y: yPos },
        connections: [],
      });
      yPos += 100;
    }

    if (config.voicemail) {
      blocks.push({
        id: "4",
        type: "record",
        config: {
          prompt:
            config.voicemail.prompt || "Please leave a message after the beep.",
          maxLength: 300,
          finishOnKey: "#",
        },
        position: { x: 100, y: yPos },
        connections: [],
      });
    }

    return blocks;
  };

  const handleLoadPreset = (preset: any) => {
    setFlowName(preset.name);
    setFlowBlocks(preset.blocks);
    setShowPresets(false);
    toast({
      title: "Preset Loaded!",
      description: `${preset.name} template has been loaded. Customize it as needed.`,
    });
  };

  const addBlock = (blockType: any, connectToBlockId?: string) => {
    // Calculate proper positioning to avoid overlaps
    let newX = 100;
    let newY = 100;

    if (connectToBlockId) {
      const parentBlock = flowBlocks.find((b) => b.id === connectToBlockId);
      if (parentBlock) {
        newX = parentBlock.position.x + 300; // Place to the right
        newY = parentBlock.position.y;
      }
    } else {
      // Find a free position by checking existing blocks
      const gridSize = 150;
      const maxCols = 4;
      let row = 0;
      let col = 0;

      while (true) {
        newX = 100 + col * 300;
        newY = 100 + row * gridSize;

        // Check if this position is occupied
        const occupied = flowBlocks.some(
          (block) =>
            Math.abs(block.position.x - newX) < 250 &&
            Math.abs(block.position.y - newY) < 100,
        );

        if (!occupied) break;

        col++;
        if (col >= maxCols) {
          col = 0;
          row++;
        }
      }
    }

    const newBlock: FlowBlock = {
      id: Date.now().toString(),
      type: blockType.type,
      config: { ...blockType.config },
      position: { x: newX, y: newY },
      connections: [],
    };

    // If connecting to an existing block, update its connections
    if (connectToBlockId) {
      setFlowBlocks((blocks) =>
        blocks
          .map((block) =>
            block.id === connectToBlockId
              ? { ...block, connections: [...block.connections, newBlock.id] }
              : block,
          )
          .concat(newBlock),
      );
    } else {
      setFlowBlocks([...flowBlocks, newBlock]);
    }

    setSelectedBlock(newBlock);
    setConnectingFrom(null);
  };

  const updateBlock = (blockId: string, updates: Partial<FlowBlock>) => {
    setFlowBlocks((blocks) =>
      blocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block,
      ),
    );

    if (selectedBlock?.id === blockId) {
      setSelectedBlock((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const deleteBlock = (blockId: string) => {
    // Remove connections to this block from other blocks
    setFlowBlocks((blocks) =>
      blocks
        .filter((block) => block.id !== blockId)
        .map((block) => ({
          ...block,
          connections: block.connections.filter((connId) => connId !== blockId),
        })),
    );
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(null);
    }
  };

  const connectBlocks = (fromBlockId: string, toBlockId: string) => {
    setFlowBlocks((blocks) =>
      blocks.map((block) =>
        block.id === fromBlockId
          ? {
              ...block,
              connections: [...new Set([...block.connections, toBlockId])],
            }
          : block,
      ),
    );
  };

  const disconnectBlocks = (fromBlockId: string, toBlockId: string) => {
    setFlowBlocks((blocks) =>
      blocks.map((block) =>
        block.id === fromBlockId
          ? {
              ...block,
              connections: block.connections.filter((id) => id !== toBlockId),
            }
          : block,
      ),
    );
  };

  const playVoiceDemo = async (voice: string) => {
    setIsPlayingVoice(voice);

    const demoText =
      "Hello! This is how I sound. Thank you for choosing our service.";

    try {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(demoText);

        const voiceMap: { [key: string]: string } = {
          alice: "female",
          woman: "female",
          man: "male",
          "Polly.Joanna": "female",
          "Polly.Matthew": "male",
          "Polly.Amy": "female",
          "Polly.Brian": "male",
          "Polly.Emma": "female",
          "Polly.Olivia": "female",
        };

        const voices = speechSynthesis.getVoices();
        const targetGender = voiceMap[voice] || "female";
        const selectedVoice =
          voices.find(
            (v) =>
              v.name.toLowerCase().includes(targetGender) ||
              (targetGender === "female" &&
                v.name.toLowerCase().includes("female")) ||
              (targetGender === "male" &&
                v.name.toLowerCase().includes("male")),
          ) || voices[0];

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.rate = 0.9;
        utterance.pitch = voice.includes("Polly") ? 1.1 : 1.0;

        utterance.onend = () => {
          setIsPlayingVoice(null);
        };

        speechSynthesis.speak(utterance);
      } else {
        toast({
          title: `${voice} Voice Demo`,
          description: `"${demoText}"`,
        });
        setTimeout(() => setIsPlayingVoice(null), 3000);
      }
    } catch (error) {
      console.error("Voice demo error:", error);
      setIsPlayingVoice(null);
      toast({
        title: "Voice Demo",
        description: `This is how ${voice} would sound: "${demoText}"`,
      });
    }
  };

  const handleSaveFlow = async () => {
    if (!user || !flowName.trim() || !selectedNumberId) {
      toast({
        title: "Validation Error",
        description: "Please provide a flow name and select a phone number.",
        variant: "destructive",
      });
      return;
    }

    if (flowBlocks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one block to your flow.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const flowConfig = {
        voice: selectedVoice,
        blocks: flowBlocks,
        version: "2.0",
      };

      const flowData = {
        flow_name: flowName,
        flow_config: flowConfig,
        twilio_number_id: selectedNumberId,
        user_id: user.id,
        is_active: true,
      };

      let result;
      if (editingFlow) {
        result = await supabase
          .from("call_flows")
          .update(flowData)
          .eq("id", editingFlow.id)
          .select();
      } else {
        result = await supabase.from("call_flows").insert([flowData]).select();
      }

      if (result.error) {
        throw result.error;
      }

      // Update Twilio webhook URLs
      const { data: webhookData, error: webhookError } =
        await supabase.functions.invoke("manage-call-flows", {
          body: {
            action: "update_webhooks",
            userId: user.id,
            twilioNumberId: selectedNumberId,
          },
        });

      if (webhookError) {
        console.error("Webhook update error:", webhookError);
        toast({
          title: "Warning",
          description:
            "Flow saved but webhook configuration may need manual setup.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Call flow ${editingFlow ? "updated" : "created"} successfully! Twilio webhooks configured.`,
        });
      }

      setShowFlowEditor(false);
      resetEditor();
      await fetchData();
    } catch (error) {
      console.error("Error saving call flow:", error);
      toast({
        title: "Error",
        description: "Failed to save call flow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("call_flows")
        .delete()
        .eq("id", flowId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Call flow deleted successfully!",
      });
      await fetchData();
    } catch (error) {
      console.error("Error deleting call flow:", error);
      toast({
        title: "Error",
        description: "Failed to delete call flow.",
        variant: "destructive",
      });
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
                Design custom call flows for your phone numbers with
                drag-and-drop blocks
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
                  editor! Choose from presets or build custom flows with endless
                  possibilities.
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
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {editingFlow ? "Edit Call Flow" : "Create Call Flow"}
            </DialogTitle>
            <DialogDescription>
              Design your interactive call flow with drag-and-drop blocks
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[70vh] gap-4">
            {/* Left Sidebar - Tools */}
            <div className="w-80 border-r pr-4 overflow-y-auto">
              {/* Flow Settings */}
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="flowName">Flow Name</Label>
                  <Input
                    id="flowName"
                    placeholder="e.g., Business Hours Flow"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                  />
                </div>

                {/* Quick Test Button */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    🚀 Quick Test
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!selectedNumberId) {
                        toast({
                          title: "Select a phone number first",
                          description:
                            "Choose a phone number to create a test flow.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setFlowName("Test Call Flow");
                      setFlowBlocks([
                        {
                          id: "1",
                          type: "say",
                          config: {
                            text: "Hello! This is a test call flow. Press 1 to continue or 2 to end the call.",
                          },
                          position: { x: 100, y: 100 },
                          connections: ["2"],
                        },
                        {
                          id: "2",
                          type: "gather",
                          config: {
                            prompt:
                              "Press 1 to hear a message, or press 2 to end the call.",
                            options: [
                              {
                                digit: "1",
                                action: "say",
                                text: "Great! The call flow is working perfectly.",
                              },
                              {
                                digit: "2",
                                action: "hangup",
                                text: "Goodbye!",
                              },
                            ],
                          },
                          position: { x: 400, y: 100 },
                          connections: ["3"],
                        },
                        {
                          id: "3",
                          type: "say",
                          config: {
                            text: "Thank you for testing NumSphere. Goodbye!",
                          },
                          position: { x: 700, y: 100 },
                          connections: ["4"],
                        },
                        {
                          id: "4",
                          type: "hangup",
                          config: {},
                          position: { x: 1000, y: 100 },
                          connections: [],
                        },
                      ]);
                      toast({
                        title: "Test Flow Created!",
                        description:
                          "A simple test flow has been loaded. Save it and try calling your number!",
                      });
                    }}
                    className="w-full"
                  >
                    Create Test Flow
                  </Button>
                  <div className="text-xs text-blue-600 mt-1">
                    Creates a simple flow to test your phone number
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="mb-6">
                <Button
                  variant="outline"
                  onClick={() => setShowPresets(!showPresets)}
                  className="w-full justify-between"
                >
                  🎯 Quick Start Presets
                  {showPresets ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                {showPresets && (
                  <div className="mt-2 space-y-2">
                    {FLOW_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-gray-500">
                          {preset.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Block Palette */}
              <div>
                <Button
                  variant="outline"
                  onClick={() => setShowBlockPalette(!showBlockPalette)}
                  className="w-full justify-between mb-2"
                >
                  🧩 Building Blocks
                  {showBlockPalette ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                {showBlockPalette && (
                  <div className="space-y-2">
                    {BLOCK_TYPES.map((blockType) => {
                      const IconComponent = blockType.icon;
                      return (
                        <div
                          key={blockType.type}
                          className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                          onClick={() => {
                            if (connectingFrom) {
                              addBlock(blockType, connectingFrom);
                            } else {
                              addBlock(blockType);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className={`p-1 rounded ${blockType.color} text-white`}
                            >
                              <IconComponent className="h-3 w-3" />
                            </div>
                            <span className="font-medium text-sm">
                              {blockType.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {blockType.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Main Canvas */}
            <div className="flex-1 relative bg-gray-50 rounded-lg overflow-auto">
              <div className="relative min-h-[800px] min-w-[1200px] p-4">
                {flowBlocks.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Start Building Your Flow
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Add blocks from the palette or load a preset to get
                        started
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative min-h-[600px]">
                    {/* Connection Lines */}
                    {flowBlocks.map((block) =>
                      block.connections.map((connectedId) => {
                        const connectedBlock = flowBlocks.find(
                          (b) => b.id === connectedId,
                        );
                        if (!connectedBlock) return null;

                        const startX = block.position.x + 192; // block width
                        const startY = block.position.y + 40; // block center
                        const endX = connectedBlock.position.x;
                        const endY = connectedBlock.position.y + 40;

                        return (
                          <svg
                            key={`${block.id}-${connectedId}`}
                            className="absolute pointer-events-none"
                            style={{
                              left: Math.min(startX, endX),
                              top: Math.min(startY, endY),
                              width: Math.abs(endX - startX),
                              height: Math.abs(endY - startY) + 20,
                            }}
                          >
                            <defs>
                              <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                              >
                                <polygon
                                  points="0 0, 10 3.5, 0 7"
                                  fill="#6b7280"
                                />
                              </marker>
                            </defs>
                            <line
                              x1={startX > endX ? Math.abs(endX - startX) : 0}
                              y1={startY > endY ? Math.abs(endY - startY) : 0}
                              x2={startX > endX ? 0 : Math.abs(endX - startX)}
                              y2={startY > endY ? 0 : Math.abs(endY - startY)}
                              stroke="#6b7280"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                              markerEnd="url(#arrowhead)"
                            />
                          </svg>
                        );
                      }),
                    )}

                    {/* Blocks */}
                    {flowBlocks.map((block) => {
                      const blockType = BLOCK_TYPES.find(
                        (bt) => bt.type === block.type,
                      );
                      const IconComponent = blockType?.icon || Phone;

                      return (
                        <div key={block.id}>
                          {/* Block */}
                          <div
                            className={`absolute w-48 min-h-[100px] p-4 bg-white border-2 rounded-lg shadow-sm cursor-pointer transition-all z-10 ${
                              selectedBlock?.id === block.id
                                ? "border-blue-500 shadow-lg z-20"
                                : connectingFrom === block.id
                                  ? "border-green-500 shadow-lg bg-green-50 z-20"
                                  : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                            }`}
                            style={{
                              left: block.position.x,
                              top: block.position.y,
                              transform:
                                selectedBlock?.id === block.id
                                  ? "scale(1.02)"
                                  : "scale(1)",
                            }}
                            onClick={() => {
                              if (
                                connectingFrom &&
                                connectingFrom !== block.id
                              ) {
                                connectBlocks(connectingFrom, block.id);
                                setConnectingFrom(null);
                              } else {
                                setSelectedBlock(block);
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`p-1 rounded ${blockType?.color || "bg-gray-500"} text-white`}
                              >
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <span className="font-medium text-sm">
                                {blockType?.label}
                              </span>
                              <div className="flex gap-1 ml-auto">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConnectingFrom(
                                      connectingFrom === block.id
                                        ? null
                                        : block.id,
                                    );
                                  }}
                                  className={`h-6 w-6 p-0 ${
                                    connectingFrom === block.id
                                      ? "text-green-600 bg-green-100"
                                      : "text-blue-500 hover:text-blue-700"
                                  }`}
                                  title={
                                    connectingFrom === block.id
                                      ? "Cancel connection"
                                      : "Connect to another block"
                                  }
                                >
                                  <Link className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBlock(block.id);
                                  }}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="text-xs text-gray-600 mb-2">
                              {block.type === "say" && block.config.text && (
                                <span>
                                  "{block.config.text.substring(0, 30)}..."
                                </span>
                              )}
                              {block.type === "gather" &&
                                block.config.prompt && (
                                  <span>
                                    "{block.config.prompt.substring(0, 30)}..."
                                  </span>
                                )}
                              {block.type === "forward" &&
                                block.config.number && (
                                  <span>→ {block.config.number}</span>
                                )}
                              {block.type === "record" && (
                                <span>🎤 Record message</span>
                              )}
                              {block.type === "pause" && (
                                <span>⏸️ Wait {block.config.duration}s</span>
                              )}
                              {block.type === "hangup" && (
                                <span>📞 End call</span>
                              )}
                            </div>

                            {/* Connection indicators */}
                            {block.connections.length > 0 && (
                              <div className="text-xs text-blue-600">
                                → Connected to {block.connections.length} block
                                {block.connections.length > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Connection helper text */}
                    {connectingFrom && (
                      <div className="absolute top-4 left-4 bg-green-100 border border-green-300 rounded-lg p-3 text-sm text-green-800">
                        <div className="font-medium mb-1">
                          🔗 Connection Mode Active
                        </div>
                        <div>
                          Click another block to connect, or click the link icon
                          again to cancel.
                        </div>
                        <div className="text-xs mt-1">
                          You can also add a new block from the palette to
                          auto-connect.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar - Block Properties */}
            <div className="w-80 border-l pl-4 overflow-y-auto">
              {selectedBlock ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className={`p-2 rounded ${BLOCK_TYPES.find((bt) => bt.type === selectedBlock.type)?.color || "bg-gray-500"} text-white`}
                    >
                      {(() => {
                        const IconComponent =
                          BLOCK_TYPES.find(
                            (bt) => bt.type === selectedBlock.type,
                          )?.icon || Phone;
                        return <IconComponent className="h-4 w-4" />;
                      })()}
                    </div>
                    <h3 className="font-bold">
                      {BLOCK_TYPES.find((bt) => bt.type === selectedBlock.type)
                        ?.label || "Block"}{" "}
                      Settings
                    </h3>
                  </div>

                  {/* Connection Management */}
                  <div className="space-y-2">
                    <Label>Connections</Label>
                    <div className="text-sm text-gray-600 mb-2">
                      This block connects to {selectedBlock.connections.length}{" "}
                      other block
                      {selectedBlock.connections.length !== 1 ? "s" : ""}
                    </div>
                    {selectedBlock.connections.map((connId) => {
                      const connectedBlock = flowBlocks.find(
                        (b) => b.id === connId,
                      );
                      const connectedBlockType = BLOCK_TYPES.find(
                        (bt) => bt.type === connectedBlock?.type,
                      );
                      return connectedBlock ? (
                        <div
                          key={connId}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1 rounded ${connectedBlockType?.color || "bg-gray-500"} text-white`}
                            >
                              {(() => {
                                const IconComponent =
                                  connectedBlockType?.icon || Phone;
                                return <IconComponent className="h-3 w-3" />;
                              })()}
                            </div>
                            <span className="text-sm">
                              {connectedBlockType?.label}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              disconnectBlocks(selectedBlock.id, connId)
                            }
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
                      onClick={() => setConnectingFrom(selectedBlock.id)}
                      className="w-full"
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Connect to Another Block
                    </Button>
                  </div>

                  {/* Block-specific configuration */}
                  {selectedBlock.type === "say" && (
                    <div className="space-y-2">
                      <Label>Message Text</Label>
                      <Textarea
                        value={selectedBlock.config.text || ""}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            config: {
                              ...selectedBlock.config,
                              text: e.target.value,
                            },
                          })
                        }
                        placeholder="Enter the message to speak..."
                        rows={4}
                      />
                    </div>
                  )}

                  {selectedBlock.type === "gather" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Menu Prompt</Label>
                        <Textarea
                          value={selectedBlock.config.prompt || ""}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                prompt: e.target.value,
                              },
                            })
                          }
                          placeholder="Enter the menu prompt..."
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Menu Options</Label>
                        {(selectedBlock.config.options || []).map(
                          (option: any, index: number) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={option.digit}
                                onChange={(e) => {
                                  const newOptions = [
                                    ...(selectedBlock.config.options || []),
                                  ];
                                  newOptions[index] = {
                                    ...option,
                                    digit: e.target.value,
                                  };
                                  updateBlock(selectedBlock.id, {
                                    config: {
                                      ...selectedBlock.config,
                                      options: newOptions,
                                    },
                                  });
                                }}
                                placeholder="Key"
                                className="w-16"
                              />
                              <Input
                                value={option.text}
                                onChange={(e) => {
                                  const newOptions = [
                                    ...(selectedBlock.config.options || []),
                                  ];
                                  newOptions[index] = {
                                    ...option,
                                    text: e.target.value,
                                  };
                                  updateBlock(selectedBlock.id, {
                                    config: {
                                      ...selectedBlock.config,
                                      options: newOptions,
                                    },
                                  });
                                }}
                                placeholder="Action description"
                                className="flex-1"
                              />
                            </div>
                          ),
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newOptions = [
                              ...(selectedBlock.config.options || []),
                              { digit: "", text: "", action: "say" },
                            ];
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                options: newOptions,
                              },
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Option
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === "forward" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={selectedBlock.config.number || ""}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                number: e.target.value,
                              },
                            })
                          }
                          placeholder="+1234567890"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timeout (seconds)</Label>
                        <Input
                          type="number"
                          value={selectedBlock.config.timeout || 30}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                timeout: parseInt(e.target.value),
                              },
                            })
                          }
                          min="5"
                          max="300"
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === "record" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Recording Prompt</Label>
                        <Textarea
                          value={selectedBlock.config.prompt || ""}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                prompt: e.target.value,
                              },
                            })
                          }
                          placeholder="Please leave your message after the beep..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Length (seconds)</Label>
                        <Input
                          type="number"
                          value={selectedBlock.config.maxLength || 300}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, {
                              config: {
                                ...selectedBlock.config,
                                maxLength: parseInt(e.target.value),
                              },
                            })
                          }
                          min="10"
                          max="600"
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === "pause" && (
                    <div className="space-y-2">
                      <Label>Duration (seconds)</Label>
                      <Input
                        type="number"
                        value={selectedBlock.config.duration || 2}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            config: {
                              ...selectedBlock.config,
                              duration: parseInt(e.target.value),
                            },
                          })
                        }
                        min="1"
                        max="10"
                      />
                    </div>
                  )}

                  {selectedBlock.type === "play" && (
                    <div className="space-y-2">
                      <Label>Audio URL</Label>
                      <Input
                        value={selectedBlock.config.url || ""}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            config: {
                              ...selectedBlock.config,
                              url: e.target.value,
                            },
                          })
                        }
                        placeholder="https://example.com/audio.mp3"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Block
                  </h3>
                  <p className="text-gray-500">
                    Click on a block in the canvas to edit its properties
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFlowEditor(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveFlow} disabled={isSaving}>
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving Flow...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingFlow ? "Update Flow" : "Save Flow"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
