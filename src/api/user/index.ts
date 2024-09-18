import { requestGet, requestPost, getPublic } from "../api";

export const urls = {
  /**用户详情 */
  userInfo: "/auth/cs/user/info",
};

/**
 * 获取用户详情
 * @param param
 * @returns
 */
export const getUserInfo = () => {
  return requestGet(urls.userInfo, {});
};
