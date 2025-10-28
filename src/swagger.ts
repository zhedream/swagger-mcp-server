interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: {
      [method: string]: OpenAPIOperation;
    };
  };
  components?: {
    schemas?: {
      [name: string]: OpenAPISchema;
    };
  };
}

interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: {
    [code: string]: OpenAPIResponse;
  };
}

interface OpenAPIParameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: OpenAPISchema;
  example?: any;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
}

interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPIResponse {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPISchema {
  $ref?: string;
  type?: string;
  description?: string;
  nullable?: boolean;
  format?: string;
  default?: any;
  example?: any;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  properties?: {
    [name: string]: OpenAPISchema;
  };
  required?: string[];
  items?: OpenAPISchema;
  additionalProperties?: boolean | OpenAPISchema;
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

interface ParsedSchema {
  type?: string;
  description?: string;
  nullable?: boolean;
  format?: string;
  default?: any;
  example?: any;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  properties?: {
    [name: string]: ParsedSchema;
  };
  required?: string[];
  items?: ParsedSchema;
  additionalProperties?: boolean | ParsedSchema;
  oneOf?: ParsedSchema[];
  anyOf?: ParsedSchema[];
  allOf?: ParsedSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

interface ParsedParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema?: ParsedSchema;
  example?: any;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
}

interface ParsedRequestBody {
  description?: string;
  required: boolean;
  contentType: string;
  schema: ParsedSchema;
}

interface ParsedResponse {
  description: string;
  contentType: string;
  schema: ParsedSchema;
}

interface ParsedApiInfo {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: {
    [code: string]: ParsedResponse;
  };
}

export class SwaggerParser {
  private swagger: OpenAPIDocument;
  apis: Record<string, Record<string, ParsedApiInfo>>;
  private refCache: Map<string, ParsedSchema>;

  constructor(swaggerDoc: OpenAPIDocument) {
    this.swagger = swaggerDoc;
    this.apis = {};
    this.refCache = new Map();
  }

  public parseApis(): { [key: string]: any } {
    const paths = this.swagger.paths;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        const apiInfo: ParsedApiInfo = {
          path,
          method: method.toUpperCase(),
          summary: details.summary,
          description: details.description,
          tags: details.tags || [],
          parameters: this.parseParameters(details.parameters),
          requestBody: this.parseRequestBody(details.requestBody),
          responses: this.parseResponses(details.responses || {})
        };

        const apiPath = path.split('/').filter(p => p).join('.');
        this.setNestedValue(this.apis, apiPath, apiInfo);
      }
    }

    return this.apis;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  private parseParameters(parameters: OpenAPIParameter[] = []): ParsedParameter[] {
    if (!parameters) return [];
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required || false,
      description: param.description,
      schema: param.schema ? this.parseSchema(param.schema) : undefined,
      example: param.example,
      deprecated: param.deprecated,
      allowEmptyValue: param.allowEmptyValue
    }));
  }

  private parseRequestBody(requestBody?: OpenAPIRequestBody): ParsedRequestBody | undefined {
    if (!requestBody?.content) return undefined;

    const firstContentType = Object.keys(requestBody.content)[0];
    const schema = requestBody.content[firstContentType].schema;

    return {
      description: requestBody.description,
      required: requestBody.required || false,
      contentType: firstContentType,
      schema: this.parseSchema(schema)
    };
  }

  private parseResponses(responses: { [code: string]: OpenAPIResponse }): { [code: string]: ParsedResponse } {
    const parsedResponses: { [code: string]: ParsedResponse } = {};

    for (const [code, response] of Object.entries(responses)) {
      if (!response.content) continue;

      const firstContentType = Object.keys(response.content)[0];
      const schema = response.content[firstContentType].schema;

      parsedResponses[code] = {
        description: response.description,
        contentType: firstContentType,
        schema: this.parseSchema(schema)
      };
    }

    return parsedResponses;
  }

  private parseSchema(schema: OpenAPISchema): ParsedSchema {
    if (!schema) return {};

    if (schema.$ref) {
      return this.resolveReference(schema.$ref);
    }

    const parsed: ParsedSchema = {
      type: schema.type,
      description: schema.description,
      nullable: schema.nullable,
      format: schema.format,
      default: schema.default,
      example: schema.example,
      deprecated: schema.deprecated,
      readOnly: schema.readOnly,
      writeOnly: schema.writeOnly,
      minimum: schema.minimum,
      maximum: schema.maximum,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
      pattern: schema.pattern,
      enum: schema.enum,
      additionalProperties: schema.additionalProperties
    };

    // 清理未定义的属性
    Object.keys(parsed).forEach(key => {
      if (parsed[key as keyof ParsedSchema] === undefined) {
        delete parsed[key as keyof ParsedSchema];
      }
    });

    // 处理属性
    if (schema.properties) {
      parsed.properties = {};
      parsed.required = schema.required || [];

      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        parsed.properties[propName] = this.parseSchema(propSchema);
      }
    }

    // 处理数组
    if (schema.type === 'array') {
      if (schema.items) {
        parsed.items = this.parseSchema(schema.items);
      }
      parsed.minItems = schema.minItems;
      parsed.maxItems = schema.maxItems;
      parsed.uniqueItems = schema.uniqueItems;
    }

    // 处理联合类型
    if (schema.oneOf) parsed.oneOf = schema.oneOf.map(s => this.parseSchema(s));
    if (schema.anyOf) parsed.anyOf = schema.anyOf.map(s => this.parseSchema(s));
    if (schema.allOf) parsed.allOf = schema.allOf.map(s => this.parseSchema(s));

    return parsed;
  }

  private resolveReference(ref: string): ParsedSchema {
    if (this.refCache.has(ref)) {
      return this.refCache.get(ref)!;
    }

    const parts = ref.split('/').slice(1);
    let current: any = this.swagger;

    for (const part of parts) {
      if (!current || !current[part]) {
        throw new Error(`无法解析引用: ${ref}`);
      }
      current = current[part];
    }

    const tempObj: ParsedSchema = {};
    this.refCache.set(ref, tempObj);

    const resolved = this.parseSchema(current);
    Object.assign(tempObj, resolved);

    return tempObj;
  }

  /**
   * 将 ParsedSchema 转换为可 JSON 序列化的格式
   * 通过追踪已访问的对象来避免循环引用
   */
  private serializeSchema(schema: ParsedSchema, visited = new WeakSet()): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // 如果已经访问过这个对象，返回一个引用标记
    if (visited.has(schema)) {
      return { $circular: true };
    }

    visited.add(schema);

    const result: any = {};

    // 复制基本属性
    const basicProps = [
      'type', 'description', 'nullable', 'format', 'default',
      'example', 'deprecated', 'readOnly', 'writeOnly',
      'minimum', 'maximum', 'minLength', 'maxLength',
      'pattern', 'enum', 'minItems', 'maxItems', 'uniqueItems'
    ];

    for (const prop of basicProps) {
      if (schema[prop as keyof ParsedSchema] !== undefined) {
        result[prop] = schema[prop as keyof ParsedSchema];
      }
    }

    // 处理 required 数组
    if (schema.required) {
      result.required = [...schema.required];
    }

    // 递归处理 properties
    if (schema.properties) {
      result.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        result.properties[key] = this.serializeSchema(value, visited);
      }
    }

    // 递归处理 items
    if (schema.items) {
      result.items = this.serializeSchema(schema.items, visited);
    }

    // 递归处理联合类型
    if (schema.oneOf) {
      result.oneOf = schema.oneOf.map(s => this.serializeSchema(s, visited));
    }
    if (schema.anyOf) {
      result.anyOf = schema.anyOf.map(s => this.serializeSchema(s, visited));
    }
    if (schema.allOf) {
      result.allOf = schema.allOf.map(s => this.serializeSchema(s, visited));
    }

    // 处理 additionalProperties
    if (schema.additionalProperties !== undefined) {
      if (typeof schema.additionalProperties === 'boolean') {
        result.additionalProperties = schema.additionalProperties;
      } else {
        result.additionalProperties = this.serializeSchema(schema.additionalProperties, visited);
      }
    }

    return result;
  }

  /**
   * 将整个 API 信息序列化为可 JSON 化的格式
   */
  private serializeApiInfo(apiInfo: ParsedApiInfo): any {
    return {
      path: apiInfo.path,
      method: apiInfo.method,
      summary: apiInfo.summary,
      description: apiInfo.description,
      tags: [...apiInfo.tags],
      parameters: apiInfo.parameters.map(param => ({
        name: param.name,
        in: param.in,
        required: param.required,
        description: param.description,
        schema: param.schema ? this.serializeSchema(param.schema) : undefined,
        example: param.example,
        deprecated: param.deprecated,
        allowEmptyValue: param.allowEmptyValue
      })),
      requestBody: apiInfo.requestBody ? {
        description: apiInfo.requestBody.description,
        required: apiInfo.requestBody.required,
        contentType: apiInfo.requestBody.contentType,
        schema: this.serializeSchema(apiInfo.requestBody.schema)
      } : undefined,
      responses: Object.entries(apiInfo.responses).reduce((acc, [code, response]) => {
        acc[code] = {
          description: response.description,
          contentType: response.contentType,
          schema: this.serializeSchema(response.schema)
        };
        return acc;
      }, {} as any)
    };
  }

  /**
   * 获取可序列化的 APIs（用于 JSON 输出）
   */
  public getSerializableApis(): any {
    const serialized: any = {};

    const serialize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      // 如果是 ParsedApiInfo，进行序列化
      if ('path' in obj && 'method' in obj && 'tags' in obj) {
        return this.serializeApiInfo(obj as ParsedApiInfo);
      }

      // 递归处理嵌套对象
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = serialize(value);
      }
      return result;
    };

    return serialize(this.apis);
  }

  /**
   * 将 APIs 转换为 JSON 字符串
   * @param apiPath 可选的 API 路径过滤，支持格式：/api/users、/api/users/create、api/users/create
   * @param pretty 是否格式化输出
   */
  public toJSON(apiPath?: string, pretty: boolean = true): string {
    let serialized = this.getSerializableApis();

    if (apiPath) {
      serialized = this.filterByPath(serialized, apiPath);
    }

    return pretty ? JSON.stringify(serialized, null, 2) : JSON.stringify(serialized);
  }

  /**
   * 将 APIs 转换为可读的文本格式
   * @param apiPath 可选的 API 路径过滤，支持格式：/api/users、/api/users/create、api/users/create
   */
  public toText(apiPath?: string): string {
    const lines: string[] = [];
    let serialized = this.getSerializableApis();

    if (apiPath) {
      serialized = this.filterByPath(serialized, apiPath);
    }

    const printSchema = (schema: any, indent: string = ''): void => {
      if (!schema || typeof schema !== 'object') {
        return;
      }

      if (schema.$circular) {
        lines.push(`${indent}[循环引用]`);
        return;
      }

      if (schema.type) {
        lines.push(`${indent}类型: ${schema.type}`);
      }
      if (schema.description) {
        lines.push(`${indent}描述: ${schema.description}`);
      }
      if (schema.format) {
        lines.push(`${indent}格式: ${schema.format}`);
      }
      if (schema.enum) {
        lines.push(`${indent}枚举值: ${schema.enum.join(', ')}`);
      }
      if (schema.properties) {
        lines.push(`${indent}属性:`);
        for (const [key, value] of Object.entries(schema.properties)) {
          const required = schema.required?.includes(key) ? ' [必填]' : '';
          lines.push(`${indent}  - ${key}${required}:`);
          printSchema(value, indent + '    ');
        }
      }
      if (schema.items) {
        lines.push(`${indent}数组项:`);
        printSchema(schema.items, indent + '  ');
      }
    };

    const printApi = (apiInfo: any, path: string): void => {
      lines.push('='.repeat(80));
      lines.push(`路径: ${path}`);
      lines.push(`方法: ${apiInfo.method}`);
      if (apiInfo.summary) {
        lines.push(`摘要: ${apiInfo.summary}`);
      }
      if (apiInfo.description) {
        lines.push(`描述: ${apiInfo.description}`);
      }
      if (apiInfo.tags?.length) {
        lines.push(`标签: ${apiInfo.tags.join(', ')}`);
      }

      if (apiInfo.parameters?.length) {
        lines.push('\n参数:');
        for (const param of apiInfo.parameters) {
          const required = param.required ? ' [必填]' : '';
          lines.push(`  - ${param.name} (${param.in})${required}`);
          if (param.description) {
            lines.push(`    描述: ${param.description}`);
          }
          if (param.schema) {
            printSchema(param.schema, '    ');
          }
        }
      }

      if (apiInfo.requestBody) {
        lines.push('\n请求体:');
        lines.push(`  Content-Type: ${apiInfo.requestBody.contentType}`);
        lines.push(`  必填: ${apiInfo.requestBody.required ? '是' : '否'}`);
        if (apiInfo.requestBody.description) {
          lines.push(`  描述: ${apiInfo.requestBody.description}`);
        }
        lines.push('  Schema:');
        printSchema(apiInfo.requestBody.schema, '    ');
      }

      if (apiInfo.responses) {
        lines.push('\n响应:');
        for (const [code, response] of Object.entries(apiInfo.responses)) {
          lines.push(`  状态码 ${code}: ${(response as any).description}`);
          lines.push(`    Content-Type: ${(response as any).contentType}`);
          lines.push('    Schema:');
          printSchema((response as any).schema, '      ');
        }
      }

      lines.push('');
    };

    const traverse = (obj: any, currentPath: string = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        if (value && typeof value === 'object' && 'path' in value && 'method' in value) {
          printApi(value, `/${newPath.replace(/\./g, '/')}`);
        } else if (value && typeof value === 'object') {
          traverse(value, newPath);
        }
      }
    };

    traverse(serialized);

    return lines.join('\n');
  }

  /**
   * 根据路径过滤 API
   * @param apis 序列化后的 API 对象
   * @param apiPath API 路径，支持格式：/api/users、/api/users/create、api/users/create
   * @returns 过滤后的 API 对象
   */
  private filterByPath(apis: any, apiPath: string): any {
    // 标准化路径：移除开头的斜杠，将斜杠替换为点号
    const normalizedPath = apiPath
      .replace(/^\/+/, '') // 移除开头的斜杠
      .replace(/\/+$/, '') // 移除结尾的斜杠
      .replace(/\//g, '.'); // 将斜杠替换为点号

    if (!normalizedPath) {
      return apis;
    }

    const pathParts = normalizedPath.split('.');
    let current = apis;

    // 逐层查找
    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // 路径不存在，返回空对象
        return {};
      }
    }

    // 如果找到的是单个 API 信息，包装成对象返回
    if (current && typeof current === 'object' && 'path' in current && 'method' in current) {
      const lastPart = pathParts[pathParts.length - 1];
      return { [lastPart]: current };
    }

    return current || {};
  }

  /**
   * 获取指定路径的 API 信息
   * @param apiPath API 路径，支持格式：/api/users、/api/users/create、api/users/create
   * @returns API 信息对象或 undefined
   */
  public getApiByPath(apiPath: string): any {
    const serialized = this.getSerializableApis();
    const filtered = this.filterByPath(serialized, apiPath);

    // 如果结果为空对象，返回 undefined
    if (Object.keys(filtered).length === 0) {
      return undefined;
    }

    return filtered;
  }
}