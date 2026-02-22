import type { RealtimeChannel } from "@supabase/supabase-js";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import { supabase } from "./supabase";

/**
 * Custom Yjs provider that syncs via Supabase Realtime Broadcast channels.
 * Each file gets a unique channel keyed by `file:{fileId}`.
 */
export class SupabaseProvider {
    doc: Y.Doc;
    awareness: Awareness;

    private channel: RealtimeChannel | null = null;
    private fileId: string;
    private connected = false;
    private destroyed = false;

    constructor(fileId: string, doc?: Y.Doc) {
        this.fileId = fileId;
        this.doc = doc || new Y.Doc();
        this.awareness = new Awareness(this.doc);

        // Listen for local Yjs updates and broadcast them
        this.doc.on("update", this.handleDocUpdate);
        this.awareness.on("update", this.handleAwarenessUpdate);
    }

    /**
     * Load initial Yjs state from a base64-encoded string (from DB).
     */
    loadInitialState(base64State: string) {
        try {
            const binaryStr = atob(base64State);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            Y.applyUpdate(this.doc, bytes);
        } catch (e) {
            console.warn("Failed to load initial Yjs state:", e);
        }
    }

    /**
     * Get the current Yjs state as a base64-encoded string (for DB persistence).
     */
    getStateAsBase64(): string {
        const state = Y.encodeStateAsUpdate(this.doc);
        let binaryStr = "";
        for (let i = 0; i < state.length; i++) {
            binaryStr += String.fromCharCode(state[i]!);
        }
        return btoa(binaryStr);
    }

    /**
     * Connect to the Supabase Realtime channel for this file.
     */
    connect() {
        if (this.connected || this.destroyed) return;

        this.channel = supabase.channel(`file:${this.fileId}`, {
            config: { broadcast: { self: false } },
        });

        // Listen for Yjs doc updates from other clients
        this.channel.on("broadcast", { event: "yjs-update" }, (payload) => {
            try {
                const binaryStr = atob(payload.payload.update);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                Y.applyUpdate(this.doc, bytes, "supabase");
            } catch (e) {
                console.warn("Failed to apply remote Yjs update:", e);
            }
        });

        // Listen for awareness updates from other clients
        this.channel.on("broadcast", { event: "awareness-update" }, (payload) => {
            try {
                const binaryStr = atob(payload.payload.update);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                applyAwarenessUpdate(this.awareness, bytes, "supabase");
            } catch (e) {
                console.warn("Failed to apply remote awareness update:", e);
            }
        });

        // Sync initial state when joining
        this.channel.on("broadcast", { event: "sync-request" }, () => {
            // Someone joined and is requesting the current state
            const state = Y.encodeStateAsUpdate(this.doc);
            this.broadcastBinary("sync-response", state);
        });

        this.channel.on("broadcast", { event: "sync-response" }, (payload) => {
            try {
                const binaryStr = atob(payload.payload.update);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                Y.applyUpdate(this.doc, bytes, "supabase");
            } catch (e) {
                console.warn("Failed to apply sync response:", e);
            }
        });

        this.channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                this.connected = true;
                // Request current state from other connected clients
                this.channel?.send({
                    type: "broadcast",
                    event: "sync-request",
                    payload: {},
                });
            }
        });
    }

    /**
     * Disconnect from the Supabase Realtime channel.
     */
    disconnect() {
        if (!this.connected || !this.channel) return;
        supabase.removeChannel(this.channel);
        this.channel = null;
        this.connected = false;
    }

    /**
     * Destroy the provider — disconnect and clean up all listeners.
     */
    destroy() {
        this.destroyed = true;
        this.disconnect();
        this.doc.off("update", this.handleDocUpdate);
        this.awareness.off("update", this.handleAwarenessUpdate);
        this.awareness.destroy();
    }

    // ---- Private helpers ----

    private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === "supabase") return; // Don't echo back remote updates
        this.broadcastBinary("yjs-update", update);
    };

    private handleAwarenessUpdate = ({ added, updated, removed }: {
        added: number[];
        updated: number[];
        removed: number[];
    }) => {
        const changedClients = added.concat(updated).concat(removed);
        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        this.broadcastBinary("awareness-update", update);
    };

    private broadcastBinary(event: string, data: Uint8Array) {
        if (!this.channel || !this.connected) return;

        // Encode binary to base64 for JSON transport
        let binaryStr = "";
        for (let i = 0; i < data.length; i++) {
            binaryStr += String.fromCharCode(data[i]!);
        }
        const base64 = btoa(binaryStr);

        this.channel.send({
            type: "broadcast",
            event,
            payload: { update: base64 },
        });
    }
}
