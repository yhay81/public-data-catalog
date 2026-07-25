import bundleDocument from "../generated/catalog.bundle.json" with { type: "json" };

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type Localized = { ja: string; en: string };
type ParameterDefinition = {
  type: "integer";
  description: Localized;
  default: number;
  minimum: number;
  maximum: number;
};
type Binding = {
  parameter: string;
  location: "query";
  name: string;
  format: string;
};
type Assertion = {
  pointer: string;
  equals?: JsonValue;
  minimum?: number;
  min_length?: number;
};
type ResultField = {
  name: string;
  label: Localized;
  pointer: string;
  unit?: string;
  description?: string;
  transform?: "integer" | "number" | "string" | "unix_milliseconds_to_iso8601";
};
export type Recipe = {
  id: string;
  contract_version: string;
  title: Localized;
  question: Localized;
  source_id: string;
  parameters?: Record<string, ParameterDefinition>;
  request: {
    method: "GET";
    url: string;
    allowed_hosts: string[];
    headers?: Record<string, string>;
    bindings?: Binding[];
  };
  expect: {
    status: 200;
    content_type_contains: string;
    max_bytes: number;
    assertions: Assertion[];
  };
  result: { fields: ResultField[] };
  interpretation: string[];
  attribution: {
    source_url: string;
    license_url: string;
    credit: string;
  };
  last_verified: string;
};
type CatalogSource = {
  id: string;
  title: string;
  publisher: string;
  type: string;
  domains: string[];
  geography: string[];
  languages: string[];
  temporal_coverage: {
    start: string;
    end: string;
    granularity: string;
  };
  access: {
    mode: string;
    auth: string;
    base_url: string;
    docs_url: string;
    formats: string[];
    rate_limit_notes: string;
  };
  license: { name: string; url: string; notes: string };
  ai_summary: string;
  query_hints: string[];
  caveats: string[];
  status: string;
  last_verified: string;
  source_urls: string[];
};
type CatalogBundle = {
  bundle_version: string;
  catalog_version: string;
  last_updated: string;
  sources: CatalogSource[];
  recipes: Recipe[];
};

export type SearchInput = {
  query?: string;
  sourceId?: string;
  domain?: string;
  limit?: number;
};
export type ExecuteInput = {
  recipeId: string;
  parameters?: Record<string, unknown>;
};

const bundle = bundleDocument as CatalogBundle;
const recipes = new Map(bundle.recipes.map((recipe) => [recipe.id, recipe]));
const sources = new Map(bundle.sources.map((source) => [source.id, source]));
const SECRET_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "app_id",
  "appid",
  "client_secret",
  "token",
]);
const RUNNER = "public-data-catalog-mcp/0.4.0";
const RECEIPT_SCHEMA =
  "https://raw.githubusercontent.com/yhay81/public-data-catalog/main/receipt.schema.json";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

function sourceSummary(source: CatalogSource) {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    type: source.type,
    domains: source.domains,
    geography: source.geography,
    languages: source.languages,
    temporal_coverage: source.temporal_coverage,
    access: source.access,
    license: source.license,
    summary: source.ai_summary,
    query_hints: source.query_hints,
    caveats: source.caveats,
    status: source.status,
    last_verified: source.last_verified,
    source_urls: source.source_urls,
  };
}

function recipeSummary(recipe: Recipe) {
  return {
    id: recipe.id,
    contract_version: recipe.contract_version,
    title: recipe.title,
    question: recipe.question,
    source_id: recipe.source_id,
    parameters: recipe.parameters ?? {},
    last_verified: recipe.last_verified,
  };
}

