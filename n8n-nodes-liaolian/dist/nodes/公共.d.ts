import { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';
export declare function 调开放接口(上下文: IExecuteFunctions, 路径: string, 方法?: string, 查询?: Record<string, string>, 请求体?: unknown): Promise<unknown>;
export declare function 通用参数(): INodeTypeDescription['properties'];
