import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { supabase } from "../../supabase/supabase";

export interface FlowBlock {
  id: string;
  type:
    | "say"
    | "gather"
    | "forward"
    | "hangup"
    | "pause"
    | "record"
    | "play"
    | "sms"
    | "hold"
    | "multi_forward";
  position: { x: number; y: number };
  config: {
    text?: string;
    speed?: number;
    prompt?: string;
    maxRetries?: number;
    retryMessage?: string;
    goodbyeMessage?: string;
    options?: Array<{
      digit: string;
      action: string;
      text: string;
      number?: string;
      blockId?: string;
    }>;
    number?: string;
    numbers?: string[]; // For multi-forward feature
    forwardStrategy?: "simultaneous" | "sequential" | "priority"; // Forwarding strategies
    ringTimeout?: number; // Timeout for each number in sequential mode
    timeout?: number;
    holdMusicUrl?: string;
    holdMusicLoop?: number;
    maxLength?: number;
    finishOnKey?: string;
    url?: string;
    duration?: number;
    message?: string;
    to?: string;
    musicUrl?: string;
    musicType?: "preset" | "custom";
    presetMusic?: string;
  };
  connections: string[];
}

export interface CallFlow {
  id: string;
  flow_name: string;
  twilio_number_id: string;
  is_active: boolean;
  flow_config: {
    blocks: FlowBlock[];
    version: string;
  };
  created_at: string;
  updated_at: string;
}

interface CallFlowState {
  // Current editing state
  currentFlow: CallFlow | null;
  blocks: FlowBlock[];
  selectedBlock: FlowBlock | null;
  connectingFrom: string | null;

  // Flow management
  flows: CallFlow[];
  isLoading: boolean;
  isSaving: boolean;

  // Editor settings
  flowName: string;
  selectedNumberId: string;

  // Actions
  setCurrentFlow: (flow: CallFlow | null) => void;
  setBlocks: (blocks: FlowBlock[]) => void;
  addBlock: (block: FlowBlock) => void;
  updateBlock: (id: string, updates: Partial<FlowBlock>) => void;
  deleteBlock: (id: string) => void;
  connectBlocks: (fromId: string, toId: string) => void;
  disconnectBlocks: (fromId: string, toId: string) => void;
  setSelectedBlock: (block: FlowBlock | null) => void;
  setConnectingFrom: (id: string | null) => void;

  // Flow operations
  loadFlows: (userId: string) => Promise<void>;
  saveFlow: (userId: string) => Promise<boolean>;
  deleteFlow: (flowId: string, userId: string) => Promise<boolean>;

  // Settings
  setFlowName: (name: string) => void;
  setSelectedNumberId: (id: string) => void;

  // Reset
  resetEditor: () => void;
}

export const useCallFlowStore = create<CallFlowState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentFlow: null,
        blocks: [],
        selectedBlock: null,
        connectingFrom: null,
        flows: [],
        isLoading: false,
        isSaving: false,
        flowName: "",
        selectedNumberId: "",

        // Actions
        setCurrentFlow: (flow) => set({ currentFlow: flow }),

        setBlocks: (blocks) => set({ blocks }),

        addBlock: (block) =>
          set((state) => ({
            blocks: [...state.blocks, block],
            selectedBlock: block,
          })),

        updateBlock: (id, updates) =>
          set((state) => ({
            blocks: state.blocks.map((block) =>
              block.id === id ? { ...block, ...updates } : block,
            ),
            selectedBlock:
              state.selectedBlock?.id === id
                ? { ...state.selectedBlock, ...updates }
                : state.selectedBlock,
          })),

        deleteBlock: (id) =>
          set((state) => ({
            blocks: state.blocks
              .filter((block) => block.id !== id)
              .map((block) => ({
                ...block,
                connections: block.connections.filter(
                  (connId) => connId !== id,
                ),
              })),
            selectedBlock:
              state.selectedBlock?.id === id ? null : state.selectedBlock,
          })),

        connectBlocks: (fromId, toId) =>
          set((state) => ({
            blocks: state.blocks.map((block) =>
              block.id === fromId
                ? {
                    ...block,
                    connections: [...new Set([...block.connections, toId])],
                  }
                : block,
            ),
          })),

        disconnectBlocks: (fromId, toId) =>
          set((state) => ({
            blocks: state.blocks.map((block) =>
              block.id === fromId
                ? {
                    ...block,
                    connections: block.connections.filter((id) => id !== toId),
                  }
                : block,
            ),
          })),

        setSelectedBlock: (block) => set({ selectedBlock: block }),
        setConnectingFrom: (id) => set({ connectingFrom: id }),

        // Flow operations
        loadFlows: async (userId) => {
          set({ isLoading: true });
          try {
            const { data, error } = await supabase
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
              .eq("user_id", userId)
              .order("created_at", { ascending: false });

            if (error) throw error;
            set({ flows: data || [] });
          } catch (error) {
            console.error("Error loading flows:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        saveFlow: async (userId) => {
          const state = get();
          if (
            !state.flowName.trim() ||
            !state.selectedNumberId ||
            state.blocks.length === 0
          ) {
            return false;
          }

          set({ isSaving: true });
          try {
            const flowConfig = {
              blocks: state.blocks,
              version: "2.0",
            };

            const flowData = {
              flow_name: state.flowName,
              flow_config: flowConfig,
              twilio_number_id: state.selectedNumberId,
              user_id: userId,
              is_active: true,
            };

            let result;
            if (state.currentFlow) {
              result = await supabase
                .from("call_flows")
                .update(flowData)
                .eq("id", state.currentFlow.id)
                .select();
            } else {
              result = await supabase
                .from("call_flows")
                .insert([flowData])
                .select();
            }

            if (result.error) throw result.error;

            // Update webhooks with correct function name
            try {
              await supabase.functions.invoke(
                "supabase-functions-manage-call-flows",
                {
                  body: {
                    action: "update_webhooks",
                    userId,
                    twilioNumberId: state.selectedNumberId,
                  },
                },
              );
            } catch (webhookError) {
              console.warn(
                "Webhook update failed, but flow saved:",
                webhookError,
              );
              // Don't fail the save if webhook update fails
            }

            // Reload flows
            await get().loadFlows(userId);
            return true;
          } catch (error) {
            console.error("Error saving flow:", error);
            return false;
          } finally {
            set({ isSaving: false });
          }
        },

        deleteFlow: async (flowId, userId) => {
          try {
            const { error } = await supabase
              .from("call_flows")
              .delete()
              .eq("id", flowId)
              .eq("user_id", userId);

            if (error) throw error;

            // Reload flows
            await get().loadFlows(userId);
            return true;
          } catch (error) {
            console.error("Error deleting flow:", error);
            return false;
          }
        },

        // Settings
        setFlowName: (flowName) => set({ flowName }),
        setSelectedNumberId: (selectedNumberId) => set({ selectedNumberId }),

        // Reset
        resetEditor: () =>
          set({
            currentFlow: null,
            blocks: [],
            selectedBlock: null,
            connectingFrom: null,
            flowName: "",
            selectedNumberId: "",
          }),
      }),
      {
        name: "call-flow-storage",
        partialize: (state) => ({
          // Don't persist flows or editing state
        }),
      },
    ),
    {
      name: "call-flow-store",
    },
  ),
);
