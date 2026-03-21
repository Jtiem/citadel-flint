/**
 * Built-in Recipes — src/data/builtinRecipes.ts
 *
 * Pre-composed component patterns that can be inserted into the active file
 * with a single click from the Recipe Strip in Build mode.
 *
 * These serve as the fallback set when no `.flint/recipes.json` exists in
 * the project root. All JSX snippets comply with Mithril Safety Rule C2:
 * every className uses palette token classes — no hardcoded hex or arbitrary
 * Tailwind values.
 *
 * Adding a recipe:
 *   1. Pick an id that is kebab-case and globally unique.
 *   2. List every registered component name used in `components[]`.
 *      An empty array means the snippet uses only native HTML elements.
 *   3. Write the jsxSnippet as a valid JSX fragment (single root element).
 *   4. List any import statements the snippet needs in `imports[]`.
 *      Leave empty when only native elements are used.
 *   5. Use a lucide-react icon name for `icon` (string, not JSX).
 */

export interface ComponentRecipe {
    /** Stable kebab-case identifier. */
    id: string
    /** Display name shown on the recipe chip. */
    name: string
    /** One-line description shown in the tooltip. */
    description: string
    /** Visual grouping for future filter UX. */
    category: 'form' | 'layout' | 'navigation' | 'content' | 'feedback'
    /**
     * Component names that this recipe uses.
     * Matched against the component card store for registry validation.
     * Empty array = only native HTML elements are used.
     */
    components: string[]
    /** The JSX string to insert as a new child of the root JSX element. */
    jsxSnippet: string
    /** Import statements to prepend to the file when inserting. */
    imports: string[]
    /** Lucide icon name (string). Resolved to an icon component at render time. */
    icon: string
}

export const BUILTIN_RECIPES: ComponentRecipe[] = [
    {
        id: 'login-form',
        name: 'Login Form',
        description: 'Email + password fields with submit button',
        category: 'form',
        components: ['Input', 'Button'],
        jsxSnippet: [
            '<form className="flex flex-col gap-4 p-6">',
            '  <Input type="email" label="Email" required />',
            '  <Input type="password" label="Password" required />',
            '  <Button variant="primary">Sign in</Button>',
            '</form>',
        ].join('\n'),
        imports: [],
        icon: 'LogIn',
    },
    {
        id: 'hero-section',
        name: 'Hero Section',
        description: 'Full-width hero with heading, subtext, and CTA',
        category: 'content',
        components: ['Button'],
        jsxSnippet: [
            '<section className="flex flex-col items-center gap-6 py-24 text-center">',
            '  <h1 className="text-4xl font-bold text-zinc-100">Welcome</h1>',
            '  <p className="max-w-md text-lg text-zinc-400">',
            '    Build beautiful, governed UI with confidence.',
            '  </p>',
            '  <Button variant="primary">Get Started</Button>',
            '</section>',
        ].join('\n'),
        imports: [],
        icon: 'Sparkles',
    },
    {
        id: 'nav-bar',
        name: 'Navigation Bar',
        description: 'Horizontal nav with logo and links',
        category: 'navigation',
        components: [],
        jsxSnippet: [
            '<nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">',
            '  <span className="font-bold text-lg text-zinc-100">Logo</span>',
            '  <div className="flex gap-6">',
            '    <a href="#" className="text-zinc-400 hover:text-zinc-100">Home</a>',
            '    <a href="#" className="text-zinc-400 hover:text-zinc-100">About</a>',
            '    <a href="#" className="text-zinc-400 hover:text-zinc-100">Contact</a>',
            '  </div>',
            '</nav>',
        ].join('\n'),
        imports: [],
        icon: 'Navigation',
    },
    {
        id: 'card-grid',
        name: 'Card Grid',
        description: '3-column responsive card layout',
        category: 'layout',
        components: ['Card'],
        jsxSnippet: [
            '<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">',
            '  <Card title="Feature 1">Description of the first feature.</Card>',
            '  <Card title="Feature 2">Description of the second feature.</Card>',
            '  <Card title="Feature 3">Description of the third feature.</Card>',
            '</div>',
        ].join('\n'),
        imports: [],
        icon: 'LayoutGrid',
    },
    {
        id: 'feedback-toast',
        name: 'Feedback Toast',
        description: 'Success / error notification banner',
        category: 'feedback',
        components: [],
        jsxSnippet: [
            '<div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-3">',
            '  <span className="text-emerald-400" aria-hidden="true">✓</span>',
            '  <span className="text-sm text-zinc-200">Changes saved successfully.</span>',
            '</div>',
        ].join('\n'),
        imports: [],
        icon: 'Bell',
    },
    {
        id: 'data-table',
        name: 'Data Table',
        description: 'Striped table with header row',
        category: 'content',
        components: [],
        jsxSnippet: [
            '<div className="overflow-x-auto rounded-lg border border-zinc-800">',
            '  <table className="w-full text-sm">',
            '    <thead className="border-b border-zinc-800 bg-zinc-900">',
            '      <tr>',
            '        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Name</th>',
            '        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>',
            '        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Updated</th>',
            '      </tr>',
            '    </thead>',
            '    <tbody className="divide-y divide-zinc-800 bg-zinc-950">',
            '      <tr>',
            '        <td className="px-4 py-3 text-zinc-100">Item A</td>',
            '        <td className="px-4 py-3 text-emerald-400">Active</td>',
            '        <td className="px-4 py-3 text-zinc-400">Today</td>',
            '      </tr>',
            '      <tr>',
            '        <td className="px-4 py-3 text-zinc-100">Item B</td>',
            '        <td className="px-4 py-3 text-amber-400">Pending</td>',
            '        <td className="px-4 py-3 text-zinc-400">Yesterday</td>',
            '      </tr>',
            '    </tbody>',
            '  </table>',
            '</div>',
        ].join('\n'),
        imports: [],
        icon: 'Table',
    },
]
