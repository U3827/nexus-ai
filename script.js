
"use strict";

/* =========================================
   NEXUS AI — Application Configuration
========================================= */

const SUPABASE_URL = "https://wmwpqpjckpivflktasyv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_38Ta1vF6Tpfx3GnxpORn2A_XhaV0YAx";

const AI_ENDPOINT =
  `${SUPABASE_URL}/functions/v1/rapid-function`;

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/* =========================================
   DOM Elements
========================================= */

const $ = (id) => document.getElementById(id);

const elements = {
  authScreen: $("auth-screen"),
  authForm: $("auth-form"),
  authEmail: $("auth-email"),
  authPassword: $("auth-password"),
  authTitle: $("auth-title"),
  authSubtitle: $("auth-subtitle"),
  authSubmit: $("auth-submit"),
  authMessage: $("auth-message"),
  authSwitchText: $("auth-switch-text"),
  authSwitchButton: $("auth-switch-button"),

  app: $("app"),
  sidebar: $("sidebar"),
  sidebarBackdrop: $("sidebar-backdrop"),
  newChatButton: $("new-chat-button"),
  conversationList: $("conversation-list"),
  userAvatar: $("user-avatar"),
  userName: $("user-name"),
  userEmail: $("user-email"),
  signOutButton: $("sign-out-button"),

  mobileMenuButton: $("mobile-menu-button"),
  chatTitle: $("chat-title"),
  connectionStatus: $("connection-status"),
  chatScroll: $("chat-scroll"),
  welcomeScreen: $("welcome-screen"),
  messages: $("messages"),
  typingIndicator: $("typing-indicator"),

  chatForm: $("chat-form"),
  messageInput: $("message-input"),
  sendButton: $("send-button"),
  toastContainer: $("toast-container")
};

/* =========================================
   Application State
========================================= */

const state = {
  session: null,
  user: null,
  conversations: [],
  currentConversationId: null,
  sending: false,
  authMode: "signin"
};

/* =========================================
   Utilities
========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  window.setTimeout(() => toast.remove(), 4500);
}

function setConnectionStatus(message) {
  elements.connectionStatus.textContent = message;
}

function setAuthMessage(message, type = "error") {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.remove("hidden");
  elements.authMessage.dataset.type = type;
}

function clearAuthMessage() {
  elements.authMessage.textContent = "";
  elements.authMessage.classList.add("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  clearAuthMessage();

  const signingIn = mode === "signin";

  elements.authTitle.textContent = signingIn
    ? "Welcome back"
    : "Create your account";

  elements.authSubtitle.textContent = signingIn
    ? "Sign in to continue your conversations."
    : "Join NEXUS AI and save your conversations.";

  elements.authSubmit.textContent = signingIn
    ? "Sign in"
    : "Create account";

  elements.authPassword.autocomplete = signingIn
    ? "current-password"
    : "new-password";

  elements.authSwitchText.textContent = signingIn
    ? "Don't have an account?"
    : "Already have an account?";

  elements.authSwitchButton.textContent = signingIn
    ? "Create account"
    : "Sign in";
}

function getErrorMessage(error) {
  const message = error?.message || "Something went wrong.";

  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password. Please check and try again.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email before signing in.";
  }

  if (/user already registered/i.test(message)) {
    return "This email already has an account. Please sign in.";
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return "Network connection failed. Check your internet and try again.";
  }

  return message;
}

function getInitials(name) {
  const words = String(name || "User").trim().split(/\s+/);
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.chatScroll.scrollTop = elements.chatScroll.scrollHeight;
  });
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarBackdrop.classList.remove("visible");
}

function openSidebar() {
  elements.sidebar.classList.add("open");
  elements.sidebarBackdrop.classList.add("visible");
}

function renderMarkdown(content) {
  const text = String(content ?? "");

  if (window.marked && window.DOMPurify) {
    const html = window.marked.parse(text, {
      breaks: true,
      gfm: true
    });

    return window.DOMPurify.sanitize(html);
  }

  return escapeHTML(text).replace(/\n/g, "<br>");
}

/* =========================================
   Authentication
========================================= */

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !password) {
    setAuthMessage("Please enter your email and password.");
    return;
  }

  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = "Please wait...";
  clearAuthMessage();

  try {
    if (state.authMode === "signin") {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      state.session = data.session;
      state.user = data.user;

      await showApplication();
    } else {
      const { data, error } =
        await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split("@")[0]
            }
          }
        });

      if (error) throw error;

      if (!data.session) {
        setAuthMessage(
          "Account created. Check your email for a confirmation link, then sign in.",
          "success"
        );
      } else {
        state.session = data.session;
        state.user = data.user;
        await showApplication();
      }
    }
  } catch (error) {
    setAuthMessage(getErrorMessage(error));
  } finally {
    elements.authSubmit.disabled = false;
    elements.authSubmit.textContent =
      state.authMode === "signin" ? "Sign in" : "Create account";
  }
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showToast(getErrorMessage(error), "error");
    return;
  }

  state.session = null;
  state.user = null;
  state.conversations = [];
  state.currentConversationId = null;

  elements.app.classList.add("hidden");
  elements.authScreen.classList.remove("hidden");
  elements.messages.innerHTML = "";
  elements.conversationList.innerHTML = "";
  elements.chatTitle.textContent = "New conversation";

  closeSidebar();
  setAuthMode("signin");
  showToast("You have signed out.");
}

