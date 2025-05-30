export class SwaggerParser {
  constructor(swaggerData) {
    this.swagger = swaggerData;
    this.apis = {};
    this.refCache = new Map(); // 添加引用缓存
    this.parsingRefs = new Set(); // 用于检测循环引用
  }

  parseApis() {
    const paths = this.swagger.paths;
    for (const path in paths) {
      const pathItem = paths[path];
      for (const method in pathItem) {
        if (method === 'parameters') continue; // 跳过路径级别的参数
        const operation = pathItem[method];
        const apiInfo = this.parseOperation(operation, method, path);

        const tag = (operation.tags && operation.tags[0]) || 'default';
        if (!this.apis[tag]) {
          this.apis[tag] = [];
        }
        this.apis[tag].push(apiInfo);
      }
    }
    return this.apis;
  }

  parseOperation(operation, method, path) {
    try {
      return {
        path,
        method: method.toUpperCase(),
        summary: operation.summary || '',
        tags: operation.tags || [],
        parameters: this.parseParameters(operation),
        requestBody: this.parseRequestBody(operation.requestBody),
        responses: this.parseResponses(operation.responses)
      };
    } catch (error) {
      console.warn(`解析操作失败 ${method} ${path}:`, error);
      return {
        path,
        method: method.toUpperCase(),
        summary: operation.summary || '',
        tags: operation.tags || [],
        error: '解析失败'
      };
    }
  }

  parseParameters(operation) {
    if (!operation.parameters) return [];
    return operation.parameters.map(param => {
      try {
        return {
          name: param.name,
          in: param.in,
          required: param.required || false,
          type: param.schema?.type || 'string',
          description: param.description || ''
        };
      } catch (error) {
        console.warn('解析参数失败:', error);
        return { name: param.name, error: '解析失败' };
      }
    });
  }

  parseRequestBody(requestBody) {
    if (!requestBody) return null;
    try {
      const content = requestBody.content;
      if (!content) return null;

      const contentType = Object.keys(content)[0];
      return {
        contentType,
        schema: this.parseSchema(content[contentType].schema),
        required: requestBody.required || false
      };
    } catch (error) {
      console.warn('解析请求体失败:', error);
      return { error: '解析失败' };
    }
  }

  parseResponses(responses) {
    const parsedResponses = {};
    for (const statusCode in responses) {
      try {
        const response = responses[statusCode];
        const content = response.content;
        if (!content) {
          parsedResponses[statusCode] = {
            description: response.description || ''
          };
          continue;
        }

        const contentType = Object.keys(content)[0];
        parsedResponses[statusCode] = {
          description: response.description || '',
          contentType,
          schema: this.parseSchema(content[contentType].schema)
        };
      } catch (error) {
        console.warn(`解析响应 ${statusCode} 失败:`, error);
        parsedResponses[statusCode] = { error: '解析失败' };
      }
    }
    return parsedResponses;
  }

  parseSchema(schema) {
    if (!schema) return null;

    try {
      // 处理引用
      if (schema.$ref) {
        return this.resolveReference(schema.$ref);
      }

      const parsed = {
        type: schema.type
      };

      // 处理属性
      if (schema.properties) {
        parsed.properties = {};
        for (const prop in schema.properties) {
          parsed.properties[prop] = this.parseSchema(schema.properties[prop]);
        }
      }

      // 处理数组
      if (schema.items) {
        parsed.items = this.parseSchema(schema.items);
      }

      // 处理其他可能的字段
      if (schema.format) parsed.format = schema.format;
      if (schema.enum) parsed.enum = schema.enum;
      if (schema.default !== undefined) parsed.default = schema.default;
      if (schema.description) parsed.description = schema.description;
      if (schema.required) parsed.required = schema.required;

      return parsed;
    } catch (error) {
      console.warn('解析 schema 失败:', error);
      return { error: '解析失败' };
    }
  }

  resolveReference(ref) {
    // 检查缓存
    if (this.refCache.has(ref)) {
      return this.refCache.get(ref);
    }

    // 检查循环引用
    if (this.parsingRefs.has(ref)) {
      return { $ref: ref, circular: true };
    }

    try {
      this.parsingRefs.add(ref);

      const parts = ref.split('/');
      let current = this.swagger;
      for (let i = 1; i < parts.length; i++) {
        current = current[parts[i]];
        if (!current) {
          throw new Error(`引用路径不存在: ${ref}`);
        }
      }

      const resolved = this.parseSchema(current);
      this.refCache.set(ref, resolved);
      this.parsingRefs.delete(ref);
      return resolved;
    } catch (error) {
      console.warn(`解析引用失败 ${ref}:`, error);
      this.parsingRefs.delete(ref);
      return { $ref: ref, error: '解析失败' };
    }
  }
}

// let controller = ''
// let method = ''
// let apis = null
// init()
//   .then(data => {
//     const parser = new SwaggerParser(data);
//     apis = parser.parseApis();
//     // console.log('已解析的 API:', apis);
//     // return apis[controller][method]
//   })
//   .catch(error => {
//     console.error('获取或解析 swagger.json 时出错:', error);
//     console.error('错误堆栈:', error.stack);
//   });

// async function init() {
//   await fetch('http://172.16.12.52:8099/Car_Center/swagger.json')
//     .then(response => response.json())
//     .then(data => {
//       const parser = new SwaggerParser(data);
//       apis = parser.parseApis();
//     });
// }
// // 获取接口信息
// function getApiInfo(controller, method) {
//   return apis[controller][method]
// }

