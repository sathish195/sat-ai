import React, { useEffect, useRef, useState } from "react";
import {
  uploadPDF,
  getDocuments,
  deleteDocument,
  getConversations,
  createConversation,
  getConversationMessages,
  deleteConversation,
  getCurrentUser,
  getTokenUsage,
  streamChatMessage,
} from "./api";
import AuthScreen from "./AuthScreen";
import MarkdownView from "./MarkdownView";

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const SidebarToggleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const DocIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function App() {
  // Authentication & User State
  const [user, setUser] = useState(null);
  const [tokenUsage, setTokenUsage] = useState({
    totalTokensUsed: 0,
    tokenLimit: 100000,
    percentageUsed: 0,
    remainingTokens: 100000,
  });
  const [authChecking, setAuthChecking] = useState(true);

  // Layout & Tabs State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("chats"); // "chats" | "documents"

  // Conversations State
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState("New Chat");
  const [messages, setMessages] = useState([]);

  // Documents State
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");

  // Input & Streaming State
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Listen for unauthorized 401 events from Axios
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToast({ type: "error", text: "Session expired. Please log in again." });
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  // Check auth and load initial dashboard data on startup
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setUser(userData);
        await Promise.all([loadUsage(), loadConversations(), loadDocuments()]);
      } catch (err) {
        console.warn("Auth check failed:", err.message);
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    initAuth();
  }, []);

  // Poll for document status updates if any document is indexing
  useEffect(() => {
    if (!user) return;
    const hasProcessing = docs.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 2000);

    return () => clearInterval(interval);
  }, [docs, user]);

  const showToast = (type, text) => {
    setToast({ type, text });
  };

  // ── Usage Handlers ──────────────────────────────────────────────────────────

  const loadUsage = async () => {
    try {
      const usage = await getTokenUsage();
      if (usage) {
        setTokenUsage({
          totalTokensUsed: usage.totalTokensUsed || 0,
          tokenLimit: usage.tokenLimit || 100000,
          percentageUsed: usage.percentageUsed || (usage.tokenLimit ? ((usage.totalTokensUsed / usage.tokenLimit) * 100).toFixed(2) : 0),
          remainingTokens: usage.remainingTokens ?? (100000 - (usage.totalTokensUsed || 0)),
        });
      }
    } catch (e) {
      console.warn("Could not load token usage:", e.message);
    }
  };

  // ── Auth Handlers ───────────────────────────────────────────────────────────

  const handleAuthSuccess = async (userData) => {
    setUser(userData);
    showToast("success", `Welcome, ${userData.name || "User"}!`);
    await Promise.all([loadUsage(), loadConversations(), loadDocuments()]);
  };

  const handleLogout = () => {
    if (isStreaming) {
      handleStopGenerating();
    }
    localStorage.removeItem("token");
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setActiveConversationTitle("New Chat");
    setMessages([]);
    setDocs([]);
    showToast("success", "Logged out successfully.");
  };

  // ── Conversation Handlers ───────────────────────────────────────────────────

  const loadConversations = async () => {
    try {
      const res = await getConversations();
      setConversations(res.data);
    } catch (e) {
      console.warn("Could not load conversations:", e.message);
    }
  };

  const handleSelectConversation = async (conv) => {
    if (isStreaming) {
      handleStopGenerating();
    }
    setActiveConversationId(conv._id);
    setActiveConversationTitle(conv.title || "Chat");
    if (conv.documentId) {
      setSelectedDocId(conv.documentId);
    }

    try {
      const res = await getConversationMessages(conv._id);
      const normalized = (res.messages || []).map((m) => ({
        role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
        text: m.content || m.text || "",
        sources: m.sources || [],
        tokens: m.tokens || null,
      }));
      setMessages(normalized);
    } catch (e) {
      showToast("error", "Failed to load conversation history.");
    }
  };

  const handleNewChat = async () => {
    if (isStreaming) {
      handleStopGenerating();
    }

    try {
      const newConv = await createConversation({
        title: "New Chat",
        documentId: selectedDocId || undefined,
      });
      if (newConv && newConv._id) {
        setActiveConversationId(newConv._id);
        setActiveConversationTitle(newConv.title || "New Chat");
        setMessages([]);
        await loadConversations();
      } else {
        setActiveConversationId(null);
        setActiveConversationTitle("New Chat");
        setMessages([]);
      }
    } catch (e) {
      setActiveConversationId(null);
      setActiveConversationTitle("New Chat");
      setMessages([]);
    }
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleDeleteConversation = async (id, title, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete conversation "${title}"?`)) return;

    try {
      await deleteConversation(id);
      showToast("success", "Conversation deleted.");
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setActiveConversationTitle("New Chat");
        setMessages([]);
      }
      await loadConversations();
    } catch (e) {
      showToast("error", e.response?.data?.error || e.message);
    }
  };

  // ── Document Handlers ───────────────────────────────────────────────────────

  const loadDocuments = async () => {
    try {
      const res = await getDocuments();
      setDocs(res.data);
    } catch (e) {
      console.warn("Could not load documents:", e.message);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("error", "Only PDF files are supported.");
      return;
    }

    setUploading(true);
    try {
      const res = await uploadPDF(file);
      showToast("success", res.data?.message || `Uploaded "${file.name}". Indexing started.`);
      await loadDocuments();
      setSidebarTab("documents");
    } catch (e) {
      showToast("error", e.response?.data?.error || e.response?.data?.message || e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete document "${name}" and all its chunk vectors?`)) return;

    try {
      await deleteDocument(id);
      if (selectedDocId === id) setSelectedDocId("");
      showToast("success", `Deleted "${name}".`);
      await loadDocuments();
    } catch (e) {
      showToast("error", e.response?.data?.error || e.message);
    }
  };

  // ── Streaming Chat Handlers ─────────────────────────────────────────────────

  const handleAsk = async (customQuery) => {
    const q = (customQuery || question).trim();
    if (!q || isStreaming) return;

    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }

    // Auto-create conversation if none is active
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      try {
        const shortTitle = q.length > 28 ? q.slice(0, 28) + "..." : q;
        const newConv = await createConversation({
          title: shortTitle,
          documentId: selectedDocId || undefined,
        });
        if (newConv && newConv._id) {
          currentConvId = newConv._id;
          setActiveConversationId(newConv._id);
          setActiveConversationTitle(newConv.title || shortTitle);
          loadConversations();
        }
      } catch (_) {}
    }

    // Append user message immediately
    const userMsg = { role: "user", text: q };
    const initialAssistantMsg = {
      role: "assistant",
      text: "",
      sources: [],
      tokens: null,
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamChatMessage({
      question: q,
      conversationId: currentConvId,
      documentId: selectedDocId || undefined,
      signal: controller.signal,
      onSources: (sources) => {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = {
              ...next[lastIdx],
              sources: sources,
            };
          }
          return next;
        });
      },
      onChunk: (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = {
              ...next[lastIdx],
              text: next[lastIdx].text + chunk,
            };
          }
          return next;
        });
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        loadUsage();
        loadConversations();
      },
      onError: (err) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        const errText = err.message || "Failed to generate answer.";
        showToast("error", errText);

        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = {
              ...next[lastIdx],
              text:
                next[lastIdx].text +
                `\n\n> ⚠️ **Error:** ${errText}`,
            };
          }
          return next;
        });
        loadUsage();
      },
    });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      abortControllerRef.current = null;
      loadUsage();
    }
  };

  const handleTextareaChange = (e) => {
    setQuestion(e.target.value);
    e.target.style.height = "24px";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // If loading authentication state
  if (authChecking) {
    return (
      <div className="auth-wrapper">
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Authenticating session...
        </div>
      </div>
    );
  }

  // If not logged in, render AuthScreen
  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const activeDoc = docs.find((d) => d._id === selectedDocId);

  // Suggestions for empty state
  const suggestions = [
    {
      title: "Summarize key findings",
      desc: "Executive summary of the document's core takeaways",
      query: "Can you provide a clear executive summary of the main points in the uploaded document?",
    },
    {
      title: "List main risks & challenges",
      desc: "Identify potential obstacles or concerns discussed",
      query: "What are the primary challenges, limitations, or risks mentioned in this document?",
    },
    {
      title: "Extract statistics & numbers",
      desc: "Find numerical metrics, dates, and financial data",
      query: "Extract all significant statistics, metrics, percentages, and financial numbers mentioned.",
    },
    {
      title: "Explain in simple terms",
      desc: "Break down complex topics into an easy explanation",
      query: "Explain the main topic and conclusions of this document in simple, beginner-friendly terms.",
    },
  ];

  // Dynamic token usage color
  const quotaPct = Math.min(100, Math.max(0, Number(tokenUsage.percentageUsed) || 0));
  const quotaColor =
    quotaPct >= 90
      ? "var(--danger-color)"
      : quotaPct >= 70
      ? "var(--warning-color)"
      : "var(--accent-green)";

  return (
    <div className="sat-ai-app">
      {/* Hidden File Input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFileUpload(e.target.files?.[0])}
      />

      {/* ── Left Sidebar (Sat AI) ─────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={handleNewChat} title="Start a fresh chat">
            <div className="new-chat-left">
              <SparkleIcon />
              <span>New chat</span>
            </div>
            <PlusIcon />
          </button>
          <button
            className="icon-btn"
            title="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <SidebarToggleIcon />
          </button>
        </div>

        {/* Sidebar Tabs: Chats vs Documents */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab-btn ${sidebarTab === "chats" ? "active" : ""}`}
            onClick={() => setSidebarTab("chats")}
          >
            Chats ({conversations.length})
          </button>
          <button
            className={`sidebar-tab-btn ${sidebarTab === "documents" ? "active" : ""}`}
            onClick={() => setSidebarTab("documents")}
          >
            Documents ({docs.length})
          </button>
        </div>

        {/* Tab 1: Past Conversations List */}
        {sidebarTab === "chats" && (
          <div className="sidebar-list-container">
            <div className="sidebar-section-label">
              <span>Recent Chats</span>
              {conversations.length > 0 && (
                <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                  {conversations.length} sessions
                </span>
              )}
            </div>

            {conversations.length === 0 ? (
              <div className="empty-list-msg">
                No saved chats yet.<br />
                Type a question or click <b>New chat</b>.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv._id;
                return (
                  <div
                    key={conv._id}
                    className={`conversation-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="conversation-info">
                      <ChatBubbleIcon />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span className="conversation-title" title={conv.title}>
                          {conv.title || "Untitled Chat"}
                        </span>
                        {conv.documentId && (
                          <div className="conversation-meta">
                            <span>📄 Linked PDF</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className="conversation-delete-btn"
                      title="Delete chat"
                      onClick={(e) => handleDeleteConversation(conv._id, conv.title, e)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Uploaded Documents List */}
        {sidebarTab === "documents" && (
          <div className="sidebar-list-container">
            <button
              className="upload-action-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <PaperclipIcon />
              <span>{uploading ? "Indexing PDF..." : "Upload New PDF"}</span>
            </button>

            <div className="sidebar-section-label">
              <span>PDF Library</span>
              {selectedDocId && (
                <span
                  style={{ cursor: "pointer", color: "var(--accent-green)", textTransform: "none" }}
                  onClick={() => setSelectedDocId("")}
                >
                  Clear filter
                </span>
              )}
            </div>

            {docs.length === 0 ? (
              <div className="empty-list-msg">
                No PDFs uploaded yet.<br />
                Click above to index your first PDF.
              </div>
            ) : (
              docs.map((d) => {
                const isSelected = selectedDocId === d._id;
                return (
                  <div
                    key={d._id}
                    className={`doc-item ${isSelected ? "active" : ""}`}
                    onClick={() => setSelectedDocId(isSelected ? "" : d._id)}
                    title={`Click to ${isSelected ? "unselect" : "filter chat by this document"}`}
                  >
                    <div className="doc-info">
                      <DocIcon />
                      <div className="doc-text">
                        <span className="doc-name">{d.originalName || d.name}</span>
                        <div className="doc-meta">
                          <span>{d.chunks} chunks</span>
                          <span className={`badge-status ${d.status || "ready"}`}>
                            {d.status || "ready"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="doc-delete-btn"
                      title="Delete document"
                      onClick={(e) => handleDeleteDoc(d._id, d.originalName || d.name, e)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Sidebar Footer: Token Quota Bar & User Profile ──────────────── */}
        <div className="sidebar-footer">
          {/* Token Quota Progress Bar */}
          <div className="token-quota-box">
            <div className="token-quota-header">
              <span style={{ fontWeight: 600 }}>Token Quota</span>
              <span>{quotaPct}% used</span>
            </div>
            <div className="token-quota-bar-track">
              <div
                className="token-quota-bar-fill"
                style={{
                  width: `${quotaPct}%`,
                  backgroundColor: quotaColor,
                }}
              />
            </div>
            <div className="token-quota-sub">
              <span>{tokenUsage.totalTokensUsed.toLocaleString()} used</span>
              <span>{tokenUsage.tokenLimit.toLocaleString()} max</span>
            </div>
          </div>

          {/* User Row with Logout */}
          <div className="sidebar-user-row">
            <div className="sidebar-user">
              <div className="avatar-circle">
                {user.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <div className="user-text-info">
                <div className="user-name">{user.name || "User"}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
            <button className="logout-btn" title="Sign out" onClick={handleLogout}>
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ──────────────────────────────────────────────── */}
      <main className="main-chat">
        {/* Top Navigation Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            {!sidebarOpen && (
              <button
                className="icon-btn"
                title="Open sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                <SidebarToggleIcon />
              </button>
            )}

            <button className="model-selector-badge">
              <span className="sparkle-icon">✦</span>
              <span>SAT AI</span>
              <ChevronDownIcon />
            </button>

            {/* Current Conversation Title */}
            {activeConversationTitle && (
              <span className="conversation-active-title" title={activeConversationTitle}>
                {activeConversationTitle}
              </span>
            )}

            {/* Linked PDF Scope Selector */}
            <div className="doc-scope-selector">
              <DocIcon />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                title="Select document to filter vector search"
              >
                <option value="">All Documents ({docs.length})</option>
                {docs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.originalName || d.name} ({d.chunks} chunks)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="icon-btn" title="New chat" onClick={handleNewChat}>
              <PlusIcon />
            </button>
          </div>
        </header>

        {/* Messages Stream */}
        <div className="messages-container">
          {messages.length === 0 ? (
            /* Empty State Hero (SAT AI) */
            <div className="hero-empty">
              <div className="hero-logo-box">
                <SparkleIcon />
              </div>
              <h1 className="hero-title">Hi, I'm SAT AI 👋</h1>
              <p className="hero-subtitle">
                {docs.length === 0
                  ? "Upload a PDF using the paperclip icon or sidebar to get started with instant real-time vector search."
                  : activeDoc
                  ? `Ready to stream answers specifically from "${activeDoc.originalName || activeDoc.name}".`
                  : `Ready to stream answers across all ${docs.length} indexed documents.`}
              </p>

              <div className="suggestions-grid">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="suggestion-card" onClick={() => handleAsk(s.query)}>
                    <div className="suggestion-text">{s.title}</div>
                    <div className="suggestion-sub">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isLastAssistant = !isUser && idx === messages.length - 1;

              return (
                <div key={idx} className={`chat-row ${isUser ? "user" : "assistant"}`}>
                  <div className="chat-row-inner">
                    {!isUser && (
                      <div className="assistant-avatar">
                        <SparkleIcon />
                      </div>
                    )}

                    <div className={isUser ? "user-bubble" : "assistant-content"}>
                      {isUser ? (
                        m.text
                      ) : (
                        <MarkdownView
                          content={m.text}
                          isStreaming={isLastAssistant && isStreaming}
                        />
                      )}

                      {/* Source Citations Accordion */}
                      {!isUser && m.sources && m.sources.length > 0 && (
                        <div className="sources-box">
                          <details>
                            <summary>
                              <span>📎 Referenced {m.sources.length} sources from index</span>
                            </summary>
                            <div className="sources-list">
                              {m.sources.map((src, sIdx) => {
                                const scorePct =
                                  src.score != null
                                    ? `${(src.score * 100).toFixed(0)}% match`
                                    : null;
                                return (
                                  <div key={sIdx} className="source-item">
                                    <div className="source-header">
                                      <span className="source-title">
                                        📄 {src.documentName || "Document"}
                                        {src.chunkIndex != null && ` · chunk ${src.chunkIndex}`}
                                      </span>
                                      {scorePct && <span className="source-score">{scorePct}</span>}
                                    </div>
                                    <div className="source-snippet">
                                      "{src.preview || src.content || src.text}"
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Footer: Copy Button */}
                      {!isUser && m.text && (
                        <div className="message-meta-footer">
                          <button
                            className="copy-btn"
                            onClick={() => handleCopy(m.text, idx)}
                            title="Copy response"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <CheckIcon />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <CopyIcon />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Bottom Floating Input Dock (Sat AI Composer) ──────────────────── */}
        <div className="composer-dock">
          <div className="composer-dock-inner">
            {/* Stop Generating Button */}
            {isStreaming && (
              <div className="stop-generating-container">
                <button
                  className="stop-generating-btn"
                  onClick={handleStopGenerating}
                  title="Stop generating response"
                >
                  <div className="stop-square" />
                  <span>Stop generating</span>
                </button>
              </div>
            )}

            <div className="composer-pill">
              {/* Paperclip upload button */}
              <div className="composer-left-actions">
                <button
                  className="dock-icon-btn"
                  title="Attach & index PDF"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <PaperclipIcon />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                rows={1}
                placeholder={
                  activeDoc
                    ? `Ask about "${activeDoc.originalName || activeDoc.name}"...`
                    : "Ask anything about your documents..."
                }
                value={question}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
              />

              {/* Send Button */}
              <div className="composer-right-actions">
                <button
                  className="send-btn"
                  onClick={() => handleAsk()}
                  disabled={!question.trim() || isStreaming}
                  title="Send message"
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            <div className="composer-disclaimer">
              SAT AI can make mistakes. Always verify important information from original source documents.
            </div>
          </div>
        </div>

        {/* Toast Alerts */}
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>
              <span>{toast.text}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
