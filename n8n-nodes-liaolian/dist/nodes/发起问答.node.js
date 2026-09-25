"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.发起问答 = void 0;
const ______1 = require("./\u516C\u5171");
class 发起问答 {
    constructor() {
        this.description = {
            displayName: '恋爱吧发起问答',
            name: 'liaolian发起问答',
            group: ['transform'],
            version: 1,
            description: '向 AI 助手发起运营问答（经工具总线查询数据）',
            defaults: { name: '恋爱吧发起问答' },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                ...(0, ______1.通用参数)(),
                {
                    displayName: '问题',
                    name: '问题',
                    type: 'string',
                    default: '平台最近运营情况如何',
                },
            ],
        };
    }
    async execute() {
        const 问题 = this.getNodeParameter('问题', 0);
        const 数据 = await (0, ______1.调开放接口)(this, '问答', 'POST', {}, { 问题 });
        return [[{ json: 数据 }]];
    }
}
exports.发起问答 = 发起问答;
