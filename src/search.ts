export type PublicDataKind = "all" | "dataset" | "statistics";

export type PublicDataSearchInput = {
  query: string;
  kind?: PublicDataKind;
  limit?: number;
};

export type PublicDataSearchResult = {
  id: string;
  kind: Exclude<PublicDataKind, "all">;
  kind_label: string;
  title: string;
  description: string;
  publisher: string;
  source: {
    id: string;
    label: string;
    url: string;
  };
  url: string;
  resource_url?: string;
  formats: string[];
  coverage?: string;
  metadata_updated?: string;
  license: {
    label: string;
    url: string;
  };
  reasons: string[];
  score: number;
};

type SourceStatus = {
  id: string;
  label: string;
  status: "ok" | "error";
  matched: number;
  examined: number;
};

type SourceSearchOutcome = {
  source: "egov" | "dashboard";
  results: PublicDataSearchResult[];
  matched: number;
  examined: number;
};

type EgDataResource = {
  format?: unknown;
  url?: unknown;
  description?: unknown;
  last_modified_date?: unknown;
  license_id?: unknown;
};

type EgDataset = {
  name?: unknown;
  title?: unknown;
  notes?: unknown;
  organization?: { title?: unknown };
  publisher?: unknown;
  tags?: Array<{ name?: unknown }>;
  groups?: Array<{ display_name?: unknown }>;
  resources?: EgDataResource[];
  metadata_modified?: unknown;
  frequency_of_update?: unknown;
  temporal?: unknown;
  spatial?: unknown;
  license_title?: unknown;
  license_url?: unknown;
};

type IndicatorClass = {
  "@name"?: unknown;
  "@sname"?: unknown;
  "@fromDate"?: unknown;
  "@toDate"?: unknown;
  "@statName"?: unknown;
  "@unit"?: unknown;
  cycle?: { "@code"?: unknown; "@name"?: unknown };
  RegionalRank?: { "@code"?: unknown; "@name"?: unknown };
  IsSeasonal?: { "@code"?: unknown; "@name"?: unknown };
};

type IndicatorObject = {
  "@name"?: unknown;
  "@code"?: unknown;
  details?: {
    detail?: Array<{ "$"?: unknown; "@name"?: unknown }> | { "$"?: unknown; "@name"?: unknown };
  };
  CLASS?: IndicatorClass[] | IndicatorClass;
};

const EGOV_SEARCH_URL = "https://data.e-gov.go.jp/data/api/action/package_search";
const EGOV_PORTAL_URL = "https://data.e-gov.go.jp/data/ja/dataset/";
const EGOV_SOURCE_URL = "https://data.e-gov.go.jp/data/ja/dataset";
const EGOV_TERMS_URL = "https://data.e-gov.go.jp/info/ja/terms";
const DASHBOARD_SEARCH_URL =
  "https://dashboard.e-stat.go.jp/api/1.0/Json/getIndicatorInfo";
