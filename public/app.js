const configText = `{
  "mcpServers": {
    "public-data-catalog": {
      "url": "https://public-data-catalog-mcp.yusuke8h.workers.dev/mcp"
    }
  }
}`;

const copyButton = document.querySelector("#copy-config");
const copyResult = document.querySelector("#copy-result");

async function copyConfig() {
  try {
    await navigator.clipboard.writeText(configText);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = configText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  copyButton.textContent = "COPIED";
  copyResult.textContent = "Endpoint copied to clipboard.";
  window.setTimeout(() => {
    copyButton.textContent = "COPY";
    copyResult.textContent = "";
  }, 2400);
}

copyButton?.addEventListener("click", copyConfig);

const liveIndicator = document.querySelector(".live-indicator");
const liveStatus = document.querySelector("#live-status");

fetch("/health", { headers: { Accept: "application/json" } })
  .then((response) => {
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  })
  .then((health) => {
    liveStatus.textContent = `${health.status.toUpperCase()} · ${health.tools.length} TOOLS · v${health.version}`;
  })
  .catch(() => {
    liveIndicator?.classList.add("is-offline");
    liveStatus.textContent = "STATUS UNAVAILABLE";
  });

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.14 },
);

for (const element of document.querySelectorAll(".reveal")) {
  revealObserver.observe(element);
}

function createRouteField(canvas, darkOnLight = false) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let frame = 0;
  let animationId = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const convergeX = width * 0.58;
    const convergeY = height * 0.69;
    const base = darkOnLight ? "11, 13, 13" : "239, 234, 222";
    const signal = darkOnLight ? "#0b0d0d" : "#b8ff3d";

    for (let index = 0; index < 26; index += 1) {
      const startY = height * (0.35 + (index / 26) * 0.62);
      const offset = Math.sin(frame * 0.004 + index * 0.82) * 12;
      context.beginPath();
      context.moveTo(-20, startY);
      context.bezierCurveTo(
        width * 0.22,
        startY + Math.sin(index * 1.7) * 70 + offset,
        width * 0.42,
        convergeY + (index - 13) * 7,
        convergeX,
        convergeY + ((index % 3) - 1) * 52,
      );
      context.strokeStyle = `rgba(${base}, ${darkOnLight ? 0.18 : 0.13})`;
      context.lineWidth = index % 5 === 0 ? 1.1 : 0.65;
      context.stroke();
    }

    context.beginPath();
    context.moveTo(convergeX, convergeY);
    context.bezierCurveTo(
      width * 0.72,
      convergeY - height * 0.08,
      width * 0.84,
      convergeY + height * 0.03,
      width + 30,
      convergeY - height * 0.04,
    );
    context.strokeStyle = signal;
    context.lineWidth = darkOnLight ? 1.4 : 2.2;
    context.stroke();

    for (let index = 0; index < 3; index += 1) {
      const y = convergeY + (index - 1) * 52;
      const pulse = reducedMotion ? 0 : Math.sin(frame * 0.025 + index) * 2;
      context.beginPath();
      context.arc(convergeX, y, 5 + pulse, 0, Math.PI * 2);
      context.fillStyle = signal;
      context.fill();
      context.beginPath();
      context.arc(convergeX, y, 16 + pulse, 0, Math.PI * 2);
      context.strokeStyle = darkOnLight ? "rgba(11,13,13,.35)" : "rgba(184,255,61,.34)";
      context.lineWidth = 1;
      context.stroke();
    }

    frame += 1;
    if (!reducedMotion) animationId = requestAnimationFrame(draw);
  }

  resize();
  draw();
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(animationId);
    resize();
    draw();
  });
  resizeObserver.observe(canvas);
}

createRouteField(document.querySelector("#route-field"));
createRouteField(document.querySelector("#closing-field"), true);
