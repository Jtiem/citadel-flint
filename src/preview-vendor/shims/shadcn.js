// shadcn/ui component shims for Flint LivePreview (srcdoc path)
// Visual approximations of shadcn/ui components using React.createElement + Tailwind.
// React is a UMD global in the srcdoc scope. No imports allowed.
// CSS custom properties (--background, --foreground, etc.) are injected separately.

// ---- Card family ----

window.Card = function Card(_ref) {
  var className = _ref.className, children = _ref.children, rest = Object.assign({}, _ref);
  delete rest.className; delete rest.children;
  return React.createElement('div', Object.assign({
    className: 'rounded-xl border border-border bg-card text-card-foreground shadow ' + (className || '')
  }, rest), children);
};

window.CardHeader = function CardHeader(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('div', {
    className: 'flex flex-col space-y-1.5 p-6 ' + (className || '')
  }, children);
};

window.CardTitle = function CardTitle(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('h3', {
    className: 'text-lg font-semibold leading-none tracking-tight ' + (className || '')
  }, children);
};

window.CardDescription = function CardDescription(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('p', {
    className: 'text-sm text-muted-foreground ' + (className || '')
  }, children);
};

window.CardContent = function CardContent(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('div', {
    className: 'p-6 pt-0 ' + (className || '')
  }, children);
};

window.CardFooter = function CardFooter(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('div', {
    className: 'flex items-center p-6 pt-0 ' + (className || '')
  }, children);
};

// ---- Button ----

window.Button = function Button(_ref) {
  var variant = _ref.variant, size = _ref.size, className = _ref.className, children = _ref.children, asChild = _ref.asChild, disabled = _ref.disabled, rest = Object.assign({}, _ref);
  delete rest.variant; delete rest.size; delete rest.className; delete rest.children; delete rest.asChild; delete rest.disabled;
  var base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ';
  var sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9'
  };
  var variants = {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline'
  };
  return React.createElement('button', Object.assign({
    disabled: disabled,
    className: base + (variants[variant] || variants.default) + ' ' + (sizes[size] || sizes.default) + ' ' + (className || '')
  }, rest), children);
};

// ---- Input ----

window.Input = function Input(_ref) {
  var type = _ref.type, placeholder = _ref.placeholder, className = _ref.className, disabled = _ref.disabled, rest = Object.assign({}, _ref);
  delete rest.type; delete rest.placeholder; delete rest.className; delete rest.disabled;
  return React.createElement('input', Object.assign({
    type: type || 'text',
    placeholder: placeholder || '',
    disabled: disabled,
    className: 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ' + (className || '')
  }, rest));
};

// ---- Label ----

window.Label = function Label(_ref) {
  var className = _ref.className, children = _ref.children, htmlFor = _ref.htmlFor;
  return React.createElement('label', {
    htmlFor: htmlFor,
    className: 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ' + (className || '')
  }, children);
};

// ---- Textarea ----

window.Textarea = function Textarea(_ref) {
  var placeholder = _ref.placeholder, className = _ref.className, disabled = _ref.disabled, rest = Object.assign({}, _ref);
  delete rest.placeholder; delete rest.className; delete rest.disabled;
  return React.createElement('textarea', Object.assign({
    placeholder: placeholder || '',
    disabled: disabled,
    className: 'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ' + (className || '')
  }, rest));
};

// ---- Badge ----

window.Badge = function Badge(_ref) {
  var variant = _ref.variant, className = _ref.className, children = _ref.children;
  var variants = {
    default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
    outline: 'text-foreground'
  };
  return React.createElement('div', {
    className: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ' + (variants[variant] || variants.default) + ' ' + (className || '')
  }, children);
};

// ---- Avatar family ----

window.Avatar = function Avatar(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('span', {
    className: 'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ' + (className || '')
  }, children);
};

window.AvatarImage = function AvatarImage(_ref) {
  var src = _ref.src, alt = _ref.alt, className = _ref.className;
  return React.createElement('img', {
    src: src,
    alt: alt || '',
    className: 'aspect-square h-full w-full ' + (className || '')
  });
};