const DASHBOARD_SOURCE_URL = "https://dashboard.e-stat.go.jp/";
const DASHBOARD_TERMS_URL = "https://dashboard.e-stat.go.jp/static/terms";
const EGOV_STRUCTURED_FILTER = "res_format:(CSV OR XLS OR XLSX OR JSON OR XML OR ZIP)";
const STRUCTURED_FORMATS = new Set([
  "API",
  "CSV",
  "GEOJSON",
  "JSON",
  "ODS",
  "TSV",
  "XLS",
  "XLSX",
  "XML",
  "ZIP",
]);
const DOCUMENT_FORMATS = new Set(["DOC", "DOCX", "HTML", "PDF", "PPT", "PPTX"]);
const QUERY_FILLER = [
  "データセット",
  "オープンデータ",
  "について知りたい",
  "について調べたい",
  "を調べたい",
  "を探したい",
  "を探す",
  "が欲しい",
  "が知りたい",
  "教えて",
  "データ",
  "統計",
  "推移",
  "一覧",
  "件数",
  "情報",
];
const INDICATOR_KEYWORDS: Array<[RegExp, string]> = [
  [/人口/u, "人口"],
  [/失業|雇用/u, "完全失業率"],
  [/物価|インフレ/u, "消費者物価指数"],
  [/賃金|給与/u, "賃金"],
  [/国内総生産|\bGDP\b/iu, "国内総生産"],
  [/空き家/u, "空き家"],
  [/観光/u, "観光"],
  [/学校|児童|生徒/u, "学校"],
  [/医療|病院/u, "医療"],
  [/交通事故|事故/u, "事故"],
  [/住宅/u, "住宅"],
  [/出生/u, "出生"],
  [/死亡/u, "死亡"],
];
const OFFICIAL_QUERY_ALIASES: Array<[RegExp, string[]]> = [
  [/観光客|旅行客|宿泊客/u, ["延べ宿泊者数"]],
  [/犯罪(?:件数|率)?|刑法犯/u, ["刑法犯認知件数"]],
  [/市区町村.*所得|地域.*所得/u, ["課税対象所得"]],
  [/(?:CO2|ＣＯ２|二酸化炭素).*排出/iu, ["二酸化炭素排出量", "温室効果ガス排出"]],
  [/病院数/u, ["病院数"]],
  [/学校数/u, ["学校数"]],
];

export class PublicDataSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicDataSearchInputError";
  }
}

export class PublicDataSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicDataSearchError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpsUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/gu, " ").trim();
}

function cleanDescription(value: unknown, maximum = 180): string {
  const cleaned = text(value)
    .replace(/^"|"$/gu, "")
    .replace(/\\?\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (cleaned.length <= maximum) return cleaned;
  return `${cleaned.slice(0, maximum).trimEnd()}…`;
}

function extractTerms(query: string): string[] {
  let candidate = normalized(query).replace(/[?？!！、。,.・/／()[\]{}「」『』]/gu, " ");
  for (const filler of QUERY_FILLER) candidate = candidate.replaceAll(filler, " ");
  const terms = candidate
    .split(/\s+|(?:について|に関する|で見る|の|を|が|は)/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 5);
  return terms.length > 0 ? [...new Set(terms)] : [normalized(query)];
}

function indicatorKeyword(query: string, terms: string[]): string {
  for (const [pattern, replacement] of INDICATOR_KEYWORDS) {
    if (pattern.test(query)) return replacement;
  }
  return [...terms].sort((left, right) => right.length - left.length)[0] ?? query;
}

function createQueryPlan(query: string, terms: string[]) {
  const interpretedAs = OFFICIAL_QUERY_ALIASES.flatMap(([pattern, aliases]) =>
    pattern.test(query) ? aliases : [],
  );
  const baseKeyword = indicatorKeyword(query, terms);
  const keywords = uniqueStrings([...interpretedAs, baseKeyword]).slice(0, 2);
  const scoreTerms = uniqueStrings([
    ...terms,
    ...keywords.flatMap((keyword) => extractTerms(keyword)),
  ]);
  return {
    keywords,
    scoreTerms,
    interpretedAs: interpretedAs.filter(
      (alias) => normalized(alias) !== normalized(query),
    ),
  };
}

function validateInput(input: PublicDataSearchInput) {
  if (input === null || typeof input !== "object") {
    throw new PublicDataSearchInputError("検索する言葉を入力してください。");
  }
  const query = text(input.query).normalize("NFKC");
  if (query.length < 2) {
    throw new PublicDataSearchInputError("検索する言葉を2文字以上入力してください。");
  }
  if (query.length > 80) {
    throw new PublicDataSearchInputError("検索する言葉は80文字以内にしてください。");
  }
  const kind = input.kind ?? "all";
  if (!(["all", "dataset", "statistics"] as const).includes(kind)) {
    throw new PublicDataSearchInputError("検索対象が正しくありません。");
  }
  const limit = input.limit ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new PublicDataSearchInputError("表示件数は1件から20件までです。");
  }
  return { query, kind, limit, terms: extractTerms(query) };
}

