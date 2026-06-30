
export interface userDataType {
    [key:string]:string|undefined,
    /** 用户昵称，未登录或接口未返回时为空。 */
    nickName:string|undefined
}
export interface userStoreType {
    /** 当前是否已登录。 */
    isLogin:boolean,
    /** 是否显示登录弹窗。 */
    modelLoginShow:boolean,
    /** 登录成功后需要跳回的页面路径。 */
    loginRedirect:string,
    /** 当前登录用户的基础信息。 */
    userData:userDataType
}
