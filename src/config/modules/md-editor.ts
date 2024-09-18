import screenfull from "screenfull";
import { config } from "md-editor-v3";
import TargetBlankExtension from "./target-blank-extension";
//新的
//@ts-ignore
import MarkExtension from "markdown-it-mark";
//老的
// import MarkExtension from '@/utils/marked-mark';


let mdEditorConfigFlag = false;
// console.log(import.meta.env);

export const cdnBase =window.location.origin+ import.meta.env.BASE_URL +"/cdns";
export const bootCdn="https://cdn.bootcdn.net/ajax/libs"

// const highlightJsBaseCdn = `${cdnBase}/highlight.js/11.8.0/`;
const highlightJsBaseCdn = `${bootCdn}/highlight.js/11.10.0/`;
// 代码高亮cdn链接

export const generateId = (text: string, level: number, index: number): string => {
  const id = (text + "_" + index).replace(/ /g, "-");
  // const id =(text+"_"+index).replace(/ /g, '-')
  return id;
};

// const getId = (text: string, level: string | number, raw: any, index: number) => {
//     return `gaobug-heade-${index}`;
// };


export const mdEditorConfig = () => {
  if (mdEditorConfigFlag) return;
  // console.log("mdEditorConfigFlag", mdEditorConfigFlag);
  try {
    config({
      iconfontType: "svg",

      markdownItConfig(md: any) {
        md.use(MarkExtension); //新的mark 扩展
        md.use(TargetBlankExtension);
      },

      // markedExtensions: [MarkExtension],//老的mark 扩展

      editorExtensions: {
        // iconfont: `${cdnBase}/iconfont/md-edit.js`,
        iconfont: `//at.alicdn.com/t/c/font_4686998_l8iumyyg8j.js`,
        highlight: {
          js: `${highlightJsBaseCdn}/highlight.min.js`,
          css: {
            atom: {
              light: `${highlightJsBaseCdn}/styles/atom-one-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/atom-one-dark.min.css`,
            },
            a11y: {
              light: `${highlightJsBaseCdn}/styles/a11y-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/a11y-dark.min.css`,
            },
            github: {
              light: `${highlightJsBaseCdn}/styles/github.min.css`,
              dark: `${highlightJsBaseCdn}/styles/github-dark.min.css`,
            },
            gradient: {
              light: `${highlightJsBaseCdn}/styles/gradient-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/gradient-dark.min.css`,
            },
            kimbie: {
              light: `${highlightJsBaseCdn}/styles/kimbie-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/kimbie-dark.min.css`,
            },
            paraiso: {
              light: `${highlightJsBaseCdn}/styles/paraiso-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/paraiso-dark.min.css`,
            },
            qtcreator: {
              light: `${highlightJsBaseCdn}/styles/qtcreator-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/qtcreator-dark.min.css`,
            },
            stackoverflow: {
              light: `${highlightJsBaseCdn}/styles/stackoverflow-light.min.css`,
              dark: `${highlightJsBaseCdn}/styles/stackoverflow-dark.min.css`,
            },
          },
        },
        katex: {
          js: `${bootCdn}/KaTeX/0.16.9/katex.min.js`,
          css: `${bootCdn}/KaTeX/0.16.9/katex.min.css`,
        },
        screenfull: {
          instance: screenfull,
        },
        mermaid: {
          js: `${bootCdn}/mermaid/10.9.1/mermaid.esm.min.mjs`,
        },
        cropper:{
          js: `${bootCdn}/cropperjs/1.6.2/cropper.min.js`,
          css: `${bootCdn}/cropperjs/1.6.2/cropper.min.css`,
        },
        prettier: {
          standaloneJs: `${bootCdn}/prettier/2.8.8/standalone.min.js`,
          parserMarkdownJs: `${bootCdn}/prettier/2.8.8/parser-markdown.min.js`,
        }
      },
    });

    mdEditorConfigFlag = true;
  } catch (error) {
    mdEditorConfigFlag = false;
    throw error;
  }
};

