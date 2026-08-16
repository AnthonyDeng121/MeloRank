/// <reference types="vite/client" />

declare module '*.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.sass' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.less' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.styl' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.stylus' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.svg'
declare module '*.webp'
declare module '*.avif'
declare module '*.ico'
declare module '*.woff'
declare module '*.woff2'
declare module '*.eot'
declare module '*.ttf'
declare module '*.otf'
