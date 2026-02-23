import { useEffect, useRef, useState, useCallback } from "react";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import {
    Editor,
    rootCtx,
    defaultValueCtx,
    editorViewCtx,
    serializerCtx,
    parserCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { collab, collabServiceCtx } from "@milkdown/plugin-collab";
import { SupabaseProvider, type PeerInfo } from "@/lib/yjs-supabase-provider";
import * as Y from "yjs";
import { Eye, Code2, Columns2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

import "./milkdown.css";

interface MilkdownEditorProps {
    fileId: string;
    initialContent?: string | null;
    initialYjsState?: string | null;
    userName?: string;
    onSave?: (content: string, yjsState: string) => void;
}

type ViewMode = "preview" | "source" | "split";

/**
 * Generate a stable HSL color from a string.
 */
function generateUserColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

function MilkdownEditorWithCollab({
    fileId,
    initialContent,
    initialYjsState,
    userName,
    onSave,
}: MilkdownEditorProps) {
    const providerRef = useRef<SupabaseProvider | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("split");
    const markdownRef = useRef(initialContent || "");
    const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
    const sourceValueRef = useRef(initialContent || "");
    const [peers, setPeers] = useState<PeerInfo[]>([]);

    // Guards to prevent infinite update loops between source ↔ WYSIWYG
    const updatingFromSource = useRef(false);
    const updatingFromEditor = useRef(false);

    const displayName = userName || "Anonymous";
    const userColor = generateUserColor(displayName);

    // Create Yjs provider on mount
    useEffect(() => {
        const doc = new Y.Doc();
        const provider = new SupabaseProvider(fileId, doc, {
            userName: displayName,
            userColor,
        });
        if (initialYjsState) {
            provider.loadInitialState(initialYjsState);
        }
        providerRef.current = provider;

        // Subscribe to peer changes
        const unsub = provider.onPeersChange((newPeers) => {
            setPeers(newPeers);
        });

        return () => {
            unsub();
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            provider.destroy();
            providerRef.current = null;
        };
    }, [fileId, initialYjsState, displayName, userColor]);

    // Auto-save (debounced)
    const triggerAutoSave = useCallback(
        (markdown: string) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                if (!providerRef.current || !onSave) return;
                const yjsState = providerRef.current.getStateAsBase64();
                onSave(markdown, yjsState);
            }, 2000);
        },
        [onSave]
    );

    // Setup Milkdown editor
    const { get } = useEditor((root) => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(rootCtx, root);
                if (!initialYjsState && initialContent) {
                    ctx.set(defaultValueCtx, initialContent);
                }
                // Listen for WYSIWYG changes → sync to source textarea
                ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
                    if (updatingFromSource.current) return; // skip echo
                    updatingFromEditor.current = true;
                    markdownRef.current = markdown;
                    sourceValueRef.current = markdown;
                    if (sourceTextareaRef.current) {
                        sourceTextareaRef.current.value = markdown;
                    }
                    triggerAutoSave(markdown);
                    // Reset flag after React flushes
                    requestAnimationFrame(() => {
                        updatingFromEditor.current = false;
                    });
                });
            })
            .use(commonmark)
            .use(listener)
            .use(history)
            .use(collab);
        return editor;
    }, [fileId]);

    // Bind collab service + Yjs provider
    useEffect(() => {
        const editor = get();
        const provider = providerRef.current;
        if (!editor || !provider) return;

        const timer = setTimeout(() => {
            try {
                const collabService = editor.ctx.get(collabServiceCtx);
                collabService
                    .bindDoc(provider.doc)
                    .setAwareness(provider.awareness);

                if (!initialYjsState && initialContent) {
                    collabService.applyTemplate(initialContent);
                }
                collabService.connect();
                provider.connect();
            } catch (e) {
                console.warn("Failed to setup collab:", e);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [get, initialContent, initialYjsState]);

    // Sync remote Yjs (collab) changes → source textarea
    useEffect(() => {
        const editor = get();
        const provider = providerRef.current;
        if (!editor || !provider) return;

        let syncTimer: ReturnType<typeof setTimeout> | null = null;

        const handleYjsUpdate = () => {
            // Don't sync if the user is actively editing in source mode
            if (updatingFromSource.current) return;

            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(() => {
                try {
                    const serializer = editor.ctx.get(serializerCtx);
                    const view = editor.ctx.get(editorViewCtx);
                    const md = serializer(view.state.doc);
                    markdownRef.current = md;
                    sourceValueRef.current = md;
                    if (sourceTextareaRef.current) {
                        sourceTextareaRef.current.value = md;
                    }
                } catch {
                    // editor may not be fully ready yet
                }
            }, 200);
        };

        provider.doc.on("update", handleYjsUpdate);

        return () => {
            provider.doc.off("update", handleYjsUpdate);
            if (syncTimer) clearTimeout(syncTimer);
        };
    }, [get]);

    // Source textarea → WYSIWYG editor sync (debounced)
    const handleSourceChange = useCallback(
        (value: string) => {
            if (updatingFromEditor.current) return;

            sourceValueRef.current = value;
            markdownRef.current = value;
            triggerAutoSave(value);

            if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
            parseTimerRef.current = setTimeout(() => {
                updatingFromSource.current = true;
                try {
                    const editor = get();
                    if (editor) {
                        const parser = editor.ctx.get(parserCtx);
                        const view = editor.ctx.get(editorViewCtx);
                        const newDoc = parser(value);
                        if (newDoc) {
                            const { state } = view;
                            const tr = state.tr.replaceWith(
                                0,
                                state.doc.content.size,
                                newDoc.content
                            );
                            view.dispatch(tr);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to sync source to editor:", e);
                }
                requestAnimationFrame(() => {
                    updatingFromSource.current = false;
                });
            }, 500);
        },
        [get, triggerAutoSave]
    );

    // Manual save
    const handleManualSave = useCallback(() => {
        if (!providerRef.current || !onSave) return;
        try {
            const editor = get();
            let content = markdownRef.current;
            if (editor) {
                const serializer = editor.ctx.get(serializerCtx);
                const view = editor.ctx.get(editorViewCtx);
                content = serializer(view.state.doc);
            }
            const yjsState = providerRef.current.getStateAsBase64();
            onSave(content, yjsState);
        } catch {
            if (providerRef.current) {
                onSave(markdownRef.current, providerRef.current.getStateAsBase64());
            }
        }
    }, [get, onSave]);

    // When switching modes, sync current state
    const switchMode = useCallback(
        (mode: ViewMode) => {
            if (mode === viewMode) return;
            // If we're leaving preview-only, make sure source is synced
            if (viewMode === "preview" && (mode === "source" || mode === "split")) {
                try {
                    const editor = get();
                    if (editor) {
                        const serializer = editor.ctx.get(serializerCtx);
                        const view = editor.ctx.get(editorViewCtx);
                        const md = serializer(view.state.doc);
                        markdownRef.current = md;
                        sourceValueRef.current = md;
                        // No need to set textarea value directly;
                        // sourceValueRef.current will be used as defaultValue on mount
                    }
                } catch {
                    // keep existing source
                }
            }
            setViewMode(mode);
        },
        [viewMode, get]
    );

    // Filter out self from peers for the indicator
    const otherPeers = peers.filter(
        (p) => providerRef.current && p.clientId !== providerRef.current.doc.clientID
    );

    return (
        <div className="milkdown-dual-editor">
            {/* Toolbar */}
            <div className="editor-toolbar">
                <div className="editor-toolbar-tabs">
                    <button
                        type="button"
                        className={`editor-tab ${viewMode === "preview" ? "active" : ""}`}
                        onClick={() => switchMode("preview")}
                        title="WYSIWYG editor only"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview</span>
                    </button>
                    <button
                        type="button"
                        className={`editor-tab ${viewMode === "split" ? "active" : ""}`}
                        onClick={() => switchMode("split")}
                        title="Side-by-side: source + preview"
                    >
                        <Columns2 className="h-3.5 w-3.5" />
                        <span>Split</span>
                    </button>
                    <button
                        type="button"
                        className={`editor-tab ${viewMode === "source" ? "active" : ""}`}
                        onClick={() => switchMode("source")}
                        title="Markdown source only"
                    >
                        <Code2 className="h-3.5 w-3.5" />
                        <span>Source</span>
                    </button>
                </div>

                <div className="editor-toolbar-right">
                    {/* Presence indicators */}
                    {otherPeers.length > 0 && (
                        <div className="presence-indicators">
                            {otherPeers.slice(0, 5).map((peer) => (
                                <div
                                    key={peer.clientId}
                                    className="presence-avatar"
                                    style={{ backgroundColor: peer.color }}
                                    title={peer.name}
                                >
                                    {peer.name.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {otherPeers.length > 5 && (
                                <div className="presence-avatar presence-overflow">
                                    +{otherPeers.length - 5}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Self indicator */}
                    <div
                        className="presence-avatar presence-self"
                        style={{ backgroundColor: userColor }}
                        title={`${displayName} (you)`}
                    >
                        {displayName.charAt(0).toUpperCase()}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleManualSave}
                    >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Editor area */}
            <div className={`editor-area mode-${viewMode}`}>
                {/* Source panel */}
                {(viewMode === "source" || viewMode === "split") && (
                    <div className="editor-panel source-panel">
                        <div className="panel-label">Markdown</div>
                        <textarea
                            ref={sourceTextareaRef}
                            className="source-textarea"
                            defaultValue={sourceValueRef.current}
                            onChange={(e) => handleSourceChange(e.target.value)}
                            spellCheck={false}
                            placeholder="Write markdown here..."
                        />
                    </div>
                )}

                {/* WYSIWYG panel - always in DOM for Milkdown to stay alive */}
                <div
                    className={`editor-panel preview-panel ${viewMode === "source" ? "panel-hidden" : ""
                        }`}
                >
                    {viewMode !== "source" && (
                        <div className="panel-label">Preview</div>
                    )}
                    <Milkdown />
                </div>
            </div>
        </div>
    );
}

export default function MilkdownEditor(props: MilkdownEditorProps) {
    return (
        <MilkdownProvider>
            <div className="milkdown-editor-wrapper">
                <MilkdownEditorWithCollab {...props} />
            </div>
        </MilkdownProvider>
    );
}
