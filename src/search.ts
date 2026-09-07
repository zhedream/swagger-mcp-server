/** 关键字检索命中过多时的返回条数上限 */
export const MAX_KEYWORD_MATCHES = 20;

/** `*` 列出全部时的简要列表上限 */
export const MAX_STAR_MATCHES = 200;

/** 按空白、斜杠、点号拆分查询 */
const TOKEN_SPLIT = /[\s/.]+/;

export interface SearchableApi {
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
}

export interface ApiMatchSummary {
  path: string;
  method: string;
  summary: string;
  description: string;
}

export interface MultipleMatchPayload {
  matchType: "multiple";
  keywords: string[];
  total: number;
  returned: number;
  truncated: boolean;
  message: string;
  matches: ApiMatchSummary[];
}

/** 供检索/详情解析使用的最小目录接口（SwaggerParser 满足此形状） */
export interface ApiCatalog {
  apis: unknown;
  getApiByPath(apiPath: string): unknown;
  toJSON(apiPath: string, pretty?: boolean): string;
}

export type ResolvedQuery =
  | { status: "empty" }
  | { status: "star" }
  | { status: "unique"; json: string }
  | { status: "multiple"; tokens: string[]; matched: SearchableApi[] }
  | { status: "none"; tokens: string[] };

export interface ApiDetailItemResult {
  query: string;
  ok: boolean;
  detail?: unknown;
  matches?: ApiMatchSummary[];
  error?: string;
}

export interface ApiDetailsPayload {
  results: ApiDetailItemResult[];
}

function isApiLeaf(value: unknown): value is SearchableApi {
  return (
    !!value &&
    typeof value === "object" &&
    "path" in value &&
    "method" in value
  );
}

/** 整个查询 trim 后是否为 `*`（表示列出全部；不与其他关键字混用） */
export function isStarQuery(input: string): boolean {
  return input.trim() === "*";
}

/**
 * 把输入拆成原始片段（保留大小写）：去掉空段，按空白 / 斜杠 / 点号切分。
 * `/Check/GetCheckRecordDetail` → `["Check", "GetCheckRecordDetail"]`
 * `记录详情` → `["记录详情"]`
 * `Check GetCheckRecordDetail 详情` → `["Check", "GetCheckRecordDetail", "详情"]`
 * `*` 不会被切分吃掉；是否表示「全部」由 isStarQuery 在上层判断。
 */
