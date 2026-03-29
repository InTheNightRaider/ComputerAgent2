export interface ServiceAccount {
  id: string
  label: string
  email: string
  connected: boolean
}

export interface Service {
  id: string
  n: string
  fb: string
  cat: string
  color: string
  multiAccount: boolean
  accounts: ServiceAccount[]
}

export const INIT_SERVICES: Service[] = [
  { id: 'gdrive',  n: 'Google Drive', fb: '📁', cat: 'Storage', color: '#4285F4', multiAccount: true,
    accounts: [{ id: 'a1', label: 'Personal', email: 'user@gmail.com', connected: true }, { id: 'a2', label: 'Work', email: 'user@company.com', connected: false }] },
  { id: 'gmail',   n: 'Gmail',        fb: '📧', cat: 'Email',   color: '#EA4335', multiAccount: true,
    accounts: [{ id: 'a1', label: 'Personal', email: 'user@gmail.com', connected: true }, { id: 'a2', label: 'Work', email: 'user@company.com', connected: false }] },
  { id: 'slack',   n: 'Slack',        fb: '💬', cat: 'Comms',   color: '#4A154B', multiAccount: true,
    accounts: [{ id: 'a1', label: 'Company', email: 'workspace.slack.com', connected: true }] },
  { id: 'notion',  n: 'Notion',       fb: '📓', cat: 'Notes',   color: '#fff',    multiAccount: false,
    accounts: [{ id: 'a1', label: 'Personal', email: 'user@email.com', connected: false }] },
  { id: 'github',  n: 'GitHub',       fb: '🐙', cat: 'Dev',     color: '#fff',    multiAccount: true,
    accounts: [{ id: 'a1', label: 'Personal', email: 'personal@github.com', connected: false }] },
  { id: 'discord', n: 'Discord',      fb: '🎮', cat: 'Comms',   color: '#5865F2', multiAccount: false,
    accounts: [{ id: 'a1', label: 'Personal', email: 'user#1234', connected: false }] },
  { id: 'webhook', n: 'Webhook',      fb: '🔗', cat: 'Dev',     color: '#12b89e', multiAccount: false,
    accounts: [{ id: 'a1', label: 'Default', email: 'Built-in', connected: true }] },
]