window.AvatarFallback = function AvatarFallback(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('span', {
    className: 'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium ' + (className || '')
  }, children);
};

// ---- Separator ----

window.Separator = function Separator(_ref) {
  var orientation = _ref.orientation, className = _ref.className;
  var isVertical = orientation === 'vertical';
  return React.createElement('div', {
    role: 'separator',
    'aria-orientation': orientation || 'horizontal',
    className: 'shrink-0 bg-border ' + (isVertical ? 'h-full w-[1px]' : 'h-[1px] w-full') + ' ' + (className || '')
  });
};

// ---- Select family (simplified: styled native select) ----

window.Select = function Select(_ref) {
  var children = _ref.children, value = _ref.value, defaultValue = _ref.defaultValue, onValueChange = _ref.onValueChange;
  var state = React.useState(value || defaultValue || '');
  var current = state[0];
  var setCurrent = state[1];
  return React.createElement('div', {
    'data-value': current,
    onChange: function(e) { setCurrent(e.target.value); if (onValueChange) onValueChange(e.target.value); }
  }, children);
};

window.SelectTrigger = function SelectTrigger(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('div', {
    className: 'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ' + (className || '')
  }, children,
    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'opacity-50 ml-auto shrink-0' },
      React.createElement('path', { d: 'm6 9 6 6 6-6' })
    )
  );
};

window.SelectValue = function SelectValue(_ref) {
  var placeholder = _ref.placeholder, children = _ref.children;
  return React.createElement('span', { className: 'text-muted-foreground' }, children || placeholder || '');
};

window.SelectContent = function SelectContent(_ref) {
  var children = _ref.children, className = _ref.className;
  return React.createElement('div', {
    className: 'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ' + (className || '')
  }, children);
};

window.SelectItem = function SelectItem(_ref) {
  var value = _ref.value, children = _ref.children, className = _ref.className;
  return React.createElement('div', {
    className: 'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground ' + (className || ''),
    'data-value': value
  }, children);
};

// ---- Tabs family ----

window.Tabs = function Tabs(_ref) {
  var children = _ref.children, defaultValue = _ref.defaultValue, value = _ref.value, onValueChange = _ref.onValueChange, className = _ref.className;
  var state = React.useState(value || defaultValue || '');
  var active = state[0];
  var setActive = state[1];
  var handleChange = function(v) { setActive(v); if (onValueChange) onValueChange(v); };
  // Pass active value via context workaround: clone children with prop
  return React.createElement('div', {
    className: (className || ''),
    'data-active-tab': active,
    onChange: function(e) { if (e.target.dataset.tabValue) handleChange(e.target.dataset.tabValue); }
  }, React.Children.map(children, function(child) {
    if (!child) return null;
    return React.cloneElement(child, { __tabsActive: active, __tabsChange: handleChange });
  }));
};

window.TabsList = function TabsList(_ref) {
  var children = _ref.children, className = _ref.className, __tabsActive = _ref.__tabsActive, __tabsChange = _ref.__tabsChange;
  return React.createElement('div', {
    className: 'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ' + (className || '')
  }, React.Children.map(children, function(child) {
    if (!child) return null;
    return React.cloneElement(child, { __tabsActive: __tabsActive, __tabsChange: __tabsChange });
  }));
};

window.TabsTrigger = function TabsTrigger(_ref) {
  var value = _ref.value, children = _ref.children, className = _ref.className, __tabsActive = _ref.__tabsActive, __tabsChange = _ref.__tabsChange;
  var isActive = __tabsActive === value;
  return React.createElement('button', {
    type: 'button',
    onClick: function() { if (__tabsChange) __tabsChange(value); },
    className: 'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ' + (isActive ? 'bg-background text-foreground shadow' : 'hover:text-foreground') + ' ' + (className || '')
  }, children);
};