/* =========================================
   Application Startup
========================================= */

async function showApplication() {
  if (!state.user || !state.session) return;

  elements.authScreen.classList.add("hidden");
  elements.app.classList.remove("hidden");

  const displayName =
    state.user.user_metadata?.full_name ||
    state.user.email?.split("@")[0] ||
    "User";

  elements.userName.textContent = displayName;
  elements.userEmail.textContent = state.user.email || "";
  elements.userAvatar.textContent = getInitials(displayName);

  setConnectionStatus("Ready to help");

  await loadConversations();

  startNewConversation(false);
}

async function initializeApp() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);

  elements.authSwitchButton.addEventListener("click", () => {
    setAuthMode(state.authMode === "signin" ? "signup" : "signin");
  });

  elements.signOutButton.addEventListener("click", signOut);

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showToast("Unable to check your session. Please refresh.", "error");
    return;
  }

  if (data.session) {
    state.session = data.session;
    state.user = data.session.user;
    await showApplication();
  } else {
    elements.authScreen.classList.remove("hidden");
    elements.app.classList.add("hidden");
    setAuthMode("signin");
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    state.user = session?.user || null;
  });
}

/* =========================================
   Conversations
========================================= */

async function loadConversations() {
  if (!state.user) return;

  elements.conversationList.innerHTML =
    '<p class="muted small">Loading conversations...</p>';

  const { data, error } = await supabaseClient
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", state.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    elements.conversationList.innerHTML =
      '<p class="muted small">Unable to load saved conversations.</p>';

    showToast("Could not load conversation history.", "error");
    return;
  }

  state.conversations = data || [];
  renderConversationList();
}

function renderConversationList() {
  elements.conversationList.innerHTML = "";

  if (!state.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.textContent = "Your saved conversations will appear here.";
    elements.conversationList.appendChild(empty);
    return;
  }

  state.conversations.forEach((conversation) => {
    const item = document.createElement("div");
    item.className = "conversation-item";

    if (conversation.id === state.currentConversationId) {
      item.classList.add("active");
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "conversation-open";
    openButton.textContent = conversation.title || "New conversation";
    openButton.title = conversation.title || "New conversation";

    openButton.addEventListener("click", () => {
      openConversation(conversation.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "conversation-delete";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "Delete conversation");
    deleteButton.title = "Delete conversation";

    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversation(conversation.id);
    });

    item.append(openButton, deleteButton);
    elements.conversationList.appendChild(item);
  });
}

function startNewConversation(focusInput = true) {
  state.currentConversationId = null;

  elements.chatTitle.textContent = "New conversation";
  elements.messages.innerHTML = "";
  elements.welcomeScreen.classList.remove("hidden");

  renderConversationList();
  closeSidebar();

  if (focusInput) {
    elements.messageInput.focus();
  }

  scrollToBottom();
}

async function createConversation(firstMessage) {
  if (!state.user) {
    throw new Error("Please sign in before starting a conversation.");
  }

  const title = firstMessage.trim().replace(/\s+/g, " ").slice(0, 55) ||
    "New conversation";

  const { data, error } = await supabaseClient
    .from("conversations")
    .insert({
      user_id: state.user.id,
      title
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) throw error;

  state.currentConversationId = data.id;
  state.conversations.unshift(data);

  elements.chatTitle.textContent = data.title;
  renderConversationList();

  return data;
}

async function openConversation(conversationId) {
  const conversation = state.conversations.find(
    item => item.id === conversationId
  );

  if (!conversation || !state.user) return;

  state.currentConversationId = conversationId;
  elements.chatTitle.textContent = conversation.title;
  elements.messages.innerHTML = "";
  elements.welcomeScreen.classList.add("hidden");

  renderConversationList();
  closeSidebar();
  setConnectionStatus("Loading conversation...");

  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    showToast("Unable to open this conversation.", "error");
    setConnectionStatus("Ready to help");
    return;
  }

  (data || []).forEach(message => {
    appendMessage(message.role, message.content, false);
  });

  setConnectionStatus("Ready to help");
  scrollToBottom();
}

async function deleteConversation(conversationId) {
  if (!state.user) return;

  const confirmed = window.confirm(
    "Delete this conversation and all its messages?"
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", state.user.id);

  if (error) {
    showToast("Could not delete this conversation.", "error");
    return;
  }

  state.conversations = state.conversations.filter(
    item => item.id !== conversationId
  );

  if (state.currentConversationId === conversationId) {
    startNewConversation(false);
  }

  renderConversationList();
  showToast("Conversation deleted.");
}

/* =========================================
   Message Display
========================================= */

function appendMessage(role, content, animate = true) {
  elements.welcomeScreen.classList.add("hidden");

  const isUser = role === "user";

  const message = document.createElement("article");
  message.className = `message ${isUser ? "user-message" : "assistant-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = isUser
    ? getInitials(state.user?.user_metadata?.full_name || "You")
    : "N";

  const body = document.createElement("div");
  body.className = "message-body";

  const heading = document.createElement("div");
  heading.className = "message-heading";
  heading.textContent = isUser
    ? "You"
    : "NEXUS AI";

  const contentElement = document.createElement("div");
  contentElement.className = "message-content";
  contentElement.innerHTML = isUser
    ? escapeHTML(content).replace(/\n/g, "<br>")
    : renderMarkdown(content);

  body.append(heading, contentElement);

  if (!isUser) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "text-btn";
    copyButton.textContent = "Copy";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(String(content));
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 1500);
      } catch {
        showToast("Copy failed. Select the response text instead.", "error");
      }
    });

    actions.appendChild(copyButton);
    body.appendChild(actions);
  }

  message.append(avatar, body);
  elements.messages.appendChild(message);

  if (animate) {
    scrollToBottom();
  }

  return message;
}

/* =========================================
   Saving Messages
========================================= */

async function saveMessage(role, content, conversationId) {
  if (!state.user || !conversationId) {
    throw new Error("Your session is missing. Please sign in again.");
  }

  const { error } = await supabaseClient
    .from("messages")
    .insert({
      conversation_id: conversationId,
      user_id: state.user.id,
      role,
      content
    });

  if (error) throw error;

  const { error: updateError } = await supabaseClient
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", state.user.id);

  if (updateError) {
    console.warn("Conversation timestamp update failed:", updateError.message);
  }
}

/* =========================================
   AI Request
========================================= */

async function requestAI(message) {
  if (!state.session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.session.access_token}`,
        "apikey": SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ message }),
      signal: controller.signal
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `AI service error (${response.status}).`
      );
    }

    if (result.success === false) {
      throw new Error(result.error || "The AI service could not answer.");
    }

    const reply = typeof result.reply === "string"
      ? result.reply.trim()
      : "";

    if (!reply) {
      throw new Error(
        "The AI returned an empty response. Please try again."
      );
    }

    return reply;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The AI took too long to respond. Please try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* =========================================
   Send a Message
