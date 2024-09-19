import { uploadImg } from "@/api";
// 上传封面
export const onUploadCover = async (option:any) => {
    const form = new FormData();
    form.append("file", option.file);
   return  uploadImg(form,option)
  
  };
  //上传前
  export const beforeAvatarUpload = (rawFile: any, ElMessage: any) => {
    console.log(rawFile);
    if ( !['image/jpeg', 'image/png','image/gif' ].includes(rawFile.type) ) {
      ElMessage.warning({message:"格式必须为JPG,PNG或GIF!",plain:true})
      return false
    } else if (rawFile.size / 1024 / 1024 > 10) {
      ElMessage.warning({message:"图片大小不能超过10M!",plain:true})
      return false
    }
    return true
  }