"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.触发流程 = void 0;
const __1 = require("./\u516C\u5171");
class 触发流程 {
    constructor() {
        this.description = {
            displayName: '恋爱吧触发流程',
            name: 'liaolian触发流程',
            group: ['transform'],
            version: 1,
            description: '触发可视化编排流程执行',
            defaults: { name: '恋爱吧触发流程' },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                ...(0, __1.通用参数)(),
                {
                    displayName: '流程名称',
                    name: '流程名称',
                    type: 'string',
                    default: '演示流程',
                },
                {
                    displayName: '输入（JSON）',
                    name: '输入',
                    type: 'string',
                    default: '{}',
                },
            ],
        };
    }
    async execute() {
        const 流程名称 = this.getNodeParameter('流程名称', 0);
        const 输入文本 = this.getNodeParameter('输入', 0);
        let 输入 = {};
        try {
            输入 = JSON.parse(输入文本);
        }
        catch {
            throw new Error('输入不是合法 JSON');
        }
        const 数据 = await (0, __1.调开放接口)(this, '触发编排', 'POST', {}, { 流程名称, 输入 });
        return [[{ json: 数据 }]];
    }
}
exports.触发流程 = 触发流程;
