<script setup lang="ts">
import { ref, nextTick, computed, reactive } from "vue";
import Props from "./props";
import { ElMessage, ElMessageBox } from "element-plus";
import { emojiObj } from "@/components/emoji/emoji";
import CommentInput from "@/components/comment-input";
import { handleCommen } from "@/utils/current";
import { getCommentList, comment, commentDel } from "@/api/blog/comment";
import { ReqCodeEnum } from "@/enums/request-enums";
import type { CommentListType, PageData } from "./type";
import type { Comment } from "@/api/blog/comment";
import { useUserStore } from "@/store";
import { getTimeInterval } from "@/utils/time";
import dayjs from "dayjs";
import {HotIcon} from "@/components/icons"
import UtilVar from "@/config/UtilVar"

const userStore = useUserStore();
// console.log(emojiList);
const props = defineProps(Props);
// const text=`我是假的，现在还不能评论[看]<p class="a" id='a'>我是p标签</p>`

const commentList = ref<CommentListType[]>([]);
const replyId = ref<string | number>("");
let pagingData = reactive<PageData>({
  current: 1,
  size: 10,
  total: 0,
  totalPage: 1,
});

const isEnd = computed(() => {
  return pagingData.current === pagingData.totalPage;
});

//点击回复
const onReply = (item: CommentListType) => {
  if (item.id === replyId.value) {
    replyId.value = "";
    return;
  }
  replyId.value = item.id;
};

//回复输入框失去焦点
const onReplyIptBlur = (e: Event) => {};

//把数据处理成评论格式
const addCommentHandle = (CommentVal: string): CommentListType => {
  const newConmmenData = {
    context: handleCommen(CommentVal),
    id: Date.now() + "",
    likeCount: 0,
    userName: userStore.userData.nickName as string,
    userAvatar: userStore.userData.avatar as string,
    createTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    userId: userStore.userData.id,
  };
  return newConmmenData;
};

/**
 * @description: 点击评论按钮事件
 * @param {*} CommentVal
 */
const onComment = (CommentVal: string, item?: CommentListType) => {
  if (!userStore.isLogin) {
    ElMessage.warning({message:"暂未登录，请登录后再进行评论！",plain:true});
    return;
  }
  comment({
    linkId: item ? item.id : 0,
    articleId: props.articleId as Comment["articleId"],
    context: handleCommen(CommentVal),
  })
    .then((res) => {
      console.log("comment", res);
      if (res.code == ReqCodeEnum.Success) {
        const newConmmenData = addCommentHandle(CommentVal);
        commentList.value.push(newConmmenData);
        ElMessage.success({message:"评论成功!",plain:true});
      } else {
        ElMessage.error({message:res.msg,plain:true});
      }
    })
    .catch((err) => {
      ElMessage.error({message:err,plain:true});
    });
};

//删除评论
const delComment = (item: CommentListType, i: number) => {
  ElMessageBox.confirm("确定要删除该评论吗?", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
    customClass: "message-box-default",
    // center: true,
    confirmButtonClass: "button-no-active",
  })
    .then(() => {
      commentDel(item.id)
        .then((res: any) => {
          // console.log("commentDel", res);
          if (res.code == ReqCodeEnum.Success) {
            commentList.value.splice(i, 1);
            ElMessage.success({message:"删除成功!",plain:true});
          } else {
            ElMessage.error({message:res.msg,plain:true});
          }
        })
        .catch((err) => {
          ElMessage.error({message:err,plain:true});
        });
    })
    .catch((err) => {
      console.log(err);
      //   取消删除
    });
};

//加载更多评论
const onLoadMoreComment = () => {
  getData(true);
};

//获取评论列表
const getData = (isLoadAll?: boolean) => {
  getCommentList({
    current: pagingData.current,
    size: isLoadAll ? pagingData.total : pagingData.size,
    articleId: props.articleId as Comment["articleId"],
  })
    .then((res: any) => {
      console.log("getCommentList", res);
      if (res.code == ReqCodeEnum.Success) {
        if (isLoadAll) {
          res.data.records.splice(0, 10);
          commentList.value = commentList.value.concat(res.data.records);
          //为了表示最后一页
          pagingData.totalPage = 1;
        } else {
          commentList.value = res.data.records;
          pagingData.totalPage = res.data.totalPage;
          pagingData.total = res.data.total;
          pagingData.total = res.data.total;
        }
      } else {
        ElMessage.error({message:res.msg,plain:true});
      }
    })
    .catch((err) => {
      ElMessage.error({message:err,plain:true});
    });
};
getData();
</script>

