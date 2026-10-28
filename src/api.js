import axios from "axios";

const API_PORT = import.meta.env.VITE_API_PORT || 3000;
export const BASE_URL = import.meta.env.VITE_API_URL || `http://localhost:${API_PORT}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
});

// Attach Authorization Bearer token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

// ── Authentication Endpoints ──────────────────────────────────────────────────

export const registerUser = async ({ name, email, password }) => {
  const res = await api.post("/auth/register", { name, email, password });
  if (res.data?.token) {
    localStorage.setItem("token", res.data.token);
  }
  return res.data;
};

export const loginUser = async ({ email, password }) => {
  const res = await api.post("/auth/login", { email, password });
  if (res.data?.token) {
    localStorage.setItem("token", res.data.token);
  }
  return res.data;
};

export const getCurrentUser = async () => {
  const res = await api.get("/auth/me");
  return res.data?.user || res.data;
};

export const getTokenUsage = async () => {
  const res = await api.get("/auth/usage");
  return res.data;
};

// ── Conversation Endpoints ────────────────────────────────────────────────────

export const getConversations = async () => {
  const res = await api.get("/conversations");
  const list = Array.isArray(res.data)
    ? res.data
    : res.data?.conversations || res.data?.data || [];
  return { ...res, data: list };
};

export const createConversation = async ({ title = "New Chat", documentId = null } = {}) => {
  const payload = { title };
  if (documentId) payload.documentId = documentId;
  const res = await api.post("/conversations", payload);
  return res.data?.conversation || res.data;
};

export const getConversationMessages = async (id) => {
  const res = await api.get(`/conversations/${id}`);
  const data = res.data || {};
  return {
    conversation: data.conversation || null,
    messages: Array.isArray(data.messages) ? data.messages : (Array.isArray(data) ? data : []),
  };
};

export const deleteConversation = (id) => api.delete(`/conversations/${id}`);

// ── Document Endpoints ────────────────────────────────────────────────────────

export const uploadPDF = (file) => {
  const fd = new FormData();
  fd.append("pdf", file);
  return api.post("/documents/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getDocuments = async () => {
  const res = await api.get("/documents");
  const rawList = Array.isArray(res.data)
    ? res.data
    : res.data?.documents || res.data?.data || [];
  const list = rawList.map((d) => ({
    ...d,
    chunks: d.totalChunks ?? d.chunks ?? 0,
  }));
  return { ...res, data: list };
};

export const deleteDocument = (id) => api.delete(`/documents/${id}`);

// ── Streaming Chat (Server-Sent Events) ────────────────────────────────────────

export async function streamChatMessage({
  question,
  conversationId,
  documentId,
  onSources,
  onChunk,
  onDone,
  onError,
  signal,
}) {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        question,
        conversationId: conversationId || undefined,
        documentId: documentId || undefined,
      }),
      signal,
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:unauthorized"));
      throw new Error("Session expired. Please log in again.");
    }

    if (response.status === 429) {
      let errData = {};
      try {
        errData = await response.json();
      } catch (_) {}
      throw new Error(errData.error || "Token quota exceeded (100k limit reached). Please upgrade your plan.");
    }

    if (!response.ok) {
      let errText = `Server responded with status ${response.status}`;
      try {
        const j = await response.json();
        errText = j.error || j.message || errText;
      } catch (_) {}
      throw new Error(errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (onDone) onDone();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop(); // keep trailing incomplete chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const raw = trimmed.replace("data: ", "").trim();
          if (raw === "[DONE]") {
            if (onDone) onDone();
            return;
          }

          try {
            const data = JSON.parse(raw);
            if (data.type === "sources" && onSources) {
              onSources(data.sources);
            } else if (data.type === "chunk" && onChunk) {
              onChunk(data.text ?? data.chunk ?? "");
            } else if (data.type === "tokens" && data.tokens) {
              // Token notification if provided
            } else if (data.type === "error") {
              throw new Error(data.error);
            } else if (data.text || data.chunk) {
              // Generic chunk payload
              if (onChunk) onChunk(data.text ?? data.chunk);
            }
          } catch (e) {
            console.warn("SSE parse notice on line:", line);
          }
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Stream aborted by user.");
      if (onDone) onDone();
      return;
    }
    if (onError) onError(err);
  }
}
