// PrimeNG/PrimeReact component shims for Flint LivePreview (srcdoc path)
// Visual approximations using React.createElement + inline styles (Aura theme defaults).
// React is a UMD global in the srcdoc scope. No imports allowed.

// ---- Button ----

window.Button = function Button(_ref) {
  var label = _ref.label, icon = _ref.icon, severity = _ref.severity, outlined = _ref.outlined, text = _ref.text, rounded = _ref.rounded, raised = _ref.raised, disabled = _ref.disabled, size = _ref.size, onClick = _ref.onClick, className = _ref.className, children = _ref.children;
  var severityColors = {
    secondary: { bg: '#64748b', hover: '#475569' },
    success: { bg: '#22c55e', hover: '#16a34a' },
    info: { bg: '#3b82f6', hover: '#2563eb' },
    warning: { bg: '#f97316', hover: '#ea580c' },
    help: { bg: '#a855f7', hover: '#9333ea' },
    danger: { bg: '#ef4444', hover: '#dc2626' }
  };
  var c = severityColors[severity] || { bg: '#6366f1', hover: '#4f46e5' };
  var isOutlined = outlined;
  var isText = text;
  var pad = size === 'small' ? '0.4rem 0.8rem' : size === 'large' ? '0.75rem 1.5rem' : '0.5rem 1rem';
  var fontSize = size === 'small' ? '0.875rem' : size === 'large' ? '1.125rem' : '1rem';
  var style = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    cursor: disabled ? 'default' : 'pointer', padding: pad, fontSize: fontSize, fontWeight: 500,
    borderRadius: rounded ? '2rem' : '6px', border: 'none', transition: 'background 200ms',
    backgroundColor: isText || isOutlined ? 'transparent' : c.bg,
    color: isText || isOutlined ? c.bg : '#fff',
    boxShadow: raised ? '0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)' : 'none',
    outline: isOutlined ? '2px solid ' + c.bg : 'none',
    opacity: disabled ? 0.6 : 1
  };
  return React.createElement('button', { type: 'button', disabled: disabled, onClick: onClick, style: style, className: className || '' },
    icon ? React.createElement('span', { style: { fontSize: '0.875em' } }, icon) : null,
    label || children
  );
};

// ---- Card ----

