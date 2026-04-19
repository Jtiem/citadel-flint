import React from 'react'
// SECURITY TEST: This import attempts to escape the project root.
// The resolver MUST reject this WITHOUT reading the referenced file.
// path.relative(projectRoot, resolved) starts with '..' → blocked.
import s from '../../../../../etc/passwd.module.css'

export function Component() {
  return <div className={s.active}>Hello</div>
}
