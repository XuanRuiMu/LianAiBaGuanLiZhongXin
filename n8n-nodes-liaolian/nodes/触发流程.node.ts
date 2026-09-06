import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { 调开放接口, 通用参数 } from './公共';

export class 触发流程 implements INodeType {
  description: INodeTypeDescription = {
    displayName: '恋爱吧触发流程',
    name: 'liaolian触发流程',
    group: ['transform'],
    version: 1,
    description: '触发可视化编排流程执行',
    defaults: { name: '恋爱吧触发流程' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      ...通用参数(),
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

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const 流程名称 = this.getNodeParameter('流程名称', 0) as string;
    const 输入文本 = this.getNodeParameter('输入', 0) as string;
    let 输入: Record<string, unknown> = {};
    try {
      输入 = JSON.parse(输入文本) as Record<string, unknown>;
    } catch {
      throw new Error('输入不是合法 JSON');
    }
    const 数据 = await 调开放接口(this, '触发编排', 'POST', {}, { 流程名称, 输入 });
    return [[{ json: 数据 as IDataObject }]];
  }
}
