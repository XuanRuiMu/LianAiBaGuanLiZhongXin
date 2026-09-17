"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.语音合成 = void 0;
const __1 = require("./\u516C\u5171");
class 语音合成 {
    constructor() {
        this.description = {
            displayName: '恋爱吧语音合成',
            name: 'liaolian语音合成',
            group: ['transform'],
            version: 1,
            description: '调用 TTS 服务合成中文语音',
            defaults: { name: '恋爱吧语音合成' },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                ...(0, __1.通用参数)(),
                {
                    displayName: '文本',
                    name: '文本',
                    type: 'string',
                    default: '你好，这里是恋爱吧管理中心',
                },
            ],
        };
    }
    async execute() {
        const 文本 = this.getNodeParameter('文本', 0);
        const 数据 = await (0, __1.调开放接口)(this, '语音合成', 'POST', {}, { 文本 });
        return [[{ json: 数据 }]];
    }
}
exports.语音合成 = 语音合成;
