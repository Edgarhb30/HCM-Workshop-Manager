export const defaultBranding = {
  theme_mode: 'light',
  primary_color: '#222222',
  accent_color: '#666666',
  background_color: '#f1f2f3',
  surface_color: '#ffffff',
  text_color: '#181818',
  logo_url: '/hcm-logo.jpg',
  legal_name: '',
  tax_id: '',
  phone: '',
  email: '',
  address: ''
}

export function themeVariables(branding = defaultBranding) {
  return {
    '--brand-primary': branding.primary_color || defaultBranding.primary_color,
    '--brand-accent': branding.accent_color || defaultBranding.accent_color,
    '--brand-background': branding.background_color || defaultBranding.background_color,
    '--brand-surface': branding.surface_color || defaultBranding.surface_color,
    '--brand-text': branding.text_color || defaultBranding.text_color
  }
}