========================================= */

async function handleChatSubmit(event) {
  event.preventDefault();

  if (state.sending) return;

  const text = elements.messageInput.value.trim();

  if (!text) return;

  if (!state.user || !state.session) {
    showToast("Please sign in to send a message.", "error");
    return;
  }

  state.sending = true;
  elements.sendButton.disabled = true;
  elements.messageInput.disabled = true;

  let conversationId = state.currentConversationId;
  let userMessageSaved = false;

  elements.messageInput.value = "";
  elements.messageInput.style.height = "auto";

  appendMessage("user", text);
  elements.typingIndicator.classList.remove("hidden");
  setConnectionStatus("Thinking...");

  try {
    if (!conversationId) {
      const conversation = await createConversation(text);
      conversationId = conversation.id;
    }

    await saveMessage("user", text, conversationId);
    userMessageSaved = true;

    const reply = await requestAI(text);

    await saveMessage("assistant", reply, conversationId);

    elements.typingIndicator.classList.add("hidden");
    appendMessage("assistant", reply);

    setConnectionStatus("Ready to help");

    const conversation = state.conversations.find(
      item => item.id === conversationId
    );

    if (conversation) {
      conversation.updated_at = new Date().toISOString();
    }

    state.conversations.sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );

    renderConversationList();
  } catch (error) {
    elements.typingIndicator.classList.add("hidden");

    const message = userMessageSaved
      ? `I couldn't get a response: ${getErrorMessage(error)}`
      : `Your message could not be saved: ${getErrorMessage(error)}`;

    appendMessage("assistant", message);
    setConnectionStatus("Connection issue");
    showToast(getErrorMessage(error), "error");
  } finally {
    state.sending = false;
    elements.sendButton.disabled = false;
    elements.messageInput.disabled = false;
    elements.messageInput.focus();
    scrollToBottom();
  }
}

/* =========================================
   Interface Events
========================================= */

function setupInterface() {
  elements.newChatButton.addEventListener("click", () => {
    startNewConversation(true);
  });

  elements.chatForm.addEventListener("submit", handleChatSubmit);

  elements.messageInput.addEventListener("input", () => {
    elements.messageInput.style.height = "auto";
    elements.messageInput.style.height =
      `${Math.min(elements.messageInput.scrollHeight, 180)}px`;
  });

  elements.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!state.sending) {
        elements.chatForm.requestSubmit();
      }
    }
  });

  elements.mobileMenuButton.addEventListener("click", openSidebar);

  elements.sidebarBackdrop.addEventListener("click", closeSidebar);

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      elements.messageInput.value = button.dataset.prompt || "";
      elements.messageInput.focus();
      elements.messageInput.dispatchEvent(new Event("input"));

      if (!state.sending) {
        elements.chatForm.requestSubmit();
      }
    });
  });
}

/* =========================================
   Start
========================================= */

setupInterface();

initializeApp().catch(error => {
  console.error("NEXUS AI startup error:", error);
  showToast("The app could not start. Please refresh the page.", "error");
});
