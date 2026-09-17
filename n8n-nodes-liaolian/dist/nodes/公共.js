"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.调开放接口 = 调开放接口;
exports.通用参数 = 通用参数;
async function 调开放接口(上下文, 路径, 方法 = 'GET', 查询 = {}, 请求体 = undefined) {
    const 服务地址 = 上下文.getNodeParameter('服务地址', 0);
    const 接口密钥 = 上下文.getNodeParameter('接口密钥', 0);
    if (!接口密钥 || 接口密钥.trim().length < 16) {
        throw new Error('开放接口令牌缺失或长度不足，拒绝发起调用');
    }
    const 地址 = new URL(`/api/v1/${路径}`, 服务地址);
    for (const [键, 值] of Object.entries(查询))
        地址.searchParams.set(键, 值);
    const 响应 = await fetch(地址, {
        method: 方法,
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 接口密钥 },
        body: 请求体 === undefined ? undefined : JSON.stringify(请求体),
    });
    if (!响应.ok)
        throw new Error(`开放接口 ${响应.status}`);
    return (await 响应.json());
}
function 通用参数() {
    return [
        {
            displayName: '服务地址',
            name: '服务地址',
            type: 'string',
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
