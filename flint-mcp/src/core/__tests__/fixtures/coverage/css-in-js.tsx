// Fixture: styled-components — css-in-js-detected
import React from 'react'
import styled from 'styled-components'

const Box = styled.div`
    background: red;
    padding: 16px;
`

export function Card() {
    return <Box>Hello</Box>
}
