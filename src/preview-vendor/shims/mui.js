// Material UI (MUI) component shims for Flint LivePreview (srcdoc path)
// Visual approximations of MUI components using React.createElement + inline styles.
// React is a UMD global in the srcdoc scope. No imports allowed.
// MUI's sx prop is simplified: passed as inline style object.

// ---- Button ----

window.Button = function Button(_ref) {
  var variant = _ref.variant, color = _ref.color, size = _ref.size, className = _ref.className, children = _ref.children, disabled = _ref.disabled, onClick = _ref.onClick, sx = _ref.sx;
  var colorMap = {
    primary: { main: '#1976d2', contrastText: '#fff', light: '#e3f2fd' },
    secondary: { main: '#9c27b0', contrastText: '#fff', light: '#f3e5f5' },
    error: { main: '#d32f2f', contrastText: '#fff', light: '#ffebee' },
    success: { main: '#2e7d32', contrastText: '#fff', light: '#e8f5e9' },
    inherit: { main: 'inherit', contrastText: 'inherit', light: 'rgba(0,0,0,0.04)' }
  };
  var c = colorMap[color] || colorMap.primary;
  var baseStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: size === 'small' ? '4px 10px' : size === 'large' ? '8px 22px' : '6px 16px',
    fontSize: size === 'small' ? '0.8125rem' : size === 'large' ? '0.9375rem' : '0.875rem',
    fontWeight: 500, lineHeight: 1.75, letterSpacing: '0.02857em', textTransform: 'uppercase',
    borderRadius: '4px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    border: 'none', transition: 'background-color 250ms', userSelect: 'none'
  };
  var variantStyle = variant === 'outlined'
    ? { background: 'transparent', color: c.main, border: '1px solid ' + c.main }
    : variant === 'text'
    ? { background: 'transparent', color: c.main }
    : { background: c.main, color: c.contrastText, boxShadow: '0 3px 1px -2px rgba(0,0,0,.2),0 2px 2px 0 rgba(0,0,0,.14),0 1px 5px 0 rgba(0,0,0,.12)' };
  return React.createElement('button', {
    disabled: disabled,
    onClick: onClick,
    style: Object.assign({}, baseStyle, variantStyle, sx || {})
  }, children);
};

// ---- Card family ----

window.Card = function Card(_ref) {
  var children = _ref.children, sx = _ref.sx, raised = _ref.raised;
  return React.createElement('div', {
    style: Object.assign({
      backgroundColor: '#fff',
      borderRadius: '4px',
      boxShadow: raised
        ? '0 5px 5px -3px rgba(0,0,0,.2),0 8px 10px 1px rgba(0,0,0,.14),0 3px 14px 2px rgba(0,0,0,.12)'
        : '0 2px 1px -1px rgba(0,0,0,.2),0 1px 1px 0 rgba(0,0,0,.14),0 1px 3px 0 rgba(0,0,0,.12)',
      overflow: 'hidden',
      color: 'rgba(0,0,0,.87)'
    }, sx || {})
  }, children);
};

window.CardContent = function CardContent(_ref) {
  var children = _ref.children, sx = _ref.sx;
  return React.createElement('div', {
    style: Object.assign({ padding: '16px' }, sx || {})
  }, children);
};

window.CardActions = function CardActions(_ref) {
  var children = _ref.children, sx = _ref.sx, disableSpacing = _ref.disableSpacing;
  return React.createElement('div', {
    style: Object.assign({
      display: 'flex', alignItems: 'center', padding: '8px',
      gap: disableSpacing ? 0 : '8px'
    }, sx || {})
  }, children);
};

// ---- TextField ----

