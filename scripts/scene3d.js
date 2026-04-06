(() => {
  const canvas = document.querySelector("#scene3DBackground");
  if (!canvas) return;

  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });

  if (!context) {
    canvas.style.display = "none";
    return;
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(pointer: fine)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const narrowViewportQuery = window.matchMedia("(max-width: 980px)");
  const root = document.documentElement;
  const forceMotion = document.body?.dataset.forceMotion === "true";
  const hero = document.querySelector(".hero");

  const hardwareThreads = Number(window.navigator.hardwareConcurrency || 8);
  const deviceMemory = Number(window.navigator.deviceMemory || 8);
  const lowPowerDevice = hardwareThreads <= 4 || deviceMemory <= 4;
  const isLiteMode = () =>
    coarsePointerQuery.matches || narrowViewportQuery.matches || lowPowerDevice;
  const isReducedMotion = () =>
    (reducedMotionQuery.matches && !forceMotion) || isLiteMode();

  const meshTemplates = {
    cube: {
      vertices: [
        { x: -1, y: -1, z: -1 },
        { x: 1, y: -1, z: -1 },
        { x: 1, y: 1, z: -1 },
        { x: -1, y: 1, z: -1 },
        { x: -1, y: -1, z: 1 },
        { x: 1, y: -1, z: 1 },
        { x: 1, y: 1, z: 1 },
        { x: -1, y: 1, z: 1 },
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ],
    },
    octa: {
      vertices: [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1.15 },
        { x: 0, y: 0, z: -1.15 },
      ],
      edges: [
        [0, 2],
        [2, 1],
        [1, 3],
        [3, 0],
        [0, 4],
        [2, 4],
        [1, 4],
        [3, 4],
        [0, 5],
        [2, 5],
        [1, 5],
        [3, 5],
      ],
    },
    tetra: {
      vertices: [
        { x: 1, y: 1, z: 1 },
        { x: -1, y: -1, z: 1 },
        { x: -1, y: 1, z: -1 },
        { x: 1, y: -1, z: -1 },
      ],
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 2],
        [1, 3],
        [2, 3],
      ],
    },
    prism: {
      vertices: [
        { x: -1, y: -1, z: -1 },
        { x: 1, y: -1, z: -1 },
        { x: 0, y: 1, z: -1 },
        { x: -1, y: -1, z: 1 },
        { x: 1, y: -1, z: 1 },
        { x: 0, y: 1, z: 1 },
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
        [3, 4],
        [4, 5],
        [5, 3],
        [0, 3],
        [1, 4],
        [2, 5],
      ],
    },
  };

  const meshPresets = [
    {
      template: "cube",
      scale: 126,
      depth: 540,
      offsetX: 0.25,
      offsetY: 0.2,
      spinX: 0.58,
      spinY: 0.47,
      spinZ: 0.22,
      drift: 0.32,
      tone: "accent",
      pointerFactor: 1,
      pulse: 1.9,
      pulseAmp: 0.1,
      scrollFactor: 220,
    },
    {
      template: "octa",
      scale: 104,
      depth: 680,
      offsetX: -0.34,
      offsetY: -0.26,
      spinX: 0.4,
      spinY: -0.56,
      spinZ: 0.2,
      drift: 0.39,
      tone: "cool",
      pointerFactor: 0.72,
      pulse: 2.4,
      pulseAmp: 0.14,
      scrollFactor: 260,
    },
    {
      template: "tetra",
      scale: 92,
      depth: 470,
      offsetX: -0.2,
      offsetY: 0.3,
      spinX: -0.62,
      spinY: 0.26,
      spinZ: 0.44,
      drift: 0.44,
      tone: "ink",
      pointerFactor: 0.82,
      pulse: 2.8,
      pulseAmp: 0.18,
      scrollFactor: 300,
    },
    {
      template: "prism",
      scale: 78,
      depth: 780,
      offsetX: 0.4,
      offsetY: -0.32,
      spinX: -0.36,
      spinY: 0.62,
      spinZ: -0.4,
      drift: 0.56,
      tone: "cool",
      pointerFactor: 0.6,
      pulse: 3.2,
      pulseAmp: 0.12,
      scrollFactor: 180,
    },
    {
      template: "cube",
      scale: 62,
      depth: 840,
      offsetX: -0.44,
      offsetY: 0.08,
      spinX: 0.34,
      spinY: -0.74,
      spinZ: 0.28,
      drift: 0.63,
      tone: "accent",
      pointerFactor: 0.45,
      pulse: 3.8,
      pulseAmp: 0.16,
      scrollFactor: 150,
    },
    {
      template: "octa",
      scale: 70,
      depth: 940,
      offsetX: 0.05,
      offsetY: -0.38,
      spinX: -0.47,
      spinY: 0.5,
      spinZ: 0.36,
      drift: 0.54,
      tone: "cool",
      pointerFactor: 0.4,
      pulse: 2.6,
      pulseAmp: 0.12,
      scrollFactor: 110,
    },
    {
      template: "prism",
      scale: 56,
      depth: 1010,
      offsetX: 0.5,
      offsetY: 0.28,
      spinX: 0.42,
      spinY: 0.32,
      spinZ: -0.52,
      drift: 0.69,
      tone: "ink",
      pointerFactor: 0.38,
      pulse: 4.1,
      pulseAmp: 0.1,
      scrollFactor: 90,
    },
  ];

  const stars = [];
  const meshes = [];
  const comets = [];

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    centerX: 0,
    centerY: 0,
    focal: 700,
    time: 0,
    lastFrame: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    scrollProgress: 0,
    scrollVelocity: 0,
    lastScrollY: window.scrollY || 0,
    energy: 0.55,
    running: false,
    rafId: 0,
    palette: null,
    projectedStars: [],
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;

  const parseColor = (rawValue, fallback) => {
    const value = String(rawValue || "").trim();
    if (!value) return fallback;

    if (value.startsWith("#")) {
      const hex = value.slice(1);
      if (hex.length === 3) {
        const r = Number.parseInt(hex[0] + hex[0], 16);
        const g = Number.parseInt(hex[1] + hex[1], 16);
        const b = Number.parseInt(hex[2] + hex[2], 16);
        if ([r, g, b].every(Number.isFinite)) return { r, g, b };
      }

      if (hex.length === 6) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].every(Number.isFinite)) return { r, g, b };
      }
    }

    const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1]
        .split(",")
        .slice(0, 3)
        .map((part) => Number.parseFloat(part.trim()));
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        return {
          r: clamp(Math.round(parts[0]), 0, 255),
          g: clamp(Math.round(parts[1]), 0, 255),
          b: clamp(Math.round(parts[2]), 0, 255),
        };
      }
    }

    return fallback;
  };

  const toRgba = (color, alpha) =>
    `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;

  const readPalette = () => {
    const computed = getComputedStyle(root);
    return {
      accent: parseColor(computed.getPropertyValue("--accent"), { r: 43, g: 106, b: 121 }),
      cool: parseColor(computed.getPropertyValue("--accent-cool"), { r: 143, g: 181, b: 194 }),
      ink: parseColor(computed.getPropertyValue("--ink"), { r: 15, g: 26, b: 36 }),
      hot: parseColor(computed.getPropertyValue("--accent-strong"), { r: 31, g: 85, b: 98 }),
    };
  };

  const pickTone = (tone) => {
    if (tone === "cool") return state.palette.cool;
    if (tone === "ink") return state.palette.ink;
    if (tone === "hot") return state.palette.hot;
    return state.palette.accent;
  };

  const setHeroTilt = (x, y) => {
    if (!hero) return;
    hero.style.setProperty("--hero-tilt-x", `${x.toFixed(2)}deg`);
    hero.style.setProperty("--hero-tilt-y", `${y.toFixed(2)}deg`);
  };

  const updateScrollProgress = () => {
    const nextScrollY = window.scrollY;
    const delta = nextScrollY - state.lastScrollY;
    state.lastScrollY = nextScrollY;

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) {
      state.scrollProgress = 0;
    } else {
      state.scrollProgress = nextScrollY / scrollable - 0.5;
    }

    const normalizedDelta = delta / Math.max(window.innerHeight, 1);
    state.scrollVelocity = lerp(state.scrollVelocity, normalizedDelta, 0.22);
  };

  const resetStar = (star, zSeed = Math.random()) => {
    const spread = Math.max(state.width, state.height) * 1.9;
    star.x = (Math.random() - 0.5) * spread;
    star.y = (Math.random() - 0.5) * spread;
    star.z = 140 + zSeed * 2800;
    star.speed = 0.8 + Math.random() * 2.4;
    star.size = 0.5 + Math.random() * 1.8;
    star.twinkle = Math.random() * Math.PI * 2;
    star.parallax = 10 + Math.random() * 26;
    star.variant = Math.random();
  };

  const resetComet = (comet) => {
    const radius = Math.max(state.width, state.height) * (0.72 + Math.random() * 0.25);
    const angle = Math.random() * Math.PI * 2;

    comet.x = state.centerX + Math.cos(angle) * radius;
    comet.y = state.centerY + Math.sin(angle) * radius;

    const heading = angle + Math.PI + (Math.random() - 0.5) * 0.5;
    comet.vx = Math.cos(heading);
    comet.vy = Math.sin(heading);
    comet.speed = 200 + Math.random() * 520;
    comet.life = 0;
    comet.maxLife = 1.5 + Math.random() * 2.6;
    comet.z = 320 + Math.random() * 1200;
    comet.variant = Math.random();
  };

  const rebuildStars = () => {
    const viewportArea = state.width * state.height;
    const density = lowPowerDevice ? 7600 : 4100;

    let targetCount = Math.floor(viewportArea / density);
    if (isReducedMotion()) {
      targetCount = Math.floor(targetCount * 0.35);
    }

    const minStars = isReducedMotion() ? 48 : lowPowerDevice ? 90 : 150;
    const maxStars = isReducedMotion() ? 140 : lowPowerDevice ? 280 : 560;
    targetCount = clamp(targetCount, minStars, maxStars);

    stars.length = 0;
    for (let i = 0; i < targetCount; i += 1) {
      const star = {};
      resetStar(star, i / targetCount);
      stars.push(star);
    }
  };

  const rebuildMeshes = () => {
    meshes.length = 0;
    const limit = isReducedMotion() ? 3 : lowPowerDevice ? 5 : meshPresets.length;

    for (let i = 0; i < limit; i += 1) {
      const preset = meshPresets[i];
      meshes.push({
        ...preset,
        phase: Math.random() * Math.PI * 2,
      });
    }
  };

  const rebuildComets = () => {
    comets.length = 0;
    const cometCount = isReducedMotion() ? 0 : lowPowerDevice ? 2 : 5;

    for (let i = 0; i < cometCount; i += 1) {
      const comet = {};
      resetComet(comet);
      comets.push(comet);
    }
  };

  const rotatePoint = (point, ax, ay, az) => {
    const sinX = Math.sin(ax);
    const cosX = Math.cos(ax);
    const sinY = Math.sin(ay);
    const cosY = Math.cos(ay);
    const sinZ = Math.sin(az);
    const cosZ = Math.cos(az);

    let x = point.x;
    let y = point.y;
    let z = point.z;

    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;

    const x2 = x * cosY + z * sinY;
    const z2 = -x * sinY + z * cosY;
    x = x2;
    z = z2;

    const x3 = x * cosZ - y * sinZ;
    const y3 = x * sinZ + y * cosZ;

    return { x: x3, y: y3, z };
  };

  const projectPoint = (point) => {
    const depth = point.z + state.focal;
    if (depth <= 20) return null;

    const scale = state.focal / depth;
    return {
      x: state.centerX + point.x * scale,
      y: state.centerY + point.y * scale,
      scale,
      depth,
    };
  };

  const drawBackdrop = () => {
    const beat = 0.5 + Math.sin(state.time * 1.8) * 0.5;
    const energyMix = clamp(state.energy, 0.2, 1);
    const radius = Math.max(state.width, state.height) * 0.95;

    const coreGradient = context.createRadialGradient(
      state.centerX + state.mouseX * 180,
      state.centerY + state.mouseY * 160,
      Math.max(80, Math.min(state.width, state.height) * 0.06),
      state.centerX,
      state.centerY,
      radius
    );

    coreGradient.addColorStop(0, toRgba(state.palette.cool, 0.18 + energyMix * 0.12));
    coreGradient.addColorStop(0.35, toRgba(state.palette.accent, 0.14 + beat * 0.06));
    coreGradient.addColorStop(0.75, toRgba(state.palette.hot, 0.06));
    coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.fillStyle = coreGradient;
    context.fillRect(0, 0, state.width, state.height);

    const sweepGradient = context.createLinearGradient(
      0,
      state.height * (0.3 + state.scrollProgress * 0.2),
      state.width,
      state.height * (0.65 - state.scrollProgress * 0.2)
    );

    sweepGradient.addColorStop(0, toRgba(state.palette.accent, 0));
    sweepGradient.addColorStop(0.5, toRgba(state.palette.cool, 0.06 + beat * 0.08));
    sweepGradient.addColorStop(1, toRgba(state.palette.accent, 0));

    context.globalCompositeOperation = "lighter";
    context.fillStyle = sweepGradient;
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "source-over";
  };

  const drawStars = (deltaSeconds) => {
    state.projectedStars.length = 0;

    const speedBoost = 1 + state.energy * 0.75 + Math.abs(state.scrollVelocity) * 2.8;

    stars.forEach((star) => {
      star.z -= deltaSeconds * (220 + star.speed * 240) * speedBoost;
      if (star.z < 20) {
        resetStar(star, 1);
      }

      const scale = state.focal / (state.focal + star.z);
      const x = state.centerX + star.x * scale + state.mouseX * star.parallax;
      const y =
        state.centerY +
        star.y * scale +
        state.mouseY * star.parallax +
        state.scrollProgress * 120 * (1 - scale);

      if (x < -120 || x > state.width + 120 || y < -120 || y > state.height + 120) {
        resetStar(star, 1);
        return;
      }

      const size = clamp(star.size * scale * (3.4 + state.energy * 2.2), 0.2, 5.2);
      const flicker = 0.55 + Math.sin(state.time * 5.4 + star.twinkle) * 0.45;
      const color =
        star.variant > 0.66
          ? state.palette.cool
          : star.variant > 0.33
            ? state.palette.accent
            : state.palette.ink;

      const alpha = clamp((0.08 + scale * 1.45 + state.energy * 0.22) * flicker, 0.06, 0.98);

      context.fillStyle = toRgba(color, alpha);
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();

      if (size > 1.3) {
        const tail = size * (4 + state.energy * 10) * (0.6 + star.speed * 0.25);
        context.strokeStyle = toRgba(color, alpha * 0.44);
        context.lineWidth = clamp(0.6 + scale * 1.8, 0.6, 2.4);
        context.beginPath();
        context.moveTo(x, y + size * 0.4);
        context.lineTo(x, y + tail);
        context.stroke();
      }

      if (alpha > 0.22) {
        state.projectedStars.push({
          x,
          y,
          alpha,
          variant: star.variant,
        });
      }
    });
  };

  const drawStarLinks = () => {
    const points = state.projectedStars;
    if (points.length < 2) return;

    const maxDistance = 130;
    const maxDistanceSq = maxDistance * maxDistance;
    const count = Math.min(points.length, lowPowerDevice ? 70 : 150);

    for (let i = 0; i < count; i += 1) {
      const a = points[i];

      for (let j = i + 1; j < count && j <= i + 9; j += 1) {
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > maxDistanceSq) continue;

        const proximity = 1 - distSq / maxDistanceSq;
        const alpha = proximity * 0.22 * ((a.alpha + b.alpha) * 0.5) * (0.5 + state.energy * 0.7);
        if (alpha < 0.03) continue;

        const linkColor = (a.variant + b.variant) * 0.5 > 0.5 ? state.palette.cool : state.palette.accent;

        context.strokeStyle = toRgba(linkColor, alpha);
        context.lineWidth = 0.45 + proximity * 1.6;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  };

  const drawComets = (deltaSeconds) => {
    comets.forEach((comet) => {
      comet.life += deltaSeconds;
      comet.x += comet.vx * comet.speed * deltaSeconds * (1 + state.energy * 0.6);
      comet.y += comet.vy * comet.speed * deltaSeconds * (1 + state.energy * 0.6);
      comet.z -= deltaSeconds * (100 + state.energy * 180);

      if (
        comet.life > comet.maxLife ||
        comet.z < 30 ||
        comet.x < -220 ||
        comet.x > state.width + 220 ||
        comet.y < -220 ||
        comet.y > state.height + 220
      ) {
        resetComet(comet);
      }

      const scale = state.focal / (state.focal + comet.z);
      const x = state.centerX + (comet.x - state.centerX) * scale + state.mouseX * 16;
      const y = state.centerY + (comet.y - state.centerY) * scale + state.mouseY * 16;

      const length = (50 + comet.speed * 0.12) * scale * (0.6 + state.energy);
      const tx = x - comet.vx * length;
      const ty = y - comet.vy * length;

      const color = comet.variant > 0.5 ? state.palette.cool : state.palette.hot;
      const tail = context.createLinearGradient(x, y, tx, ty);
      tail.addColorStop(0, toRgba(color, 0.85));
      tail.addColorStop(0.45, toRgba(color, 0.35));
      tail.addColorStop(1, toRgba(color, 0));

      context.strokeStyle = tail;
      context.lineWidth = clamp(1.2 + scale * 4.2, 1.2, 4.8);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(tx, ty);
      context.stroke();

      context.fillStyle = toRgba(color, 0.86);
      context.beginPath();
      context.arc(x, y, clamp(1.1 + scale * 4.4, 1.1, 5.2), 0, Math.PI * 2);
      context.fill();
    });
  };

  const drawMesh = (mesh) => {
    const template = meshTemplates[mesh.template];
    if (!template) return;

    const pulse = 1 + Math.sin(state.time * mesh.pulse + mesh.phase) * mesh.pulseAmp + state.energy * 0.08;

    const angleX = state.time * mesh.spinX + mesh.phase;
    const angleY = state.time * mesh.spinY + mesh.phase * 0.7;
    const angleZ = state.time * mesh.spinZ + mesh.phase * 0.35;

    const offsetX =
      Math.sin(state.time * mesh.drift + mesh.phase) * state.width * mesh.offsetX +
      state.mouseX * 96 * mesh.pointerFactor;
    const offsetY =
      Math.cos(state.time * mesh.drift * 0.88 + mesh.phase) * state.height * mesh.offsetY +
      state.mouseY * 96 * mesh.pointerFactor;
    const offsetZ =
      mesh.depth +
      Math.sin(state.time * mesh.drift * 0.66 + mesh.phase) * 150 +
      state.scrollProgress * mesh.scrollFactor +
      state.scrollVelocity * 340;

    const projected = template.vertices.map((vertex) => {
      const rotated = rotatePoint(
        {
          x: vertex.x * mesh.scale * pulse,
          y: vertex.y * mesh.scale * pulse,
          z: vertex.z * mesh.scale * pulse,
        },
        angleX,
        angleY,
        angleZ
      );

      const worldPoint = {
        x: rotated.x + offsetX,
        y: rotated.y + offsetY,
        z: rotated.z + offsetZ,
      };

      return projectPoint(worldPoint);
    });

    const edgeColor = pickTone(mesh.tone);
    const vertexColor = mesh.tone === "ink" ? state.palette.cool : state.palette.hot;

    template.edges.forEach(([startIndex, endIndex]) => {
      const a = projected[startIndex];
      const b = projected[endIndex];
      if (!a || !b) return;

      const intensity = clamp((a.scale + b.scale) * 0.5 * 3.1 * (0.75 + state.energy), 0.18, 1);

      context.strokeStyle = toRgba(edgeColor, intensity * 0.32);
      context.lineWidth = clamp(1 + intensity * 3.6, 1, 3.4);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();

      context.strokeStyle = toRgba(edgeColor, intensity * 0.9);
      context.lineWidth = clamp(0.6 + intensity * 1.8, 0.6, 2.1);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    });

    projected.forEach((point) => {
      if (!point) return;

      const radius = clamp(1.2 + point.scale * 5.4, 1.2, 5.6);
      const alpha = clamp(0.28 + point.scale * 1.4 + state.energy * 0.25, 0.28, 1);
      context.fillStyle = toRgba(vertexColor, alpha);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });
  };

  const drawShockwave = () => {
    const cycle = (state.time * 0.12) % 1;
    const maxRadius = Math.max(state.width, state.height) * 0.92;
    const radius = cycle * maxRadius;
    const alpha = (1 - cycle) * 0.16 * (0.5 + state.energy * 0.8);

    if (alpha <= 0.01) return;

    context.strokeStyle = toRgba(state.palette.cool, alpha);
    context.lineWidth = 1.1 + state.energy * 2.6;
    context.beginPath();
    context.arc(
      state.centerX + state.mouseX * 90,
      state.centerY + state.mouseY * 72,
      radius,
      0,
      Math.PI * 2
    );
    context.stroke();
  };

  const drawVignette = () => {
    const vignette = context.createRadialGradient(
      state.centerX,
      state.centerY,
      Math.max(state.width, state.height) * 0.34,
      state.centerX,
      state.centerY,
      Math.max(state.width, state.height) * 0.92
    );

    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, toRgba(state.palette.ink, 0.22));

    context.fillStyle = vignette;
    context.fillRect(0, 0, state.width, state.height);
  };

  const render = (deltaSeconds) => {
    context.clearRect(0, 0, state.width, state.height);
    drawBackdrop();
    drawStars(deltaSeconds);

    if (!isReducedMotion()) {
      drawStarLinks();
    }

    drawComets(deltaSeconds);

    context.save();
    context.globalCompositeOperation = "lighter";
    meshes.forEach(drawMesh);
    drawShockwave();
    context.restore();

    drawVignette();
  };

  const setCanvasSize = () => {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    const nextDpr = Math.min(
      window.devicePixelRatio || 1,
      isLiteMode() ? 1 : lowPowerDevice ? 1.4 : 2
    );

    state.width = nextWidth;
    state.height = nextHeight;
    state.dpr = nextDpr;
    state.centerX = nextWidth / 2;
    state.centerY = nextHeight / 2;
    state.focal = clamp(nextWidth * 0.72, 460, 1080);

    canvas.width = Math.floor(nextWidth * nextDpr);
    canvas.height = Math.floor(nextHeight * nextDpr);
    context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);

    rebuildStars();
    rebuildMeshes();
    rebuildComets();
  };

  const stop = () => {
    if (!state.running) return;
    state.running = false;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  };

  const updateEnergyAndHeroTilt = () => {
    const beat = 0.5 + Math.sin(state.time * 2.4) * 0.5;
    const pointerEnergy = Math.hypot(state.targetMouseX, state.targetMouseY) * 0.42;
    const scrollEnergy = clamp(Math.abs(state.scrollVelocity) * 16, 0, 0.5);
    const targetEnergy = clamp(0.34 + beat * 0.26 + pointerEnergy + scrollEnergy, 0.28, 1);

    state.energy = lerp(state.energy, targetEnergy, 0.08);
    root.style.setProperty("--scene-energy", state.energy.toFixed(3));

    if (!hero || isReducedMotion()) {
      setHeroTilt(0, 0);
      return;
    }

    const autoTiltX = Math.sin(state.time * 0.7) * 2.4;
    const autoTiltY = Math.cos(state.time * 0.9) * 3.2;
    const pointerTiltX = -state.mouseY * 8.8;
    const pointerTiltY = state.mouseX * 11.5;
    const scrollRoll = state.scrollVelocity * 28;

    setHeroTilt(autoTiltX + pointerTiltX, autoTiltY + pointerTiltY + scrollRoll);
  };

  const frame = (timestamp) => {
    if (!state.running) return;

    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }

    const deltaMs = Math.min(timestamp - state.lastFrame, 42);
    state.lastFrame = timestamp;

    state.time += (deltaMs / 1000) * (0.95 + state.energy * 0.35);
    state.mouseX = lerp(state.mouseX, state.targetMouseX, 0.11);
    state.mouseY = lerp(state.mouseY, state.targetMouseY, 0.11);

    updateEnergyAndHeroTilt();
    render(deltaMs / 1000);

    state.rafId = window.requestAnimationFrame(frame);
  };

  const drawStaticFrame = () => {
    state.time += 0.006;
    state.energy = lerp(state.energy, 0.36, 0.2);
    root.style.setProperty("--scene-energy", state.energy.toFixed(3));
    setHeroTilt(0, 0);
    render(0.016);
  };

  const start = () => {
    if (state.running || isReducedMotion() || document.hidden) return;
    state.running = true;
    state.lastFrame = 0;
    state.rafId = window.requestAnimationFrame(frame);
  };

  const handlePointerMove = (event) => {
    if (!finePointerQuery.matches) return;

    const relativeX = event.clientX / Math.max(state.width, 1) - 0.5;
    const relativeY = event.clientY / Math.max(state.height, 1) - 0.5;

    state.targetMouseX = clamp(relativeX * 2, -1, 1);
    state.targetMouseY = clamp(relativeY * 2, -1, 1);
  };

  const handlePointerLeave = () => {
    state.targetMouseX = 0;
    state.targetMouseY = 0;
  };

  const handleHeroMove = (event) => {
    if (!hero || !finePointerQuery.matches || isReducedMotion()) return;

    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;

    state.targetMouseX = clamp(x * 1.8, -1, 1);
    state.targetMouseY = clamp(y * 1.8, -1, 1);
  };

  const handleHeroLeave = () => {
    state.targetMouseX = 0;
    state.targetMouseY = 0;
  };

  const attachMediaListener = (query, callback) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", callback);
      return;
    }

    if (typeof query.addListener === "function") {
      query.addListener(callback);
    }
  };

  state.palette = readPalette();
  updateScrollProgress();
  setCanvasSize();

  window.addEventListener("resize", () => {
    setCanvasSize();
    if (isReducedMotion()) {
      drawStaticFrame();
    }
  });

  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

  if (hero) {
    hero.addEventListener("pointermove", handleHeroMove, { passive: true });
    hero.addEventListener("pointerleave", handleHeroLeave);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      return;
    }

    if (isReducedMotion()) {
      drawStaticFrame();
      return;
    }

    start();
  });

  const onReducedMotionChange = () => {
    setCanvasSize();

    if (isReducedMotion()) {
      stop();
      drawStaticFrame();
      return;
    }

    start();
  };

  attachMediaListener(reducedMotionQuery, onReducedMotionChange);
  attachMediaListener(coarsePointerQuery, onReducedMotionChange);
  attachMediaListener(narrowViewportQuery, onReducedMotionChange);

  const onFinePointerChange = () => {
    if (!finePointerQuery.matches) {
      state.targetMouseX = 0;
      state.targetMouseY = 0;
      setHeroTilt(0, 0);
    }
  };

  attachMediaListener(finePointerQuery, onFinePointerChange);

  const themeObserver = new MutationObserver(() => {
    state.palette = readPalette();

    if (isReducedMotion()) {
      drawStaticFrame();
    }
  });

  themeObserver.observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  if (isReducedMotion()) {
    drawStaticFrame();
  } else {
    start();
  }
})();
