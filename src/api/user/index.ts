import { requestGet, requestPost } from "../api";

export interface UserProfile {
  /** Login account for read-only display; never included in the profile update payload. */
  account?: string;
  username: string;
  nickName: string;
  gender?: number;
  birthday?: string;
  summary?: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface UserProfileUpdateParams {
  nickName?: string;
  gender?: number;
  avatar?: string;
  birthday?: string;
  summary?: string;
}

interface UserProfileResponse {
  code: number;
  msg: string;
  data?: UserProfile | null;
}

interface UserAvatarUpdateResponse {
  code: number;
  msg: string;
  data?: UserProfile | null;
}

export const urls = {
  /**用户详情 */
  userInfo: "/auth/cs/user/info",
  /**个人资料 */
  userProfile: "/platform/user/profile",
  /**修改个人资料 */
  updateUserProfile: "/platform/user/profile/update",
  updateUserAvatar: "/platform/user/profile/avatar/update",
};

/**
 * 获取用户详情
 * @param param
 * @returns
 */
export const getUserInfo = () => {
  return requestGet(urls.userInfo, {});
};

/** 获取当前登录用户的个人资料。 */
export const getUserProfile = () => {
  return requestGet<Record<string, never>, UserProfileResponse>(urls.userProfile, {});
};

/** 更新个人资料，登录账号不允许提交修改。 */
export const updateUserProfile = (params: UserProfileUpdateParams) => {
  return requestPost<UserProfileUpdateParams, UserProfileResponse>(urls.updateUserProfile, params);
};

/** Update only the current user's avatar. */
export const updateUserAvatar = (params: Pick<UserProfileUpdateParams, "avatar">) => {
  return requestPost<Pick<UserProfileUpdateParams, "avatar">, UserAvatarUpdateResponse>(urls.updateUserAvatar, params);
};
