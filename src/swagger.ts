import type { OpenAPIV3 } from "openapi-types";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

function isReference(obj: unknown): obj is OpenAPIV3.ReferenceObject {
  return !!obj && typeof obj === "object" && "$ref" in obj;
}

/** OpenAPI Operation 不含 path/method，查询结果需要把这两项带上。 */
interface ApiInfo {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses: Record<string, OpenAPIV3.ResponseObject>;
}

export class SwaggerParser {
  private swagger: OpenAPIV3.Document;
  apis: Record<string, Record<string, ApiInfo>>;
  private refCache: Map<string, OpenAPIV3.SchemaObject>;

  constructor(swaggerDoc: OpenAPIV3.Document) {
    this.swagger = swaggerDoc;
    this.apis = {};
    this.refCache = new Map();
  }

  public reload(swaggerDoc: OpenAPIV3.Document): Record<string, Record<string, ApiInfo>> {
    this.swagger = swaggerDoc;
    this.apis = {};
    this.refCache = new Map();
    return this.parseApis();
  }

  public parseApis(): Record<string, Record<string, ApiInfo>> {
    const paths = this.swagger.paths ?? {};

    for (const [path, pathItemOrRef] of Object.entries(paths)) {
      if (!pathItemOrRef) continue;
      const pathItem = this.resolve(pathItemOrRef);
      const pathParameters = pathItem.parameters ?? [];

      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;

        const apiInfo: ApiInfo = {
          path,
          method: method.toUpperCase(),
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags || [],
          parameters: this.parseParameters([
            ...pathParameters,
            ...(operation.parameters ?? []),
          ]),
          requestBody: this.parseRequestBody(operation.requestBody),
          responses: this.parseResponses(operation.responses || {}),
        };

        const apiPath = path.split("/").filter(Boolean).join(".");
        this.setNestedValue(this.apis, apiPath, apiInfo);
      }
    }

