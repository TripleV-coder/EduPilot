// EduPilot — Foundation UI components
// Each component reads tokens from CSS custom properties; dark mode + palette
// swaps work for free.

const { useState, useRef, useEffect } = React;

// ─── Icon (Lucide-style outline, single-stroke) ──────────────
const Icon = ({ name, size = 18, color = 'currentColor', strokeWidth = 1.75, style }) => {
  const paths = {
    home: <><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></>,
    users: <><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M21 17c-.4-2.2-1.9-3.5-4-3.5"/></>,
    book: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15.5H6a2 2 0 0 0-2 2V4.5Z"/><path d="M4 18.5A2 2 0 0 1 6 20.5h14"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    money: <><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M7 9.5v.01M17 15.5v.01"/></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .67.39 1.27 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.24.61.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.67 0-1.27.39-1.51 1Z"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    check: <path d="m4.5 12 5 5L20 6.5"/>,
    x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    arrowUp: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
    arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4Z"/>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>,
    warning: <><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    danger: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></>,
    success: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    sms: <><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></>,
    school: <><path d="M3 10 12 5l9 5"/><path d="M5 9.5V19h14V9.5"/><path d="M9 19v-5h6v5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    pencil: <><path d="M17 3.5a2.1 2.1 0 0 1 3 3L8 18.5 3.5 20l1.5-4.5Z"/></>,
    moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></>,
    flame: <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1 .4-1.8 1-2.5-1.6 1.5-3 3.5-3 6.5a6 6 0 0 0 12 0c0-6-6-12-6-12Z"/>,
    trophy: <><path d="M8 4h8v6a4 4 0 1 1-8 0V4Z"/><path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4M8 21h8"/></>,
    tag: <><path d="M9 3h7l5 5v7l-9 9-12-12 9-9Z"/><circle cx="14" cy="9" r="1.2"/></>,
    cards: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, ...style}}>
      {paths[name] || paths.info}
    </svg>
  );
};

// ─── Button ──────────────────────────────────────────────────
const Button = ({ variant = 'primary', size = 'md', icon, iconRight, loading, children, onClick, disabled, full, style }) => {
  const sizes = {
    sm: { h: 30, px: 12, fs: 12, gap: 6, rad: 8 },
    md: { h: 38, px: 16, fs: 13, gap: 8, rad: 10 },
    lg: { h: 46, px: 20, fs: 15, gap: 10, rad: 12 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: 'var(--brand-700)', color: 'var(--text-on-brand)', border: 'transparent', hov: 'var(--brand-800)' },
    secondary: { bg: 'var(--surface-card)', color: 'var(--text-primary)', border: 'var(--border-default)', hov: 'var(--surface-sunken)' },
    ghost: { bg: 'transparent', color: 'var(--text-primary)', border: 'transparent', hov: 'var(--surface-sunken)' },
    danger: { bg: 'var(--danger-600)', color: 'var(--neutral-0)', border: 'transparent', hov: 'var(--danger-700)' },
    soft: { bg: 'var(--brand-50)', color: 'var(--brand-800)', border: 'transparent', hov: 'var(--brand-100)' },
  };
  const v = variants[variant];
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled || loading} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        height: s.h, padding: `0 ${s.px}px`, gap: s.gap,
        fontSize: s.fs, fontWeight: 600, letterSpacing: '-0.005em',
        borderRadius: s.rad, border: `1px solid ${v.border === 'transparent' ? 'transparent' : v.border}`,
        background: hov && !disabled ? v.hov : v.bg, color: v.color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'background var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out)',
        transform: hov && !disabled ? 'translateY(-0.5px)' : 'none',
        fontFamily: 'inherit', width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
        ...style,
      }}>
      {loading ? <Spinner size={s.fs} color={v.color}/> : icon && <Icon name={icon} size={s.fs + 2}/>}
      {children}
      {iconRight && <Icon name={iconRight} size={s.fs + 2}/>}
    </button>
  );
};

