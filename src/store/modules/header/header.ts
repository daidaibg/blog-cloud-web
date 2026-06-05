import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
// import { storeToRefs } from 'pinia';
export const useHeaderStore = defineStore('header', () => {
    const headerSearch = reactive<{
        keywords:string,
        searchVersion:number
    }>({
        keywords:"",
        searchVersion:0
    })

    const setSearchKeywords=(val:string)=>{
        headerSearch.keywords=val
    }

    const submitSearch=(val:string)=>{
        setSearchKeywords(val)
        headerSearch.searchVersion++
    }
    return {headerSearch,setSearchKeywords,submitSearch}
})
