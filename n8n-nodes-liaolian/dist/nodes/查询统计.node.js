"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.查询统计 = void 0;
const __1 = require("./\u516C\u5171");
class 查询统计 {
    constructor() {
        this.description = {
            displayName: '恋爱吧查询统计',
            name: 'liaolian查询统计',
            group: ['transform'],
            version: 1,
            description: '查询平台运营统计（总览/用户趋势）',
            defaults: { name: '恋爱吧查询统计' },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                ...(0, __1.通用参数)(),
                {
                    displayName: '查询',
                    name: '查询',
                    type: 'options',
                    default: '总览',
                    options: [
                        { name: '总览', value: '总览' },
                        { name: '用户趋势', value: '用户趋势' },
                    ],
                },
            ],
        };
    }
    async execute() {
        const 查询 = this.getNodeParameter('查询', 0);
        const 数据 = await (0, __1.调开放接口)(this, 查询 === '总览' ? '公开概览' : '公开趋势');
        return [[{ json: 数据 }]];
    }
}
exports.查询统计 = 查询统计;