window.TabsContent = function TabsContent(_ref) {
  var value = _ref.value, children = _ref.children, className = _ref.className, __tabsActive = _ref.__tabsActive;
  if (__tabsActive !== undefined && __tabsActive !== value) return null;
  return React.createElement('div', {
    className: 'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' + (className || '')
  }, children);
};

// ---- Switch ----

window.Switch = function Switch(_ref) {
  var checked = _ref.checked, onCheckedChange = _ref.onCheckedChange, className = _ref.className, defaultChecked = _ref.defaultChecked;
  var state = React.useState(checked !== undefined ? checked : (defaultChecked || false));
  var isOn = state[0];
  var setIsOn = state[1];
  var toggle = function() {
    var next = !isOn;
    setIsOn(next);
    if (onCheckedChange) onCheckedChange(next);
  };
  return React.createElement('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': isOn,
    onClick: toggle,
    className: 'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' + (isOn ? 'bg-primary' : 'bg-input') + ' ' + (className || '')
  }, React.createElement('span', {
    className: 'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ' + (isOn ? 'translate-x-4' : 'translate-x-0')
  }));
};

// ---- Checkbox ----

window.Checkbox = function Checkbox(_ref) {
  var checked = _ref.checked, onCheckedChange = _ref.onCheckedChange, className = _ref.className, defaultChecked = _ref.defaultChecked;
  var state = React.useState(checked !== undefined ? checked : (defaultChecked || false));
  var isChecked = state[0];
  var setIsChecked = state[1];
  var toggle = function() {
    var next = !isChecked;
    setIsChecked(next);
    if (onCheckedChange) onCheckedChange(next);
  };
  return React.createElement('button', {
    type: 'button',
    role: 'checkbox',
    'aria-checked': isChecked,
    onClick: toggle,
    className: 'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ' + (isChecked ? 'bg-primary text-primary-foreground' : '') + ' ' + (className || '')
  }, isChecked ? React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'h-3 w-3 text-white mx-auto'
  }, React.createElement('path', { d: 'M20 6 9 17l-5-5' })) : null);
};

// ---- Alert family ----

window.Alert = function Alert(_ref) {
  var variant = _ref.variant, className = _ref.className, children = _ref.children;
  var variants = {
    default: 'bg-background text-foreground border',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/10'
  };
  return React.createElement('div', {
    role: 'alert',
    className: 'relative w-full rounded-lg p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 ' + (variants[variant] || variants.default) + ' ' + (className || '')
  }, children);
};

window.AlertTitle = function AlertTitle(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('h5', {
    className: 'mb-1 font-medium leading-none tracking-tight ' + (className || '')
  }, children);
};

window.AlertDescription = function AlertDescription(_ref) {
  var className = _ref.className, children = _ref.children;
  return React.createElement('div', {
    className: 'text-sm [&_p]:leading-relaxed ' + (className || '')
  }, children);
};

// ---- CSS custom properties for shadcn/ui (neutral default theme) ----
window.__FLINT_SHADCN_CSS = ':root {\n  --background: 0 0% 100%;\n  --foreground: 222.2 84% 4.9%;\n  --card: 0 0% 100%;\n  --card-foreground: 222.2 84% 4.9%;\n  --popover: 0 0% 100%;\n  --popover-foreground: 222.2 84% 4.9%;\n  --primary: 222.2 47.4% 11.2%;\n  --primary-foreground: 210 40% 98%;\n  --secondary: 210 40% 96.1%;\n  --secondary-foreground: 222.2 47.4% 11.2%;\n  --muted: 210 40% 96.1%;\n  --muted-foreground: 215.4 16.3% 46.9%;\n  --accent: 210 40% 96.1%;\n  --accent-foreground: 222.2 47.4% 11.2%;\n  --destructive: 0 84.2% 60.2%;\n  --destructive-foreground: 210 40% 98%;\n  --border: 214.3 31.8% 91.4%;\n  --input: 214.3 31.8% 91.4%;\n  --ring: 222.2 84% 4.9%;\n  --radius: 0.5rem;\n}';