window.Card = function Card(_ref) {
  var title = _ref.title, subTitle = _ref.subTitle, header = _ref.header, footer = _ref.footer, children = _ref.children, className = _ref.className, style = _ref.style;
  return React.createElement('div', {
    className: className || '',
    style: Object.assign({
      background: '#fff', borderRadius: '12px', padding: 0, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.08)'
    }, style || {})
  },
    header ? React.createElement('div', null, header) : null,
    React.createElement('div', { style: { padding: '1.5rem' } },
      title ? React.createElement('div', { style: { fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#334155' } }, title) : null,
      subTitle ? React.createElement('div', { style: { fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' } }, subTitle) : null,
      children
    ),
    footer ? React.createElement('div', { style: { padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0' } }, footer) : null
  );
};

// ---- InputText ----

window.InputText = function InputText(_ref) {
  var placeholder = _ref.placeholder, value = _ref.value, defaultValue = _ref.defaultValue, onChange = _ref.onChange, disabled = _ref.disabled, invalid = _ref.invalid, size = _ref.size, className = _ref.className, rest = Object.assign({}, _ref);
  delete rest.placeholder; delete rest.value; delete rest.defaultValue; delete rest.onChange;
  delete rest.disabled; delete rest.invalid; delete rest.size; delete rest.className;
  var pad = size === 'small' ? '0.375rem 0.75rem' : size === 'large' ? '0.625rem 1rem' : '0.5rem 0.75rem';
  return React.createElement('input', Object.assign({
    type: 'text',
    placeholder: placeholder || '',
    defaultValue: defaultValue || value,
    onChange: onChange,
    disabled: disabled,
    className: className || '',
    style: {
      border: '1px solid ' + (invalid ? '#ef4444' : '#cbd5e1'),
      borderRadius: '6px', padding: pad, fontSize: '1rem',
      color: '#334155', backgroundColor: disabled ? '#f8fafc' : '#fff',
      outline: 'none', width: '100%', boxSizing: 'border-box'
    }
  }, rest));
};

// ---- Dropdown ----

window.Dropdown = function Dropdown(_ref) {
  var options = _ref.options, optionLabel = _ref.optionLabel, optionValue = _ref.optionValue, value = _ref.value, placeholder = _ref.placeholder, onChange = _ref.onChange, disabled = _ref.disabled, className = _ref.className;
  var labelKey = optionLabel || 'label';
  var valueKey = optionValue || 'value';
  var opts = Array.isArray(options) ? options : [];
  var style = {
    border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.75rem',
    fontSize: '1rem', color: '#334155', backgroundColor: disabled ? '#f8fafc' : '#fff',
    width: '100%', boxSizing: 'border-box', appearance: 'none', cursor: disabled ? 'default' : 'pointer'
  };
  return React.createElement('select', {
    defaultValue: value,
    disabled: disabled,
    className: className || '',
    style: style,
    onChange: function(e) { if (onChange) onChange({ value: e.target.value }); }
  },
    placeholder ? React.createElement('option', { value: '', disabled: true }, placeholder) : null,
    opts.map(function(opt, i) {
      var v = typeof opt === 'object' ? opt[valueKey] : opt;
      var l = typeof opt === 'object' ? opt[labelKey] : opt;
      return React.createElement('option', { key: i, value: v }, l);
    })
  );
};

// ---- DataTable / Column ----

window.Column = function Column() { return null; };

window.DataTable = function DataTable(_ref) {
  var value = _ref.value, children = _ref.children, className = _ref.className, stripedRows = _ref.stripedRows, showGridlines = _ref.showGridlines;
  var rows = Array.isArray(value) ? value : [];
  var columns = [];
  React.Children.forEach(children, function(child) {
    if (child && child.props) columns.push(child.props);
  });
  var borderStyle = showGridlines ? '1px solid #e2e8f0' : undefined;
  return React.createElement('div', { className: className || '', style: { overflowX: 'auto' } },
    React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' } },
      React.createElement('thead', null,
        React.createElement('tr', { style: { backgroundColor: '#f8fafc' } },
          columns.map(function(col, ci) {
            return React.createElement('th', {
              key: ci,
              style: { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0', border: borderStyle }
            }, col.header);
          })
        )
      ),
      React.createElement('tbody', null,
        rows.map(function(row, ri) {
          return React.createElement('tr', {
            key: ri,
            style: { backgroundColor: stripedRows && ri % 2 === 1 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }
          },
            columns.map(function(col, ci) {
              return React.createElement('td', {
                key: ci,
                style: { padding: '0.75rem 1rem', color: '#334155', border: borderStyle }
              }, col.body ? col.body(row) : row[col.field]);
            })
          );
        })
      )
    )
  );
};

// ---- Panel ----

window.Panel = function Panel(_ref) {
  var header = _ref.header, children = _ref.children, toggleable = _ref.toggleable, collapsed = _ref.collapsed, className = _ref.className;
  var state = React.useState(collapsed || false);
  var isCollapsed = state[0];
  var setIsCollapsed = state[1];
  return React.createElement('div', {
    className: className || '',
    style: { border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }
  },
    React.createElement('div', {
      style: {
        padding: '0.75rem 1.25rem', background: '#f8fafc',
        borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: toggleable ? 'pointer' : 'default'
      },
      onClick: toggleable ? function() { setIsCollapsed(function(v) { return !v; }); } : undefined
    },
      React.createElement('span', { style: { fontWeight: 600, color: '#334155', fontSize: '0.9375rem' } }, header),
      toggleable ? React.createElement('span', { style: { color: '#64748b', fontSize: '0.75rem' } }, isCollapsed ? '\u25bc' : '\u25b2') : null
    ),
    !isCollapsed ? React.createElement('div', { style: { padding: '1.25rem' } }, children) : null
  );
};

// ---- Avatar ----

window.Avatar = function Avatar(_ref) {
  var label = _ref.label, image = _ref.image, shape = _ref.shape, size = _ref.size, className = _ref.className, style = _ref.style;
  var dim = size === 'large' ? 60 : size === 'xlarge' ? 80 : 40;
  var borderRadius = shape === 'square' ? '6px' : '50%';
  var containerStyle = Object.assign({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: dim, height: dim, borderRadius: borderRadius,
    backgroundColor: '#6366f1', color: '#fff', fontWeight: 600,
    fontSize: size === 'large' ? '1.25rem' : size === 'xlarge' ? '1.5rem' : '1rem',
    overflow: 'hidden'
  }, style || {});
  if (image) {
    return React.createElement('div', { className: className || '', style: containerStyle },
      React.createElement('img', { src: image, alt: label || '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
    );
  }
  return React.createElement('div', { className: className || '', style: containerStyle }, label);
};

// ---- Badge ----

window.Badge = function Badge(_ref) {
  var value = _ref.value, severity = _ref.severity, size = _ref.size, className = _ref.className, children = _ref.children;
  var severityColors = {
    secondary: '#64748b', success: '#22c55e', info: '#3b82f6',
    warning: '#f97316', danger: '#ef4444', help: '#a855f7'
  };
  var bg = severityColors[severity] || '#6366f1';
  var dim = size === 'large' ? 24 : size === 'xlarge' ? 30 : 20;
  var badgeStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: bg, color: '#fff', borderRadius: '50%',
    width: dim, height: dim, fontSize: size === 'large' ? '0.8rem' : '0.7rem',
    fontWeight: 700, minWidth: dim
  };
  if (children) {
    return React.createElement('div', { style: { position: 'relative', display: 'inline-flex' }, className: className || '' },
      children,
      React.createElement('span', { style: Object.assign({}, badgeStyle, { position: 'absolute', top: '-8px', right: '-8px' }) }, value)
    );
  }
  return React.createElement('span', { className: className || '', style: badgeStyle }, value);
};

// ---- Divider ----

window.Divider = function Divider(_ref) {
  var align = _ref.align, layout = _ref.layout, type = _ref.type, className = _ref.className;
  var isVertical = layout === 'vertical';
  var borderStyle = type === 'dashed' ? 'dashed' : type === 'dotted' ? 'dotted' : 'solid';
  var style = {
    border: 'none',
    borderTopWidth: isVertical ? 0 : '1px',
    borderTopStyle: isVertical ? undefined : borderStyle,
    borderLeftWidth: isVertical ? '1px' : 0,
    borderLeftStyle: isVertical ? borderStyle : undefined,
    borderColor: '#e2e8f0',
    margin: isVertical ? '0 1rem' : '1rem 0',
    alignSelf: isVertical ? 'stretch' : undefined
  };
  if (align) {
    return React.createElement('div', {
      className: className || '',
      style: { display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }
    },
      React.createElement('div', { style: { flex: 1, borderTop: '1px solid #e2e8f0' } }),
      React.createElement('span', { style: { fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500 } }, align),
      React.createElement('div', { style: { flex: 1, borderTop: '1px solid #e2e8f0' } })
    );
  }
  return React.createElement('hr', { className: className || '', style: style });
};

// ---- Message ----

window.Message = function Message(_ref) {
  var severity = _ref.severity, text = _ref.text, children = _ref.children, className = _ref.className;
  var severityConfig = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '\u2713' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '\u2139' },
    warn: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '\u26a0' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '\u26a0' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '\u2717' }
  };
  var c = severityConfig[severity] || severityConfig.info;
  return React.createElement('div', {
    className: className || '',
    style: {
      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
      padding: '0.75rem 1rem', borderRadius: '6px',
      backgroundColor: c.bg, border: '1px solid ' + c.border, color: c.text,
      fontSize: '0.875rem'
    }
  },
    React.createElement('span', { style: { fontWeight: 700, flexShrink: 0 } }, c.icon),
    React.createElement('span', null, text || children)
  );
};

// ---- PrimeNG CSS (Aura theme defaults) ----
window.__FLINT_PRIMENG_CSS = ':root {\n  --p-primary-color: #6366f1;\n  --p-primary-contrast-color: #fff;\n  --p-primary-hover-color: #4f46e5;\n  --p-surface-0: #fff;\n  --p-surface-50: #f8fafc;\n  --p-surface-100: #f1f5f9;\n  --p-surface-200: #e2e8f0;\n  --p-surface-300: #cbd5e1;\n  --p-surface-400: #94a3b8;\n  --p-surface-500: #64748b;\n  --p-surface-600: #475569;\n  --p-surface-700: #334155;\n  --p-surface-800: #1e293b;\n  --p-surface-900: #0f172a;\n  --p-surface-950: #020617;\n  --p-text-color: #334155;\n  --p-text-muted-color: #64748b;\n  --p-border-radius: 6px;\n}';
