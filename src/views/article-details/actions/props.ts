import { PropType } from 'vue';
import { ActionProps } from "../type"
export default {
  details: {
    type: Object as PropType<ActionProps['details']>,
    default: () => ({})
  }
}
