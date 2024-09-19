import { requestPost, requestGet } from "../api";
import type { MessageOptions } from "element-plus";

export const Home = {
  blogList: "/index/blog/list", //首页博客列表
  categoryPage: "/blog/category/page", //博客分类列表
  blogSearch: "/index/blog/search", //头部博客搜索
  upload: "/platform/oss/upload", //上传文件

  deleteBlog: "/blog/del/", //删除博客
  addBlog: "/blog/add", //新增博客
  iBlogList: "/blog/page", //我的博客列表
  publish: "/blog/publish/", //发布博客
  blogDetail: "/blog/info/", //博客详情  需要登录
  /**获取博客详情不需要登录 */
  noLoginBlogDetail: "/index/info/", //博客详情  不需要登录
  updataBlog: "/blog/update", //更新博客
  blogLike: "/blog/like", //点赞

  login: "/auth/cs/user/login", //登录
  register: "/auth/cs/user/register", //注册
  registerEmail: "/auth/cs/user/register", //邮箱注册
  captchaEmail: "/captcha/email", //验证码
};

export interface GetBlogListType {
  current: number;
  size: number;
  type: string;
  categoryId: string | number;
  keywords: string | number;
}

//获取博客列表
export const getBlog = (param: GetBlogListType) => {
  return requestGet<
    GetBlogListType,
    { code: number; data: { records: any; totalPage: number }; msg: MessageOptions['message'] }
  >(Home.blogList, param);
};

//登录
export const postLogin = (param: any) => {
  return requestPost(Home.login, param);
  // return requestPost(Home.login, param, { enc: false, 'Content-Type': 'application/x-www-form-urlencoded' })
};

/**博客详情 */
export const getBlogDetail = (id: string | number) => {
  return requestGet(Home.blogDetail + id, {});
};

/**
 * 获取博客详情不需要登录
 * @param param
 * @returns
 */
export const getNoLoginBlogDetail = (id: string | number) => {
  return requestGet(Home.noLoginBlogDetail + id, {});
};

/**
 * 博客分页列表
 */
export const getBlogCategoryPage = (param: any) => {
  return requestGet(Home.categoryPage, param);
};

/**
 * 验证码
 */
export const getCaptchaEmail = (param: any) => {
  return requestGet(Home.captchaEmail, param);
};

/**新增博客 */
export const addBlog = (param: any) => {
  return requestPost(Home.addBlog, param);
};

/**更新博客 */
export const updateBlog = (param: any) => {
  return requestPost(Home.updataBlog, param);
};

/**点赞 */
export const postBlogLike = (param: any) => {
  return requestPost(Home.blogLike, param);
};

/**邮箱注册 */
export const registerEmail = (param: any) => {
  return requestPost(Home.registerEmail, param);
};