async function fetchJson(
  url: URL,
  fetchImpl: typeof fetch,
  maximumBytes: number,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PDC-public-data-search/0.6.0",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase().includes("json")) {
    throw new Error("Upstream did not return JSON");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maximumBytes) throw new Error("Upstream response was too large");
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    throw new Error("Upstream response was too large");
  }
  return JSON.parse(body) as unknown;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(text).filter(Boolean))];
}

function formatCodeDate(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  if (raw.startsWith("9999")) return "現在";
  const annual = /^(\d{4})(?:CY|FY)00$/u.exec(raw);
  if (annual) return `${annual[1]}年`;
  const monthly = /^(\d{4})(\d{2})00$/u.exec(raw);
  if (monthly) return `${monthly[1]}年${Number(monthly[2])}月`;
  return raw.slice(0, 4) ? `${raw.slice(0, 4)}年` : undefined;
}

function datasetScore(dataset: EgDataset, terms: string[], formats: string[]): number {
  const title = normalized(text(dataset.title));
  const tags = normalized(uniqueStrings((dataset.tags ?? []).map((tag) => tag.name)).join(" "));
  const groups = normalized(
    uniqueStrings((dataset.groups ?? []).map((group) => group.display_name)).join(" "),
  );
  const notes = normalized(text(dataset.notes));
  const all = `${title} ${tags} ${groups} ${notes}`;
  let score = 0;
  for (const term of terms.map(normalized)) {
    if (title.includes(term)) score += 32;
    else if (tags.includes(term)) score += 18;
    else if (notes.includes(term)) score += 8;
    else if (groups.includes(term)) score += 5;
  }
  if (terms.some((term) => all.includes(normalized(term)))) score += 12;
  if (formats.some((format) => STRUCTURED_FORMATS.has(format))) score += 16;
  if (formats.length === 0) score -= 24;
  if (formats.length > 0 && formats.every((format) => DOCUMENT_FORMATS.has(format))) score -= 12;
  if (/白書|年次報告|discussion paper|報告書/iu.test(title)) score -= 14;
  if (notes.length >= 40) score += 4;
  return score;
}

function bestResource(resources: EgDataResource[]): EgDataResource | undefined {
  return [...resources].sort((left, right) => {
    const leftFormat = text(left.format).toLocaleUpperCase();
    const rightFormat = text(right.format).toLocaleUpperCase();
    const leftScore = STRUCTURED_FORMATS.has(leftFormat) ? 2 : text(left.url) ? 1 : 0;
    const rightScore = STRUCTURED_FORMATS.has(rightFormat) ? 2 : text(right.url) ? 1 : 0;
    return rightScore - leftScore;
  })[0];
}

function normalizeEgovResults(payload: unknown, terms: string[]): PublicDataSearchResult[] {
  const root = asObject(payload);
  const result = asObject(root?.result);
  const rawResults = Array.isArray(result?.results) ? result.results : [];
  return rawResults
    .map((raw): PublicDataSearchResult | undefined => {
      const dataset = asObject(raw) as EgDataset | undefined;
      if (!dataset) return undefined;
      const name = text(dataset.name);
      const title = text(dataset.title);
      if (!name || !title) return undefined;
      const resources = Array.isArray(dataset.resources) ? dataset.resources : [];
      const formats = uniqueStrings(resources.map((resource) => resource.format)).map((format) =>
        format.toLocaleUpperCase(),
      );
      const chosenResource = bestResource(resources);
      const publisher = text(dataset.organization?.title) || text(dataset.publisher) || "政府機関";
      const description =
        cleanDescription(dataset.notes) ||
        cleanDescription(chosenResource?.description) ||
        "公式カタログに登録された公開データです。内容は詳細ページで確認できます。";
      const hasStructured = formats.some((format) => STRUCTURED_FORMATS.has(format));
      const score = datasetScore(dataset, terms, formats);
      const reasons = [
        hasStructured ? "表計算やプログラムで使える形式があります" : "公式ページで内容を確認できます",
      ];
      const normalizedTitle = normalized(title);
      if (terms.some((term) => normalizedTitle.includes(normalized(term)))) {
        reasons.unshift("検索語または対応する公式用語がタイトルに含まれています");
      }
      const temporal = text(dataset.temporal);
      const spatial = text(dataset.spatial);
      const frequency = text(dataset.frequency_of_update);
      const coverageParts = [temporal, spatial, frequency ? `更新頻度 ${frequency}` : ""].filter(Boolean);
      const resourceUrl = safeHttpsUrl(chosenResource?.url);
      const licenseUrl = safeHttpsUrl(dataset.license_url);
      return {
        id: `egov:${name}`,
        kind: "dataset",
        kind_label: "公開データセット",
        title,
        description,
        publisher,
        source: {
          id: "egov-data-portal",
          label: "e-Govデータポータル",
          url: EGOV_SOURCE_URL,
        },
        url: `${EGOV_PORTAL_URL}${encodeURIComponent(name)}`,
        ...(resourceUrl ? { resource_url: resourceUrl } : {}),
        formats,
        ...(coverageParts.length > 0 ? { coverage: coverageParts.join("・") } : {}),
        ...(text(dataset.metadata_modified)
          ? { metadata_updated: text(dataset.metadata_modified) }
          : {}),
        license: {
          label: text(dataset.license_title) || "e-Govデータポータル利用規約",
          url: licenseUrl ?? EGOV_TERMS_URL,
        },
        reasons: reasons.slice(0, 2),
        score,
      };
    })
    .filter((result): result is PublicDataSearchResult => result !== undefined)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "ja"));
}

