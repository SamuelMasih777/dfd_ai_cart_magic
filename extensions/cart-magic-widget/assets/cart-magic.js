/**
 * Cart Magic storefront widget (vanilla JS, PRD §6)
 */
(function () {
  const root = document.getElementById("sc-cart-magic-root");
  if (!root) return;

  const shop = root.dataset.shop;
  let appUrl = (root.dataset.appUrl || "").replace(/\/$/, "");
  if (!shop) {
    console.warn("[Cart Magic] Missing data-shop.");
    return;
  }
  if (!appUrl || appUrl === "https://") {
    console.warn(
      "[Cart Magic] Set App URL in Online Store → Themes → Customize → App embeds → Cart Magic.",
    );
    return;
  }

  const state = {
    config: null,
    cart: null,
    open: false,
    upsellProducts: [],
    timerEnd: 0,
    termsAccepted: false,
  };

  var RETURNING_VISITOR = (function () {
    var k = "sc_cart_magic_visit";
    var v = localStorage.getItem(k);
    if (!v) {
      localStorage.setItem(k, "1");
      return false;
    }
    return true;
  })();

  function postAnalytics(eventType, extra) {
    try {
      fetch(appUrl + "/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          event_type: eventType,
          cart_total:
            state.cart && state.cart.total_price
              ? Number(state.cart.total_price) / 100
              : undefined,
          cart_token: state.cart && state.cart.token,
          metadata: extra || {},
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  function applyCssVars(cfg) {
    const d = (cfg && cfg.design) || {};
    const r = document.documentElement;
    r.style.setProperty("--sc-primary", d.primaryColor || "#111");
    r.style.setProperty("--sc-btn-text", d.buttonTextColor || "#fff");
    r.style.setProperty("--sc-bg", d.backgroundColor || "#fff");
    r.style.setProperty("--sc-accent", d.accentColor || "#d44c2b");
    r.style.setProperty("--sc-btn-radius", d.buttonRadius || "8px");
    r.style.setProperty("--sc-drawer-width", d.drawerWidth || "420px");
    r.style.setProperty("--sc-font", d.fontFamily || "inherit");
  }

  function money(cents) {
    if (cents == null) return "";
    var n = Number(cents) / 100;
    return n.toFixed(2);
  }

  function cartTotalMoney() {
    if (!state.cart || state.cart.total_price == null) return 0;
    return Number(state.cart.total_price) / 100;
  }

  function evaluateCartRules() {
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.rulesEngine) return "";
    var rules = cfg.cartRules;
    if (!rules || !rules.length) return "";
    var total = cartTotalMoney();
    var cart = state.cart;
    var items = (cart && cart.items) || [];
    var returning = RETURNING_VISITOR;

    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      var ok = false;
      if (r.if === "cart_value_gt") {
        var thr = parseFloat(r.val || "0");
        ok = total > thr;
      } else if (r.if === "product_in_cart") {
        var pid = String(r.val || "");
        ok = items.some(function (line) {
          return String(line.product_id) === pid;
        });
      } else if (r.if === "returning_customer") {
        ok = returning;
      }
      if (!ok) continue;
      if (r.then === "show_upsell_product") {
        return r.action || "Eligible for a special offer — check upsells below.";
      }
      if (r.then === "show_offer") {
        return r.action || "You unlocked an offer.";
      }
      if (r.then === "apply_discount") {
        return r.action || "Use the discount box before checkout.";
      }
    }
    return "";
  }

  function giftVariantIdsFromConfig(cfg) {
    var out = [];
    var list = (cfg && cfg.giftRules) || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i].meta;
      if (m && m.variantNumericId) out.push(String(m.variantNumericId));
    }
    return out;
  }

  function syncGiftVariant() {
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.giftRule) {
      return Promise.resolve(false);
    }
    var rules = (cfg.giftRules || []).filter(function (g) {
      return g.autoAdd && g.meta && g.meta.variantNumericId;
    });
    if (!rules.length) return Promise.resolve(false);

    rules.sort(function (a, b) {
      return b.minCartValue - a.minCartValue;
    });

    var total = cartTotalMoney();
    var match = rules.find(function (g) {
      return total >= g.minCartValue;
    });

    var cart = state.cart;
    if (!cart || !cart.items) return Promise.resolve(false);

    var giftIds = giftVariantIdsFromConfig(cfg);

    function lineGiftInfo() {
      var lines = [];
      cart.items.forEach(function (line) {
        if (giftIds.indexOf(String(line.variant_id)) !== -1) {
          lines.push({ key: line.key, variant_id: line.variant_id });
        }
      });
      return lines;
    }

    var changed = false;

    if (!match) {
      var toClear = lineGiftInfo();
      if (!toClear.length) return Promise.resolve(false);
      return Promise.all(
        toClear.map(function (ln) {
          return fetch(window.location.origin + "/cart/change.js", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: ln.key, quantity: 0 }),
          });
        }),
      ).then(function () {
        return fetchCart().then(function () {
          return true;
        });
      });
    }

    var wantVid = String(match.meta.variantNumericId);
    var otherGifts = lineGiftInfo().filter(function (ln) {
      return String(ln.variant_id) !== wantVid;
    });

    return Promise.all(
      otherGifts.map(function (ln) {
        return fetch(window.location.origin + "/cart/change.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ln.key, quantity: 0 }),
        });
      }),
    )
      .then(function () {
        return fetchCart();
      })
      .then(function () {
        cart = state.cart;
        var has = cart.items.some(function (line) {
          return String(line.variant_id) === wantVid;
        });
        if (has) return false;
        return fetch(window.location.origin + "/cart/add.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: wantVid, quantity: 1 }] }),
        }).then(function () {
          postAnalytics("gift_redeemed", {
            gift_rule_id: match.id,
            variant_id: wantVid,
          });
          return true;
        });
      });
  }

  function loadConfig() {
    return fetch(
      appUrl + "/api/widget-config?shop=" + encodeURIComponent(shop),
      { credentials: "omit" },
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (cfg) {
        state.config = cfg;
        if (!cfg.enabled) return cfg;
        applyCssVars(cfg);
        return cfg;
      })
      .catch(function (e) {
        console.warn("[Cart Magic] widget-config failed", e);
        return null;
      });
  }

  function fetchCart() {
    return fetch(window.location.origin + "/cart.js", {
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (cart) {
        state.cart = cart;
        return cart;
      });
  }

  function fetchRecommendations(productId, limit) {
    if (!productId) return Promise.resolve([]);
    var u =
      window.location.origin +
      "/recommendations/products.json?product_id=" +
      encodeURIComponent(productId) +
      "&limit=" +
      encodeURIComponent(limit);
    return fetch(u, { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        return (data && data.products) || [];
      })
      .catch(function () {
        return [];
      });
  }

  function fetchProductByHandle(handle) {
    return fetch(window.location.origin + "/products/" + handle + ".js", {
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function loadUpsellProducts() {
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.upsell || !cfg.upsellRule)
      return Promise.resolve([]);
    var rule = cfg.upsellRule;
    if (!rule.type) return Promise.resolve([]);

    if (rule.type === "manual" && rule.manualProducts && rule.manualProducts.length) {
      return Promise.all(
        rule.manualProducts.slice(0, rule.maxProducts || 3).map(function (p) {
          if (!p.handle) return Promise.resolve(null);
          return fetchProductByHandle(p.handle);
        }),
      ).then(function (arr) {
        return arr.filter(Boolean);
      });
    }

    if (rule.type === "ai" && state.cart && state.cart.items && state.cart.items.length) {
      var first = state.cart.items[0];
      var pid = first.product_id;
      return fetchRecommendations(pid, rule.maxProducts || 3);
    }

    return Promise.resolve([]);
  }

  function renderRewards(container) {
    var cfg = state.config;
    if (!cfg || !cfg.rewardTiers || !cfg.rewardTiers.length) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }
    var tiers = cfg.rewardTiers.slice().sort(function (a, b) {
      return a.threshold - b.threshold;
    });
    var total = cartTotalMoney();
    var next = tiers.find(function (t) {
      return total < t.threshold;
    });
    var pct = 0;
    if (next) {
      pct = Math.min(100, (total / next.threshold) * 100);
    } else {
      pct = 100;
    }

    var labels = tiers
      .map(function (t) {
        return (
          '<span title="' +
          (t.label || t.rewardType || "") +
          '">' +
          (t.label || t.threshold) +
          "</span>"
        );
      })
      .join("");

    container.style.display = "block";
    container.innerHTML =
      '<div class="sc-rewards">' +
      '<div style="font-size:12px;font-weight:600;">Rewards</div>' +
      '<div class="sc-rewards-track"><div class="sc-rewards-fill" style="width:' +
      pct +
      '%"></div></div>' +
      '<div class="sc-rewards-labels">' +
      labels +
      "</div>" +
      "</div>";
  }

  function renderUpsell(container) {
    var cfg = state.config;
    container.innerHTML = "";
    if (!cfg || !cfg.features || !cfg.features.upsell) {
      container.style.display = "none";
      return;
    }
    var prods = state.upsellProducts || [];
    if (!prods.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "block";
    var block =
      cfg.upsellRule && cfg.upsellRule.style === "block" ? true : false;
    var row = document.createElement("div");
    row.className = block ? "" : "sc-upsell-row";

    prods.forEach(function (p) {
      var img =
        p.featured_image ||
        (p.images && p.images[0] && p.images[0].src) ||
        "";
      var card = document.createElement("div");
      card.className = "sc-upsell-card";
      card.innerHTML =
        (img
          ? '<img src="' + img.replace(/"/g, "") + '" alt="">'
          : "") +
        '<div style="font-weight:600;">' +
        (p.title || "") +
        "</div>" +
        '<button type="button" class="sc-upsell-add" data-variant-id="' +
        (p.variants && p.variants[0] ? p.variants[0].id : "") +
        '">Add</button>';
      row.appendChild(card);
    });

    container.innerHTML =
      '<div class="sc-upsell"><div class="sc-upsell-title">You may also like</div></div>';
    container.firstChild.appendChild(row);

    container.querySelectorAll(".sc-upsell-add").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-variant-id");
        if (!id) return;
        fetch(window.location.origin + "/cart/add.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: id, quantity: 1 }] }),
        })
          .then(function () {
            return fetchCart();
          })
          .then(function () {
            postAnalytics("upsell_added", { variant_id: id });
            renderAll();
          });
      });
    });
  }

  function renderLineItems(container) {
    if (!state.cart || !state.cart.items || !state.cart.items.length) {
      container.innerHTML =
        '<p style="opacity:0.7;font-size:14px;">Your cart is empty.</p>';
      return;
    }
    var html = "";
    state.cart.items.forEach(function (line) {
      var img =
        line.image ||
        (line.featured_image && line.featured_image.url) ||
        "";
      html +=
        '<div class="sc-line">' +
        (img
          ? '<img src="' + img.replace(/"/g, "") + '" alt="">'
          : "<div></div>") +
        "<div><p class=\"sc-line-title\">" +
        (line.title || "") +
        "</p>" +
        '<p class="sc-line-meta">Qty ' +
        line.quantity +
        " · " +
        money(line.final_line_price || line.line_price) +
        "</p></div></div>";
    });
    container.innerHTML = html;
  }

  function renderRulesBanner(el) {
    if (!el) return;
    var msg = evaluateCartRules();
    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = msg;
  }

  function renderTimer(el) {
    if (!el) return;
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.timer) {
      el.style.display = "none";
      if (els._timerId) {
        clearInterval(els._timerId);
        els._timerId = null;
      }
      return;
    }
    el.style.display = "block";
    if (els._timerId) {
      clearInterval(els._timerId);
      els._timerId = null;
    }
    var end = state.timerEnd;
    function tick() {
      var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      var m = Math.floor(left / 60);
      var s = left % 60;
      el.textContent =
        "Offer ends in " + m + ":" + (s < 10 ? "0" : "") + s;
    }
    tick();
    els._timerId = setInterval(tick, 1000);
  }

  var els = {};

  function renderAll() {
    if (!els.body) return;
    renderLineItems(els.body);
    renderRewards(els.rewards);
    renderRulesBanner(els.rulesBanner);
    loadUpsellProducts().then(function (prods) {
      state.upsellProducts = prods;
      renderUpsell(els.upsell);
    });
    if (els.subtotal) {
      els.subtotal.textContent = money(state.cart && state.cart.total_price);
    }
    syncGiftVariant().then(function (mutated) {
      if (mutated) {
        return fetchCart().then(function () {
          renderLineItems(els.body);
          if (els.subtotal) {
            els.subtotal.textContent = money(
              state.cart && state.cart.total_price,
            );
          }
        });
      }
    });
  }

  function openDrawer() {
    if (!state.config || !state.config.enabled) return;
    state.open = true;
    els.overlay.classList.add("sc-open");
    els.drawer.classList.add("sc-open");
    postAnalytics("drawer_open", {});
    var mins = (state.config.timerMinutes || 15) * 60 * 1000;
    state.timerEnd = Date.now() + mins;
    renderTimer(els.timer);
    fetchCart().then(function () {
      var total = cartTotalMoney();
      var reached = (state.config.rewardTiers || []).filter(function (x) {
        return total >= x.threshold;
      });
      if (reached.length)
        postAnalytics("progress_influenced", { tiers_reached: reached.length });
      renderAll();
    });
  }

  function closeDrawer() {
    state.open = false;
    els.overlay.classList.remove("sc-open");
    els.drawer.classList.remove("sc-open");
    if (els._timerId) {
      clearInterval(els._timerId);
      els._timerId = null;
    }
  }

  function applyDiscountCode() {
    var input = els.discountInput;
    if (!input) return;
    var code = (input.value || "").trim();
    if (!code) return;
    fetch(window.location.origin + "/cart/update.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount: code }),
    })
      .then(function () {
        return fetchCart();
      })
      .then(function () {
        renderAll();
      });
  }

  function saveCartNote() {
    var input = els.noteInput;
    if (!input) return;
    var note = input.value || "";
    fetch(window.location.origin + "/cart/update.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note }),
    }).catch(function () {});
  }

  function checkoutAllowed() {
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.termsCheckbox) return true;
    return state.termsAccepted;
  }

  function buildUi() {
    els.overlay = document.createElement("div");
    els.overlay.className = "sc-overlay";
    els.overlay.addEventListener("click", closeDrawer);

    els.drawer = document.createElement("div");
    els.drawer.className = "sc-drawer";
    els.drawer.setAttribute("role", "dialog");
    els.drawer.setAttribute("aria-modal", "true");

    var cfg = state.config || {};
    var ann = cfg.announcement || "";
    var checkoutText =
      (cfg.design && cfg.design.checkoutButtonText) || "Checkout";
    var f = cfg.features || {};

    var discountBlock = f.discountBox
      ? '<div class="sc-discount" id="sc-discount-wrap">' +
        '<label class="sc-label">Discount code</label>' +
        '<div class="sc-discount-row">' +
        '<input type="text" id="sc-discount-input" class="sc-input" placeholder="Code" />' +
        '<button type="button" class="sc-discount-apply" id="sc-discount-apply">Apply</button>' +
        "</div></div>"
      : "";

    var trustBlock = f.trustBadges
      ? '<div class="sc-trust" id="sc-trust-wrap">' +
        '<span class="sc-trust-item">🔒 Secure checkout</span>' +
        '<span class="sc-trust-item">↩ Easy returns</span>' +
        '<span class="sc-trust-item">★ Trusted store</span>' +
        "</div>"
      : "";

    var timerBlock = f.timer
      ? '<div class="sc-timer" id="sc-timer-wrap"></div>'
      : "";

    var noteBlock = f.orderNote
      ? '<div class="sc-note" id="sc-note-wrap">' +
        '<label class="sc-label">Order note</label>' +
        '<textarea id="sc-note-input" class="sc-textarea" rows="2" placeholder="Gift message, instructions…"></textarea>' +
        "</div>"
      : "";

    var termsBlock = f.termsCheckbox
      ? '<div class="sc-terms" id="sc-terms-wrap">' +
        '<label class="sc-terms-label">' +
        '<input type="checkbox" id="sc-terms-check" /> ' +
        "I agree to the terms before checkout" +
        "</label></div>"
      : "";

    var expressBlock = f.expressCheckout
      ? '<a class="sc-express" href="/checkout">Express checkout</a>'
      : "";

    els.drawer.innerHTML =
      (ann
        ? '<div class="sc-announcement">' +
          ann.replace(/</g, "&lt;") +
          "</div>"
        : "") +
      '<div class="sc-header"><span style="font-weight:700;font-size:16px;">Cart</span>' +
      '<button type="button" class="sc-close" aria-label="Close">×</button></div>' +
      '<div class="sc-rules-banner" id="sc-rules-banner" style="display:none"></div>' +
      '<div class="sc-rewards" id="sc-rewards-wrap"></div>' +
      '<div class="sc-body" id="sc-line-items"></div>' +
      '<div class="sc-upsell" id="sc-upsell-wrap"></div>' +
      discountBlock +
      trustBlock +
      timerBlock +
      noteBlock +
      termsBlock +
      '<div class="sc-footer">' +
      '<div class="sc-subtotal"><span>Subtotal</span><span id="sc-subtotal">0.00</span></div>' +
      expressBlock +
      '<a class="sc-checkout" id="sc-checkout-btn" href="/checkout">' +
      checkoutText.replace(/</g, "&lt;") +
      "</a>" +
      "</div>";

    els.body = els.drawer.querySelector("#sc-line-items");
    els.rewards = els.drawer.querySelector("#sc-rewards-wrap");
    els.upsell = els.drawer.querySelector("#sc-upsell-wrap");
    els.subtotal = els.drawer.querySelector("#sc-subtotal");
    els.rulesBanner = els.drawer.querySelector("#sc-rules-banner");
    els.timer = els.drawer.querySelector("#sc-timer-wrap");
    els.discountInput = els.drawer.querySelector("#sc-discount-input");
    els.noteInput = els.drawer.querySelector("#sc-note-input");

    var applyBtn = els.drawer.querySelector("#sc-discount-apply");
    if (applyBtn) applyBtn.addEventListener("click", applyDiscountCode);

    var termsEl = els.drawer.querySelector("#sc-terms-check");
    if (termsEl) {
      termsEl.addEventListener("change", function () {
        state.termsAccepted = termsEl.checked;
      });
    }

    var noteEl = els.drawer.querySelector("#sc-note-input");
    if (noteEl) {
      noteEl.addEventListener("blur", saveCartNote);
    }

    var checkoutBtn = els.drawer.querySelector("#sc-checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function (e) {
        if (!checkoutAllowed()) {
          e.preventDefault();
          alert("Please accept the terms to continue.");
          return;
        }
        postAnalytics("checkout_click", {});
      });
    }

    els.drawer.querySelector(".sc-close").addEventListener("click", closeDrawer);

    els.fab = document.createElement("button");
    els.fab.type = "button";
    els.fab.className = "sc-fab";
    els.fab.setAttribute("aria-label", "Open cart");
    els.fab.innerHTML = "🛒";

    els.fab.addEventListener("click", function () {
      if (state.open) closeDrawer();
      else openDrawer();
    });

    document.body.appendChild(els.overlay);
    document.body.appendChild(els.drawer);
    document.body.appendChild(els.fab);

    document.addEventListener("cart:updated", function () {
      fetchCart().then(renderAll);
    });
    document.addEventListener(
      "submit",
      function (e) {
        var t = e.target;
        if (
          t &&
          t.action &&
          String(t.action).indexOf("/cart/add") !== -1
        ) {
          setTimeout(function () {
            fetchCart().then(function () {
              renderAll();
              if (state.config && state.config.enabled) openDrawer();
            });
          }, 500);
        }
      },
      true,
    );
  }

  function initStickyAtc() {
    var cfg = state.config;
    if (!cfg || !cfg.features || !cfg.features.stickyAtc) return;
    if (document.querySelector(".sc-sticky-atc")) return;
    var form = document.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    var bar = document.createElement("div");
    bar.className = "sc-sticky-atc";
    var inner = document.createElement("div");
    inner.className = "sc-sticky-atc-inner";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sc-sticky-atc-btn";
    btn.textContent = "Add to cart";
    btn.addEventListener("click", function () {
      if (form.requestSubmit) form.requestSubmit();
      else form.submit();
    });
    inner.appendChild(btn);
    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  loadConfig().then(function (cfg) {
    if (!cfg || !cfg.enabled) return;
    buildUi();
    fetchCart().then(function () {
      renderAll();
      initStickyAtc();
    });

    var params = new URLSearchParams(window.location.search);
    var autoDiscount = params.get("discount") || params.get("discount_code");
    if (autoDiscount && cfg.features && cfg.features.discountBox) {
      setTimeout(function () {
        fetch(window.location.origin + "/cart/update.js", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discount: autoDiscount }),
        }).catch(function () {});
      }, 300);
    }
  });
})();
