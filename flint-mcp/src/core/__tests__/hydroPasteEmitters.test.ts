/**
 * D2C.4 Feature 1 — emitNamedComponent + wrapContainer element param tests
 *
 * Tests emitNamedComponent across all 4 library emitters for library-specific
 * component rendering, and wrapContainer with the optional element parameter
 * for semantic HTML wrapper output.
 *
 * Also includes an integration test exercising the full processPayload pipeline
 * with a "LoginForm" frame containing input-named children.
 */

import { describe, it, expect } from 'vitest';
import {
    ShadcnEmitter,
    MuiEmitter,
    PrimeEmitter,
    TailwindLibEmitter,
} from '../hydroPaste-emitters.js';
import { HydroPasteEngine } from '../hydroPaste.js';

// ---------------------------------------------------------------------------
// emitNamedComponent — ShadcnEmitter
// ---------------------------------------------------------------------------

describe('ShadcnEmitter.emitNamedComponent', () => {
    it('emits <Input /> for componentType "Input"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Input', {}, '', 1);
        expect(output).toContain('<Input');
    });

    it('emits compound Select structure for componentType "Select"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Select', {}, '', 1);
        expect(output).toContain('<Select');
        expect(output).toContain('<SelectTrigger');
        expect(output).toContain('<SelectContent');
    });

    it('emits compound Avatar structure for componentType "Avatar"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Avatar', {}, '', 1);
        expect(output).toContain('<Avatar');
        expect(output).toContain('<AvatarImage');
        expect(output).toContain('<AvatarFallback');
    });

    it('emits <Badge> for componentType "Badge"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Badge', {}, '', 1);
        expect(output).toContain('<Badge');
    });

    it('emits <Separator /> for componentType "Separator"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Separator', {}, '', 1);
        expect(output).toContain('<Separator');
    });

    it('emits compound Alert structure for componentType "Alert"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Alert', {}, '', 1);
        expect(output).toContain('<Alert');
        expect(output).toContain('<AlertDescription');
    });

    it('includes props when provided', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('Input', { placeholder: 'Email' }, '', 1);
        expect(output).toContain('placeholder="Email"');
    });

    it('registers imports after emitNamedComponent("Input")', () => {
        const emitter = new ShadcnEmitter();
        emitter.emitNamedComponent('Input', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some(i => i.includes('@/components/ui/input'))).toBe(true);
    });

    it('registers imports for compound components (Select)', () => {
        const emitter = new ShadcnEmitter();
        emitter.emitNamedComponent('Select', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some(i => i.includes('@/components/ui/select'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// emitNamedComponent — MuiEmitter
// ---------------------------------------------------------------------------

describe('MuiEmitter.emitNamedComponent', () => {
    it('emits <TextField /> for componentType "Input"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Input', {}, '', 1);
        expect(output).toContain('<TextField');
    });

    it('emits <Chip /> for componentType "Badge"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Badge', {}, '', 1);
        expect(output).toContain('<Chip');
    });

    it('emits <Switch /> for componentType "Switch"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Switch', {}, '', 1);
        expect(output).toContain('<Switch');
    });

    it('emits <Avatar /> for componentType "Avatar"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Avatar', {}, '', 1);
        expect(output).toContain('<Avatar');
    });

    it('emits <Divider /> for componentType "Separator"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Separator', {}, '', 1);
        expect(output).toContain('<Divider');
    });

    it('emits <Alert> for componentType "Alert"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Alert', {}, '', 1);
        expect(output).toContain('<Alert');
    });

    it('registers @mui/material imports after emitNamedComponent("Input")', () => {
        const emitter = new MuiEmitter();
        emitter.emitNamedComponent('Input', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some(i => i.includes('@mui/material') && i.includes('TextField'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// emitNamedComponent — PrimeEmitter
// ---------------------------------------------------------------------------

describe('PrimeEmitter.emitNamedComponent', () => {
    it('emits <InputText /> for componentType "Input"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Input', {}, '', 1);
        expect(output).toContain('<InputText');
    });

    it('emits <InputSwitch /> for componentType "Switch"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Switch', {}, '', 1);
        expect(output).toContain('<InputSwitch');
    });

    it('emits <Dropdown /> for componentType "Select"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Select', {}, '', 1);
        expect(output).toContain('<Dropdown');
    });

    it('emits <Badge /> for componentType "Badge"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Badge', {}, '', 1);
        expect(output).toContain('<Badge');
    });

    it('emits <Avatar /> for componentType "Avatar"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Avatar', {}, '', 1);
        expect(output).toContain('<Avatar');
    });

    it('emits <Message /> for componentType "Alert"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Alert', {}, '', 1);
        expect(output).toContain('<Message');
    });

    it('emits <Divider /> for componentType "Separator"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Separator', {}, '', 1);
        expect(output).toContain('<Divider');
    });

    it('registers primereact/inputtext import after emitNamedComponent("Input")', () => {
        const emitter = new PrimeEmitter();
        emitter.emitNamedComponent('Input', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some(i => i.includes('primereact/inputtext'))).toBe(true);
    });

    it('registers primereact/inputswitch import after emitNamedComponent("Switch")', () => {
        const emitter = new PrimeEmitter();
        emitter.emitNamedComponent('Switch', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some(i => i.includes('primereact/inputswitch'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// emitNamedComponent — TailwindLibEmitter
// ---------------------------------------------------------------------------

describe('TailwindLibEmitter.emitNamedComponent', () => {
    it('emits <input /> for componentType "Input"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Input', {}, '', 1);
        expect(output).toContain('<input');
    });

    it('emits <hr /> for componentType "Separator"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Separator', {}, '', 1);
        expect(output).toContain('<hr');
    });

    it('emits <select> for componentType "Select"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Select', {}, '', 1);
        expect(output).toContain('<select');
    });

    it('emits <input type="checkbox" role="switch"> for componentType "Switch"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Switch', {}, '', 1);
        expect(output).toContain('role="switch"');
    });

    it('emits <div role="alert"> for componentType "Alert"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Alert', {}, '', 1);
        expect(output).toContain('role="alert"');
    });

    it('emits <span class="badge"> for componentType "Badge"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Badge', {}, '', 1);
        expect(output).toContain('<span');
        expect(output).toContain('badge');
    });

    it('emits <div class="avatar"> for componentType "Avatar"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Avatar', {}, '', 1);
        expect(output).toContain('avatar');
    });

    it('returns empty import array (Tailwind is utility-only)', () => {
        const emitter = new TailwindLibEmitter();
        emitter.emitNamedComponent('Input', {}, '', 1);
        expect(emitter.getImports()).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// wrapContainer — element param across emitters
// ---------------------------------------------------------------------------

describe('ShadcnEmitter.wrapContainer with element param', () => {
    it('emits <form> with className when element is "form"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('p-4', '<div/>', 1, 'form');
        expect(output).toContain('<form');
        expect(output).toContain('className="p-4"');
        expect(output).not.toContain('<Card');
    });

    it('backward compat: falls back to Card when element is omitted', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('p-4', '<div/>', 1);
        expect(output).toContain('<Card');
    });

    it('backward compat: falls back to Card when element is "div"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('p-4', '<div/>', 1, 'div');
        expect(output).toContain('<Card');
    });

    it('emits <nav> when element is "nav"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<a>link</a>', 1, 'nav');
        expect(output).toContain('<nav');
        expect(output).not.toContain('<Card');
    });

    it('emits <section> when element is "section"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>body</p>', 1, 'section');
        expect(output).toContain('<section');
    });

    it('emits <article> when element is "article"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>body</p>', 1, 'article');
        expect(output).toContain('<article');
    });

    it('emits self-closing semantic element when children are empty', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('p-4', '', 1, 'form');
        expect(output).toContain('<form');
        expect(output).toContain('/>');
    });
});