function egovMatchedCount(payload: unknown): number {
  const root = asObject(payload);
  const result = asObject(root?.result);
  const count = Number(result?.count);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function indicatorDetails(indicator: IndicatorObject): string {
  const raw = indicator.details?.detail;
  const details = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cleanDescription(details.map((detail) => text(detail["$"])).filter(Boolean).join(" "));
}

function indicatorClasses(indicator: IndicatorObject): IndicatorClass[] {
  const raw = indicator.CLASS;
  if (Array.isArray(raw)) return raw;
  return raw ? [raw] : [];
}

function representativeClass(
  classes: IndicatorClass[],
  query: string,
): IndicatorClass | undefined {
  const wantsPrefecture = /都道府県|東京都|北海道|大阪府|京都府/u.test(query);
  return [...classes].sort((left, right) => {
    const score = (candidate: IndicatorClass) => {
      let value = text(candidate["@toDate"]).startsWith("9999") ? 12 : 0;
      const regionalRank = text(candidate.RegionalRank?.["@code"]);
      if (regionalRank === (wantsPrefecture ? "3" : "2")) value += 7;
      else if (regionalRank === "2") value += 3;
      if (text(candidate.cycle?.["@code"]) === "3") value += 3;
      if (text(candidate.IsSeasonal?.["@code"]) === "1") value += 1;
      return value;
    };
    return score(right) - score(left);
  })[0];
}

function indicatorScore(
  indicator: IndicatorObject,
  representative: IndicatorClass,
  terms: string[],
  query: string,
  classes: IndicatorClass[],
): number {
  const title = normalized(text(indicator["@name"]));
  const detail = normalized(indicatorDetails(indicator));
  let score = 12;
  for (const term of terms.map(normalized)) {
    if (title.includes(term)) score += 34;
    else if (detail.includes(term)) score += 8;
  }
  if (text(representative["@toDate"]).startsWith("9999")) score += 18;
  if (text(representative.RegionalRank?.["@code"]) === "2") score += 5;
  if (text(representative.cycle?.["@code"]) === "3") score += 4;
  if (detail.length >= 30) score += 4;
  if (/都道府県/u.test(query) && classes.some((item) => text(item.RegionalRank?.["@code"]) === "3")) {
    score += 20;
  }
  if (/人口/u.test(query) && !/労働|失業|就業|雇用|出生|死亡|移動/u.test(query)) {
    if (/^総人口（総数）|人口総数|推計人口/u.test(text(indicator["@name"]))) score += 72;
    else if (/^総人口/u.test(text(indicator["@name"]))) score += 35;
    if (/0～14|15～64|65歳|（女）|（男）/u.test(text(indicator["@name"]))) score -= 18;
    if (/労働力|就業|失業/u.test(text(indicator["@name"]))) score -= 32;
    if (!text(indicator["@code"]).startsWith("02")) score -= 50;
  }
  if (/物価|インフレ/u.test(query)) {
    if (/消費者物価指数（総合）/u.test(text(indicator["@name"]))) score += 32;
    if (/生鮮食品|エネルギーを除く/u.test(text(indicator["@name"]))) score -= 12;
    if (
      !/前年|前月|前年比|変化率|上昇率/u.test(query) &&
      /^[（(](?:前年|前月)/u.test(text(indicator["@name"]))
    ) {
      score -= 45;
    }
  }
  if (/失業/u.test(query) && /^完全失業率（男女計）/u.test(text(indicator["@name"]))) {
    score += 38;
  }
  if (/病院数/u.test(query)) {
    if (/^病院数(?:（総数）)?$/u.test(text(indicator["@name"]))) score += 60;
    else if (/^一般病院数(?:（総数）)?$/u.test(text(indicator["@name"]))) score += 36;
    if (/公立|公的医療機関|人口.*当たり/u.test(text(indicator["@name"]))) score -= 22;
  }
  if (/学校数/u.test(query)) {
    if (/^(?:小学校数|中学校数|高等学校数|学校数)$/u.test(text(indicator["@name"]))) score += 34;
    if (/各種学校|義務教育学校|専修学校|人口.*当たり/u.test(text(indicator["@name"]))) {
      score -= 18;
    }
  }
  if (/観光客|旅行客|宿泊客/u.test(query) && /^延べ宿泊者数（総数）/u.test(text(indicator["@name"]))) {
    score += 48;
  }
  if (/犯罪/u.test(query) && /^刑法犯認知件数$/u.test(text(indicator["@name"]))) {
    score += 48;
  }
  if (/市区町村.*所得|地域.*所得/u.test(query) && /^課税対象所得$/u.test(text(indicator["@name"]))) {
    score += 48;
  }
  return score;
}

function normalizeIndicatorResults(
  payload: unknown,
  terms: string[],
  query: string,
): PublicDataSearchResult[] {
  const root = asObject(payload);
  const response = asObject(root?.GET_META_INDICATOR_INF);
  const metadata = asObject(response?.METADATA_INF);
  const classInfo = asObject(metadata?.CLASS_INF);
  const rawObjects = Array.isArray(classInfo?.CLASS_OBJ) ? classInfo.CLASS_OBJ : [];
  const results = rawObjects
    .map((raw): PublicDataSearchResult | undefined => {
      const indicator = asObject(raw) as IndicatorObject | undefined;
      if (!indicator) return undefined;
      const code = text(indicator["@code"]);
      const title = text(indicator["@name"]);
      const classes = indicatorClasses(indicator);
      const representative = representativeClass(classes, query);
      if (!code || !title || !representative) return undefined;
      const from = formatCodeDate(representative["@fromDate"]);
      const to = formatCodeDate(representative["@toDate"]);
      const geography = text(representative.RegionalRank?.["@name"]);
      const cycle = text(representative.cycle?.["@name"]);
      const unit = text(representative["@unit"]);
      const publisher = text(representative["@statName"]) || "政府統計";
      const description =
        indicatorDetails(indicator) ||
        `${publisher}が提供する「${title}」の統計データです。`;
      const requestUrl = new URL(DASHBOARD_SEARCH_URL);
      requestUrl.searchParams.set("Lang", "JP");
      requestUrl.searchParams.set("IndicatorCode", code);
      const score = indicatorScore(indicator, representative, terms, query, classes);
      const toDate = text(representative["@toDate"]);
      const toYear = Number(toDate.slice(0, 4));
      const freshnessReason = toDate.startsWith("9999")
        ? "現在も更新されている系列です"
        : Number.isFinite(toYear) && toYear > new Date().getUTCFullYear()
          ? "将来の推計を含む系列です"
          : "対象期間が決まっている系列です";
      const coverageParts = [
        from && to ? `${from}〜${to}` : from ?? to ?? "",
        geography,
        cycle ? `${cycle}データ` : "",
        unit ? `単位 ${unit}` : "",
      ].filter(Boolean);
      return {
        id: `dashboard:${code}`,
        kind: "statistics",
        kind_label: "統計データ",
        title,
        description,
        publisher,
        source: {
          id: "statistics-dashboard-api",
          label: "統計ダッシュボード",
          url: DASHBOARD_SOURCE_URL,
        },
        url: requestUrl.toString(),
        resource_url: requestUrl.toString(),
        formats: ["JSON", "CSV", "XML"],
        ...(coverageParts.length > 0 ? { coverage: coverageParts.join("・") } : {}),
        license: {
          label: "統計ダッシュボード利用規約",
          url: DASHBOARD_TERMS_URL,
        },
        reasons: [
          "公式統計の意味・期間・地域を確認できます",
          freshnessReason,
        ],
        score,
      };
    })
    .filter((result): result is PublicDataSearchResult => result !== undefined)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "ja"));

  const seen = new Set<string>();
  return results.filter((result) => {
    const key = normalized(result.title).replace(/(?:19|20)\d{2}年基準/gu, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicate(results: PublicDataSearchResult[]): PublicDataSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.kind}:${normalized(result.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateById(results: PublicDataSearchResult[]): PublicDataSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.id)) return false;
    seen.add(result.id);
    return true;
  });
}