export function searchData(input: SearchInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const terms = (input.query ?? "")
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  const candidates = bundle.sources
    .filter((source) => !input.sourceId || source.id === input.sourceId)
    .filter((source) => !input.domain || source.domains.includes(input.domain))
    .map((source) => {
      const sourceRecipes = bundle.recipes.filter((recipe) => recipe.source_id === source.id);
      const haystack = JSON.stringify({
        source,
        recipes: sourceRecipes.map(recipeSummary),
      }).toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return { source, sourceRecipes, score };
    })
    .filter(({ score }) => terms.length === 0 || score === terms.length)
    .sort((left, right) => right.score - left.score || left.source.id.localeCompare(right.source.id));
  const matches = candidates
    .slice(0, limit)
    .map(({ source, sourceRecipes }) => ({
      source: sourceSummary(source),
      contracts: sourceRecipes.map(recipeSummary),
    }));
  return { matches, total: candidates.length, catalog_version: bundle.catalog_version };
}

function getRecipe(recipeId: string): Recipe {
  const recipe = recipes.get(recipeId);
  if (!recipe) {
    throw new ContractError(
      `Unknown recipe ${JSON.stringify(recipeId)}. Available recipes: ${[...recipes.keys()].join(", ")}`,
    );
  }
  return recipe;
}

function resolveParameters(
  recipe: Recipe,
  supplied: Record<string, unknown> = {},
): Record<string, number> {
  const definitions = recipe.parameters ?? {};
  const unknown = Object.keys(supplied).filter((name) => !(name in definitions));
  if (unknown.length > 0) {
    throw new ContractError(`Unknown parameter(s): ${unknown.sort().join(", ")}`);
  }
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const candidate = supplied[name] ?? definition.default;
      const value =
        typeof candidate === "string" && /^-?[0-9]+$/u.test(candidate)
          ? Number(candidate)
          : candidate;
      if (!Number.isSafeInteger(value)) {
        throw new ContractError(`Parameter ${JSON.stringify(name)} must be an integer`);
      }
      const integer = value as number;
      if (integer < definition.minimum || integer > definition.maximum) {
        throw new ContractError(
          `Parameter ${JSON.stringify(name)} must be from ${definition.minimum} to ${definition.maximum}`,
        );
      }
      return [name, integer];
    }),
  );
}

function validateUrl(url: URL, allowedHosts: string[]): void {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash
  ) {
    throw new ContractError("The rendered request URL is outside the HTTPS trust boundary");
  }
  if (!allowedHosts.includes(url.hostname.toLocaleLowerCase())) {
    throw new ContractError(`Host ${JSON.stringify(url.hostname)} is not allowlisted`);
  }
  for (const name of url.searchParams.keys()) {
    if (SECRET_KEYS.has(name.toLocaleLowerCase())) {
      throw new ContractError(`Secret-like query parameter is not allowed: ${name}`);
    }
  }
}

function renderRequestUrl(recipe: Recipe, parameters: Record<string, number>): string {
  const url = new URL(recipe.request.url);
  for (const binding of recipe.request.bindings ?? []) {
    const value = binding.format.replace("{value}", String(parameters[binding.parameter]));
    url.searchParams.set(binding.name, value);
  }
  validateUrl(url, recipe.request.allowed_hosts.map((host) => host.toLocaleLowerCase()));
  return url.toString();
}

function resolvePointer(document: JsonValue, pointer: string): JsonValue {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) throw new ContractError(`Invalid JSON Pointer: ${pointer}`);
  let current: JsonValue = document;
  for (const encodedToken of pointer.slice(1).split("/")) {
    const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current) && /^(0|[1-9][0-9]*)$/u.test(token)) {
      const value = current[Number(token)];
      if (value === undefined) throw new ContractError(`JSON Pointer does not resolve: ${pointer}`);
      current = value;
    } else if (current !== null && typeof current === "object" && !Array.isArray(current)) {
      if (!(token in current)) throw new ContractError(`JSON Pointer does not resolve: ${pointer}`);
      current = current[token] as JsonValue;
    } else {
      throw new ContractError(`JSON Pointer does not resolve: ${pointer}`);
    }
  }
  return current;
}

