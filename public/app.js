document.documentElement.classList.add("js-ready");

const copyButton = document.querySelector("#copy-config");
const copyResult = document.querySelector("#copy-result");
const endpointText = document.querySelector("#config-code")?.textContent?.trim() ?? "";

async function copyEndpoint() {
  let copied = false;

  try {
    await navigator.clipboard.writeText(endpointText);
    copied = true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = endpointText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    copied = document.execCommand("copy");
    textarea.remove();
  }

  copyButton?.removeAttribute("data-copied");
  copyButton?.removeAttribute("data-failed");

  if (copied) {
    copyButton?.setAttribute("data-copied", "true");
    copyButton.textContent = "コピー済み ✓";
    copyResult.textContent =
      "コピーしました。次に接続手順を開いて、MCP設定へ追加してください。";
    return;
  }

  copyButton?.setAttribute("data-failed", "true");
  copyButton.textContent = "コピーできません";
  copyResult.textContent = "URLを選択して手動でコピーしてください。";
}

copyButton?.addEventListener("click", copyEndpoint);

const serviceStatus = document.querySelector(".service-status");
const liveStatus = document.querySelector("#live-status");
const metricTools = document.querySelector("#metric-tools");

fetch("/health", { headers: { Accept: "application/json" } })
  .then((response) => {
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  })
  .then((health) => {
    liveStatus.textContent = `稼働中 · ${health.tools.length} tools · v${health.version}`;
    metricTools.textContent = String(health.tools.length);
  })
  .catch(() => {
    serviceStatus?.classList.add("is-offline");
    liveStatus.textContent = "状態を確認できません";
  });

const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  for (const item of revealItems) revealObserver.observe(item);
} else {
  for (const item of revealItems) item.classList.add("is-visible");
}