function validateEgovPayload(payload: unknown) {
  if (asObject(payload)?.success !== true) {
    throw new Error("e-Gov Data Portal returned an unsuccessful response");
  }
  return payload;
}

function validateDashboardPayload(payload: unknown) {
  const root = asObject(payload);
  const response = asObject(root?.GET_META_INDICATOR_INF);
  const result = asObject(response?.RESULT);
  if (text(result?.status) !== "0") {
    throw new Error("Statistics Dashboard returned an unsuccessful response");
  }
  return payload;
}

async function searchEgov(
  keywords: string[],
  scoreTerms: string[],
  fetchImpl: typeof fetch,
): Promise<SourceSearchOutcome> {
  const firstKeyword = keywords[0]!;
  const lastKeyword = keywords[keywords.length - 1]!;
  const specifications = [
    { keyword: firstKeyword, structured: true },
    { keyword: lastKeyword, structured: false },
  ];
  const settled = await Promise.allSettled(
    specifications.map(async ({ keyword, structured }) => {
      const url = new URL(EGOV_SEARCH_URL);
      url.searchParams.set("q", keyword);
      url.searchParams.set("rows", "30");
      url.searchParams.set("start", "0");
      url.searchParams.set("sort", "score desc, metadata_modified desc");
      if (structured) url.searchParams.set("fq", EGOV_STRUCTURED_FILTER);
      return validateEgovPayload(await fetchJson(url, fetchImpl, 6_000_000));
    }),
  );
  const payloads = settled.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  if (payloads.length === 0) throw new Error("e-Gov Data Portal search failed");
  const results = deduplicateById(
    payloads.flatMap((payload) => normalizeEgovResults(payload, scoreTerms)),
  );
  return {
    source: "egov",
    results,
    matched: Math.max(...payloads.map(egovMatchedCount)),
    examined: results.length,
  };
}

