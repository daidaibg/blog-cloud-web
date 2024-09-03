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
    code: 401, //登陆过期
    ENC_key:import.meta.env.VITE_API_ENC_KEY,
    resourceUrl: "https://www.daidaibg.com",
    get assetsBaseUrl(): string {
        return this.resourceUrl
    }
}
console.log(import.meta.env)
export default UtilVar