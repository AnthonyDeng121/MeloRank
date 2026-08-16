// 声明romanize模块，解决TypeScript类型错误
declare module 'romanize' {
  function romanize(str: string): string;
  export default romanize;
}