async function searchDashboard(
  keywords: string[],
  scoreTerms: string[],
  query: string,
  fetchImpl: typeof fetch,
): Promise<SourceSearchOutcome> {
  const settled = await Promise.allSettled(
    keywords.map(async (keyword) => {
      const url = new URL(DASHBOARD_SEARCH_URL);
      url.searchParams.set("Lang", "JP");
      url.searchParams.set("SearchIndicatorWord", keyword);
      return validateDashboardPayload(await fetchJson(url, fetchImpl, 12_000_000));
    }),
  );
  const payloads = settled.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  if (payloads.length === 0) throw new Error("Statistics Dashboard search failed");
  const results = deduplicateById(
    payloads.flatMap((payload) => normalizeIndicatorResults(payload, scoreTerms, query)),
  );
  return {
    source: "dashboard",
    results,
    matched: results.length,
    examined: results.length,
  };
}

function chooseResults(
  datasets: PublicDataSearchResult[],
  statistics: PublicDataSearchResult[],
  kind: PublicDataKind,
  limit: number,
): PublicDataSearchResult[] {
  const eligibleDatasets = deduplicate(datasets).filter((result) => result.score >= 60);
  const eligibleStatistics = deduplicate(statistics).filter((result) => result.score >= 24);
  if (kind === "dataset") return eligibleDatasets.slice(0, limit);
  if (kind === "statistics") return eligibleStatistics.slice(0, limit);
  const chosen = [...eligibleDatasets, ...eligibleStatistics]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "ja"))
    .slice(0, limit);
  const ensureSource = (candidate: PublicDataSearchResult | undefined) => {
    if (!candidate || chosen.some((result) => result.kind === candidate.kind)) return;
    if (chosen.length < limit) chosen.push(candidate);
    else chosen[chosen.length - 1] = candidate;
  };
  ensureSource(eligibleDatasets[0]);
  ensureSource(eligibleStatistics[0]);
  return chosen.sort(
    (left, right) => right.score - left.score || left.title.localeCompare(right.title, "ja"),
  );
}