window.TextField = function TextField(_ref) {
  var label = _ref.label, placeholder = _ref.placeholder, value = _ref.value, defaultValue = _ref.defaultValue, type = _ref.type, variant = _ref.variant, size = _ref.size, fullWidth = _ref.fullWidth, disabled = _ref.disabled, error = _ref.error, helperText = _ref.helperText, multiline = _ref.multiline, rows = _ref.rows, onChange = _ref.onChange, sx = _ref.sx;
  var fieldStyle = Object.assign({ display: 'inline-flex', flexDirection: 'column', position: 'relative', width: fullWidth ? '100%' : undefined }, sx || {});
  var inputStyle = {
    font: 'inherit', fontSize: size === 'small' ? '0.875rem' : '1rem',
    padding: size === 'small' ? '4px 12px' : '8px 12px',
    border: '1px solid ' + (error ? '#d32f2f' : 'rgba(0,0,0,.23)'),
    borderRadius: '4px', outline: 'none', width: fullWidth ? '100%' : undefined,
    backgroundColor: 'transparent', color: 'rgba(0,0,0,.87)',
    boxSizing: 'border-box', marginTop: label ? '16px' : 0
  };
  var labelStyle = {
    position: 'absolute', top: '4px', left: '12px', fontSize: '0.75rem',
    color: error ? '#d32f2f' : 'rgba(0,0,0,.6)', lineHeight: 1.4375, transformOrigin: 'top left'
  };
  return React.createElement('div', { style: fieldStyle },
    label ? React.createElement('label', { style: labelStyle }, label) : null,
    multiline
      ? React.createElement('textarea', { rows: rows || 4, placeholder: placeholder, defaultValue: defaultValue || value, disabled: disabled, onChange: onChange, style: inputStyle })
      : React.createElement('input', { type: type || 'text', placeholder: placeholder, defaultValue: defaultValue || value, disabled: disabled, onChange: onChange, style: inputStyle }),
    helperText ? React.createElement('p', { style: { fontSize: '0.75rem', color: error ? '#d32f2f' : 'rgba(0,0,0,.6)', margin: '3px 14px 0' } }, helperText) : null
  );
};

// ---- Typography ----

