import {
  ContractError,
  executeContract,
  verifyExecution,
  type JsonValue,
} from "./core.ts";

type ResearchField = {
  label: { ja: string; en: string };
  value: JsonValue;
  unit?: string;
  description?: string;
};

type TopicDefinition = {
  id: string;
  label: string;
  description: string;
  recipeId: string;
  primaryFields: string[];
  question: (parameters: Record<string, number>) => string;
  parameters?: {
    year: {
      label: string;
      minimum: number;
      maximum: number;
      default: number;
    };
  };
};

type ResearchTopicSummary = {
  id: string;
  label: string;
  description: string;
  parameters: Record<
    string,
    {
      label: string;
      minimum: number;
      maximum: number;
      default: number;
    }
  >;
};

const topics: Record<string, TopicDefinition> = {
  "tokyo-population": {
    id: "tokyo-population",
    label: "東京都の人口",
    description: "2015年から2025年までの年次総人口",
    recipeId: "tokyo-population-by-year",
    primaryFields: ["population"],
    question: ({ year }) => `${year}年の東京都の総人口は？`,
    parameters: {
      year: {
        label: "調べる年",
        minimum: 2015,
        maximum: 2025,
        default: 2025,
      },
    },
  },
  "japan-unemployment": {
    id: "japan-unemployment",
    label: "日本の完全失業率",
    description: "2023年・男女計の年次値",
    recipeId: "japan-unemployment-rate-2023",
    primaryFields: ["unemployment-rate"],
    question: () => "2023年の日本の完全失業率（男女計）は？",
  },
  "world-bank-japan-population": {
    id: "world-bank-japan-population",
    label: "世界銀行による日本の人口",
    description: "2023年のWorld Bank指標",
    recipeId: "world-bank-japan-population-2023",
    primaryFields: ["population"],
    question: () => "世界銀行による2023年の日本の総人口は？",
  },
  "noto-earthquake": {
    id: "noto-earthquake",
    label: "2024年能登半島地震",
    description: "USGSが記録した規模・時刻・地点",
    recipeId: "usgs-noto-earthquake-2024",
    primaryFields: ["magnitude", "occurred-at", "place"],
    question: () => "USGSによる2024年能登半島地震の記録",
  },
  "egov-population-dataset": {
    id: "egov-population-dataset",
    label: "e-Govの人口データセット",
    description: "公開データセットの提供者・形式・更新日",
    recipeId: "egov-population-dataset-search",
    primaryFields: ["dataset-name", "publisher", "metadata-modified"],
    question: () => "e-Govで人口に関する公開データセットを確認する",
  },
};

export class ResearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchInputError";
  }
}

export function listResearchTopics(): ResearchTopicSummary[] {
  return Object.values(topics).map((topic) => ({
    id: topic.id,
    label: topic.label,
    description: topic.description,
    parameters: topic.parameters ?? {},
  }));
}

function requireRequest(input: unknown) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ResearchInputError("調べる内容を選んでください。");
  }
  const request = input as Record<string, unknown>;
  const unknownKeys = Object.keys(request).filter(
    (key) => key !== "topic" && key !== "year",
  );
  if (unknownKeys.length > 0) {
    throw new ResearchInputError(`未対応の入力項目があります: ${unknownKeys.join(", ")}`);
  }
  if (typeof request.topic !== "string" || !(request.topic in topics)) {
    throw new ResearchInputError("対応している調査内容を選んでください。");
  }
  const topic = topics[request.topic]!;
  const parameters: Record<string, number> = {};
  if (topic.parameters?.year) {
    const year = request.year ?? topic.parameters.year.default;
    if (!Number.isSafeInteger(year)) {
      throw new ResearchInputError("年を正しく選んでください。");
    }
    const numericYear = year as number;
    if (
      numericYear < topic.parameters.year.minimum ||
      numericYear > topic.parameters.year.maximum
    ) {
      throw new ResearchInputError(
        `年は${topic.parameters.year.minimum}年から${topic.parameters.year.maximum}年まで選べます。`,
      );
    }
    parameters.year = numericYear;
  } else if (request.year !== undefined) {
    throw new ResearchInputError("この調査では年を指定できません。");
  }
  return { topic, parameters };
}

export async function researchStatistic(
  input: unknown,
  fetchImpl: typeof fetch = fetch,
) {
  const { topic, parameters } = requireRequest(input);
  const execution = await executeContract(
    {
      recipeId: topic.recipeId,
      ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    },
    fetchImpl,
  );
  const verification = await verifyExecution(execution);
  if (!verification.valid) {
    throw new ContractError("取得結果の確認に失敗しました。");
  }

  const resultEntries = Object.entries(execution.results as Record<string, ResearchField>);
  const primary = resultEntries
    .filter(([id]) => topic.primaryFields.includes(id))
    .map(([id, field]) => ({ id, ...field }));
  const details = resultEntries
    .filter(([id]) => !topic.primaryFields.includes(id))
    .map(([id, field]) => ({ id, ...field }));
  const integrityChecks = Object.values(verification.checks).filter(Boolean).length;
  const sourceChecks = execution.receipt.verification.assertions_passed;

  return {
    status: "ok" as const,
    topic: topic.id,
    title: topic.label,
    question: topic.question(parameters),
    primary,
    details,
    notes: execution.interpretation,
    retrieved_at: execution.retrieved_at,
    source: {
      credit: execution.provenance.credit,
      url: execution.provenance.source_url,
      license_url: execution.provenance.license_url,
      request_url: execution.request_url,
      recipe_last_verified: execution.provenance.recipe_last_verified,
    },
    verification: {
      valid: true,
      source_checks: sourceChecks,
      integrity_checks: integrityChecks,
      receipt_id: verification.receipt_id,
    },
    method: {
      recipe_id: execution.recipe_id,
      contract_version: execution.contract_version,
      parameters: execution.parameters,
    },
  };
}
