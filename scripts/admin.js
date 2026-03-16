const adminSection = document.querySelector("#admin");

if (adminSection) {
  const ADMIN_KEY_PARAM = "admin_key";
  const lockCard = document.querySelector("#adminLockCard");
  const unlockForm = document.querySelector("#adminUnlockForm");
  const unlockStatusBox = document.querySelector("#adminUnlockStatus");
  const loginCard = document.querySelector("#adminLoginCard");
  const loginForm = document.querySelector("#adminLoginForm");
  const statusBox = document.querySelector("#adminStatus");
  const dashboard = document.querySelector("#adminDashboard");
  const loginToggle = document.querySelector("#adminLoginToggle");
  const isStandaloneAdminPage =
    !loginToggle || document.body?.dataset?.adminOnly === "true";
  const messagesBox = document.querySelector("#adminMessages");
  const logsBox = document.querySelector("#adminLogs");
  const logSelect = document.querySelector("#adminLogFile");
  const logFileLabel = document.querySelector("#adminLogFileLabel");
  const visitsTotal = document.querySelector("#adminVisitsTotal");
  const visitsUnique = document.querySelector("#adminVisitsUnique");
  const visitsRange = document.querySelector("#adminVisitsRange");
  const visitsChart = document.querySelector("#adminVisitsChart");
  const refreshButton = document.querySelector("#adminRefresh");
  const logoutButton = document.querySelector("#adminLogout");
  const adminThemeToggle = document.querySelector("#adminThemeToggle");
  const adminUserLabel = document.querySelector("#adminUserLabel");
  const exportVisitsButton = document.querySelector("#adminExportVisits");
  const exportMessagesButton = document.querySelector("#adminExportMessages");
  const searchInput = document.querySelector("#adminSearch");
  const prevPageButton = document.querySelector("#adminPrevPage");
  const nextPageButton = document.querySelector("#adminNextPage");
  const pageInfo = document.querySelector("#adminPageInfo");
  const messagesCount = document.querySelector("#adminMessagesCount");
  const adminSignalLastMessage = document.querySelector("#adminSignalLastMessage");
  const adminSignalLastMessageNote = document.querySelector(
    "#adminSignalLastMessageNote"
  );
  const adminSignalLogStatus = document.querySelector("#adminSignalLogStatus");
  const adminSignalLogNote = document.querySelector("#adminSignalLogNote");
  const adminSignalRefresh = document.querySelector("#adminSignalRefresh");
  const adminSignalRefreshNote = document.querySelector(
    "#adminSignalRefreshNote"
  );
  const adminSignalSearch = document.querySelector("#adminSignalSearch");
  const adminSignalSearchNote = document.querySelector("#adminSignalSearchNote");
  const root = document.documentElement;
  const themeColorMeta = document.querySelector("meta[name='theme-color']");

  const state = {
    authenticated: false,
    exposed: isStandaloneAdminPage,
    uiAccess: isStandaloneAdminPage,
    adminUiLocked: false,
    visitsDays: 14,
    lastRefreshAt: "",
    messages: {
      q: "",
      limit: 20,
      offset: 0,
      total: 0,
    },
  };

  let latestVisits = [];
  let searchTimer = null;
  const ADMIN_THEME_STORAGE_KEY = "admin_theme";
  const PUBLIC_THEME_STORAGE_KEY = "theme";

  const numberFormatter = new Intl.NumberFormat("fr-FR");
  const setText = (node, value) => {
    if (node) node.textContent = value;
  };

  const setAdminTheme = (mode) => {
    const dark = mode === "dark";
    if (dark) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }

    if (adminThemeToggle) {
      adminThemeToggle.textContent = dark ? "Mode clair" : "Mode sombre";
      adminThemeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", dark ? "#0f1a24" : "#d9e3ea");
    }

    if (latestVisits.length) {
      drawVisitsChart(latestVisits);
    }
  };

  const getInitialTheme = () => {
    try {
      const fromStorage = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
      if (fromStorage === "dark" || fromStorage === "light") {
        return fromStorage;
      }

      const fromPublic = localStorage.getItem(PUBLIC_THEME_STORAGE_KEY);
      if (fromPublic === "dark" || fromPublic === "light") {
        return fromPublic;
      }
    } catch {
      // ignore storage errors
    }

    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const initThemeToggle = () => {
    setAdminTheme(getInitialTheme());

    if (!adminThemeToggle) return;
    adminThemeToggle.addEventListener("click", () => {
      const isDark = root.getAttribute("data-theme") === "dark";
      const nextTheme = isDark ? "light" : "dark";
      try {
        localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextTheme);
      } catch {
        // ignore storage errors
      }
      setAdminTheme(nextTheme);
    });
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatCountLabel = (count, singular, plural) => {
    const label = count === 1 ? singular : plural;
    return `${numberFormatter.format(count)} ${label}`;
  };

  const updateRefreshSignal = (status = "idle") => {
    if (!state.lastRefreshAt) {
      setText(adminSignalRefresh, "Jamais");
      setText(
        adminSignalRefreshNote,
        "Connexion ou action manuelle requise."
      );
      return;
    }

    setText(adminSignalRefresh, formatDate(state.lastRefreshAt));
    setText(
      adminSignalRefreshNote,
      status === "error"
        ? "Chargement partiel, une source a échoué."
        : "Synchronisation terminée."
    );
  };

  const updateSearchSignal = () => {
    const query = state.messages.q.trim();
    if (!query) {
      setText(adminSignalSearch, "Aucune");
      setText(adminSignalSearchNote, "Toutes les entrées sont visibles.");
      return;
    }

    setText(adminSignalSearch, query);
    setText(
      adminSignalSearchNote,
      `${formatCountLabel(state.messages.total, "résultat", "résultats")} pour ce filtre.`
    );
  };

  const updateLastMessageSignal = (items) => {
    if (!items || !items.length) {
      setText(adminSignalLastMessage, "Aucun");
      setText(
        adminSignalLastMessageNote,
        state.messages.total > 0 || state.messages.q
          ? "Aucune entrée visible dans cette vue."
          : "Boîte de réception vide."
      );
      return;
    }

    const latest = items[0];
    const sender = latest.name || latest.email || "Expéditeur inconnu";
    const subject = latest.subject || "Sans sujet";
    setText(
      adminSignalLastMessage,
      latest.created_at ? formatDate(latest.created_at) : "Reçu"
    );
    setText(adminSignalLastMessageNote, `${sender} • ${subject}`);
  };

  const updateLogSignal = (resolvedFile, content) => {
    if (!resolvedFile) {
      setText(adminSignalLogStatus, "Vide");
      setText(adminSignalLogNote, "Aucun journal chargé.");
      return;
    }

    const lines = String(content || "")
      .split(/\r?\n/)
      .filter((line) => line.trim()).length;

    setText(adminSignalLogStatus, "Synchronisé");
    setText(adminSignalLogNote, `${resolvedFile} • ${numberFormatter.format(lines)} lignes`);
  };

  const resetDashboardSignals = () => {
    state.lastRefreshAt = "";
    setText(adminSignalLastMessage, "Aucun");
    setText(adminSignalLastMessageNote, "Boîte de réception vide.");
    setText(adminSignalLogStatus, "En attente");
    setText(adminSignalLogNote, "Aucun journal chargé.");
    setText(adminSignalSearch, "Aucune");
    setText(adminSignalSearchNote, "Toutes les entrées sont visibles.");
    updateRefreshSignal();
  };

  const setStatus = (message, type) => {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.dataset.type = type;
    statusBox.classList.add("is-visible");
  };

  const clearStatus = () => {
    if (!statusBox) return;
    statusBox.textContent = "";
    statusBox.dataset.type = "";
    statusBox.classList.remove("is-visible");
  };

  const setUnlockStatus = (message, type) => {
    if (!unlockStatusBox) return;
    unlockStatusBox.textContent = message;
    unlockStatusBox.dataset.type = type;
    unlockStatusBox.classList.add("is-visible");
  };

  const clearUnlockStatus = () => {
    if (!unlockStatusBox) return;
    unlockStatusBox.textContent = "";
    unlockStatusBox.dataset.type = "";
    unlockStatusBox.classList.remove("is-visible");
  };

  const updateLoginToggle = () => {
    if (!loginToggle) return;
    if (!state.uiAccess) {
      loginToggle.hidden = true;
      return;
    }
    loginToggle.hidden = false;
    if (state.authenticated) {
      loginToggle.textContent = "Se déconnecter";
      loginToggle.dataset.action = "logout";
      loginToggle.setAttribute(
        "aria-label",
        "Se déconnecter de la session admin"
      );
      return;
    }
    loginToggle.textContent = "Se connecter";
    loginToggle.dataset.action = "login";
    loginToggle.setAttribute("aria-label", "Se connecter à la session admin");
  };

  const updateVisibility = () => {
    if (isStandaloneAdminPage) {
      state.exposed = true;
    }
    updateLoginToggle();

    if (isStandaloneAdminPage) {
      adminSection.hidden = false;
      if (lockCard) lockCard.hidden = true;
      if (state.authenticated) {
        if (loginCard) loginCard.hidden = true;
        if (dashboard) dashboard.hidden = false;
        return;
      }
      if (loginCard) loginCard.hidden = false;
      if (dashboard) dashboard.hidden = true;
      return;
    }

    if (!state.uiAccess) {
      state.exposed = false;
      adminSection.hidden = true;
      if (lockCard) lockCard.hidden = true;
      if (loginCard) loginCard.hidden = true;
      if (dashboard) dashboard.hidden = true;
      return;
    }

    if (!state.exposed) {
      adminSection.hidden = true;
      return;
    }

    adminSection.hidden = false;
    if (lockCard) lockCard.hidden = true;
    if (state.authenticated) {
      if (loginCard) loginCard.hidden = true;
      if (dashboard) dashboard.hidden = false;
      return;
    }

    if (loginCard) loginCard.hidden = false;
    if (dashboard) dashboard.hidden = true;
  };

  const logoutAdmin = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      // ignore
    }
    state.authenticated = false;
    state.exposed = isStandaloneAdminPage;
    state.uiAccess = isStandaloneAdminPage ? true : false;
    state.messages.q = "";
    state.messages.offset = 0;
    state.messages.total = 0;
    if (adminUserLabel) {
      adminUserLabel.textContent = "";
    }
    if (searchInput) {
      searchInput.value = "";
    }
    if (loginForm) loginForm.reset();
    clearStatus();
    clearUnlockStatus();
    resetDashboardSignals();
    updateVisibility();
  };

  const updateMessagesMeta = () => {
    const { total, limit, offset } = state.messages;
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.max(Math.ceil(total / limit), 1);

    if (pageInfo) {
      pageInfo.textContent = `Page ${page} / ${pages}`;
    }

    if (prevPageButton) {
      prevPageButton.disabled = offset <= 0;
    }

    if (nextPageButton) {
      nextPageButton.disabled = offset + limit >= total;
    }

    if (messagesCount) {
      messagesCount.textContent = formatCountLabel(total, "message", "messages");
    }

    updateSearchSignal();
  };

  const renderMessages = (items) => {
    if (!messagesBox) return;
    messagesBox.innerHTML = "";

    if (!items || !items.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aucun message pour le moment.";
      messagesBox.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "admin-message";

      const header = document.createElement("div");
      header.className = "admin-message-head";

      const name = document.createElement("strong");
      name.textContent = item.name || "Sans nom";

      const meta = document.createElement("span");
      const metaParts = [item.email];
      if (item.phone) metaParts.push(item.phone);
      if (item.created_at) metaParts.push(formatDate(item.created_at));
      meta.textContent = metaParts.filter(Boolean).join(" - ");

      header.append(name, meta);

      const subject = document.createElement("div");
      subject.className = "admin-message-subject";
      subject.textContent = item.subject || "(Sans sujet)";

      const body = document.createElement("p");
      body.className = "admin-message-body";
      body.textContent = item.message || "";

      const footer = document.createElement("div");
      footer.className = "admin-message-footer";
      const agent = item.user_agent ? "UA: " + item.user_agent : null;
      footer.textContent = [agent].filter(Boolean).join(" - ");

      wrapper.append(header, subject, body);
      if (footer.textContent) {
        wrapper.appendChild(footer);
      }
      messagesBox.appendChild(wrapper);
    });
  };

  const renderLogs = (content, resolvedFile) => {
    if (logsBox) {
      logsBox.textContent = content || "";
    }
    if (logFileLabel) {
      logFileLabel.textContent = resolvedFile
        ? `Fichier actuel : ${resolvedFile}`
        : "Aucun log disponible.";
    }
  };

  const drawVisitsChart = (series) => {
    if (!visitsChart) return;
    const context = visitsChart.getContext("2d");
    if (!context) return;

    const width = visitsChart.clientWidth || 600;
    const height = visitsChart.clientHeight || 180;
    const dpr = window.devicePixelRatio || 1;

    visitsChart.width = Math.floor(width * dpr);
    visitsChart.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!series.length) return;

    const padding = 16;
    const chartHeight = Math.max(height - padding * 2 - 10, 1);
    const chartWidth = Math.max(width - padding * 2, 1);

    const totals = series.map((item) => item.total || 0);
    const uniques = series.map((item) => item.unique || 0);
    const maxValue = Math.max(1, ...totals, ...uniques);

    const slot = chartWidth / series.length;
    const gap = Math.min(slot * 0.35, 16);
    const barWidth = Math.max(slot - gap, 2);

    const rootStyles = getComputedStyle(document.documentElement);
    const accent = rootStyles.getPropertyValue("--accent").trim() || "#2b6a79";
    const accentStrong =
      rootStyles.getPropertyValue("--accent-strong").trim() || "#1f5562";
    const gridColor =
      rootStyles.getPropertyValue("--accent-a-20").trim() ||
      "rgba(43, 106, 121, 0.2)";

    context.strokeStyle = gridColor;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding, height - padding);
    context.lineTo(width - padding, height - padding);
    context.stroke();

    context.fillStyle = accent;

    series.forEach((item, index) => {
      const totalValue = item.total || 0;
      const barHeight = (totalValue / maxValue) * chartHeight;
      const x = padding + index * slot + gap / 2;
      const y = height - padding - barHeight;
      context.fillRect(x, y, barWidth, barHeight);
    });

    if (uniques.some((value) => value > 0)) {
      context.strokeStyle = accentStrong;
      context.lineWidth = 2;
      context.beginPath();

      series.forEach((item, index) => {
        const value = item.unique || 0;
        const x = padding + index * slot + gap / 2 + barWidth / 2;
        const y = height - padding - (value / maxValue) * chartHeight;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });

      context.stroke();
    }
  };

  const renderVisits = (data) => {
    if (!data) return;
    if (visitsTotal) {
      visitsTotal.textContent = numberFormatter.format(Number(data.total || 0));
    }
    if (visitsUnique) {
      visitsUnique.textContent = numberFormatter.format(
        Number(data.uniqueTotal || 0)
      );
    }
    if (visitsRange) {
      visitsRange.textContent = `${data.days || 0} derniers jours`;
    }
    latestVisits = Array.isArray(data.series) ? data.series : [];
    drawVisitsChart(latestVisits);
  };

  const fetchVisits = async () => {
    const response = await fetch(`/api/admin/visits?days=${state.visitsDays}`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Impossible de charger les visites.");
    }
    const data = await response.json();
    renderVisits(data);
  };

  const fetchMessages = async () => {
    const params = new URLSearchParams({
      limit: String(state.messages.limit),
      offset: String(state.messages.offset),
    });
    if (state.messages.q) {
      params.set("q", state.messages.q);
    }

    const response = await fetch(`/api/admin/messages?${params.toString()}`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Impossible de charger les messages.");
    }
    const data = await response.json();
    state.messages.total = Number(data.total || 0);
    renderMessages(data.items || []);
    updateLastMessageSignal(data.items || []);
    updateMessagesMeta();
  };

  const fetchLogs = async () => {
    const fileKey = logSelect ? logSelect.value : "app";
    const response = await fetch(
      `/api/admin/logs?file=${encodeURIComponent(fileKey)}&lines=200`,
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error("Impossible de charger les logs.");
    }
    const data = await response.json();
    renderLogs(data.content || "", data.resolvedFile || "");
    updateLogSignal(data.resolvedFile || "", data.content || "");
  };

  const refreshDashboard = async () => {
    if (!state.authenticated) return;
    if (messagesBox) messagesBox.innerHTML = "";
    if (logsBox) logsBox.textContent = "";

    const results = await Promise.allSettled([
      fetchMessages(),
      fetchLogs(),
      fetchVisits(),
    ]);

    const hasError = results.some((result) => result.status === "rejected");
    state.lastRefreshAt = new Date().toISOString();
    updateRefreshSignal(hasError ? "error" : "success");

    if (hasError) {
      renderLogs("Erreur lors du chargement des données.");
    }
  };

  const unlockUiAccess = async (key) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return false;

    const response = await fetch("/api/admin/ui-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ key: cleanKey }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json().catch(() => ({}));
    state.adminUiLocked =
      Object.prototype.hasOwnProperty.call(data, "locked")
        ? Boolean(data.locked)
        : state.adminUiLocked;
    state.uiAccess = Boolean(data.enabled);
    return state.uiAccess;
  };

  const unlockUiAccessFromUrl = async () => {
    let url;
    try {
      url = new URL(window.location.href);
    } catch {
      return;
    }

    const key = String(url.searchParams.get(ADMIN_KEY_PARAM) || "").trim();
    if (!key) return;

    try {
      const unlocked = await unlockUiAccess(key);
      if (unlocked) {
        state.exposed = true;
      }
    } catch {
      // ignore
    } finally {
      url.searchParams.delete(ADMIN_KEY_PARAM);
      const cleanPath = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, "", cleanPath);
    }
  };

  const checkSession = async () => {
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "include",
      });
      if (!response.ok) {
        state.authenticated = false;
        state.uiAccess = isStandaloneAdminPage ? true : false;
        updateVisibility();
        return;
      }
      const data = await response.json();
      state.authenticated = Boolean(data.authenticated);
      state.adminUiLocked =
        Object.prototype.hasOwnProperty.call(data, "adminUiLocked")
          ? Boolean(data.adminUiLocked)
          : state.adminUiLocked;
      state.uiAccess = isStandaloneAdminPage
        ? true
        : (
          Object.prototype.hasOwnProperty.call(data, "uiAccess")
            ? Boolean(data.uiAccess)
            : false
        );
      if (adminUserLabel) {
        adminUserLabel.textContent = data.username || "";
      }
      updateVisibility();
      if (state.authenticated && state.exposed) {
        await refreshDashboard();
      }
    } catch (error) {
      state.authenticated = false;
      state.uiAccess = isStandaloneAdminPage ? true : false;
      updateVisibility();
    }
  };

  if (loginToggle) {
    loginToggle.addEventListener("click", async () => {
      if (state.authenticated) {
        await logoutAdmin();
        return;
      }

      state.exposed = true;
      updateVisibility();
      adminSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (loginForm) {
        const input = loginForm.querySelector("input[name='username']");
        if (input) input.focus();
      }
      if (state.authenticated) {
        await refreshDashboard();
      }
    });
  }

  if (unlockForm) {
    unlockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearUnlockStatus();

      const formData = new FormData(unlockForm);
      const key = String(formData.get("key") || "").trim();
      if (!key) {
        setUnlockStatus("Clé admin requise.", "error");
        return;
      }

      try {
        setUnlockStatus("Vérification en cours...", "loading");
        const unlocked = await unlockUiAccess(key);
        if (!unlocked) {
          setUnlockStatus("Clé admin invalide.", "error");
          return;
        }

        clearUnlockStatus();
        state.exposed = true;
        updateVisibility();
        if (loginForm) {
          const input = loginForm.querySelector("input[name='username']");
          if (input) input.focus();
        }
      } catch {
        setUnlockStatus("Impossible de valider la clé pour le moment.", "error");
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus();

      const formData = new FormData(loginForm);
      const payload = {
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || ""),
      };

      if (!payload.username || !payload.password) {
        setStatus("Merci de saisir les identifiants.", "error");
        return;
      }

      try {
        setStatus("Connexion en cours...", "loading");
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Connexion impossible.");
        }

        state.authenticated = true;
        state.uiAccess = true;
        state.exposed = true;
        if (adminUserLabel) {
          adminUserLabel.textContent = data.username || payload.username;
        }
        updateVisibility();
        clearStatus();
        await refreshDashboard();
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Erreur de connexion.",
          "error"
        );
      }
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      refreshDashboard();
    });
  }

  if (logSelect) {
    logSelect.addEventListener("change", () => {
      refreshDashboard();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await logoutAdmin();
    });
  }

  if (exportVisitsButton) {
    exportVisitsButton.addEventListener("click", () => {
      window.location.assign(`/api/admin/visits/export?days=${state.visitsDays}`);
    });
  }

  if (exportMessagesButton) {
    exportMessagesButton.addEventListener("click", () => {
      const params = new URLSearchParams();
      if (state.messages.q) params.set("q", state.messages.q);
      const url = params.toString()
        ? `/api/admin/messages/export?${params.toString()}`
        : "/api/admin/messages/export";
      window.location.assign(url);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const nextQuery = searchInput.value.trim();
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.messages.q = nextQuery;
        state.messages.offset = 0;
        updateSearchSignal();
        if (state.authenticated) {
          fetchMessages().catch(() => {
            renderLogs("Erreur lors du chargement des messages.");
          });
        }
      }, 300);
    });
  }

  if (prevPageButton) {
    prevPageButton.addEventListener("click", () => {
      state.messages.offset = Math.max(
        0,
        state.messages.offset - state.messages.limit
      );
      fetchMessages().catch(() => {
        renderLogs("Erreur lors du chargement des messages.");
      });
    });
  }

  if (nextPageButton) {
    nextPageButton.addEventListener("click", () => {
      state.messages.offset = Math.min(
        state.messages.offset + state.messages.limit,
        Math.max(state.messages.total - state.messages.limit, 0)
      );
      fetchMessages().catch(() => {
        renderLogs("Erreur lors du chargement des messages.");
      });
    });
  }

  if (visitsChart) {
    window.addEventListener("resize", () => {
      if (latestVisits.length) {
        drawVisitsChart(latestVisits);
      }
    });
  }

  initThemeToggle();
  resetDashboardSignals();
  updateVisibility();
  updateMessagesMeta();
  (async () => {
    await unlockUiAccessFromUrl();
    await checkSession();
  })();
}

