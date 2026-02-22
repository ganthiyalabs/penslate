import type { RealtimeChannel } from "@supabase/supabase-js";
import {
    Awareness,
    encodeAwarenessUpdate,
    applyAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";
import { supabase } from "./supabase";

export interface PeerInfo {
    clientId: number;
    name: string;
    color: string;
}

type PeersChangeCallback = (peers: PeerInfo[]) => void;

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log("[SupabaseProvider]", ...args);
}

/**
 * Custom Yjs provider that syncs via Supabase Realtime.
 *
 * - **Broadcast** for Yjs doc updates + awareness (cursor) updates
 * - **Presence** for tracking who is online with name/color metadata
 */
export class SupabaseProvider {
    doc: Y.Doc;
    awareness: Awareness;

    private channel: RealtimeChannel | null = null;
    private fileId: string;
    private connected = false;
    private destroyed = false;
    private userName: string;
    private userColor: string;
    private awarenessHeartbeat: ReturnType<typeof setInterval> | null = null;
    private peersChangeListeners: Set<PeersChangeCallback> = new Set();
    private currentPeers: PeerInfo[] = [];

    constructor(
        fileId: string,
        doc?: Y.Doc,
        opts?: { userName?: string; userColor?: string },
    ) {
        this.fileId = fileId;
        this.doc = doc || new Y.Doc();
        this.awareness = new Awareness(this.doc);
        this.userName = opts?.userName || "Anonymous";
        this.userColor = opts?.userColor || this.generateColor(this.userName);

        log("constructor", { fileId, clientID: this.doc.clientID, userName: this.userName, userColor: this.userColor });

        // Listen for local Yjs updates and broadcast them
        this.doc.on("update", this.handleDocUpdate);
        this.awareness.on("update", this.handleAwarenessUpdate);
    }

    // ---- Public API ----

    /**
     * Load initial Yjs state from a base64-encoded string (from DB).
     */
    loadInitialState(base64State: string) {
        try {
            const bytes = this.base64ToBytes(base64State);
            Y.applyUpdate(this.doc, bytes);
            log("loadInitialState: applied initial state, bytes:", bytes.length);
        } catch (e) {
            console.warn("Failed to load initial Yjs state:", e);
        }
    }

    /**
     * Get the current Yjs state as a base64-encoded string (for DB persistence).
     */
    getStateAsBase64(): string {
        const state = Y.encodeStateAsUpdate(this.doc);
        return this.bytesToBase64(state);
    }

    /**
     * Subscribe to peer list changes. Returns an unsubscribe function.
     */
    onPeersChange(callback: PeersChangeCallback): () => void {
        this.peersChangeListeners.add(callback);
        // Immediately fire with current peers
        callback(this.currentPeers);
        return () => {
            this.peersChangeListeners.delete(callback);
        };
    }