function checkAssertions(recipe: Recipe, document: JsonValue): void {
  for (const assertion of recipe.expect.assertions) {
    const value = resolvePointer(document, assertion.pointer);
    if ("equals" in assertion && JSON.stringify(value) !== JSON.stringify(assertion.equals)) {
      throw new ContractError(`Assertion failed at ${assertion.pointer}: unexpected value`);
    }
    if (
      assertion.minimum !== undefined &&
      (typeof value !== "number" || value < assertion.minimum)
    ) {
      throw new ContractError(`Assertion failed at ${assertion.pointer}: value below minimum`);
    }
    if (assertion.min_length !== undefined) {
      const length =
        typeof value === "string" || Array.isArray(value)
          ? value.length
          : value !== null && typeof value === "object"
            ? Object.keys(value).length
            : -1;
      if (length < assertion.min_length) {
        throw new ContractError(`Assertion failed at ${assertion.pointer}: value too short`);
      }
    }
  }
}

function transform(value: JsonValue, name?: ResultField["transform"]): JsonValue {
  if (!name) return value;
  if (name === "string") return String(value);
  if (name === "integer") {
    const transformed = Number(String(value));
    if (!Number.isSafeInteger(transformed)) {
      throw new ContractError(`Cannot transform ${value} to integer`);
    }
    return transformed;
  }
  if (name === "number") {
    const transformed = Number(String(value));
    if (!Number.isFinite(transformed)) throw new ContractError(`Cannot transform ${value} to number`);
    return transformed;
  }
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) throw new ContractError(`Cannot transform ${value} to time`);
  return new Date(milliseconds).toISOString();
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new ContractError(`Response exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const bytes = Uint8Array.from(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Json(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(JSON.stringify(sortJson(value))));
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function executeContract(
  input: ExecuteInput,
  fetchImpl: typeof fetch = fetch,
) {
  const recipe = getRecipe(input.recipeId);
  const parameters = resolveParameters(recipe, input.parameters);
  const initialUrl = renderRequestUrl(recipe, parameters);
  const allowedHosts = recipe.request.allowed_hosts.map((host) => host.toLocaleLowerCase());
  let url = initialUrl;
  const started = Date.now();
  let response: Response | undefined;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": RUNNER,
        ...recipe.request.headers,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirects === 3) throw new ContractError("Unsafe or excessive redirect");
    const redirected = new URL(location, url);
    validateUrl(redirected, allowedHosts);
    url = redirected.toString();
  }
  if (!response) throw new ContractError("No response received");
  if (response.status !== recipe.expect.status) {
    throw new ContractError(`Expected HTTP ${recipe.expect.status}, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase().includes(recipe.expect.content_type_contains.toLocaleLowerCase())) {
    throw new ContractError(`Unexpected content type: ${contentType}`);
  }
  const body = await readBounded(response, recipe.expect.max_bytes);
  let document: JsonValue;
  try {
    document = JSON.parse(new TextDecoder().decode(body)) as JsonValue;
  } catch (error) {
    throw new ContractError(`Response was not valid JSON: ${String(error)}`);
  }
  checkAssertions(recipe, document);
  const results = Object.fromEntries(
    recipe.result.fields.map((field) => [
      field.name,
      {
        label: field.label,
        value: transform(resolvePointer(document, field.pointer), field.transform),
        ...(field.unit ? { unit: field.unit } : {}),
        ...(field.description ? { description: field.description } : {}),
      },
    ]),
  );
  const retrievedAt = new Date().toISOString();
  const receiptBody = {
    $schema: RECEIPT_SCHEMA,
    receipt_version: "1.0.0",
    contract: {
      id: recipe.id,
      version: recipe.contract_version,
      last_verified: recipe.last_verified,
    },
    parameters,
    request: {
      method: "GET",
      url,
      retrieved_at: retrievedAt,
      elapsed_ms: Date.now() - started,
      response_sha256: await sha256Bytes(body),
    },
    verification: {
      assertions_passed: recipe.expect.assertions.length,
      runner: RUNNER,
    },
    provenance: {
      source_id: recipe.source_id,
      ...recipe.attribution,
    },
    results_sha256: await sha256Json(results),
  };
  const receipt = { ...receiptBody, receipt_id: await sha256Json(receiptBody) };
  return {
    status: "ok",
    recipe_id: recipe.id,
    contract_version: recipe.contract_version,
    question: recipe.question,
    parameters,
    retrieved_at: retrievedAt,
    elapsed_ms: receiptBody.request.elapsed_ms,
    request_url: url,
    results,
    interpretation: recipe.interpretation,
    provenance: {
      source_id: recipe.source_id,
      ...recipe.attribution,
      recipe_last_verified: recipe.last_verified,
    },
    receipt,
  };
}

