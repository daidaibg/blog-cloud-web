
export  interface ClassificatioType {
    id:string|number,
    categoryName:string
}

export interface StateType{
    title:string,
    content:string,
    previewTheme:previewTheme,
    dialogVisible:boolean,
    classificatio:Array<ClassificatioType> ,
    id:any

}

export interface FormDataType {
    categoryId: string,
    coverUrl: string,
    tag: string,
    articlesPart: string,
    summary: string,
}