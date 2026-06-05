<script setup lang="ts">
import Props from "./props";
import { useBlogAction } from "@/hook/modules/use-blog-action";
import { articleDetailsConfig } from "@/config/article";
import { windowScrollTo } from "@/utils/scroll";
import { useRouter } from "vue-router";
import { vClickEmoji } from "@/directives/gsap/click-emoji/click-emoji";
import { computed } from "vue";
import type { ActionLikePayload } from "../type";

const { blogLike } = useBlogAction();
const props = defineProps(Props);
const router = useRouter();
const details = computed(() => props.details || {});
const isLiked = computed(() => !!details.value.isLike);
const likeCount = computed(() => Number(details.value.likeCount) || 0);
const commentNum = computed(() => Number(details.value.openComment) || 0);
const collectCount = computed(() => Number(details.value.collectCount) || 0);

const emits = defineEmits<{
  (e: "like", payload: ActionLikePayload): void;
}>();

//点赞
const onLike = () => {
  blogLike(
    {
      targetId: details.value.id,
      targetType: 1,
      likeFlag: isLiked.value ? 0 : 1,
    },
    {
      success: (res: any) => {
        // console.log(res);
        const nextLiked = !isLiked.value;
        const nextLikeCount = Math.max(likeCount.value + (nextLiked ? 1 : -1), 0);
        emits("like", {
          res,
          isLike: nextLiked,
          likeCount: nextLikeCount,
        });
      },
    }
  );
};

const goComment = async (): Promise<void> => {
  const id = "#" + articleDetailsConfig.commentAnchor;
  router.replace({ hash: id });
  windowScrollTo(id, 74);
  // console.log(comment,scrollContainer,scrollTop,offsetTop,top);
};

</script>

<template>
  <div class="detail-actions detail-root">
    <div class="action_item" :class="{ liked: isLiked }" @click="onLike" v-click-emoji="{ type: isLiked ? 'cancel' : 'like' }">
      <i class="dd-icon-dianzan_kuai icon"></i>
      <span class="badge" v-show="likeCount != 0">{{ likeCount }}</span>
    </div>
    <div class="action_item" @click="goComment">
      <i class="dd-icon-pinglun1 icon"></i>
      <span class="badge" v-show="commentNum != 0">{{ commentNum }}</span>
    </div>
    <div class="action_item">
      <i class="dd-icon-shoucang1 icon"></i>
      <span class="badge" v-show="collectCount != 0">{{ collectCount }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-actions {
  position: fixed;
  top: 140px;
  margin-left: -70px;

  .action_item {
    position: relative;
    margin-bottom: 20px;
    width: 48px;
    height: 48px;
    background-color: var(--yh-bg-color-container);
    border-radius: 50%;
    // box-shadow: var(--yh-shadow-1);
    box-shadow: $primary-shadow;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    .icon {
      font-size: 20px;
      color: var(--yh-text-color-placeholder);
    }

    .badge {
      content: attr(badge);
      position: absolute;
      top: 0;
      left: 75%;
      height: 17px;
      line-height: 17px;
      padding: 0 5px;
      border-radius: 9px;
      font-size: 11px;
      text-align: center;
      white-space: nowrap;
      background-color: var(--bages-bg);
      color: var(--bages-color);
    }

    &:hover {
      background: var(--yh-bg-color-container-hover);

      .icon {
        color: var(--yh-text-color-secondary);
      }
    }

    &.liked {
      .icon {
        color: var(--yh-brand-color);
      }

      .badge {
        background-color: var(--yh-brand-color);
        color: var(--yh-text-color-anti);
      }
    }
  }
}
</style>
