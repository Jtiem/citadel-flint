import React from 'react'
// NOTE: postcss-less is not installed in this test environment
// This import should yield resolved: false, failureReason: "module-parse-error"
// because LESS syntax is not parseable without the postcss-less plugin
import s from './style.module.less'

export function Component() {
  return <button className={s.button}>Click me</button>
}
