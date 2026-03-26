// Generic component stubs for Flint LivePreview (srcdoc path)
// These are library-agnostic visual stubs extracted from the inline block in buildSrcdoc.
// React is a UMD global in the srcdoc scope -- do not import it.
// Each component is assigned to window.* so stripped import statements resolve at runtime.

window.Badge = function Badge(_ref) {
  var className = _ref.className, children = _ref.children, rest = Object.assign({}, _ref);
  delete rest.className; delete rest.children;
  return React.createElement('span', Object.assign({
    className: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-slate-900 text-white shadow hover:bg-slate-900/80 ' + (className || ''),
    style: { pointerEvents: 'auto' }
  }, rest), children);
};

window.Button = function Button(_ref) {
  var variant = _ref.variant, className = _ref.className, children = _ref.children, rest = Object.assign({}, _ref);
  delete rest.variant; delete rest.className; delete rest.children;
  var base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 ';
  var variants = {
    primary: 'bg-blue-600 text-white shadow hover:bg-blue-700',
    secondary: 'text-blue-600 hover:bg-blue-50',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  };
  return React.createElement('button', Object.assign({
    className: base + (variants[variant] || variants.primary) + ' ' + (className || ''),
    style: { pointerEvents: 'auto' }
  }, rest), children);
};

window.Heading = function Heading(_ref) {
  var as = _ref.as, className = _ref.className, children = _ref.children, rest = Object.assign({}, _ref);
  delete rest.as; delete rest.className; delete rest.children;
  var level = as || 1;
  var sizes = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg', 4: 'text-base', 5: 'text-sm', 6: 'text-xs' };
  return React.createElement('h' + level, Object.assign({
    className: 'font-medium tracking-tight text-slate-800 ' + (sizes[level] || 'text-base') + ' ' + (className || '')
  }, rest), children);
};

window.TextField = function TextField(_ref) {
  var label = _ref.label, placeholder = _ref.placeholder, value = _ref.value, helperText = _ref.helperText, className = _ref.className, rest = Object.assign({}, _ref);
  delete rest.label; delete rest.placeholder; delete rest.value; delete rest.helperText; delete rest.className;
  return React.createElement('div', { className: 'flex flex-col gap-1 ' + (className || '') },
    label ? React.createElement('label', { className: 'text-sm font-medium text-slate-700' }, label) : null,
    React.createElement('input', Object.assign({ type: 'text', placeholder: placeholder || '', defaultValue: value || '', className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' }, rest)),
    helperText ? React.createElement('span', { className: 'text-xs text-slate-500' }, helperText) : null
  );
};

window.SwitchToggle = function SwitchToggle(_ref) {
  var label = _ref.label, checked = _ref.checked, className = _ref.className;
  return React.createElement('label', { className: 'inline-flex items-center gap-3 cursor-pointer ' + (className || '') },
    React.createElement('span', {
      className: 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' + (checked ? 'bg-blue-600' : 'bg-slate-300'),
    }, React.createElement('span', {
      className: 'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ' + (checked ? 'translate-x-4' : 'translate-x-0.5')
    })),
    label ? React.createElement('span', { className: 'text-sm text-slate-700' }, label) : null
  );
};

window.SelectField = function SelectField(_ref) {
  var label = _ref.label, options = _ref.options, value = _ref.value, className = _ref.className;
  return React.createElement('div', { className: 'flex flex-col gap-1 ' + (className || '') },
    label ? React.createElement('label', { className: 'text-sm font-medium text-slate-700' }, label) : null,
    React.createElement('select', {
      defaultValue: value || '',
      className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
    })
  );
};

window.IconButton = function IconButton(_ref) {
  var icon = _ref.icon, label = _ref.label, size = _ref.size, className = _ref.className, rest = Object.assign({}, _ref);
  delete rest.icon; delete rest.label; delete rest.size; delete rest.className;
  var sizeClass = size === 'sm' ? 'h-5 w-5 p-0.5' : 'h-8 w-8 p-1.5';
  return React.createElement('button', Object.assign({
    type: 'button',
    'aria-label': label || icon,
    className: 'inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ' + sizeClass + ' ' + (className || '')
  }, rest), icon);
};

window.Stack = function Stack(_ref) {
  var direction = _ref.direction, spacing = _ref.spacing, className = _ref.className, children = _ref.children;
  var dir = direction === 'horizontal' ? 'flex-row' : 'flex-col';
  var gap = spacing ? 'gap-' + spacing : 'gap-4';
  return React.createElement('div', {
    className: 'flex ' + dir + ' ' + gap + ' ' + (className || '')
  }, children);
};

window.Input = function Input(_ref) {
  var placeholder = _ref.placeholder, type = _ref.type, className = _ref.className, rest = Object.assign({}, _ref);
  delete rest.placeholder; delete rest.type; delete rest.className;
  return React.createElement('input', Object.assign({
    type: type || 'text',
    placeholder: placeholder || '',
    className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' + (className || '')
  }, rest));
};