window.Typography = function Typography(_ref) {
  var variant = _ref.variant, component = _ref.component, children = _ref.children, sx = _ref.sx, className = _ref.className, color = _ref.color, align = _ref.align, gutterBottom = _ref.gutterBottom;
  var tagMap = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', subtitle1: 'h6', subtitle2: 'h6', body1: 'p', body2: 'p', caption: 'span', overline: 'span', button: 'span', inherit: 'p' };
  var styleMap = {
    h1: { fontSize: '6rem', fontWeight: 300, letterSpacing: '-0.01562em' },
    h2: { fontSize: '3.75rem', fontWeight: 300, letterSpacing: '-0.00833em' },
    h3: { fontSize: '3rem', fontWeight: 400 },
    h4: { fontSize: '2.125rem', fontWeight: 400, letterSpacing: '0.00735em' },
    h5: { fontSize: '1.5rem', fontWeight: 400 },
    h6: { fontSize: '1.25rem', fontWeight: 500, letterSpacing: '0.0075em' },
    subtitle1: { fontSize: '1rem', fontWeight: 400, letterSpacing: '0.00938em' },
    subtitle2: { fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.00714em' },
    body1: { fontSize: '1rem', fontWeight: 400, letterSpacing: '0.00938em' },
    body2: { fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.01071em' },
    caption: { fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.03333em' },
    overline: { fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.08333em', textTransform: 'uppercase' }
  };
  var tag = component || tagMap[variant] || 'p';
  var style = Object.assign(
    { margin: 0, fontFamily: '"Roboto","Helvetica","Arial",sans-serif', color: color || 'rgba(0,0,0,.87)' },
    styleMap[variant] || styleMap.body1,
    gutterBottom ? { marginBottom: '0.35em' } : {},
    align ? { textAlign: align } : {},
    sx || {}
  );
  return React.createElement(tag, { style: style, className: className || '' }, children);
};

// ---- Box ----

window.Box = function Box(_ref) {
  var children = _ref.children, sx = _ref.sx, component = _ref.component, className = _ref.className;
  return React.createElement(component || 'div', { style: sx || {}, className: className || '' }, children);
};

// ---- Stack ----

window.Stack = function Stack(_ref) {
  var children = _ref.children, direction = _ref.direction, spacing = _ref.spacing, sx = _ref.sx, className = _ref.className, divider = _ref.divider, alignItems = _ref.alignItems, justifyContent = _ref.justifyContent;
  var dir = direction === 'row' ? 'row' : direction === 'row-reverse' ? 'row-reverse' : direction === 'column-reverse' ? 'column-reverse' : 'column';
  var gap = typeof spacing === 'number' ? spacing * 8 + 'px' : (spacing || '8px');
  return React.createElement('div', {
    style: Object.assign({ display: 'flex', flexDirection: dir, gap: gap, alignItems: alignItems, justifyContent: justifyContent }, sx || {}),
    className: className || ''
  }, children);
};

// ---- Avatar ----

window.Avatar = function Avatar(_ref) {
  var src = _ref.src, alt = _ref.alt, children = _ref.children, sx = _ref.sx, variant = _ref.variant;
  var borderRadius = variant === 'square' ? '0' : variant === 'rounded' ? '4px' : '50%';
  var style = Object.assign({
    width: 40, height: 40, borderRadius: borderRadius,
    backgroundColor: '#bdbdbd', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.25rem', fontWeight: 400, overflow: 'hidden', userSelect: 'none'
  }, sx || {});
  if (src) {
    return React.createElement('div', { style: style }, React.createElement('img', { src: src, alt: alt || '', style: { width: '100%', height: '100%', objectFit: 'cover' } }));
  }
  return React.createElement('div', { style: style }, children || (alt ? alt.slice(0, 2).toUpperCase() : ''));
};

// ---- Chip ----

window.Chip = function Chip(_ref) {
  var label = _ref.label, variant = _ref.variant, color = _ref.color, size = _ref.size, onDelete = _ref.onDelete, onClick = _ref.onClick, sx = _ref.sx;
  var colorMap = { primary: '#1976d2', secondary: '#9c27b0', error: '#d32f2f', success: '#2e7d32', default: '#e0e0e0' };
  var bg = colorMap[color] || colorMap.default;
  var isOutlined = variant === 'outlined';
  var style = Object.assign({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: size === 'small' ? '24px' : '32px',
    padding: '0 12px', borderRadius: '16px', cursor: onClick ? 'pointer' : 'default',
    fontSize: size === 'small' ? '0.8125rem' : '0.875rem', fontWeight: 400,
    backgroundColor: isOutlined ? 'transparent' : bg,
    color: isOutlined ? bg : (color && color !== 'default' ? '#fff' : 'rgba(0,0,0,.87)'),
    border: isOutlined ? '1px solid ' + bg : 'none',
    gap: '4px'
  }, sx || {});
  return React.createElement('div', { style: style, onClick: onClick },
    label,
    onDelete ? React.createElement('button', {
      type: 'button', onClick: function(e) { e.stopPropagation(); onDelete(e); },
      style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', fontSize: '18px', lineHeight: 1 }
    }, '\u00d7') : null
  );
};

// ---- Divider ----

window.Divider = function Divider(_ref) {
  var orientation = _ref.orientation, sx = _ref.sx, variant = _ref.variant, light = _ref.light;
  var isVertical = orientation === 'vertical';
  var style = Object.assign({
    border: 'none',
    borderColor: light ? 'rgba(0,0,0,.08)' : 'rgba(0,0,0,.12)',
    borderTopWidth: isVertical ? 0 : '1px', borderTopStyle: isVertical ? undefined : 'solid',
    borderLeftWidth: isVertical ? '1px' : 0, borderLeftStyle: isVertical ? 'solid' : undefined,
    margin: variant === 'inset' ? '0 0 0 72px' : variant === 'middle' ? '0 16px' : 0,
    alignSelf: isVertical ? 'stretch' : undefined,
    height: isVertical ? 'auto' : undefined
  }, sx || {});
  return React.createElement('hr', { style: style });
};

// ---- Alert ----

window.Alert = function Alert(_ref) {
  var severity = _ref.severity, variant = _ref.variant, children = _ref.children, sx = _ref.sx, onClose = _ref.onClose;
  var severityColors = {
    success: { bg: '#edf7ed', border: '#4caf50', text: '#1e4620', icon: '#4caf50' },
    info: { bg: '#e5f6fd', border: '#03a9f4', text: '#014361', icon: '#03a9f4' },
    warning: { bg: '#fff4e5', border: '#ff9800', text: '#663c00', icon: '#ff9800' },
    error: { bg: '#fdeded', border: '#ef5350', text: '#5f2120', icon: '#ef5350' }
  };
  var c = severityColors[severity] || severityColors.info;
  var isOutlined = variant === 'outlined';
  var isFilled = variant === 'filled';
  var style = Object.assign({
    display: 'flex', alignItems: 'flex-start', padding: '6px 16px',
    borderRadius: '4px',
    backgroundColor: isFilled ? c.icon : isOutlined ? 'transparent' : c.bg,
    border: isOutlined ? '1px solid ' + c.border : 'none',
    color: isFilled ? '#fff' : c.text,
    fontSize: '0.875rem', lineHeight: 1.43, letterSpacing: '0.01071em'
  }, sx || {});
  return React.createElement('div', { role: 'alert', style: style },
    React.createElement('div', { style: { marginRight: '12px', paddingTop: '2px', color: isFilled ? '#fff' : c.icon, fontWeight: 'bold' } }, severity ? severity[0].toUpperCase() : 'i'),
    React.createElement('div', { style: { flex: 1 } }, children),
    onClose ? React.createElement('button', {
      type: 'button', onClick: onClose,
      style: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '8px', padding: 0, fontSize: '18px', lineHeight: 1 }
    }, '\u00d7') : null
  );
};

// ---- Switch ----

window.Switch = function Switch(_ref) {
  var checked = _ref.checked, defaultChecked = _ref.defaultChecked, onChange = _ref.onChange, disabled = _ref.disabled, color = _ref.color, sx = _ref.sx;
  var colorMap = { primary: '#1976d2', secondary: '#9c27b0', default: '#fafafa' };
  var trackColor = colorMap[color] || colorMap.primary;
  var state = React.useState(checked !== undefined ? checked : (defaultChecked || false));
  var isOn = state[0];
  var setIsOn = state[1];
  var toggle = function(e) {
    if (disabled) return;
    var next = !isOn;
    setIsOn(next);
    if (onChange) onChange(e, next);
  };
  var containerStyle = Object.assign({ display: 'inline-flex', width: 58, height: 38, position: 'relative', overflow: 'hidden', borderRadius: '50px', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }, sx || {});
  var trackStyle = {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    width: 34, height: 14, borderRadius: '7px',
    backgroundColor: isOn ? trackColor + 'aa' : 'rgba(0,0,0,.38)', transition: 'background 200ms'
  };
  var thumbStyle = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    left: isOn ? 'calc(50% + 2px)' : 'calc(50% - 14px)',
    width: 20, height: 20, borderRadius: '50%', backgroundColor: isOn ? trackColor : '#fafafa',
    boxShadow: '0 2px 1px -1px rgba(0,0,0,.2),0 1px 1px 0 rgba(0,0,0,.14),0 1px 3px 0 rgba(0,0,0,.12)',
    transition: 'left 200ms, background 200ms'
  };
  return React.createElement('span', { style: containerStyle, onClick: toggle },
    React.createElement('span', { style: trackStyle }),
    React.createElement('span', { style: thumbStyle })
  );
};

// ---- Select / MenuItem ----

window.Select = function Select(_ref) {
  var value = _ref.value, defaultValue = _ref.defaultValue, onChange = _ref.onChange, children = _ref.children, sx = _ref.sx, disabled = _ref.disabled, fullWidth = _ref.fullWidth, label = _ref.label, variant = _ref.variant;
  var style = Object.assign({
    fontSize: '1rem', padding: '8px 32px 8px 12px', border: '1px solid rgba(0,0,0,.23)',
    borderRadius: '4px', backgroundColor: 'transparent', width: fullWidth ? '100%' : undefined,
    appearance: 'none', cursor: disabled ? 'default' : 'pointer', color: 'rgba(0,0,0,.87)'
  }, sx || {});
  var opts = [];
  React.Children.forEach(children, function(child) {
    if (child && child.props && child.props.value !== undefined) {
      opts.push(React.createElement('option', { key: child.props.value, value: child.props.value }, child.props.children));
    }
  });
  return React.createElement('select', { defaultValue: defaultValue || value, onChange: onChange, disabled: disabled, style: style }, opts);
};

window.MenuItem = function MenuItem(_ref) {
  var value = _ref.value, children = _ref.children, onClick = _ref.onClick, selected = _ref.selected, sx = _ref.sx;
  return React.createElement('div', {
    'data-value': value,
    onClick: onClick,
    style: Object.assign({
      padding: '6px 16px', cursor: 'pointer', fontSize: '1rem',
      backgroundColor: selected ? 'rgba(25,118,210,.08)' : 'transparent',
      color: 'rgba(0,0,0,.87)'
    }, sx || {})
  }, children);
};

// ---- MUI CSS (Material Design defaults) ----
window.__FLINT_MUI_CSS = ':root {\n  --mui-primary: #1976d2;\n  --mui-primary-light: #42a5f5;\n  --mui-primary-dark: #1565c0;\n  --mui-secondary: #9c27b0;\n  --mui-error: #d32f2f;\n  --mui-warning: #ed6c02;\n  --mui-info: #0288d1;\n  --mui-success: #2e7d32;\n  --mui-background: #fff;\n  --mui-surface: #fff;\n  --mui-text-primary: rgba(0,0,0,.87);\n  --mui-text-secondary: rgba(0,0,0,.6);\n  --mui-divider: rgba(0,0,0,.12);\n}\n* { box-sizing: border-box; }\nbody { font-family: "Roboto","Helvetica","Arial",sans-serif; }';
