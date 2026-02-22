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
import { SupabaseProvider } from "@/lib/yjs-supabase-provider";
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

function MilkdownEditorWithCollab({
    fileId,
    initialContent,
    initialYjsState,
    userName,
    onSave,
}: MilkdownEditorProps) {
    const providerRef = useRef<SupabaseProvider | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("split");
    const [markdownSource, setMarkdownSource] = useState(initialContent || "");
    const markdownRef = useRef(initialContent || "");

    // Guards to prevent infinite update loops between source ↔ WYSIWYG
    const updatingFromSource = useRef(false);
    const updatingFromEditor = useRef(false);

    // Create Yjs provider on mount
    useEffect(() => {
        const doc = new Y.Doc();
        const provider = new SupabaseProvider(fileId, doc);
        if (initialYjsState) {
            provider.loadInitialState(initialYjsState);
        }
        providerRef.current = provider;
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            provider.destroy();
            providerRef.current = null;
        };
    }, [fileId, initialYjsState]);

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
                    setMarkdownSource(markdown);
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
                collabService.bindDoc(provider.doc).setAwareness(provider.awareness);
                if (userName) {
                    provider.awareness.setLocalStateField("user", {
                        name: userName,
                        color: `#${Math.floor(Math.random() * 16777215)
                            .toString(16)
                            .padStart(6, "0")}`,
                    });
                }
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
    }, [get, userName, initialContent, initialYjsState]);

    // Source textarea → WYSIWYG editor sync
    const handleSourceChange = useCallback(
        (value: string) => {
            if (updatingFromEditor.current) return; // skip echo

            setMarkdownSource(value);
            markdownRef.current = value;
            triggerAutoSave(value);

            // Parse markdown → update ProseMirror document
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
                        setMarkdownSource(md);
                        markdownRef.current = md;
                    }
                } catch {
                    // keep existing source
                }
            }
            setViewMode(mode);
        },
        [viewMode, get]
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

            {/* Editor area */}
            <div className={`editor-area mode-${viewMode}`}>
                {/* Source panel */}
                {(viewMode === "source" || viewMode === "split") && (
                    <div className="editor-panel source-panel">
                        <div className="panel-label">Markdown</div>
                        <textarea
                            className="source-textarea"
                            value={markdownSource}
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
