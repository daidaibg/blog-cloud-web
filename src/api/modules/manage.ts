
import {Home} from "./home"
import { requestPost, requestGet } from "../api";


//我的博客列表
export const getUserBlogList = (param:any)=>{
    return requestGet(Home.iBlogList,param)
}

//删除博客
export const deleteBlog = (id:string)=>{
    return requestPost(Home.deleteBlog+id,{})
}