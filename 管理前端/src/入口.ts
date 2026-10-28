import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './主题.css';
import App from './根组件.vue';
import 路由器 from './router/路由表';

const 应用 = createApp(App);
应用.use(createPinia());
应用.use(路由器);
应用.mount('#ying-yong');