    return this.apis;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        const next = current[part];
        if (!next || typeof next !== "object") {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }
  }

  private parseParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[] = [],
  ): OpenAPIV3.ParameterObject[] {
    return parameters.map((paramOrRef) => {
      const param = this.resolve(paramOrRef);
      return {
        ...param,
        required: param.required || param.in === "path",
        schema: param.schema ? this.parseSchema(param.schema) : undefined,
      };
    });
  }

  private parseRequestBody(
    requestBody?: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject,
  ): OpenAPIV3.RequestBodyObject | undefined {
    if (!requestBody) return undefined;

    const body = this.resolve(requestBody);
    const content: OpenAPIV3.RequestBodyObject["content"] = {};

    for (const [mediaType, media] of Object.entries(body.content)) {
      content[mediaType] = {
        ...media,
        schema: media.schema ? this.parseSchema(media.schema) : undefined,
      };
    }

    return { ...body, content };
  }

  private parseResponses(
    responses: OpenAPIV3.ResponsesObject,
  ): Record<string, OpenAPIV3.ResponseObject> {
    const parsed: Record<string, OpenAPIV3.ResponseObject> = {};

    for (const [code, responseOrRef] of Object.entries(responses)) {
      const response = this.resolve(responseOrRef);
      const content: OpenAPIV3.ResponseObject["content"] = {};

      for (const [mediaType, media] of Object.entries(response.content ?? {})) {
        content[mediaType] = {
          ...media,
          schema: media.schema ? this.parseSchema(media.schema) : undefined,
        };
      }

      parsed[code] = {
        ...response,
        content: Object.keys(content).length ? content : undefined,
      };
    }

    return parsed;
  }

  private parseSchema(
    schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
  ): OpenAPIV3.SchemaObject {
    if (!schema) {
      return {};
    }

    if (isReference(schema)) {
      return this.resolveReference(schema.$ref);
    }

    const parsed = { ...schema } as OpenAPIV3.SchemaObject;

    if (schema.properties) {
      parsed.properties = {};
      for (const [name, prop] of Object.entries(schema.properties)) {
        parsed.properties[name] = this.parseSchema(prop);
      }
    }

    if ("items" in schema && schema.items) {
      (parsed as OpenAPIV3.ArraySchemaObject).items = this.parseSchema(
        schema.items,
      );
    }

    if (
      typeof schema.additionalProperties === "object" &&
      schema.additionalProperties
    ) {
      parsed.additionalProperties = this.parseSchema(
        schema.additionalProperties,
      );
    }

    if (schema.oneOf) {
      parsed.oneOf = schema.oneOf.map((item) => this.parseSchema(item));
    }
    if (schema.anyOf) {
      parsed.anyOf = schema.anyOf.map((item) => this.parseSchema(item));
    }
    if (schema.allOf) {
      parsed.allOf = schema.allOf.map((item) => this.parseSchema(item));
    }
    if (schema.not) {
      parsed.not = this.parseSchema(schema.not);
    }

    return parsed;
  }

  private resolve<T>(obj: T | OpenAPIV3.ReferenceObject): T {
    if (!isReference(obj)) {
      return obj;
    }
    return this.resolve(
      this.lookupRef(obj.$ref) as T | OpenAPIV3.ReferenceObject,
    );
  }

  private lookupRef(ref: string): unknown {
    const pointer = ref.startsWith("#") ? ref.slice(1) : ref;
    const parts = pointer
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));

    let current: unknown = this.swagger;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) {
        throw new Error(`无法解析引用: ${ref}`);
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private resolveReference(ref: string): OpenAPIV3.SchemaObject {
    const cached = this.refCache.get(ref);
    if (cached) {
      return cached;
    }

    const placeholder = {} as OpenAPIV3.SchemaObject;
    this.refCache.set(ref, placeholder);

    const resolved = this.parseSchema(
      this.lookupRef(ref) as OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
    );
    Object.assign(placeholder, resolved);

    return placeholder;
  }

  private serializeValue(
    value: unknown,
    visited = new WeakSet<object>(),
  ): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (visited.has(value)) {
      return { $circular: true };
    }

    visited.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item, visited));
    }

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        result[key] = this.serializeValue(nested, visited);
      }
    }
    return result;
  }

  public getSerializableApis(): unknown {
    return this.serializeValue(this.apis);
  }

  public toJSON(apiPath?: string, pretty: boolean = true): string {
    let serialized = this.getSerializableApis();

    if (apiPath) {
      serialized = this.filterByPath(serialized, apiPath);
    }

    return pretty
      ? JSON.stringify(serialized, null, 2)
      : JSON.stringify(serialized);
  }

  public toText(apiPath?: string): string {
    const lines: string[] = [];
    let serialized = this.getSerializableApis();

    if (apiPath) {
      serialized = this.filterByPath(serialized, apiPath);
    }

    const printSchema = (schema: unknown, indent: string = ""): void => {
      if (!schema || typeof schema !== "object") {
        return;
      }

      const obj = schema as Record<string, unknown>;
      if (obj.$circular) {
        lines.push(`${indent}[循环引用]`);
        return;
      }

      if (obj.type) {
        lines.push(`${indent}类型: ${obj.type}`);
      }
      if (typeof obj.description === "string") {
        lines.push(`${indent}描述: ${obj.description}`);
      }
      if (typeof obj.format === "string") {
        lines.push(`${indent}格式: ${obj.format}`);
      }
      if (Array.isArray(obj.enum)) {
        lines.push(`${indent}枚举值: ${obj.enum.join(", ")}`);
      }
      if (obj.properties && typeof obj.properties === "object") {
        const required = Array.isArray(obj.required) ? obj.required : [];
        lines.push(`${indent}属性:`);
        for (const [key, value] of Object.entries(
          obj.properties as Record<string, unknown>,
        )) {
          const mark = required.includes(key) ? " [必填]" : "";
          lines.push(`${indent}  - ${key}${mark}:`);
          printSchema(value, indent + "    ");
        }
      }
      if (obj.items) {
        lines.push(`${indent}数组项:`);
        printSchema(obj.items, indent + "  ");
      }
    };

    const firstContent = (
      content?:
        | OpenAPIV3.RequestBodyObject["content"]
        | OpenAPIV3.ResponseObject["content"],
    ) => {
      if (!content) return undefined;
      const contentType = Object.keys(content)[0];
      if (!contentType) return undefined;
      return { contentType, media: content[contentType] };
    };

    const printApi = (apiInfo: ApiInfo, path: string): void => {
      lines.push("=".repeat(80));
      lines.push(`路径: ${path}`);
      lines.push(`方法: ${apiInfo.method}`);
      if (apiInfo.summary) {
        lines.push(`摘要: ${apiInfo.summary}`);
      }
      if (apiInfo.description) {
        lines.push(`描述: ${apiInfo.description}`);
      }
      if (apiInfo.tags?.length) {
        lines.push(`标签: ${apiInfo.tags.join(", ")}`);
      }

      if (apiInfo.parameters?.length) {
        lines.push("\n参数:");
        for (const param of apiInfo.parameters) {
          const required = param.required ? " [必填]" : "";
          lines.push(`  - ${param.name} (${param.in})${required}`);
          if (param.description) {
            lines.push(`    描述: ${param.description}`);
          }
          if (param.schema) {
            printSchema(param.schema, "    ");
          }
        }
      }

      const requestMedia = firstContent(apiInfo.requestBody?.content);
      if (apiInfo.requestBody && requestMedia) {
        lines.push("\n请求体:");
        lines.push(`  Content-Type: ${requestMedia.contentType}`);
        lines.push(`  必填: ${apiInfo.requestBody.required ? "是" : "否"}`);
        if (apiInfo.requestBody.description) {
          lines.push(`  描述: ${apiInfo.requestBody.description}`);
        }
        lines.push("  Schema:");
        printSchema(requestMedia.media.schema, "    ");
      }

      if (apiInfo.responses) {
        lines.push("\n响应:");
        for (const [code, response] of Object.entries(apiInfo.responses)) {
          const responseMedia = firstContent(response.content);
          lines.push(`  状态码 ${code}: ${response.description}`);
          if (responseMedia) {
            lines.push(`    Content-Type: ${responseMedia.contentType}`);
            lines.push("    Schema:");
            printSchema(responseMedia.media.schema, "      ");
          }
        }
      }

      lines.push("");
    };

    const traverse = (obj: unknown, currentPath: string = ""): void => {
      if (!obj || typeof obj !== "object") {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        if (
          value &&
          typeof value === "object" &&
          "path" in value &&
          "method" in value
        ) {
          printApi(value as ApiInfo, `/${newPath.replace(/\./g, "/")}`);
        } else if (value && typeof value === "object") {
          traverse(value, newPath);
        }
      }
    };

    traverse(serialized);

    return lines.join("\n");
  }

  private filterByPath(apis: unknown, apiPath: string): unknown {
    const normalizedPath = apiPath
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/\//g, ".");

    if (!normalizedPath) {
      return apis;
    }

    const pathParts = normalizedPath.split(".");
    let current: unknown = apis;

    for (const part of pathParts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return {};
      }
    }

    if (
      current &&
      typeof current === "object" &&
      "path" in current &&
      "method" in current
    ) {
      const lastPart = pathParts[pathParts.length - 1];
      return { [lastPart]: current };
    }

    return current || {};
  }

  public getApiByPath(apiPath: string): unknown {
    const serialized = this.getSerializableApis();
    const filtered = this.filterByPath(serialized, apiPath);

    if (
      !filtered ||
      typeof filtered !== "object" ||
      Object.keys(filtered).length === 0
    ) {
      return undefined;
    }

    return filtered;
  }
}
