const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const narrowViewportQuery = window.matchMedia("(max-width: 980px)");
const hardwareThreads = Number(window.navigator.hardwareConcurrency || 8);
const deviceMemory = Number(window.navigator.deviceMemory || 8);

const prefersReducedMotion = () => reducedMotionQuery.matches;
const isLowPowerDevice = () => hardwareThreads <= 4 || deviceMemory <= 4;
const shouldUseLiteMotion = () =>
  prefersReducedMotion() || coarsePointerQuery.matches || narrowViewportQuery.matches || isLowPowerDevice();

const createTracker = () => {
  return () => {};
};

const trackPageView = createTracker();

const setupReveal = () => {
  const autoTargets = document.querySelectorAll(
    ".card, .callout, .timeline-item, .faq-item, .section-header, .hero-content, .hero-panel, .hero-metadata, .contact-card, .site-footer"
  );

  autoTargets.forEach((item) => {
    if (!item.hasAttribute("data-reveal")) {
      item.setAttribute("data-reveal", "");
    }
  });

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  revealItems.forEach((item, index) => {
    const delay = item.dataset.revealDelay || `${Math.min(index * 70, 280)}ms`;
    item.style.setProperty("--delay", delay);
  });

  if (shouldUseLiteMotion()) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));
};

const setupNavHighlight = () => {
  const navLinks = Array.from(document.querySelectorAll(".site-nav a[href^='#']"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActive = () => {
    const scrollPosition = window.scrollY + 140;
    let currentId = sections[0]?.id;

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPosition) {
        currentId = section.id;
      }
    });

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${currentId}`;
      link.classList.toggle("is-active", isActive);
    });
  };

  return setActive;
};

const setupScrollProgress = () => {
  const progressBar = document.querySelector("#scrollProgress");
  if (!progressBar) return () => {};

  const update = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    progressBar.style.transform = `scaleX(${progress})`;
  };

  return update;
};

const setupParallax = () => {
  const targets = document.querySelectorAll("[data-parallax]");
  if (shouldUseLiteMotion() || !targets.length) return () => {};

  const update = () => {
    const scrollTop = window.scrollY;
    targets.forEach((target) => {
      const speed = Number.parseFloat(target.dataset.parallax) || 0.05;
      target.style.transform = `translateY(${scrollTop * speed * -0.2}px)`;
    });
  };

  return update;
};

const setupHeroGlow = () => {
  const hero = document.querySelector(".hero");
  if (!hero || shouldUseLiteMotion()) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  hero.addEventListener("mousemove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty("--glow-x", `${x}%`);
    hero.style.setProperty("--glow-y", `${y}%`);
  });

  hero.addEventListener("mouseleave", () => {
    hero.style.setProperty("--glow-x", "70%");
    hero.style.setProperty("--glow-y", "20%");
  });
};

const setupInterfaceTelemetry = () => {
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return () => {};

  const updateScrollState = () => {
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1
    );
    const ratio = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    root.style.setProperty("--scroll-ratio", ratio.toFixed(4));
    body.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  if (body.dataset.adminOnly === "true" || shouldUseLiteMotion()) {
    updateScrollState();
    return updateScrollState;
  }

  if (window.matchMedia("(pointer: fine)").matches) {
    let pointerX = 72;
    let pointerY = 18;
    let rafId = 0;

    const flushPointer = () => {
      root.style.setProperty("--cursor-x", `${pointerX}%`);
      root.style.setProperty("--cursor-y", `${pointerY}%`);
      rafId = 0;
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        pointerX = (event.clientX / window.innerWidth) * 100;
        pointerY = (event.clientY / window.innerHeight) * 100;
        if (!rafId) {
          rafId = window.requestAnimationFrame(flushPointer);
        }
      },
      { passive: true }
    );
  }

  updateScrollState();
  return updateScrollState;
};

const setupInteractiveSurfaces = () => {
  const body = document.body;
  if (!body || body.dataset.adminOnly === "true") return;
  if (shouldUseLiteMotion() || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  const surfaces = document.querySelectorAll(
    ".card, .btn, .tag, .badge, .meta-block, .tool-group, .tool-matrix-item, .competence-signal-item, .contact-signal, .contact-step, .faq-item, .project-media"
  );

  surfaces.forEach((surface) => {
    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      surface.style.setProperty("--spot-x", `${x}%`);
      surface.style.setProperty("--spot-y", `${y}%`);
    });

    surface.addEventListener("pointerleave", () => {
      surface.style.setProperty("--spot-x", "50%");
      surface.style.setProperty("--spot-y", "50%");
    });
  });
};

const setupNavSmoothScroll = () => {
  const navLinks = Array.from(document.querySelectorAll(".site-nav a[href^='#']"));
  if (!navLinks.length) return;

  const header = document.querySelector(".site-header");
  const getHeaderOffset = () => (header ? header.offsetHeight + 16 : 0);

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const useNativeScroll = () => shouldUseLiteMotion();

  const animateScroll = (targetY) => {
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 700;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOut(progress);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      const targetTop =
        target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
      const nextTop = Math.max(targetTop, 0);

      if (useNativeScroll()) {
        window.scrollTo({
          top: nextTop,
          behavior: "smooth",
        });
      } else {
        animateScroll(nextTop);
      }

      history.replaceState(null, "", href);
      trackPageView(`${window.location.pathname}${href}`);
    });
  });
};

const setupMobileNav = () => {
  const toggle = document.querySelector("#navToggle");
  const nav = document.querySelector("#siteNav");
  if (!toggle || !nav) return;

  const navLinks = nav.querySelectorAll("a[href^='#']");

  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const close = () => setOpen(false);

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("nav-open");
    setOpen(!isOpen);
  });

  navLinks.forEach((link) => link.addEventListener("click", close));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      close();
    }
  });
};

const setupStickyCta = () => {
  const cta = document.querySelector("#stickyCta");
  const contact = document.querySelector("#contact");
  if (!cta || !contact) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        cta.classList.toggle("is-hidden", entry.isIntersecting);
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(contact);
};

const setupThemeToggle = () => {
  const toggle = document.querySelector("#themeToggle");
  if (!toggle) return;

  const root = document.documentElement;
  const storageKey = "theme";
  const themeMeta = document.querySelector("meta[name='theme-color']");
  const prefersDarkQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  const getStoredTheme = () => {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "dark" || value === "light" ? value : null;
    } catch {
      return null;
    }
  };

  const applyTheme = (mode) => {
    const isDark = mode === "dark";
    if (isDark) {
      root.setAttribute("data-theme", "dark");
      toggle.textContent = "Mode clair";
      toggle.setAttribute("aria-pressed", "true");
    } else {
      root.removeAttribute("data-theme");
      toggle.textContent = "Mode sombre";
      toggle.setAttribute("aria-pressed", "false");
    }

    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0f1a24" : "#d9e3ea");
    }
  };

  const resolveSystemTheme = () =>
    prefersDarkQuery && prefersDarkQuery.matches ? "dark" : "light";

  const saved = getStoredTheme();
  applyTheme(saved || resolveSystemTheme());

  const handleSystemThemeChange = (event) => {
    if (getStoredTheme()) return;
    applyTheme(event.matches ? "dark" : "light");
  };

  if (prefersDarkQuery) {
    if (typeof prefersDarkQuery.addEventListener === "function") {
      prefersDarkQuery.addEventListener("change", handleSystemThemeChange);
    } else if (typeof prefersDarkQuery.addListener === "function") {
      prefersDarkQuery.addListener(handleSystemThemeChange);
    }
  }

  toggle.addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // ignore storage failures
    }
    applyTheme(next);
  });
};

const init = () => {
  setupReveal();
  setupNavSmoothScroll();
  setupMobileNav();
  setupStickyCta();
  setupThemeToggle();
  setupInteractiveSurfaces();

  const updateNav = setupNavHighlight();
  const updateProgress = setupScrollProgress();
  const updateParallax = setupParallax();
  const updateInterface = setupInterfaceTelemetry();

  const onScroll = () => {
    updateNav();
    updateProgress();
    updateParallax();
    updateInterface();
  };

  let ticking = false;
  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll);
  onScroll();

  const trackLocation = () => {
    trackPageView(`${window.location.pathname}${window.location.hash}`);
  };

  window.addEventListener("hashchange", trackLocation);
  window.addEventListener("popstate", trackLocation);

  setupHeroGlow();
  updateInterface();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
