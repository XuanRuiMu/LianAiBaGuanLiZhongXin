import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { 调开放接口, 通用参数 } from './公共';

export class 语音合成 implements INodeType {
  description: INodeTypeDescription = {
    displayName: '恋爱吧语音合成',
    name: 'liaolian语音合成',
    group: ['transform'],
    version: 1,
    description: '调用 TTS 服务合成中文语音',
    defaults: { name: '恋爱吧语音合成' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      ...通用参数(),
      {
        displayName: '文本',
        name: '文本',
        type: 'string',
        default: '你好，这里是恋爱吧管理中心',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const 文本 = this.getNodeParameter('文本', 0) as string;
    const 数据 = await 调开放接口(this, '语音合成', 'POST', {}, { 文本 });
    return [[{ json: 数据 as IDataObject }]];
  }
}
