import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { 调开放接口, 通用参数 } from './公共';

export class 查询统计 implements INodeType {
  description: INodeTypeDescription = {
    displayName: '恋爱吧查询统计',
    name: 'liaolian查询统计',
    group: ['transform'],
    version: 1,
    description: '查询平台运营统计（总览/用户趋势）',
    defaults: { name: '恋爱吧查询统计' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      ...通用参数(),
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

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const 查询 = this.getNodeParameter('查询', 0) as string;
    const 数据 = await 调开放接口(this, 查询 === '总览' ? '公开概览' : '公开趋势');
    return [[{ json: 数据 as IDataObject }]];
  }
}
