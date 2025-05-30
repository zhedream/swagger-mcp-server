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
}