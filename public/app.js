const researchForm = document.querySelector("#research");
const topicSelect = document.querySelector("#research-topic");
const yearField = document.querySelector("#year-field");
const yearSelect = document.querySelector("#research-year");
const topicNote = document.querySelector("#topic-note");
const researchSubmit = document.querySelector("#research-submit");
const formMessage = document.querySelector("#form-message");
const resultSection = document.querySelector("#research-result");
const resultQuestion = document.querySelector("#result-question");
const resultValues = document.querySelector("#result-values");
const resultTime = document.querySelector("#result-time");
const resultSource = document.querySelector("#result-source");
const resultLicense = document.querySelector("#result-license");
const resultChecks = document.querySelector("#result-checks");
const resultMethod = document.querySelector("#result-method");
const resultDetails = document.querySelector("#result-details");
const resultNotes = document.querySelector("#result-notes");
const resultRequest = document.querySelector("#result-request");
const copyResearchButton = document.querySelector("#copy-research");
const copyResearchStatus = document.querySelector("#copy-research-status");

const topicInformation = {
  "tokyo-population": {
    hasYear: true,
    note: "総務省統計局の統計ダッシュボードから、東京都の年次総人口を取得します。",
  },
  "japan-unemployment": {
    hasYear: false,
    note: "総務省統計局の統計ダッシュボードから、2023年の完全失業率（男女計）を取得します。",
  },
  "world-bank-japan-population": {
    hasYear: false,
    note: "世界銀行のIndicators APIから、2023年の日本の総人口を取得します。",
  },
  "noto-earthquake": {
    hasYear: false,
    note: "アメリカ地質調査所の地震カタログから、能登半島地震の記録を取得します。",
  },
  "egov-population-dataset": {
    hasYear: false,
    note: "e-Govデータポータルから、人口に関する公開データセットの情報を取得します。",
  },
};

let latestResearch = null;

function updateTopic() {
  const information = topicInformation[topicSelect?.value];
  if (!information) return;
  yearField.hidden = !information.hasYear;
  yearSelect.disabled = !information.hasYear;
  topicNote.textContent = information.note;
}

function formatValue(value) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value);
  }
  if (value === null || value === undefined) return "—";
  return String(value);
}

function formatFieldValue(field) {
  if (field.id === "occurred-at" && typeof field.value === "string") {
    const date = new Date(field.value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Tokyo",
      }).format(date);
    }
  }
  return formatValue(field.value);
}

function displayUnit(field) {
  return field.id === "occurred-at" ? "日本時間" : field.unit;
}

function formatRetrievedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function appendValue(container, field, index) {
  const item = document.createElement("div");
  item.className = "result-value";
  const formatted = formatFieldValue(field);
  if (index === 0 && (typeof field.value === "number" || formatted.length <= 18)) {
    item.classList.add("is-main");
  }

  const label = document.createElement("span");
  label.textContent = field.label.ja;
  const value = document.createElement("strong");
  value.append(document.createTextNode(formatted));
  const shownUnit = displayUnit(field);
  if (shownUnit) {
    const unit = document.createElement("small");
    unit.textContent = shownUnit;
    value.append(unit);
  }
  item.append(label, value);
  container.append(item);
}

function appendDetail(container, field) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const definition = document.createElement("dd");
  term.textContent = field.label.ja;

  const formatted = formatFieldValue(field);
  if (typeof field.value === "string" && /^https:\/\//u.test(field.value)) {
    const link = document.createElement("a");
    link.href = field.value;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "公式データを開く ↗";
    definition.append(link);
  } else {
    const shownUnit = displayUnit(field);
    definition.textContent = `${formatted}${shownUnit ? ` ${shownUnit}` : ""}`;
  }
  row.append(term, definition);
  container.append(row);
}

function renderResearch(research) {
  latestResearch = research;
  resultQuestion.textContent = research.question;
  resultValues.replaceChildren();
  research.primary.forEach((field, index) => appendValue(resultValues, field, index));

  resultTime.textContent = `取得日時：${formatRetrievedAt(research.retrieved_at)}（日本時間）`;
  resultSource.href = research.source.url;
  resultSource.textContent = `${research.source.credit} ↗`;
  resultLicense.href = research.source.license_url;
  resultChecks.textContent = `取得内容 ${research.verification.source_checks}項目・記録 ${research.verification.integrity_checks}項目を確認済み`;
  resultMethod.textContent = `${research.method.recipe_id} / v${research.method.contract_version}`;
  resultRequest.href = research.source.request_url;

  resultDetails.replaceChildren();
  if (research.details.length === 0) {
    const empty = document.createElement("div");
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = "追加情報";
    definition.textContent = "ありません";
    empty.append(term, definition);
    resultDetails.append(empty);
  } else {
    research.details.forEach((field) => appendDetail(resultDetails, field));
  }

  resultNotes.replaceChildren();
  research.notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    resultNotes.append(item);
  });

  resultSection.hidden = false;
  copyResearchStatus.textContent = "";
  requestAnimationFrame(() => {
    resultQuestion.focus({ preventScroll: true });
    resultSection.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  });
}

