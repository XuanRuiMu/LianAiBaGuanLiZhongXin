import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export async function 调开放接口(
  上下文: IExecuteFunctions,
  路径: string,
  方法 = 'GET',
  查询: Record<string, string> = {},
  请求体: unknown = undefined,
): Promise<unknown> {
  const 服务地址 = 上下文.getNodeParameter('服务地址', 0) as string;
  const 接口密钥 = 上下文.getNodeParameter('接口密钥', 0) as string;
  // YH-113 令牌直通：空令牌拒绝发起，禁无凭证调管理后端
  if (!接口密钥 || 接口密钥.trim().length < 16) {
    throw new Error('开放接口令牌缺失或长度不足，拒绝发起调用');
  }
  const 地址 = new URL(`/api/v1/${路径}`, 服务地址);
  for (const [键, 值] of Object.entries(查询)) 地址.searchParams.set(键, 值);
  const 响应 = await fetch(地址, {
    method: 方法,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 接口密钥 },
    body: 请求体 === undefined ? undefined : JSON.stringify(请求体),
  });
  if (!响应.ok) throw new Error(`开放接口 ${响应.status}`);
  return (await 响应.json()) as unknown;
}

export function 通用参数(): INodeTypeDescription['properties'] {
  return [
    {
      displayName: '服务地址',
      name: '服务地址',
      type: 'string',
      // YH-113 n8n默认改3100：管理后端容器内地址，随行部署同网
      default: 'http://management-backend:3100',
      description: '管理后端地址（容器内3100，宿主经MANAGEMENT_BACKEND_PORT映射）',
    },
    {
      displayName: '接口密钥',
      name: '接口密钥',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: '开放平台接口密钥',
    },
  ];
}
