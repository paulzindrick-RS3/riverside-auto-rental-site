/* Upgrades the Help link only when chat is available. Otherwise it stays an sms: link. */
(function () {
  var PHONE = "715-396-1466";
  var PHONE_TEL = "+17153961466";
  var SMS_HREF = "sms:+17153961466";
  var DISCLOSURE = "This is an automated assistant that answers from riversideautorental.com. For anything it can't answer, text us at 715-396-1466, or call the same number.";
  var HELPER = "Don't send card numbers, driver's license numbers, or Social Security numbers.";
  var STATUS_TIMEOUT_MS = 4000;
  var LOADED_AT = Date.now();

  var CHIPS = [
    { label: "Weekly rates", message: "What are the weekly rates?" },
    { label: "15-passenger van", message: "Tell me about the 15-passenger van." },
    { label: "Insurance replacement", message: "How does insurance replacement work?" },
    { label: "What do I need to rent?", message: "What do I need to rent a car, including the age requirement?" },
    { label: "Deposits", message: "How do deposits work?" },
    { label: "I'd like someone to call me", handoff: true }
  ];

  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  function sessionId() {
    var existing = storageGet("rar-chat-session");
    if (existing) return existing;
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "10000000-1000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12);
    storageSet("rar-chat-session", id);
    return id;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function upgrade(help) {
    if (help.getAttribute("data-rar-chat") === "on") return;
    help.setAttribute("data-rar-chat", "on");
    help.setAttribute("aria-label", "Help: text us or ask a question");
    help.setAttribute("aria-expanded", "false");
    help.setAttribute("aria-controls", "rar-help-menu");
    help.setAttribute("aria-haspopup", "menu");

    var menu = el("div", "rar-help-menu");
    menu.id = "rar-help-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    var textLink = document.createElement("a");
    textLink.href = SMS_HREF;
    textLink.textContent = "Text us";
    textLink.setAttribute("role", "menuitem");
    var askBtn = el("button", "rar-help-menu__ask", "Ask a question");
    askBtn.type = "button";
    askBtn.setAttribute("role", "menuitem");
    menu.appendChild(textLink);
    menu.appendChild(askBtn);
    help.insertAdjacentElement("afterend", menu);

    var chat = buildChat();
    document.body.appendChild(chat.panel);

    function setMenu(open) {
      menu.hidden = !open;
      help.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) chat.close();
    }
    function setChat(open) {
      chat.panel.hidden = !open;
      if (open) {
        setMenu(false);
        window.setTimeout(function () { chat.field.focus(); }, 30);
      }
    }

    help.addEventListener("click", function (event) {
      event.preventDefault();
      setMenu(menu.hidden);
    });
    askBtn.addEventListener("click", function () { setChat(chat.panel.hidden); });
    chat.closeBtn.addEventListener("click", function () { setChat(false); help.focus(); });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!menu.hidden) { setMenu(false); help.focus(); }
      else if (!chat.panel.hidden) { setChat(false); help.focus(); }
    });
    document.addEventListener("click", function (event) {
      if (menu.hidden) return;
      if (event.target === help || menu.contains(event.target)) return;
      setMenu(false);
    });
  }

  function buildChat() {
    var panel = el("section", "rar-chat__panel");
    panel.id = "rar-chat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "rar-chat-title");

    var header = el("div", "rar-chat__header");
    var title = el("h2", "rar-chat__title", "Riverside Rental Help");
    title.id = "rar-chat-title";
    var closeBtn = el("button", "rar-chat__close", "Close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    header.appendChild(title);
    header.appendChild(closeBtn);

    var disclosure = el("p", "rar-chat__disclosure", DISCLOSURE);
    var log = el("div", "rar-chat__log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    var chips = el("div", "rar-chat__chips");
    var composer = el("form", "rar-chat__composer");
    var field = el("textarea", "rar-chat__input");
    field.maxLength = 500;
    field.rows = 2;
    field.required = true;
    field.setAttribute("aria-label", "Your question");
    field.placeholder = "Ask about rates, the fleet, or what to bring";
    var send = el("button", "rar-chat__send", "Send");
    send.type = "submit";
    composer.appendChild(field);
    composer.appendChild(send);
    var helper = el("p", "rar-chat__helper", HELPER);
    var textUs = buildTextUs();
    var transcript = [];

    panel.appendChild(header);
    panel.appendChild(disclosure);
    panel.appendChild(log);
    panel.appendChild(chips);
    panel.appendChild(composer);
    panel.appendChild(helper);
    panel.appendChild(textUs);

    function addMessage(role, text) {
      var item = el("div", "rar-chat__msg rar-chat__msg--" + role);
      item.textContent = text;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
      transcript.push({ role: role, content: text });
    }
    function showTextUs() {
      textUs.hidden = false;
      window.setTimeout(function () { textUs.scrollIntoView({ block: "nearest" }); }, 30);
    }
    function addTextChip(label) {
      var link = document.createElement("a");
      link.className = "rar-chat__chip";
      link.href = SMS_HREF;
      link.textContent = label;
      link.addEventListener("click", function () { showTextUs(); });
      chips.appendChild(link);
    }

    addMessage("assistant", "Hi, I'm Riverside Rental Help. I answer from our website. I can't book a car or check what's free.");
    CHIPS.forEach(function (chip) {
      if (chip.handoff) {
        addTextChip(chip.label);
        return;
      }
      var button = el("button", "rar-chat__chip", chip.label);
      button.type = "button";
      button.addEventListener("click", function () { ask(chip.message); });
      chips.appendChild(button);
    });
    addTextChip("Request a callback");

    var wait = Math.max(0, 1000 - (Date.now() - LOADED_AT));
    send.disabled = true;
    window.setTimeout(function () { send.disabled = false; }, wait);

    composer.addEventListener("submit", function (event) {
      event.preventDefault();
      ask(field.value);
    });
    field.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        composer.requestSubmit ? composer.requestSubmit() : composer.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    function ask(text) {
      var question = String(text || "").trim();
      if (!question || send.disabled) return;
      field.value = "";
      addMessage("user", question);
      send.disabled = true;
      var prior = transcript.filter(function (item) {
        return item.role === "user" || item.role === "assistant";
      }).slice(-8, -1);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          message: question,
          history: prior,
          sessionId: sessionId(),
          loadedAt: LOADED_AT,
          pageUrl: location.href
        })
      }).then(function (res) {
        return res.json().then(function (data) { return data || {}; });
      }).then(function (data) {
        addMessage("assistant", data.reply || ("I can't reach the assistant right now. Text us at " + PHONE + ", or call the same number."));
        if (data.showHandoff) showTextUs();
      }).catch(function () {
        addMessage("assistant", "I can't reach the assistant right now. Text us at " + PHONE + ", or call the same number.");
        showTextUs();
      }).then(function () {
        send.disabled = false;
        field.focus();
      });
    }

    return {
      panel: panel,
      field: field,
      closeBtn: closeBtn,
      close: function () { panel.hidden = true; }
    };
  }

  function buildTextUs() {
    var box = el("div", "rar-chat__textus");
    box.hidden = true;
    var lead = el("p", "rar-chat__textus-lead");
    lead.appendChild(document.createTextNode("Text us at "));
    lead.appendChild(el("span", "rar-chat__number", PHONE));
    lead.appendChild(document.createTextNode("."));
    box.appendChild(lead);
    var actions = el("p", "rar-chat__phone");
    var sms = document.createElement("a");
    sms.href = SMS_HREF;
    sms.textContent = "Text " + PHONE;
    var call = document.createElement("a");
    call.href = "tel:" + PHONE_TEL;
    call.textContent = "Call " + PHONE;
    actions.appendChild(sms);
    actions.appendChild(document.createTextNode(" · "));
    actions.appendChild(call);
    box.appendChild(actions);
    return box;
  }

  function boot() {
    var help = document.getElementById("rar-help");
    if (!help || help.getAttribute("href") !== SMS_HREF) return;
    var settled = false;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      settled = true;
      if (controller) controller.abort();
    }, STATUS_TIMEOUT_MS);
    fetch("/api/chat-status", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (data && data.mode === "chat") upgrade(help);
    }).catch(function () {
      settled = true;
      window.clearTimeout(timer);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