describe('MuiEmitter.wrapContainer with element param', () => {
    it('emits Box with component="nav" when element is "nav"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('', '<div/>', 1, 'nav');
        expect(output).toContain('component="nav"');
        expect(output).toContain('<Box');
    });

    it('emits Box with component="form" when element is "form"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('', '<div/>', 1, 'form');
        expect(output).toContain('component="form"');
    });

    it('emits plain Box without component prop when element is "div"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('', '<div/>', 1, 'div');
        expect(output).toContain('<Box');
        expect(output).not.toContain('component=');
    });

    it('emits plain Box without component prop when element is omitted', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('', '<div/>', 1);
        expect(output).toContain('<Box');
        expect(output).not.toContain('component=');
    });
});

describe('PrimeEmitter.wrapContainer with element param', () => {
    it('emits <form> when element is "form"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.wrapContainer('p-4', '<div/>', 1, 'form');
        expect(output).toContain('<form');
        expect(output).not.toContain('<Card');
    });

    it('emits <nav> when element is "nav"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.wrapContainer('flex', '<div/>', 1, 'nav');
        expect(output).toContain('<nav');
    });

    it('falls back to Card when element is omitted', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.wrapContainer('flex', '<div/>', 1);
        expect(output).toContain('<Card');
    });

    it('falls back to Card when element is "div"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.wrapContainer('flex', '<div/>', 1, 'div');
        expect(output).toContain('<Card');
    });
});

