/* Hariom AI - Frontend Logic
   Handles chat UI, history, sending messages, copy & regenerate.
   Uses safe DOM methods (textContent) — never injects chat HTML. */

(function () {
  "use strict";

  // ---------- DOM references ----------
  var messagesEl = document.getElementById("messages");
  var inputEl = document.getElementById("messageInput");
  var sendBtn = document.getElementById("sendBtn");
  var newChatBtn = document.getElementById("newChatBtn");
  var clearChatBtn = document.getElementById("clearChatBtn");
  var clearAllBtn = document.getElementById("clearAllBtn");
  var chatHistoryEl = document.getElementById("chatHistory");
  var chatTitleEl = document.getElementById("chatTitle");
  var welcomeScreen = document.getElementById("welcomeScreen");
  var menuBtn = document.getElementById("menuBtn");
  var closeSidebarBtn = document.getElementById("closeSidebarBtn");
  var sidebar = document.getElementById("sidebar");
  var setupBanner = document.getElementById("setupBanner");
  var dismissBannerBtn = document.getElementById("dismissBannerBtn");
  var toastEl = document.getElementById("toast");
  var suggestionsEl = document.getElementById("suggestions");

  // ---------- State ----------
  var currentChatId = null;
  var isSending = false;

  // ---------- Helpers ----------
  function showToast(message, isError) {
    toastEl.textContent = message;
    toastEl.className = "toast" + (isError ? " error" : "");
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.hidden = true;
    }, 3000);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }

  function setSending(value) {
    isSending = value;
    sendBtn.disabled = value;
  }

  // ---------- Message rendering (safe DOM) ----------
  function createMessageEl(role, content, messageId) {
    var wrap = document.createElement("div");
    wrap.className = "message " + role;

    var avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "U" : "A";

    var body = document.createElement("div");
    body.className = "message-body";

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Hariom AI";

    var bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = content; // safe: textContent, not innerHTML

    body.appendChild(roleLabel);
    body.appendChild(bubble);

    if (role === "assistant") {
      var actions = document.createElement("div");
      actions.className = "message-actions";

      var copyBtn = document.createElement("button");
      copyBtn.className = "action-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", function () {
        copyText(content, copyBtn);
      });

      var regenBtn = document.createElement("button");
      regenBtn.className = "action-btn";
      regenBtn.textContent = "Regenerate";
      regenBtn.addEventListener("click", function () {
        regenerateMessage(wrap, regenBtn);
      });

      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);
      body.appendChild(actions);
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    if (messageId) wrap.dataset.messageId = messageId;
    return wrap;
  }

  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        var old = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(function () { btn.textContent = old; }, 1500);
      }).catch(function () {
        showToast("Could not copy. Please copy manually.", true);
      });
    } else {
      showToast("Clipboard not supported in this browser.", true);
    }
  }

  function showTyping() {
    var wrap = document.createElement("div");
    wrap.className = "message assistant";
    wrap.id = "typingMessage";

    var avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "A";

    var body = document.createElement("div");
    body.className = "message-body";

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "Hariom AI";

    var bubble = document.createElement("div");
    bubble.className = "message-bubble";

    var indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = '<span></span><span></span><span></span>';

    bubble.appendChild(indicator);
    body.appendChild(roleLabel);
    body.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  }

  function removeTyping() {
    var t = document.getElementById("typingMessage");
    if (t) t.remove();
  }

  function showErrorBubble(message) {
    var wrap = document.createElement("div");
    wrap.className = "message assistant";

    var avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "A";

    var body = document.createElement("div");
    body.className = "message-body";

    var roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "Hariom AI";

    var bubble = document.createElement("div");
    bubble.className = "message-bubble error-bubble";
    bubble.textContent = message;

    body.appendChild(roleLabel);
    body.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  }

  function hideWelcome() {
    if (welcomeScreen) welcomeScreen.style.display = "none";
  }

  function showWelcome() {
    messagesEl.innerHTML = "";
    welcomeScreen = document.getElementById("welcomeScreen");
    if (welcomeScreen) {
      welcomeScreen.style.display = "";
      messagesEl.appendChild(welcomeScreen);
    }
  }

  // ---------- Chat history sidebar ----------
  function loadChatHistory() {
    fetch("/api/chats")
      .then(function (r) { return r.json(); })
      .then(function (chats) {
        chatHistoryEl.innerHTML = "";
        if (!chats.length) {
          var empty = document.createElement("p");
          empty.className = "history-empty";
          empty.textContent = "No chats yet";
          chatHistoryEl.appendChild(empty);
          return;
        }
        chats.forEach(function (chat) {
          var item = document.createElement("div");
          item.className = "history-item";
          if (chat.id === currentChatId) item.classList.add("active");

          var title = document.createElement("span");
          title.className = "history-title";
          title.textContent = chat.title;

          var del = document.createElement("button");
          del.className = "delete-history";
          del.textContent = "\u00d7";
          del.title = "Delete chat";
          del.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteChat(chat.id);
          });

          item.appendChild(title);
          item.appendChild(del);
          item.addEventListener("click", function () {
            openChat(chat.id);
          });
          chatHistoryEl.appendChild(item);
        });
      })
      .catch(function () {
        chatHistoryEl.innerHTML = '<p class="history-empty">Could not load chats</p>';
      });
  }

  function openChat(chatId) {
    currentChatId = chatId;
    fetch("/api/chats/" + chatId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        chatTitleEl.textContent = data.title;
        messagesEl.innerHTML = "";
        hideWelcome();
        data.messages.forEach(function (m) {
          var role = m.role === "user" ? "user" : "assistant";
          messagesEl.appendChild(createMessageEl(role, m.content, m.id));
        });
        scrollToBottom();
        loadChatHistory();
        closeSidebarMobile();
      })
      .catch(function () {
        showToast("Could not open chat.", true);
      });
  }

  function deleteChat(chatId) {
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    fetch("/api/chats/" + chatId, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () {
        if (currentChatId === chatId) {
          currentChatId = null;
          chatTitleEl.textContent = "New Chat";
          showWelcome();
        }
        loadChatHistory();
        showToast("Chat deleted.");
      })
      .catch(function () {
        showToast("Could not delete chat.", true);
      });
  }

  function newChat() {
    currentChatId = null;
    chatTitleEl.textContent = "New Chat";
    showWelcome();
    loadChatHistory();
    closeSidebarMobile();
    inputEl.focus();
  }

  function clearCurrentChat() {
    if (!currentChatId) {
      newChat();
      return;
    }
    if (!confirm("Clear this chat? All messages will be deleted.")) return;
    fetch("/api/chats/" + currentChatId, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () {
        newChat();
        showToast("Chat cleared.");
      })
      .catch(function () {
        showToast("Could not clear chat.", true);
      });
  }

  function clearAllChats() {
    if (!confirm("Delete ALL chats? This cannot be undone.")) return;
    fetch("/api/chats/clear_all", { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function () {
        newChat();
        showToast("All chats deleted.");
      })
      .catch(function () {
        showToast("Could not clear all chats.", true);
      });
  }

  // ---------- Sending messages ----------
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || isSending) return;

    hideWelcome();
    setSending(true);

    // Render user message immediately
    messagesEl.appendChild(createMessageEl("user", text));
    scrollToBottom();

    // Clear input
    inputEl.value = "";
    autoResize();

    // Show typing indicator
    var typing = showTyping();
    messagesEl.appendChild(typing);
    scrollToBottom();

    var body = JSON.stringify({ message: text, chat_id: currentChatId });

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (result) {
        removeTyping();
        if (!result.ok) {
          var errMsg = (result.data && result.data.error) || "Something went wrong. Please try again.";
          messagesEl.appendChild(showErrorBubble(errMsg));
          showToast(errMsg, true);
        } else {
          if (result.data.chat_id) currentChatId = result.data.chat_id;
          if (result.data.title) chatTitleEl.textContent = result.data.title;
          messagesEl.appendChild(createMessageEl("assistant", result.data.reply));
          loadChatHistory();
        }
        scrollToBottom();
      })
      .catch(function () {
        removeTyping();
        messagesEl.appendChild(showErrorBubble("Network error. Please check your connection and try again."));
        showToast("Network error.", true);
      })
      .finally(function () {
        setSending(false);
        inputEl.focus();
      });
  }

  // ---------- Regenerate ----------
  function regenerateMessage(messageEl, btn) {
    if (isSending) return;
    if (!currentChatId) {
      showToast("Nothing to regenerate.", true);
      return;
    }

    btn.disabled = true;
    btn.textContent = "Regenerating...";
    setSending(true);

    // Replace bubble content with typing indicator
    var bubble = messageEl.querySelector(".message-bubble");
    var oldContent = bubble.textContent;
    bubble.innerHTML = "";
    var indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = '<span></span><span></span><span></span>';
    bubble.appendChild(indicator);
    scrollToBottom();

    fetch("/api/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: currentChatId })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          var errMsg = (result.data && result.data.error) || "Could not regenerate response.";
          bubble.textContent = errMsg;
          bubble.classList.add("error-bubble");
          showToast(errMsg, true);
        } else {
          bubble.textContent = result.data.reply;
          bubble.classList.remove("error-bubble");
          // Update the copy button reference content
          var copyBtn = messageEl.querySelector(".action-btn");
          if (copyBtn) {
            // Rebind copy by storing latest content on the bubble
            bubble.dataset.content = result.data.reply;
          }
        }
      })
      .catch(function () {
        bubble.textContent = "Network error during regeneration.";
        bubble.classList.add("error-bubble");
      })
      .finally(function () {
        setSending(false);
        btn.disabled = false;
        btn.textContent = "Regenerate";
        scrollToBottom();
      });
  }

  // ---------- API key status ----------
  function checkApiKey() {
    fetch("/api/status")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.api_key_configured) {
          setupBanner.hidden = false;
        }
      })
      .catch(function () {
        // ignore — server may be starting
      });
  }

  // ---------- Sidebar mobile ----------
  function openSidebarMobile() {
    sidebar.classList.add("open");
  }

  function closeSidebarMobile() {
    sidebar.classList.remove("open");
  }

  // ---------- Event listeners ----------
  sendBtn.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", autoResize);

  newChatBtn.addEventListener("click", newChat);
  clearChatBtn.addEventListener("click", clearCurrentChat);
  clearAllBtn.addEventListener("click", clearAllChats);
  menuBtn.addEventListener("click", openSidebarMobile);
  closeSidebarBtn.addEventListener("click", closeSidebarMobile);
  dismissBannerBtn.addEventListener("click", function () {
    setupBanner.hidden = true;
  });

  // Suggestion chips
  if (suggestionsEl) {
    suggestionsEl.addEventListener("click", function (e) {
      var chip = e.target.closest(".suggestion-chip");
      if (!chip) return;
      inputEl.value = chip.dataset.text;
      autoResize();
      sendMessage();
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", function (e) {
    if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && e.target !== menuBtn) {
        closeSidebarMobile();
      }
    }
  });

  // ---------- Init ----------
  loadChatHistory();
  checkApiKey();
  inputEl.focus();
})();
