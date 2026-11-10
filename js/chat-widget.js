/* Riverside Auto Rental chat widget. Talks only to this site's Netlify functions. */
(function () {
  var PHONE = "715-396-1466";
  var PHONE_TEL = "+17153961466";
  var DISCLOSURE = "This is an AI assistant that answers from riversideautorental.com. For anything it can't answer, call or text 715-396-1466.";
  var HELPER = "Don't send card numbers, driver's license numbers, or Social Security numbers.";
  var HOURS = "Monday–Friday 8:00 AM–5:00 PM, Saturday 8:00 AM–noon. Sunday we're closed. A callback is a request, not a confirmed appointment. After hours, we call the next business day.";
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

  function mount(mode) {
    if (document.getElementById("rar-chat")) return;
    var root = el("div", "rar-chat");
    root.id = "rar-chat";
    if (!document.getElementById("sms-bubble")) root.classList.add("rar-chat--no-sms");

    var panel = el("section", "rar-chat__panel");
    panel.id = "rar-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "rar-chat-title");
    panel.hidden = true;

    var header = el("div", "rar-chat__header");
    var title = el("h2", "rar-chat__title", "Riverside Auto Rental AI");
    title.id = "rar-chat-title";
    var close = el("button", "rar-chat__close", "Close");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    header.appendChild(title);
    header.appendChild(close);

    var disclosure = el("p", "rar-chat__disclosure", DISCLOSURE);
    var log = el("div", "rar-chat__log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");

    var chips = el("div", "rar-chat__chips");
    var composer = el("form", "rar-chat__composer");
    var field = el("textarea", "rar-chat__input");
    field.name = "message";
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

    var handoff = buildHandoff();
    var transcript = [];

    panel.appendChild(header);
    panel.appendChild(disclosure);
    panel.appendChild(log);
    panel.appendChild(chips);
    panel.appendChild(composer);
    panel.appendChild(helper);
    panel.appendChild(handoff.form);

    var launcher = el("button", "rar-chat__launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "rar-chat-panel");
    launcher.appendChild(el("span", "rar-chat__launcher-kicker", "AI"));
    launcher.appendChild(el("span", "rar-chat__launcher-label", "Ask"));

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    function addMessage(role, text) {
      var item = el("div", "rar-chat__msg rar-chat__msg--" + role);
      item.textContent = text;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
      transcript.push({ role: role, content: text });
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", open ? "true" : "false");
      panel.setAttribute("aria-modal", open ? "true" : "false");
      if (open) {
        var focusTarget = mode === "chat" ? field : handoff.name;
        window.setTimeout(function () { focusTarget.focus(); }, 30);
      }
    }

    function showHandoff(prefill) {
      handoff.form.hidden = false;
      if (prefill && !handoff.question.value) handoff.question.value = prefill;
      chips.hidden = true;
      window.setTimeout(function () { handoff.submit.scrollIntoView({ block: "nearest" }); }, 30);
      if (mode === "fallback") {
        composer.hidden = true;
        helper.hidden = true;
      }
    }

    close.addEventListener("click", function () { setOpen(false); launcher.focus(); });
    launcher.addEventListener("click", function () { setOpen(panel.hidden); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false);
        launcher.focus();
      }
    });

    if (mode === "fallback") {
      composer.hidden = true;
      helper.hidden = true;
      chips.hidden = true;
      log.hidden = true;
      showHandoff("");
    } else {
      addMessage("assistant", "Hi, I'm the Riverside Auto Rental AI. I answer from our website. I can't book a car or check what's free.");
      CHIPS.forEach(function (chip) {
        var button = el("button", "rar-chat__chip", chip.label);
        button.type = "button";
        button.addEventListener("click", function () {
          if (chip.handoff) {
            showHandoff("Please call me.");
            handoff.name.focus();
            return;
          }
          ask(chip.message);
        });
        chips.appendChild(button);
      });
      var callBtn = el("button", "rar-chat__chip rar-chat__chip--quiet", "Request a callback");
      callBtn.type = "button";
      callBtn.addEventListener("click", function () { showHandoff(""); });
      chips.appendChild(callBtn);
      var wait = Math.max(0, 1000 - (Date.now() - LOADED_AT));
      send.disabled = true;
      window.setTimeout(function () { send.disabled = false; }, wait);
    }

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

    handoff.form.addEventListener("submit", function (event) {
      event.preventDefault();
      sendHandoff();
    });

    function historyForModel() {
      return transcript.filter(function (item) {
        return item.role === "user" || item.role === "assistant";
      }).slice(-8);
    }

    function ask(text) {
      var question = String(text || "").trim();
      if (!question || send.disabled) return;
      field.value = "";
      addMessage("user", question);
      send.disabled = true;
      var prior = historyForModel().slice(0, -1);
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
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        var reply = (result.data && result.data.reply) || ("I can't reach the assistant right now. Call or text " + PHONE + ".");
        addMessage("assistant", reply);
        if (result.data && result.data.showHandoff) showHandoff(question);
      }).catch(function () {
        addMessage("assistant", "I can't reach the assistant right now. Call or text " + PHONE + ", or leave your name and number.");
        showHandoff(question);
      }).then(function () {
        send.disabled = false;
        field.focus();
      });
    }

    function sendHandoff() {
      if (handoff.submit.disabled) return;
      handoff.error.textContent = "";
      handoff.submit.disabled = true;
      var include = handoff.include.checked;
      var lines = transcript.map(function (item) {
        return (item.role === "user" ? "Visitor" : "Assistant") + ": " + item.content;
      });
      fetch("/api/chat-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name: handoff.name.value,
          phone: handoff.phone.value,
          email: handoff.email.value,
          preferred_time: handoff.when.value,
          question: handoff.question.value,
          transcript: include ? lines.join("\n").slice(0, 8000) : "",
          page_url: location.href,
          "bot-field": handoff.trap.value
        })
      }).then(function (res) {
        return res.json().then(function (data) { return { status: res.status, data: data || {} }; });
      }).then(function (result) {
        if (result.data && result.data.ok) {
          handoff.form.hidden = true;
          addMessage("assistant", result.data.reply || "Thanks. This is a callback request, not a confirmed appointment.");
          return;
        }
        handoff.error.textContent = (result.data && result.data.reply) || ("Please call or text " + PHONE + ".");
      }).catch(function () {
        handoff.error.textContent = "Please call or text " + PHONE + ".";
      }).then(function () {
        handoff.submit.disabled = false;
      });
    }
  }

  function buildHandoff() {
    var form = el("form", "rar-chat__handoff");
    form.hidden = true;
    form.noValidate = false;
    form.appendChild(el("p", "rar-chat__hours", HOURS));

    var trapWrap = el("p", "rar-chat__trap");
    trapWrap.setAttribute("aria-hidden", "true");
    var trap = document.createElement("input");
    trap.name = "bot-field";
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trapWrap.appendChild(el("label", null, "Leave this field empty"));
    trapWrap.appendChild(trap);
    form.appendChild(trapWrap);

    function labeled(name, label, required) {
      var wrap = el("label", "rar-chat__field");
      wrap.appendChild(document.createTextNode(label));
      var input = document.createElement(name === "question" ? "textarea" : "input");
      input.name = name;
      if (name !== "question") input.type = name === "email" ? "email" : name === "phone" ? "tel" : "text";
      if (name === "question") input.rows = 2;
      if (required) input.required = true;
      wrap.appendChild(input);
      form.appendChild(wrap);
      return input;
    }

    var name = labeled("name", "Name", true);
    var phone = labeled("phone", "Phone", true);
    var email = labeled("email", "Email (optional)", false);
    var when = labeled("preferred_time", "A good time to call (optional)", false);
    var question = labeled("question", "What should we help with?", true);
    name.autocomplete = "name";
    phone.autocomplete = "tel";
    email.autocomplete = "email";

    var includeWrap = el("label", "rar-chat__check");
    var include = document.createElement("input");
    include.type = "checkbox";
    include.name = "include_transcript";
    includeWrap.appendChild(include);
    includeWrap.appendChild(document.createTextNode(" Include this chat with the request"));
    form.appendChild(includeWrap);

    var error = el("p", "rar-chat__error", "");
    error.setAttribute("role", "alert");
    form.appendChild(error);
    var submit = el("button", "rar-chat__submit", "Request a callback");
    submit.type = "submit";
    form.appendChild(submit);
    var phoneLine = el("p", "rar-chat__phone");
    var link = document.createElement("a");
    link.href = "tel:" + PHONE_TEL;
    link.textContent = "Call " + PHONE;
    var sms = document.createElement("a");
    sms.href = "sms:" + PHONE_TEL;
    sms.textContent = "Text " + PHONE;
    phoneLine.appendChild(link);
    phoneLine.appendChild(document.createTextNode(" · "));
    phoneLine.appendChild(sms);
    form.appendChild(phoneLine);

    return { form: form, name: name, phone: phone, email: email, when: when, question: question, include: include, trap: trap, error: error, submit: submit };
  }

  function boot() {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 4000);
    fetch("/api/chat-status", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      window.clearTimeout(timer);
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      if (!data || (data.mode !== "chat" && data.mode !== "fallback")) return;
      mount(data.mode);
    }).catch(function () {
      window.clearTimeout(timer);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