    /**
     * Connect to the Supabase Realtime channel for this file.
     */
    connect() {
        if (this.connected || this.destroyed) {
            log("connect: skipping (connected:", this.connected, "destroyed:", this.destroyed, ")");
            return;
        }

        const channelName = `file:${this.fileId}`;
        log("connect: joining channel", channelName);

        this.channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: false },
                presence: { key: String(this.doc.clientID) },
            },
        });

        // ---- Broadcast listeners ----

        // Yjs doc updates from other clients
        this.channel.on("broadcast", { event: "yjs-update" }, (payload) => {
            log("RECEIVED yjs-update, payload keys:", Object.keys(payload));
            try {
                // Supabase wraps: { event: string, payload: { ... } }
                const data = payload.payload || payload;
                const bytes = this.base64ToBytes(data.update);
                log("RECEIVED yjs-update: applying", bytes.length, "bytes");
                Y.applyUpdate(this.doc, bytes, "supabase");
            } catch (e) {
                console.warn("Failed to apply remote Yjs update:", e);
            }
        });

        // Awareness updates from other clients (cursor/selection)
        this.channel.on(
            "broadcast",
            { event: "awareness-update" },
            (payload) => {
                try {
                    const data = payload.payload || payload;
                    const bytes = this.base64ToBytes(data.update);
                    log("RECEIVED awareness-update:", bytes.length, "bytes");
                    applyAwarenessUpdate(this.awareness, bytes, "supabase");
                } catch (e) {
                    console.warn("Failed to apply remote awareness update:", e);
                }
            },
        );

        // Sync: someone joined and requests current state
        this.channel.on("broadcast", { event: "sync-request" }, () => {
            log("RECEIVED sync-request from another client, sending state + awareness");
            const state = Y.encodeStateAsUpdate(this.doc);
            this.broadcastBinary("sync-response", state);

            // Also send our awareness so the newcomer sees our cursor
            const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [
                this.doc.clientID,
            ]);
            this.broadcastBinary("awareness-update", awarenessUpdate);
        });

        // Sync: response from another client with their state
        this.channel.on(
            "broadcast",
            { event: "sync-response" },
            (payload) => {
                try {
                    const data = payload.payload || payload;
                    const bytes = this.base64ToBytes(data.update);
                    log("RECEIVED sync-response:", bytes.length, "bytes");
                    Y.applyUpdate(this.doc, bytes, "supabase");
                    
                    // Broadcast our awareness so the other client sees our cursor
                    const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [
                        this.doc.clientID,
                    ]);
                    this.broadcastBinary("awareness-update", awarenessUpdate);
                } catch (e) {
                    console.warn("Failed to apply sync response:", e);
                }
            },
        );

        // ---- Presence listeners ----

        this.channel.on("presence", { event: "sync" }, () => {
            log("PRESENCE sync");
            this.updatePeersFromPresence();
        });

        this.channel.on("presence", { event: "join" }, ({ newPresences }) => {
            log("PRESENCE join:", newPresences);
            this.updatePeersFromPresence();
        });

        this.channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
            log("PRESENCE leave:", leftPresences);
            if (!this.channel) return;
            
            // Remove awareness states for departed clients
            const presenceState = this.channel.presenceState();
            const leftClientIds: number[] = [];
            
            for (const key of Object.keys(presenceState)) {
                const clientId = parseInt(key, 10);
                const presences = presenceState[key];
                const stillPresent = presences && presences.length > 0;
                if (!stillPresent && !isNaN(clientId)) {
                    leftClientIds.push(clientId);
                }
            }
            
            if (leftClientIds.length > 0) {
                removeAwarenessStates(this.awareness, leftClientIds, "supabase");
            }
            this.updatePeersFromPresence();
        });

        // ---- Subscribe ----

        this.channel.subscribe(async (status, err) => {
            log("channel status:", status, err || "");

            if (status === "SUBSCRIBED") {
                this.connected = true;

                // Set local awareness state
                this.awareness.setLocalStateField("user", {
                    name: this.userName,
                    color: this.userColor,
                });
                log("awareness local state set:", { name: this.userName, color: this.userColor });

                // Track our presence (clientId is already in the presence key)
                const trackResult = await this.channel?.track({
                    name: this.userName,
                    color: this.userColor,
                });
                log("presence track result:", trackResult);

                // Request current doc state from other clients
                // Small delay to allow presence to propagate
                setTimeout(() => {
                    log("sending sync-request");
                    this.channel?.send({
                        type: "broadcast",
                        event: "sync-request",
                        payload: {},
                    });
                }, 300);

                // Heartbeat: periodically broadcast awareness so late joiners
                // always see our cursor position
                this.awarenessHeartbeat = setInterval(() => {
                    if (!this.connected) return;
                    const update = encodeAwarenessUpdate(this.awareness, [
                        this.doc.clientID,
                    ]);
                    this.broadcastBinary("awareness-update", update);
                }, 5000);
            } else if (status === "CHANNEL_ERROR") {
                console.error("[SupabaseProvider] Channel error:", err);
            } else if (status === "TIMED_OUT") {
                console.error("[SupabaseProvider] Channel timed out");
            }
        });
    }

    /**
     * Disconnect from the Supabase Realtime channel.
     */
    disconnect() {
        if (!this.connected || !this.channel) return;
        log("disconnect");
        if (this.awarenessHeartbeat) {
            clearInterval(this.awarenessHeartbeat);
            this.awarenessHeartbeat = null;
        }
        supabase.removeChannel(this.channel);
        this.channel = null;
        this.connected = false;
    }

    /**
     * Destroy the provider — disconnect and clean up all listeners.
     */
    destroy() {
        log("destroy");
        this.destroyed = true;
        // Remove our awareness state so others see us leave
        removeAwarenessStates(this.awareness, [this.doc.clientID], null);
        this.disconnect();
        this.doc.off("update", this.handleDocUpdate);
        this.awareness.off("update", this.handleAwarenessUpdate);
        this.awareness.destroy();
        this.peersChangeListeners.clear();
    }

    // ---- Private helpers ----

    private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === "supabase") return; // Don't echo back remote updates
        log("local doc update, broadcasting", update.length, "bytes, origin:", origin);
        this.broadcastBinary("yjs-update", update);
    };

    private handleAwarenessUpdate = ({
        added,
        updated,
        removed,
    }: {
        added: number[];
        updated: number[];
        removed: number[];
    }) => {
        const changedClients = added.concat(updated).concat(removed);
        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        log("local awareness update, clients:", changedClients, "broadcasting", update.length, "bytes");
        this.broadcastBinary("awareness-update", update);
    };

    private broadcastBinary(event: string, data: Uint8Array) {
        if (!this.channel || !this.connected) {
            log("broadcastBinary: skipping (no channel or not connected)", { event, connected: this.connected, hasChannel: !!this.channel });
            return;
        }
        const base64 = this.bytesToBase64(data);
        this.channel.send({
            type: "broadcast",
            event,
            payload: { update: base64 },
        });
    }

    private updatePeersFromPresence() {
        if (!this.channel) return;
        const presenceState = this.channel.presenceState();
        const peers: PeerInfo[] = [];

        log("presenceState:", JSON.stringify(presenceState));

        for (const key of Object.keys(presenceState)) {
            const presences = presenceState[key] as Array<Record<string, unknown>>;
            for (const p of presences) {
                const clientId = parseInt(key, 10);
                if (!isNaN(clientId)) {
                    peers.push({
                        clientId,
                        name: p.name as string,
                        color: p.color as string,
                    });
                }
            }
        }

        this.currentPeers = peers;
        log("peers updated:", peers.length, "peers");
        for (const listener of this.peersChangeListeners) {
            listener(peers);
        }
    }

    /**
     * Generate a stable HSL color from a string (user name).
     */
    private generateColor(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    // ---- Base64 helpers ----

    private base64ToBytes(base64: string): Uint8Array {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
    }

    private bytesToBase64(data: Uint8Array): string {
        let binaryStr = "";
        for (let i = 0; i < data.length; i++) {
            binaryStr += String.fromCharCode(data[i]!);
        }
        return btoa(binaryStr);
    }
}
