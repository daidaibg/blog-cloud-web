// 不使用 api 文件夹里面统一封装的方法/拦截器（如有全局拦截器会影响此接口），
// 此处提供一个独立函数，按需调用并返回原始响应数据。

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

const BASE_URL = 'https://wzz.wangzouzou.com/motion/api/motion'

export interface XiaomiMotionPayload {
	// 根据实际接口字段补充类型；使用 any 以保持灵活
	[key: string]: any
}

export interface XiaomiMotionResult<T = any> {
	success: boolean
	code?: number
	message?: string
	data?: T
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
				timeout: 15000
			},
			config || {}
		)

		const url = `${BASE_URL}/Xiaomi`
		const resp: AxiosResponse = await axios.post(url, formData, axiosConfig)

		return {
			success: true,
			code: resp.status,
			data: resp.data
		}
	} catch (error: any) {
		return {
			success: false,
			message: error?.message || '请求失败',
			code: error?.response?.status
		}
	}
}


