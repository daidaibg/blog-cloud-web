import {MenuProps} from "@/components/menus"
import { Setting, User } from "@element-plus/icons-vue";
export const settingUserMenuList:MenuProps[] =[
    {
        name:"个人资料",
        iconComponent: User,
        url:'/user/setting/profile',
    }, 
    {
        name:"账号设置",
        iconComponent: Setting,
        url:'/user/setting/account',
    }, 
]