const Spinner = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'eduSpin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2.5" strokeOpacity="0.2"/>
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ─── Badge ───────────────────────────────────────────────────
const Badge = ({ variant = 'neutral', icon, children, dot, size = 'md', style }) => {
  const variants = {
    success: { bg: 'var(--success-100)', fg: 'var(--success-800)', dot: 'var(--success-600)' },
    warning: { bg: 'var(--warning-100)', fg: 'var(--warning-800)', dot: 'var(--warning-600)' },
    danger: { bg: 'var(--danger-100)', fg: 'var(--danger-800)', dot: 'var(--danger-600)' },
    info: { bg: 'var(--info-100)', fg: 'var(--info-800)', dot: 'var(--info-600)' },
    neutral: { bg: 'var(--neutral-200)', fg: 'var(--neutral-700)', dot: 'var(--neutral-600)' },
    brand: { bg: 'var(--brand-100)', fg: 'var(--brand-800)', dot: 'var(--brand-600)' },
  };
  const v = variants[variant];
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6,
      height: sm ? 20 : 24, padding: sm ? '0 8px' : '0 10px',
      borderRadius: 'var(--radius-full)',
      background: v.bg, color: v.fg,
      fontSize: sm ? 11 : 12, fontWeight: 600, letterSpacing: '-0.005em',
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.dot }}/>}
      {icon && <Icon name={icon} size={sm ? 11 : 13}/>}
      {children}
    </span>
  );
};

// ─── Card ────────────────────────────────────────────────────
const Card = ({ children, padding = 20, variant = 'default', style, onClick }) => {
  const variants = {
    default:  { bg: 'var(--surface-card)', shadow: 'var(--shadow-sm)', border: '1px solid var(--border-subtle)' },
    elevated: { bg: 'var(--surface-card)', shadow: 'var(--shadow-md)', border: 'none' },
    flat:     { bg: 'var(--surface-sunken)', shadow: 'none', border: '1px solid transparent' },
    inverse:  { bg: 'var(--neutral-900)', shadow: 'var(--shadow-md)', border: 'none', color: 'var(--neutral-50)' },
  };
  const v = variants[variant];
  return (
    <div onClick={onClick} style={{
      background: v.bg, borderRadius: 'var(--radius-xl)', padding,
      boxShadow: v.shadow, border: v.border, color: v.color,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out)',
      ...style,
    }}>
      {children}
    </div>
  );
};

// ─── Input ───────────────────────────────────────────────────
const Input = ({ label, helper, error, icon, value, onChange = () => {}, placeholder, type = 'text', style }) => {
  const [focused, setFocused] = useState(false);
  const filled = focused || (value && value.length);
  return (
    <label style={{ display: 'block', position: 'relative', ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 46, padding: '0 14px',
        background: 'var(--surface-card)',
        border: `1px solid ${error ? 'var(--danger-500)' : focused ? 'var(--brand-600)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: focused ? `0 0 0 3px ${error ? 'rgba(239,68,68,0.18)' : 'rgba(74,99,232,0.18)'}` : 'none',
        transition: 'all var(--motion-fast) var(--ease-out)',
      }}>
        {icon && <Icon name={icon} size={16} color="var(--text-tertiary)"/>}
        <div style={{ position: 'relative', flex: 1, height: '100%' }}>
          {label && (
            <span style={{
              position: 'absolute', left: 0, pointerEvents: 'none',
              top: filled ? 4 : '50%', transform: filled ? 'none' : 'translateY(-50%)',
              fontSize: filled ? 10 : 13, fontWeight: 500,
              color: error ? 'var(--danger-600)' : focused ? 'var(--brand-700)' : 'var(--text-tertiary)',
              transition: 'all var(--motion-fast) var(--ease-out)',
              letterSpacing: filled ? '0.04em' : 0,
              textTransform: filled ? 'uppercase' : 'none',
            }}>{label}</span>
          )}
          <input type={type} value={value || ''} onChange={onChange} placeholder={!label ? placeholder : ''}
            onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
            style={{
              width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, color: 'var(--text-primary)',
              paddingTop: label ? 14 : 0,
            }}/>
        </div>
      </div>
      {(helper || error) && (
        <div style={{ marginTop: 6, fontSize: 12, color: error ? 'var(--danger-600)' : 'var(--text-tertiary)' }}>
          {error || helper}
        </div>
      )}
    </label>
  );
};

// ─── Avatar ──────────────────────────────────────────────────
const Avatar = ({ name = '', src, size = 'md', status, color, style }) => {
  const sizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };
  const px = sizes[size];
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  // Hash name → hue for fallback bg
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const bg = color || `oklch(0.62 0.13 ${hue})`;
  const statusColors = { online: 'var(--success-500)', away: 'var(--warning-500)', busy: 'var(--danger-500)' };
  return (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0, ...style }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: src ? `center/cover url(${src})` : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: px * 0.4,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
        fontFamily: 'var(--font-display)',
      }}>{!src && initials}</div>
      {status && <span style={{
        position: 'absolute', bottom: 0, right: 0,
        width: px * 0.28, height: px * 0.28, borderRadius: '50%',
        background: statusColors[status],
        boxShadow: '0 0 0 2px var(--surface-card)',
      }}/>}
    </div>
  );
};

// ─── Progress ────────────────────────────────────────────────
const Progress = ({ value = 0, label, sublabel, variant = 'brand', size = 'md' }) => {
  const colors = {
    brand: 'var(--brand-600)', success: 'var(--success-600)',
    warning: 'var(--warning-500)', danger: 'var(--danger-600)',
  };
  const h = size === 'sm' ? 4 : size === 'lg' ? 10 : 6;
  return (
    <div>
      {(label || sublabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sublabel}</span>
        </div>
      )}
      <div style={{ height: h, background: 'var(--neutral-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(100, value)}%`, background: colors[variant],
          borderRadius: 'inherit', transition: 'width var(--motion-base) var(--ease-out)',
        }}/>
      </div>
    </div>
  );
};

