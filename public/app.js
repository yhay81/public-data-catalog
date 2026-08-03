const searchForm = document.querySelector("#search");
const searchInput = document.querySelector("#search-query");
const searchSubmit = document.querySelector("#search-submit");
const searchMessage = document.querySelector("#search-message");
const resultsSection = document.querySelector("#results");
const resultsTitle = document.querySelector("#results-title");
const resultsSummary = document.querySelector("#results-summary");
const sourceStatus = document.querySelector("#source-status");
const resultList = document.querySelector("#result-list");
const resultNote = document.querySelector("#result-note");
const emptyResult = document.querySelector("#empty-result");
const filterButtons = [...document.querySelectorAll("[data-kind]")];

let latestSearch = null;
let activeKind = "all";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function createMeta(label, value) {
  const item = document.createElement("div");
  const term = document.createElement("dt");
  const definition = document.createElement("dd");
  term.textContent = label;
  definition.textContent = value || "記載なし";
  item.append(term, definition);
  return item;
}

function createResult(result, index) {
  const item = document.createElement("li");
  item.className = "result-item";
  item.dataset.kind = result.kind;
  item.style.setProperty("--result-index", index);

  const side = document.createElement("div");
  side.className = "result-side";
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const kind = document.createElement("strong");
  kind.textContent = result.kind_label;
  const source = document.createElement("small");
  source.textContent = result.source.label;
  side.append(number, kind, source);

  const main = document.createElement("article");
  const heading = document.createElement("div");
  heading.className = "result-title-row";
  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = result.url;
  titleLink.target = "_blank";
  titleLink.rel = "noreferrer";
  titleLink.textContent = result.title;
  title.append(titleLink);
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  heading.append(title, arrow);

  const description = document.createElement("p");
  description.className = "result-description";
  description.textContent = result.description;

  const reasons = document.createElement("ul");
  reasons.className = "result-reasons";
  for (const reason of result.reasons ?? []) {
    const reasonItem = document.createElement("li");
    reasonItem.textContent = reason;
    reasons.append(reasonItem);
  }

  const metadata = document.createElement("dl");
  metadata.className = "result-meta";
  metadata.append(createMeta("提供元", result.publisher));
  metadata.append(
    createMeta("形式", result.formats?.length ? result.formats.join(" / ") : "公式ページで確認"),
  );
  if (result.coverage) metadata.append(createMeta("対象", result.coverage));
  if (result.metadata_updated) {
    metadata.append(createMeta("メタデータ更新", formatDate(result.metadata_updated)));
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const detailLink = document.createElement("a");
  detailLink.href = result.url;
  detailLink.target = "_blank";
  detailLink.rel = "noreferrer";
  detailLink.textContent = "公式の詳細を見る ↗";
  actions.append(detailLink);
  if (result.resource_url && result.resource_url !== result.url) {
    const resourceLink = document.createElement("a");
    resourceLink.href = result.resource_url;
    resourceLink.target = "_blank";
    resourceLink.rel = "noreferrer";
    resourceLink.textContent = "データを開く ↗";
    actions.append(resourceLink);
  }
  const licenseLink = document.createElement("a");
  licenseLink.href = result.license.url;
  licenseLink.target = "_blank";
  licenseLink.rel = "noreferrer";
  licenseLink.textContent = "利用条件 ↗";
  actions.append(licenseLink);

  main.append(heading, description, reasons, metadata, actions);
  item.append(side, main);
  return item;
}

function filteredResults() {
  if (!latestSearch) return [];
  if (activeKind === "all") return latestSearch.results;
  return latestSearch.results.filter((result) => result.kind === activeKind);
}

function renderResultList() {
  const results = filteredResults();
  resultList.replaceChildren(...results.map(createResult));
  emptyResult.hidden = results.length > 0;
}

function renderSourceStatus(sources) {
  const successful = sources.filter((source) => source.status === "ok");
  const failed = sources.filter((source) => source.status === "error");
  const checked = successful.map((source) => source.label).join("、");
  sourceStatus.textContent = failed.length
    ? `${checked}を検索しました。${failed.map((source) => source.label).join("、")}は一時的に検索できませんでした。`
    : `${checked}の公式メタデータを検索しました。`;
  sourceStatus.classList.toggle("has-warning", failed.length > 0);
}

function renderSearch(payload) {
  latestSearch = payload;
  activeKind = "all";
  for (const button of filterButtons) {
    const kindCount =
      button.dataset.kind === "all"
        ? payload.results.length
        : payload.results.filter((result) => result.kind === button.dataset.kind).length;
    button.disabled = kindCount === 0;
    button.setAttribute("aria-pressed", String(button.dataset.kind === "all"));
  }
  resultsTitle.textContent = `「${payload.query}」の候補`;
  resultsSummary.textContent = payload.total
    ? `内容と形式を比べやすい順に、${payload.total}件を表示しています。`
    : "公式サイトを検索しましたが、表示できる候補はありませんでした。";
  renderSourceStatus(payload.sources);
  resultNote.textContent = payload.note;
  resultsSection.hidden = false;
  renderResultList();
}

function setSearching(searching) {
  searchSubmit.disabled = searching;
  searchInput.disabled = searching;
  searchSubmit.classList.toggle("is-loading", searching);
  searchSubmit.querySelector("span").textContent = searching ? "検索中" : "データを探す";
}

async function runSearch(event, options = {}) {
  event?.preventDefault();
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchMessage.classList.add("is-error");
    searchMessage.textContent = "検索する言葉を2文字以上入力してください。";
    searchInput.focus();
    return;
  }

  setSearching(true);
  searchMessage.classList.remove("is-error");
  searchMessage.textContent = "2つの公式サイトを検索し、候補を整理しています。";

  try {
    const parameters = new URLSearchParams({ q: query, limit: "6" });
    const response = await fetch(`/api/search?${parameters.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "検索できませんでした。");
    renderSearch(payload);
    searchMessage.textContent = "検索が完了しました。候補を比べて、公式ページで内容を確認してください。";
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("q", query);
    pageUrl.hash = "results";
    window.history.replaceState(null, "", pageUrl);
    if (!options.skipScroll) {
      requestAnimationFrame(() => {
        resultsTitle.focus({ preventScroll: true });
        resultsSection.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
    }
  } catch (error) {
    searchMessage.classList.add("is-error");
    searchMessage.textContent =
      error instanceof Error
        ? error.message
        : "公式サイトを検索できませんでした。時間をおいて再度お試しください。";
  } finally {
    setSearching(false);
  }
}

searchForm?.addEventListener("submit", runSearch);

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    searchForm.requestSubmit();
  });
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeKind = button.dataset.kind;
    for (const candidate of filterButtons) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    renderResultList();
  });
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

const copyButton = document.querySelector("#copy-config");
const copyResult = document.querySelector("#copy-result");
const endpointText = document.querySelector("#config-code")?.textContent?.trim() ?? "";

copyButton?.addEventListener("click", async () => {
  const copied = await copyText(endpointText);
  copyButton.textContent = copied ? "コピー済み ✓" : "コピーできません";
  copyButton.dataset.state = copied ? "copied" : "failed";
  copyResult.textContent = copied
    ? "コピーしました。AIツールのMCP設定に追加してください。"
    : "URLを選択して手動でコピーしてください。";
});

const serviceLine = document.querySelector(".service-line");
const liveStatus = document.querySelector("#live-status");

fetch("/health", { headers: { Accept: "application/json" } })
  .then((response) => {
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  })
  .then((health) => {
    liveStatus.textContent = `稼働中・${health.search_sources ?? 2}つの公式サイトを検索`;
  })
  .catch(() => {
    serviceLine?.classList.add("is-offline");
    liveStatus.textContent = "接続状態を確認できません";
  });

const initialQuery = new URL(window.location.href).searchParams.get("q")?.trim();
if (initialQuery && initialQuery.length >= 2) {
  searchInput.value = initialQuery;
  runSearch(undefined, { skipScroll: true });
}
