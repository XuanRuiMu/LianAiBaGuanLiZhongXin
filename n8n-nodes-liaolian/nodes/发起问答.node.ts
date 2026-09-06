import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { 调开放接口, 通用参数 } from './公共';

export class 发起问答 implements INodeType {
  description: INodeTypeDescription = {
    displayName: '恋爱吧发起问答',
    name: 'liaolian发起问答',
    group: ['transform'],
    version: 1,
    description: '向 AI 助手发起运营问答（经工具总线查询数据）',
    defaults: { name: '恋爱吧发起问答' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      ...通用参数(),
      {
        displayName: '问题',
        name: '问题',
        type: 'string',
        default: '平台最近运营情况如何',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const 问题 = this.getNodeParameter('问题', 0) as string;
    const 数据 = await 调开放接口(this, '问答', 'POST', {}, { 问题 });
    return [[{ json: 数据 as IDataObject }]];
  }
}