export async function verifyExecution(execution: unknown) {
  if (execution === null || typeof execution !== "object") {
    throw new ContractError("Execution must be an object");
  }
  const candidate = execution as Record<string, unknown>;
  const receipt = candidate.receipt;
  const results = candidate.results;
  if (
    receipt === null ||
    typeof receipt !== "object" ||
    results === null ||
    typeof results !== "object"
  ) {
    throw new ContractError("Execution must contain receipt and results objects");
  }
  const receiptRecord = receipt as Record<string, unknown>;
  if (typeof receiptRecord.receipt_id !== "string") {
    throw new ContractError("Receipt must contain a receipt_id");
  }
  const { receipt_id: receiptId, ...receiptBody } = receiptRecord;
  const expectedReceiptId = await sha256Json(receiptBody);
  const expectedResultsHash = await sha256Json(results);
  const receiptIntegrity = receiptId === expectedReceiptId;
  const resultsIntegrity = receiptRecord.results_sha256 === expectedResultsHash;
  const contract = asRecord(receiptRecord.contract);
  const request = asRecord(receiptRecord.request);
  const provenance = asRecord(receiptRecord.provenance);
  const contractBinding =
    contract !== undefined &&
    candidate.recipe_id === contract.id &&
    candidate.contract_version === contract.version;
  const parametersBinding = jsonEqual(candidate.parameters, receiptRecord.parameters);
  const requestBinding =
    request !== undefined &&
    candidate.request_url === request.url &&
    candidate.retrieved_at === request.retrieved_at &&
    candidate.elapsed_ms === request.elapsed_ms;
  const provenanceBinding =
    contract !== undefined &&
    provenance !== undefined &&
    jsonEqual(candidate.provenance, {
      ...provenance,
      recipe_last_verified: contract.last_verified,
    });
  const recipe =
    contract && typeof contract.id === "string" ? recipes.get(contract.id) : undefined;
  let catalogBinding = false;
  if (
    recipe &&
    contract &&
    request &&
    provenance &&
    jsonEqual(contract, {
      id: recipe.id,
      version: recipe.contract_version,
      last_verified: recipe.last_verified,
    }) &&
    jsonEqual(provenance, {
      source_id: recipe.source_id,
      ...recipe.attribution,
    }) &&
    jsonEqual(candidate.question, recipe.question) &&
    jsonEqual(candidate.interpretation, recipe.interpretation) &&
    request.method === recipe.request.method
  ) {
    try {
      const receiptParameters = asRecord(receiptRecord.parameters);
      if (receiptParameters) {
        const resolvedParameters = resolveParameters(recipe, receiptParameters);
        const requestUrl = new URL(String(request.url));
        validateUrl(
          requestUrl,
          recipe.request.allowed_hosts.map((host) => host.toLocaleLowerCase()),
        );
        catalogBinding = jsonEqual(receiptParameters, resolvedParameters);
      }
    } catch {
      catalogBinding = false;
    }
  }
  const checks = {
    receipt_integrity: receiptIntegrity,
    results_integrity: resultsIntegrity,
    execution_status: candidate.status === "ok",
    contract_binding: contractBinding,
    parameters_binding: parametersBinding,
    request_binding: requestBinding,
    provenance_binding: provenanceBinding,
    catalog_binding: catalogBinding,
  };
  return {
    valid: Object.values(checks).every(Boolean),
    receipt_id: receiptId,
    checks,
  };
}

export function serviceInfo() {
  return {
    name: "public-data-catalog-mcp",
    version: "0.4.0",
    catalog_version: bundle.catalog_version,
    tools: ["search_data", "execute", "verify"],
    transport: "MCP Streamable HTTP",
    endpoint: "/mcp",
  };
}