export async function searchPublicData(
  input: PublicDataSearchInput,
  fetchImpl: typeof fetch = fetch,
) {
  const { query, kind, limit, terms } = validateInput(input);
  const plan = createQueryPlan(query, terms);
  const tasks: Array<Promise<SourceSearchOutcome>> = [];
  const requestedSources: Array<"egov" | "dashboard"> = [];

  if (kind !== "statistics") {
    requestedSources.push("egov");
    tasks.push(searchEgov(plan.keywords, plan.scoreTerms, fetchImpl));
  }
  if (kind !== "dataset") {
    requestedSources.push("dashboard");
    tasks.push(searchDashboard(plan.keywords, plan.scoreTerms, query, fetchImpl));
  }

  const settled = await Promise.allSettled(tasks);
  const datasets: PublicDataSearchResult[] = [];
  const statistics: PublicDataSearchResult[] = [];
  const statuses = new Map<"egov" | "dashboard", SourceStatus>();
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      if (outcome.value.source === "egov") datasets.push(...outcome.value.results);
      else statistics.push(...outcome.value.results);
      statuses.set(outcome.value.source, {
        id: outcome.value.source === "egov" ? "egov-data-portal" : "statistics-dashboard-api",
        label: outcome.value.source === "egov" ? "e-Govデータポータル" : "統計ダッシュボード",
        status: "ok",
        matched: outcome.value.matched,
        examined: outcome.value.examined,
      });
    }
  }
  for (let index = 0; index < settled.length; index += 1) {
    if (settled[index]?.status === "rejected") {
      const source = requestedSources[index]!;
      statuses.set(source, {
        id: source === "egov" ? "egov-data-portal" : "statistics-dashboard-api",
        label: source === "egov" ? "e-Govデータポータル" : "統計ダッシュボード",
        status: "error",
        matched: 0,
        examined: 0,
      });
    }
  }
  if ([...statuses.values()].every((status) => status.status === "error")) {
    throw new PublicDataSearchError(
      "公式サイトを検索できませんでした。時間をおいて再度お試しください。",
    );
  }

  const results = chooseResults(datasets, statistics, kind, limit);
  const publicResults = results.map(({ score: _score, ...result }) => result);
  return {
    status: "ok" as const,
    query,
    interpreted_as: plan.interpretedAs,
    searched_at: new Date().toISOString(),
    results: publicResults,
    total: publicResults.length,
    available: {
      dataset: statuses.get("egov")?.matched ?? 0,
      statistics: statuses.get("dashboard")?.matched ?? 0,
    },
    sources: requestedSources.map((source) => statuses.get(source)!),
    note:
      "検索結果は公式サイトのメタデータを整理した候補です。利用前に対象期間・内容・利用条件を公式ページで確認してください。",
  };
}