<template>
  <div id="comment" class="container-bg mt-16 rounded-6 comments">
    <div class="header-title">评论</div>
    <div class="input_wrap flex">
      <el-avatar :size="40" :src="userStore.getUserData.avatar" class="avatar" />
      <comment-input @comment="onComment"></comment-input>
    </div>
    <div class="header-title flex items-center" >
      <div class="flex items-center" v-if=" commentList.length>0">
        热门评论
        <HotIcon width="16" height="16"/>
      </div>
      <div v-else class="text-center w-full">
        <p>暂无评论！🪹</p>
      </div>
    </div>

    <div class="comment_item flex" v-for="(item, i) in commentList" :key="i">
      <el-image
        :src="
          item.userAvatar
            ? item.userAvatar
            :UtilVar.assetsBaseUrl+ '/static/imgs/avatar/avatar.png'
        "
        lazy
        class="comment_avatar"
        fit="cover"
      />
      <div class="comment_box">
        <div class="comment_main">
          <div class="user-box">
            <span class="name"> {{ item.userName }}</span>
            <span class="time"> {{ getTimeInterval(item.createTime) }}</span>
          </div>
          <p v-html="item.context" class="discuss_item"></p>
          <div class="info-box_action flex items-center">
            <div class="info-box_action-item hovers">
              <i class="dd-icon-dianzan icon"></i>
              <span>{{ item.likeCount }}</span>
            </div>
            <div
              class="info-box_action-item hovers"
              @click="onReply(item)"
              :class="{ replyIconActive: replyId == item.id }"
            >
              <i class="dd-icon-pinglun icon"></i>
              <span>{{ replyId == item.id ? "取消回复" : 0 }}</span>
            </div>
            <div
              class="info-box_action-item ml-auto del"
              v-if="item.userId == userStore.userData.id"
              @click="delComment(item, i)"
            >
              <span>删除</span>
            </div>
          </div>
        </div>
        <!-- 回复框 -->
        <div class="comment_main_reply" v-if="item.id == replyId">
          <comment-input
            @comment="(val:string)=>onComment(val,item)"
            @blur="onReplyIptBlur"
            :placeholder="'回复' + item.userName + '...'"
          ></comment-input>
        </div>
        <!-- 二级评论 -->
        <div class="reply_list"></div>
      </div>
    </div>
    <div
      class="load-more-commen box-variable flex justify-center cursor-pointer py-4"
      @click="onLoadMoreComment"
      v-if="!isEnd && pagingData.totalPage"
    >
      <p>加载全部{{ pagingData.total }}条评论...</p>
    </div>

    <div style="height: 400px"></div>
  </div>
</template>

<style scoped lang="scss">
.comments {
  font-size: 14px;
  padding: 16px 24px;

  .header-title {
    font-size: 18px;
    font-weight: 900;
    margin: 16px 0;
    color: var(--yh-text-color-primary);

    svg {
      margin-left: 4px;
      fill: var(--yh-error-color);
    }
  }

  .input_wrap {
    .avatar {
      flex-shrink: 0;
      margin-right: 16px;
    }

    .commitedit {
      min-height: 58px;
      height: auto;
      word-break: break-all;
    }
  }
}

//评论内容
.discuss_item {
  margin-top: 8px;
  color: var(--yh-text-color-secondary);

  img {
    display: inline;
    width: 20px;
    height: 20px;
    margin: 0 2px;
    vertical-align: sub;
  }
}

.comment_item {
  padding: 16px 0;
  .comment_avatar {
    width: 40px;
    height: 40px;
  }

  .comment_box {
    flex: 1;
    margin-left: 16px;
  }
  .comment_main {
    &:hover {
      .del {
        display: block;
      }
    }
  }
}

//用户名称 时间
.user-box {
  display: flex;

  .name {
    color: var(--yh-text-color-primary);
  }

  .time {
    margin-left: auto;
    color: var(--yh-text-color-placeholder);
  }
}

// 评论action
.info-box_action {
  font-size: 12px;
  margin: 10px 0;

  .info-box_action-item {
    display: flex;
    align-items: center;
    margin-right: 12px;
    line-height: 1;
    cursor: pointer;

    .icon {
      font-size: 14px;
      margin-right: 4px;
      color: var(--yh-text-color-placeholder);
      font-weight: 900;
    }

    span {
      color: var(--yh-text-color-placeholder);
    }

    &:not(.del):hover,
    &:not(.del).replyIconActive {
      .icon,
      span {
        color: var(--yh-brand-color);
      }
    }
    &.del {
      display: none;
      span {
        color: var(--yh-error-color-hover);
      }
      &:hover {
        span {
          color: var(--yh-error-color-active);
        }
      }
    }
  }
}
.load-more-commen {
  background-color: var(--gb-container-hover);
  &:hover {
    color: var(--yh-brand-color);
  }
}
</style>