const RingProgress = ({ value = 0, size = 60, stroke = 6, variant = 'brand', children }) => {
  const colors = { brand: 'var(--brand-600)', success: 'var(--success-600)', warning: 'var(--warning-500)', danger: 'var(--danger-600)' };
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--neutral-200)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colors[variant]} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset var(--motion-base) var(--ease-out)' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
};

// ─── Toast ───────────────────────────────────────────────────
const Toast = ({ variant = 'info', title, body, action }) => {
  const variants = {
    success: { icon: 'success', accent: 'var(--success-600)', bg: 'var(--success-50)' },
    warning: { icon: 'warning', accent: 'var(--warning-600)', bg: 'var(--warning-50)' },
    danger: { icon: 'danger', accent: 'var(--danger-600)', bg: 'var(--danger-50)' },
    info: { icon: 'info', accent: 'var(--info-600)', bg: 'var(--info-50)' },
  };
  const v = variants[variant];
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 14,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      borderLeft: `3px solid ${v.accent}`,
      minWidth: 320, maxWidth: 380,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: v.bg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Icon name={v.icon} size={16} color={v.accent}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
        {body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{body}</div>}
        {action && <button style={{
          marginTop: 8, padding: '4px 10px', height: 26, fontSize: 12, fontWeight: 600,
          background: 'transparent', border: `1px solid ${v.accent}`, color: v.accent,
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
        }}>{action}</button>}
      </div>
    </div>
  );
};