describe('TailwindLibEmitter.wrapContainer with element param', () => {
    it('emits <section> when element is "section" at depth 0', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('', '<div/>', 0, 'section');
        expect(output).toContain('<section');
    });

    it('emits <form> when element is "form"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<div/>', 1, 'form');
        expect(output).toContain('<form');
    });

    it('emits <div> when element is omitted (default)', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1);
        expect(output).toContain('<div');
    });

    it('emits <div> when element is "div"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1, 'div');
        expect(output).toContain('<div');
    });
});

// ---------------------------------------------------------------------------
// Integration: LoginForm with input children via processPayload
// ---------------------------------------------------------------------------

describe('Integration: LoginForm with semantic children', () => {
    it('shadcn: "LoginForm" FRAME with EmailInput, PasswordInput, SubmitButton children produces <form>, <Input>, <Button>', async () => {
        const engine = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const payload = {
            name: 'LoginForm',
            type: 'FRAME',
            children: [
                { name: 'EmailInput', type: 'FRAME' },
                { name: 'PasswordInput', type: 'FRAME' },
                {
                    name: 'SubmitButton',
                    type: 'FRAME',
                    children: [{ name: 'Label', type: 'TEXT', characters: 'Login' }],
                },
            ],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;

        // LoginForm maps to <form> via classifyFrame "form" keyword
        expect(jsx).toContain('<form');

        // EmailInput and PasswordInput map to <Input> via classifyComponent "input" keyword
        expect(jsx).toContain('<Input');

        // SubmitButton maps to <Button> via button heuristic
        expect(jsx).toContain('<Button');
    });

    it('tailwind: "LoginForm" FRAME with EmailInput children produces <form>, <input>', async () => {
        const engine = new HydroPasteEngine({ components: {} }, [], { library: 'tailwind' });
        const payload = {
            name: 'LoginForm',
            type: 'FRAME',
            children: [
                { name: 'EmailInput', type: 'FRAME' },
                { name: 'PasswordInput', type: 'FRAME' },
            ],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;

        expect(jsx).toContain('<form');
        expect(jsx).toContain('<input');
    });

    it('mui: "LoginForm" FRAME with EmailInput children produces Box component="form", <TextField>', async () => {
        const engine = new HydroPasteEngine({ components: {} }, [], { library: 'mui' });
        const payload = {
            name: 'LoginForm',
            type: 'FRAME',
            children: [
                { name: 'EmailInput', type: 'FRAME' },
            ],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;

        expect(jsx).toContain('component="form"');
        expect(jsx).toContain('<TextField');
    });

    it('primeng: "LoginForm" FRAME with EmailInput children produces <form>, <InputText>', async () => {
        const engine = new HydroPasteEngine({ components: {} }, [], { library: 'primeng' });
        const payload = {
            name: 'LoginForm',
            type: 'FRAME',
            children: [
                { name: 'EmailInput', type: 'FRAME' },
            ],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;

        expect(jsx).toContain('<form');
        expect(jsx).toContain('<InputText');
    });
});

// ---------------------------------------------------------------------------
// Integration: NavBar with links via processPayload
// ---------------------------------------------------------------------------

describe('Integration: NavBar with children', () => {
    it('shadcn: "MainNavbar" FRAME generates <nav> wrapper', async () => {
        const engine = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const payload = {
            name: 'MainNavbar',
            type: 'FRAME',
            children: [
                { name: 'Home', type: 'TEXT', characters: 'Home' },
                { name: 'About', type: 'TEXT', characters: 'About' },
            ],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<nav');
    });
});

// ---------------------------------------------------------------------------
// emitNamedComponent — case insensitivity (lowercase input)
// ---------------------------------------------------------------------------

describe('emitNamedComponent — handles case variations', () => {
    it('ShadcnEmitter handles lowercase "input"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('input', {}, '', 1);
        expect(output).toContain('<Input');
    });

    it('ShadcnEmitter handles uppercase "INPUT"', () => {
        const emitter = new ShadcnEmitter();
        // emitNamedComponent lowercases internally
        const output = emitter.emitNamedComponent('INPUT', {}, '', 1);
        expect(output).toContain('<Input');
    });

    it('MuiEmitter handles mixed case "Input"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('Input', {}, '', 1);
        expect(output).toContain('<TextField');
    });

    it('PrimeEmitter handles mixed case "Switch"', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('Switch', {}, '', 1);
        expect(output).toContain('<InputSwitch');
    });

    it('TailwindLibEmitter handles mixed case "Separator"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('Separator', {}, '', 1);
        expect(output).toContain('<hr');
    });
});
