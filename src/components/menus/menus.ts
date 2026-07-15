import type { Component } from "vue";

export interface MenuSubProps{
    sub?:[],
    url:string,
    name:string,
    icon?:string,
    iconComponent?: Component
}
export interface MenuProps{
    sub?:MenuProps[],
    url:string,
    name:string,
    icon?:string,
    iconComponent?: Component
}
