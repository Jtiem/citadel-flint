import fs from 'node:fs'
import path from 'node:path'
import * as t from '@babel/types'
import generate from '@babel/generator'

// Load Mock Files
const figmaJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'mock-figma-export.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'bridge-manifest.json'), 'utf8')).components

function generateJsxElement(nodeData: any): t.JSXElement {
    const componentDef = manifest[nodeData.figmaComponent]
    if (!componentDef) {
        throw new Error(`Unknown Figma Component used: ${nodeData.figmaComponent}`)
    }

    const jsxName = t.jsxIdentifier(componentDef.componentName)
    const attributes: t.JSXAttribute[] = []
    let childNodes: t.JSXElement[] = []
    let textContent = ""

    // Map Props
    if (nodeData.props) {
        for (const [figmaProp, value] of Object.entries(nodeData.props)) {
            const reactProp = componentDef.propMap[figmaProp]
            if (!reactProp) continue

            // Handle children text explicitly
            if (reactProp === 'children') {
                textContent = String(value)
                continue
            }

            // Normal attribute
            let attrValue: t.JSXAttribute['value'] = t.stringLiteral(String(value))

            // Basic heuristic handling for booleans or numbers if needed
            if (value === "true") attrValue = null
            if (value === "false") attrValue = t.jsxExpressionContainer(t.booleanLiteral(false))
            if (!isNaN(Number(value))) attrValue = t.jsxExpressionContainer(t.numericLiteral(Number(value)))

            attributes.push(t.jsxAttribute(t.jsxIdentifier(reactProp), attrValue))
        }
    }

    // Process nested children (recursively)
    if (nodeData.children && Array.isArray(nodeData.children)) {
        for (const child of nodeData.children) {
            childNodes.push(generateJsxElement(child))
        }
    }

    // Build the opening and closing tags
    const opening = t.jsxOpeningElement(jsxName, attributes, childNodes.length === 0 && !textContent)
    const closing = childNodes.length === 0 && !textContent ? null : t.jsxClosingElement(jsxName)

    // Construct the JSXElement
    const childrenBlock: (t.JSXElement | t.JSXText)[] = childNodes
    if (textContent) {
        childrenBlock.unshift(t.jsxText(textContent))
    }

    return t.jsxElement(opening, closing, childrenBlock)
}

function processFigmaToAST() {
    console.log(`🚀 Bridge Hydrator: Processing Screen [${figmaJson.screenName}]`)

    // 1. Collect all necessary imports
    const requiredImports = new Set<string>()
    const treeQueue = [...figmaJson.children]
    while (treeQueue.length > 0) {
        const item = treeQueue.shift()
        const manifestEntry = manifest[item.figmaComponent]
        if (manifestEntry) {
            requiredImports.add(`import { ${manifestEntry.componentName} } from '${manifestEntry.importPath}'`)
        }
        if (item.children) {
            treeQueue.push(...item.children)
        }
    }

    // 2. Generate the React Component Array
    const rootElements = figmaJson.children.map(generateJsxElement)

    // 3. Assemble the file AST
    const screenComponentName = figmaJson.screenName + 'Screen'
    const returnStatement = t.returnStatement(
        rootElements.length === 1
            ? rootElements[0]
            : t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), rootElements)
    )

    const componentFunction = t.exportDefaultDeclaration(
        t.functionDeclaration(
            t.identifier(screenComponentName),
            [],
            t.blockStatement([returnStatement])
        )
    )

    // Assemble the code string
    const importCode = Array.from(requiredImports).join('\n')
    const { code: componentCode } = (generate as any).default(componentFunction)

    const finalFileContent = `${importCode}\n\n${componentCode}\n`

    // Output
    const outPath = path.join(process.cwd(), 'src', 'components', `${screenComponentName}.tsx`)
    fs.writeFileSync(outPath, finalFileContent, 'utf8')
    console.log(`✅ Success! Generated perfect React file at: ${outPath}`)
}

processFigmaToAST()
