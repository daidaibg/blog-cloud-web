interface UtilVarType {
    baseUrl: string,
    code: string | number,
    /**签名加密key */
    ENC_key: string,
    assetsBaseUrl: string,
    resourceUrl: string,//资源地址
}

const UtilVar: UtilVarType = {
    baseUrl:import.meta.env.VITE_API_URL,
    /** 登陆过期code */
    code: 401,
    ENC_key:import.meta.env.VITE_API_ENC_KEY,
    resourceUrl: import.meta.env.VITE_API_ENC_KEY.VITE_API_ENC_RESOURCE_URL,
    get assetsBaseUrl(): string {
        return this.resourceUrl
    }
}
console.log(import.meta.env)
export default UtilVar