export function splitQueryParts(input: string): string[] {
  return input
    .trim()
    .split(TOKEN_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 归一化为不区分大小写的关键字（去重、保序）。
 * 中文短语不额外分词：整段作为 token；子串匹配由 includes 完成
 *（因此单独搜「详情」也能命中 summary 含「记录详情」的接口）。
 * 注意：`*` 表示全部由 isStarQuery / resolveQuery 处理，不要对 Check* 做通配。
 */
export function normalizeQuery(input: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const part of splitQueryParts(input)) {
    const token = part.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** 从 parser.apis 嵌套树中收集全部接口 */
export function collectApis(obj: unknown): SearchableApi[] {
  const results: SearchableApi[] = [];

  if (!obj || typeof obj !== "object") {
    return results;
  }

  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (isApiLeaf(value)) {
      const summary = typeof value.summary === "string" ? value.summary : "";
      const description =
        typeof value.description === "string" ? value.description : summary;
      results.push({
        path: String(value.path ?? ""),
        method: String(value.method ?? ""),
        summary,
        description,
        tags: asStringArray(value.tags),
      });
    } else if (value && typeof value === "object") {
      results.push(...collectApis(value));
    }
  }

  return results;
}

/**
 * 供 AND 匹配的拼接文本：path（含分段）、method、summary、description、
 * tags、路径最后一段 / operation 名。不区分大小写。
 */
export function buildSearchText(api: SearchableApi): string {
  const path = api.path ?? "";
  const segments = path.split("/").filter(Boolean);
  const operationName = segments[segments.length - 1] ?? "";

  return [
    path,
    segments.join(" "),
    api.method ?? "",
    api.summary ?? "",
    api.description ?? "",
    ...(api.tags ?? []),
    operationName,
  ]
    .join(" ")
    .toLowerCase();
}

export function matchesAllKeywords(
  api: SearchableApi,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return false;
  const haystack = buildSearchText(api);
  return tokens.every((token) => haystack.includes(token));
}

/** tokens 为空时返回全部（供 `*` 列出全部使用） */
export function filterByKeywords(
  apis: SearchableApi[],
  tokens: string[],
): SearchableApi[] {
  if (tokens.length === 0) return [...apis];
  return apis.filter((api) => matchesAllKeywords(api, tokens));
}

/**
 * 判断 toJSON / getApiByPath 的结果是否为「唯一接口详情」
 *（形如 `{ GetCheckRecordDetail: { path, method, ... } }`）。
 * 前缀目录或多接口对象不算唯一命中。
 */
export function isUniqueExactApiResult(filtered: unknown): boolean {
  if (!filtered || typeof filtered !== "object") return false;
  const values = Object.values(filtered as Record<string, unknown>);
  return values.length === 1 && isApiLeaf(values[0]);
}

export function formatNoMatchMessage(tokens: string[]): string {
  const shown = tokens.length > 0 ? tokens.join(", ") : "（无）";
  return `未找到匹配的接口。使用的关键字: ${shown}`;
}

export function toMatchSummary(api: SearchableApi): ApiMatchSummary {
  return {
    path: api.path,
    method: api.method,
    summary: api.summary,
    description: api.description,
  };
}

export function buildMultipleMatchPayload(
  matched: SearchableApi[],
  tokens: string[],
  maxMatches: number = MAX_KEYWORD_MATCHES,
): MultipleMatchPayload {
  const returned = matched.slice(0, maxMatches);
  const truncated = matched.length > maxMatches;
  const isStar = tokens.length === 1 && tokens[0] === "*";

  let message: string;
  if (isStar) {
    message = truncated
      ? `共 ${matched.length} 个接口，已返回前 ${returned.length} 条（上限 ${maxMatches}）。完整详情请用 getApiDetails 传入具体路径。`
      : `共 ${matched.length} 个接口（简要列表）。完整详情请用 getApiDetails 传入具体路径。`;
  } else {
    message = truncated
      ? `找到 ${matched.length} 个匹配接口，已返回前 ${returned.length} 条。请使用更精确的路径或关键字缩小范围。`
      : `找到 ${matched.length} 个匹配接口。可使用更精确的路径或 getApiDetails 查看完整详情。`;
  }

  return {
    matchType: "multiple",
    keywords: tokens,
    total: matched.length,
    returned: returned.length,
    truncated,
    message,
    matches: returned.map(toMatchSummary),
  };
}

export function toListItem(api: SearchableApi): ApiMatchSummary {
  return toMatchSummary(api);
}

export function tryExactApiJson(
  catalog: ApiCatalog,
  apiPath: string,
): string | null {
  const filtered = catalog.getApiByPath(apiPath);
  if (!isUniqueExactApiResult(filtered)) {
    return null;
  }
  return catalog.toJSON(apiPath, true);
}

/**
 * 解析单条查询：空 / `*` / 精确唯一 / 关键字 0·1·多。
 * `*` 不与其他关键字混用；仅 trim 后等于 `*` 时表示全部。
 */
export function resolveQuery(
  catalog: ApiCatalog,
  input: string,
): ResolvedQuery {
  const trimmed = input.trim();
  if (!trimmed) {
    return { status: "empty" };
  }

  if (isStarQuery(trimmed)) {
    return { status: "star" };
  }

  const exactOriginal = tryExactApiJson(catalog, trimmed);
  if (exactOriginal) {
    return { status: "unique", json: exactOriginal };
  }

  const parts = splitQueryParts(trimmed);
  const joinedPath = parts.join(".");
  if (joinedPath && joinedPath !== trimmed) {
    const exactJoined = tryExactApiJson(catalog, joinedPath);
    if (exactJoined) {
      return { status: "unique", json: exactJoined };
    }
  }

  const tokens = normalizeQuery(trimmed);
  if (tokens.length === 0) {
    return { status: "none", tokens };
  }

  const matched = filterByKeywords(collectApis(catalog.apis), tokens);

  if (matched.length === 0) {
    return { status: "none", tokens };
  }

  if (matched.length === 1) {
    return { status: "unique", json: catalog.toJSON(matched[0].path, true) };
  }

  return { status: "multiple", tokens, matched };
}

export function formatEmptyQueryMessage(): string {
  return "请输入路径、名称或关键字。使用 * 可列出全部接口（简要列表）。";
}

/** searchApis：1 条详情，多条简要，`*` 全部简要 */
export function formatSearchApisResult(
  catalog: ApiCatalog,
  apiPath: string,
): string {
  const resolved = resolveQuery(catalog, apiPath);

  switch (resolved.status) {
    case "empty":
      return formatEmptyQueryMessage();
    case "star": {
      const all = collectApis(catalog.apis);
      return JSON.stringify(
        buildMultipleMatchPayload(all, ["*"], MAX_STAR_MATCHES),
        null,
        2,
      );
    }
    case "unique":
      return resolved.json;
    case "multiple":
      return JSON.stringify(
        buildMultipleMatchPayload(
          resolved.matched,
          resolved.tokens,
          MAX_KEYWORD_MATCHES,
        ),
        null,
        2,
      );
    case "none":
      return formatNoMatchMessage(resolved.tokens);
  }
}

/** getApiDetails：单条解析，不能唯一确定时不让整次调用失败 */
export function resolveApiDetailItem(
  catalog: ApiCatalog,
  query: string,
): ApiDetailItemResult {
  const resolved = resolveQuery(catalog, query);

  switch (resolved.status) {
    case "empty":
      return {
        query,
        ok: false,
        error: "查询为空，请提供接口路径或能唯一命中的关键字",
      };
    case "star":
      return {
        query,
        ok: false,
        error:
          "不支持 *。getApiDetails 用于按路径批量获取完整详情；列出全部接口请用 searchApis，apiPath 为 *。",
      };
    case "unique":
      return {
        query,
        ok: true,
        detail: JSON.parse(resolved.json) as unknown,
      };
    case "multiple": {
      const payload = buildMultipleMatchPayload(
        resolved.matched,
        resolved.tokens,
        MAX_KEYWORD_MATCHES,
      );
      return {
        query,
        ok: false,
        matches: payload.matches,
        error: `匹配到 ${resolved.matched.length} 个接口，无法唯一确定。请改用更精确的路径。`,
      };
    }
    case "none":
      return {
        query,
        ok: false,
        error: formatNoMatchMessage(resolved.tokens),
      };
  }
}

export function resolveApiDetails(
  catalog: ApiCatalog,
  apiPaths: string[],
): ApiDetailsPayload {
  return {
    results: apiPaths.map((item) => resolveApiDetailItem(catalog, item)),
  };
}
