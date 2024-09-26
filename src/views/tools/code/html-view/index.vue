<script setup lang="ts">
import { ref, useTemplateRef, defineAsyncComponent, reactive, onMounted } from "vue";
import Loading from "@/components/loading";
import TestHTml from "./test/test.html?raw"

const MonacoEditor = defineAsyncComponent({
  loader: () => import("@/components/monaco-editor"),
  loadingComponent: Loading,
});
const htmlPreviewEl = useTemplateRef("htmlPreviewRef");

const editorOption = reactive<any>({
  theme: "vs",
  commonKeyword: "",
  editValue: TestHTml,
  languageModel: "html",
  hightChange: false,
  options: {
    minimap: {
      enabled: true,
    },
  },
});

const editorMounted = (editor: any) => {
  // console.log("%ceditor实例加载完成", "color: #229453");
  // console.log("editor实例加载完成", editor);
};

const saveFiles=()=>{
  const iframeDocument = htmlPreviewEl.value?.contentDocument || htmlPreviewEl.value?.contentWindow?.document;
  if(!iframeDocument)return;
  iframeDocument.open();
  iframeDocument.write(editorOption.editValue);
  iframeDocument.close();
}
onMounted(()=>{
saveFiles()

})
</script>

<template>
  <div class="html-preview-container">
    <div class="html-preview-content">
      <div class="html-preview-code">
        <MonacoEditor
          v-model="editorOption.editValue"
          :language="editorOption.languageModel"
          :hight-change="editorOption.hightChange"
          :options="(editorOption.options as any)"
          :theme="editorOption.theme"
          :read-only="false"
          @editor-mounted="editorMounted"
          @save="saveFiles"
          class="html-preview_editor"></MonacoEditor>
      </div>
      <div class="html-gutter"></div>
      <div class="html-preview-result">
        <iframe frameborder="0" width="100%" height="100%" ref="htmlPreviewRef"></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.html-preview-container {
  width: 100%;
  padding: 60px 16px 0;
}
.html-preview-content {
  width: 100%;
  min-height: 500px;
  height: 80vh;
  background: var(--yh-bg-color-container);
  display: flex;
  border: solid 1px var(--yh-border-level-1-color);
}
$gutter-width: 1px;
.html-preview-code {
  width: calc(50% - $gutter-width);
  height: 100%;
}
.html-gutter {
  width: $gutter-width;
  background-color: var(--yh-border-level-1-color);
}
.html-preview-result {
  width: 50%;
  height: 100%;
}
.html-preview_editor {
  width: 100%;
  height: 100%;
}
</style>
