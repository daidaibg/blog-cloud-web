// 不使用 api 文件夹里面统一封装的方法/拦截器（如有全局拦截器会影响此接口），
// 此处提供一个独立函数，按需调用并返回原始响应数据。

import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

const BASE_URL = "https://wzz.wangzouzou.com/motion/api/motion";

export interface XiaomiMotionPayload {
  // 根据实际接口字段补充类型；使用 any 以保持灵活
  [key: string]: any;
}

export interface XiaomiMotionResult<T = any> {
  success: boolean;
  code?: number;
  message?: string;
  data?: T;
}

export async function send<T = any>(): Promise<any> {
  const payload = {
    website: "0659a209-5e84-4283-9657-243026b37771",
    screen: "430x932",
    language: "zh-CN",
    title: "出去走走.",
    hostname: "m.cqzz.top",
    url: "https://m.cqzz.top/",
    referrer: "",
  };

  await fetch("https://tongji.wangzouzou.com//api/send", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",

      // "x-umami-cache": "optional-cache-id", // 如果你之前服务器返回过，可以带上
    },
    body: JSON.stringify({
      type: "event",
      payload,
    }),
  }).then((res)=>{
	console.log(res);
  })
}

/**
 * 使用 FormData 向 Xiaomi motion 提交（单条记录）
 * 浏览器环境下不要手动设置 Content-Type，让浏览器自动处理 boundary
 */
export async function sendXiaomiMotionForm<T = any>(
  formData: FormData,
  config?: AxiosRequestConfig
): Promise<XiaomiMotionResult<T>> {
  try {
    const axiosConfig: AxiosRequestConfig = Object.assign(
      {
        timeout: 15000,
      },
      config || {}
    );

    const url = `${BASE_URL}/Xiaomi`;
    const resp: AxiosResponse = await axios.post(url, formData, axiosConfig);

    return {
      success: true,
      code: resp.status,
      data: resp.data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "请求失败",
      code: error?.response?.status,
    };
  }
}