// ─── EduMetricCard ───────────────────────────────────────────
const MetricCard = ({ label, value, unit, trend, trendLabel, icon, variant = 'neutral', size = 'md' }) => {
  const accents = {
    neutral: { bg: 'var(--surface-card)', icon: 'var(--neutral-700)', iconBg: 'var(--neutral-100)' },
    brand: { bg: 'var(--surface-card)', icon: 'var(--brand-700)', iconBg: 'var(--brand-50)' },
    success: { bg: 'var(--surface-card)', icon: 'var(--success-700)', iconBg: 'var(--success-50)' },
    warning: { bg: 'var(--surface-card)', icon: 'var(--warning-700)', iconBg: 'var(--warning-50)' },
    danger: { bg: 'var(--surface-card)', icon: 'var(--danger-700)', iconBg: 'var(--danger-50)' },
    info: { bg: 'var(--surface-card)', icon: 'var(--info-700)', iconBg: 'var(--info-50)' },
  };
  const a = accents[variant];
  const trendColor = trend == null ? null : trend >= 0 ? 'var(--success-600)' : 'var(--danger-600)';
  return (
    <Card padding={size === 'sm' ? 14 : 18} style={{ background: a.bg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>{label}</span>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 10, background: a.iconBg, display: 'grid', placeItems: 'center' }}>
            <Icon name={icon} size={16} color={a.icon}/>
          </div>
        )}
      </div>
      <div className="display tabular" style={{
        fontSize: size === 'sm' ? 24 : 30, fontWeight: 700,
        color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em',
      }}>
        {value}
        {unit && <span style={{ fontSize: '0.55em', color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>{unit}</span>}
      </div>
      {trend != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: trendColor, fontWeight: 600 }} className="tabular">
            <Icon name={trend >= 0 ? 'arrowUp' : 'arrowDown'} size={12}/>
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span style={{ color: 'var(--text-tertiary)' }}>{trendLabel}</span>}
        </div>
      )}
    </Card>
  );
};

// ─── EduNotificationItem ─────────────────────────────────────
const NotifItem = ({ type = 'info', title, body, time, priority = 'P2', actions, sender }) => {
  const types = {
    urgent: { icon: 'danger', color: 'var(--danger-600)', bg: 'var(--danger-50)' },
    warning: { icon: 'warning', color: 'var(--warning-600)', bg: 'var(--warning-50)' },
    success: { icon: 'success', color: 'var(--success-600)', bg: 'var(--success-50)' },
    info: { icon: 'info', color: 'var(--info-600)', bg: 'var(--info-50)' },
    reminder: { icon: 'clock', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    sms: { icon: 'sms', color: 'var(--neutral-700)', bg: 'var(--neutral-100)' },
  };
  const t = types[type];
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: priority === 'P0' ? t.bg : 'transparent',
      border: priority === 'P0' ? `1px solid ${t.color}33` : '1px solid transparent',
      transition: 'background var(--motion-fast) var(--ease-out)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: t.bg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Icon name={t.icon} size={16} color={t.color}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          {priority === 'P0' && <Badge variant="danger" size="sm">URGENT</Badge>}
        </div>
        {body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{body}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{time}</span>
          {sender && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>• {sender}</span>}
          {actions && actions.map((a, i) => (
            <button key={i} style={{
              fontSize: 11, fontWeight: 600, color: t.color,
              background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            }}>{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar nav item ────────────────────────────────────────
const NavItem = ({ icon, label, count, active, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '8px 12px', height: 36, borderRadius: 'var(--radius-md)',
    background: active ? 'var(--brand-700)' : 'transparent',
    color: active ? 'var(--neutral-0)' : 'var(--text-secondary)',
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: active ? 600 : 500,
    transition: 'all var(--motion-fast) var(--ease-out)',
    textAlign: 'left',
  }}>
    <Icon name={icon} size={16}/>
    <span style={{ flex: 1 }}>{label}</span>
    {count != null && (
      <span className="tabular" style={{
        fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 'var(--radius-full)',
        background: active ? 'rgba(255,255,255,0.18)' : 'var(--neutral-200)',
        color: active ? 'var(--neutral-0)' : 'var(--text-secondary)',
      }}>{count}</span>
    )}
  </button>
);

// ─── Pill chart bar (compact viz) ───────────────────────────
const Sparkline = ({ data, height = 36, color = 'var(--brand-600)' }) => {
  const max = Math.max(...data);
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Animation keyframes
if (!document.getElementById('edu-keyframes')) {
  const s = document.createElement('style');
  s.id = 'edu-keyframes';
  s.textContent = `@keyframes eduSpin{to{transform:rotate(360deg)}} @keyframes eduPulse{0%,100%{opacity:.5}50%{opacity:1}}`;
  document.head.appendChild(s);
}

Object.assign(window, {
  Icon, Button, Spinner, Badge, Card, Input, Avatar, Progress, RingProgress,
  Toast, MetricCard, NotifItem, NavItem, Sparkline,
});