async function runResearch(event) {
  event.preventDefault();
  const information = topicInformation[topicSelect.value];
  if (!information) return;

  researchSubmit.disabled = true;
  researchSubmit.classList.add("is-loading");
  researchSubmit.querySelector("span").textContent = "公式データを確認中";
  formMessage.classList.remove("is-error");
  formMessage.textContent = "公式サイトから取得し、答えと根拠を確認しています。";

  const request = { topic: topicSelect.value };
  if (information.hasYear) request.year = Number(yearSelect.value);

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "調査に失敗しました。");
    renderResearch(payload);
    formMessage.textContent = "調査が完了しました。結果と根拠を表示しています。";
  } catch (error) {
    formMessage.classList.add("is-error");
    formMessage.textContent =
      error instanceof Error
        ? error.message
        : "公式データを取得できませんでした。時間をおいて再度お試しください。";
  } finally {
    researchSubmit.disabled = false;
    researchSubmit.classList.remove("is-loading");
    researchSubmit.querySelector("span").textContent = "公式データを調べる";
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function researchMemo(research) {
  const values = [...research.primary, ...research.details]
    .map(
      (field) =>
        `- ${field.label.ja}: ${formatFieldValue(field)}${displayUnit(field) ? ` ${displayUnit(field)}` : ""}`,
    )
    .join("\n");
  const notes = research.notes.map((note) => `- ${note}`).join("\n");
  return `${research.question}\n\n結果\n${values}\n\n出典\n${research.source.credit}\n${research.source.url}\n\n利用条件\n${research.source.license_url}\n\n取得日時\n${formatRetrievedAt(research.retrieved_at)}（日本時間）\n\n確認結果\n取得内容 ${research.verification.source_checks}項目・記録 ${research.verification.integrity_checks}項目を確認済み\n\n読むときの注意\n${notes}\n\nPDC 根拠付き公的統計リサーチ\nhttps://pdc.yhay81.com/`;
}

copyResearchButton?.addEventListener("click", async () => {
  if (!latestResearch) return;
  const copied = await copyText(researchMemo(latestResearch));
  copyResearchStatus.textContent = copied ? "コピーしました ✓" : "コピーできませんでした";
});

topicSelect?.addEventListener("change", updateTopic);
researchForm?.addEventListener("submit", runResearch);
updateTopic();

document.querySelectorAll("[data-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    const topic = button.dataset.topic;
    if (!topic || !topicInformation[topic]) return;
    topicSelect.value = topic;
    updateTopic();
    researchForm.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    topicSelect.focus({ preventScroll: true });
  });
});

const copyButton = document.querySelector("#copy-config");
const copyResult = document.querySelector("#copy-result");
const endpointText = document.querySelector("#config-code")?.textContent?.trim() ?? "";

copyButton?.addEventListener("click", async () => {
  const copied = await copyText(endpointText);
  copyButton.removeAttribute("data-copied");
  copyButton.removeAttribute("data-failed");
  if (copied) {
    copyButton.setAttribute("data-copied", "true");
    copyButton.textContent = "コピー済み ✓";
    copyResult.textContent = "コピーしました。AIツールのMCP設定へ追加してください。";
  } else {
    copyButton.setAttribute("data-failed", "true");
    copyButton.textContent = "コピーできません";
    copyResult.textContent = "URLを選択して手動でコピーしてください。";
  }
});

const serviceStatus = document.querySelector(".service-status");
const liveStatus = document.querySelector("#live-status");

fetch("/health", { headers: { Accept: "application/json" } })
  .then((response) => {
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  })
  .then((health) => {
    liveStatus.textContent = `稼働中 · ${health.research_topics}種類の調査`;
  })
  .catch(() => {
    serviceStatus?.classList.add("is-offline");
    liveStatus.textContent = "状態を確認できません";
  });
