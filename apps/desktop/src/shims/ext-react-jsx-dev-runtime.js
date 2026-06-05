import { Fragment, createElement } from 'react'

export { Fragment }

export function jsxDEV(type, props, key) {
  if (key === undefined) return createElement(type, props)
  return createElement(type, { ...props, key })
}
