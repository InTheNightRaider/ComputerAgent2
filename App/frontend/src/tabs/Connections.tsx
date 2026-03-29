import { T } from '../theme'
import { Tag, Dot } from '../components/Tag'
import { useAppStore } from '../store'
import { Service, ServiceAccount } from '../data/connections'

function AccountRow({
  account,
  service,
  onToggle,
}: {
  account: ServiceAccount
  service: Service
  onToggle: () => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', background: T.s3, borderRadius: 8,
        border: `1px solid ${account.connected ? service.color + '33' : T.b}`,
        marginBottom: 6,
      }}
    >
      <Dot color={account.connected ? T.gr : T.mu2} pulse={false} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{account.label}</div>
        <div style={{ fontSize: 11, color: T.mu }}>{account.email}</div>
      </div>
      {account.connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={T.gr} style={{ fontSize: 9 }}>Connected</Tag>
          <button
            onClick={onToggle}
            style={{ padding: '3px 10px', background: T.rd + '20', border: `1px solid ${T.rd}44`, borderRadius: 5, color: T.rd, cursor: 'pointer', fontSize: 11 }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          style={{ padding: '3px 10px', background: T.ac, border: 'none', borderRadius: 5, color: T.tx, cursor: 'pointer', fontSize: 11 }}
        >
          Connect
        </button>
      )}
    </div>
  )
}

const CAT_ORDER = ['Storage', 'Email', 'Comms', 'Notes', 'Dev']

export function Connections() {
  const { services, setServices } = useAppStore()

  const toggleAccount = (serviceId: string, accountId: string) => {
    setServices(ss => ss.map(s =>
      s.id !== serviceId ? s : {
        ...s,
        accounts: s.accounts.map(a =>
          a.id !== accountId ? a : { ...a, connected: !a.connected }
        ),
      }
    ))
  }

  const connectedCount = services.reduce((n, s) => n + s.accounts.filter(a => a.connected).length, 0)

  const grouped = CAT_ORDER.reduce<Record<string, Service[]>>((acc, cat) => {
    acc[cat] = services.filter(s => s.cat === cat)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.b}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>🔌 Connections</div>
          <div style={{ fontSize: 13, color: T.mu }}>Connect services to use in Pipelines and Automations.</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: T.gr + '18', border: `1px solid ${T.gr}33`, borderRadius: 8 }}>
          <Dot color={T.gr} />
          <span style={{ fontSize: 12, color: T.gr, fontWeight: 600 }}>{connectedCount} connected</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16, alignItems: 'start' }}>
          {CAT_ORDER.map(cat => {
            const svcs = grouped[cat] ?? []
            if (svcs.length === 0) return null
            return (
              <div key={cat}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  {cat}
                </div>
                {svcs.map(service => {
                  const anyConnected = service.accounts.some(a => a.connected)
                  return (
                    <div
                      key={service.id}
                      style={{
                        background: T.s2,
                        border: `1px solid ${anyConnected ? service.color + '33' : T.b}`,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        transition: 'border-color .2s',
                      }}
                    >
                      {/* Service header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: service.color + '22',
                            border: `1px solid ${service.color}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                          }}
                        >
                          {service.fb}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{service.n}</div>
                          <div style={{ fontSize: 11, color: T.mu }}>
                            {service.multiAccount ? 'Multi-account' : 'Single account'}
                          </div>
                        </div>
                        {anyConnected && <Tag color={T.gr} style={{ fontSize: 9 }}>Active</Tag>}
                      </div>

                      {/* Accounts */}
                      {service.accounts.map(account => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          service={service}
                          onToggle={() => toggleAccount(service.id, account.id)}
                        />
                      ))}

                      {/* Add account */}
                      {service.multiAccount && (
                        <button
                          disabled
                          style={{
                            width: '100%', marginTop: 6, padding: '6px', background: 'none',
                            border: `1px dashed ${T.b2}`, borderRadius: 8, color: T.mu2,
                            cursor: 'not-allowed', fontSize: 11,
                          }}
                        >
                          + Add account (coming soon)
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 8, padding: '16px 20px', background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.7 }}>
            <strong style={{ color: T.tx }}>Note:</strong> OAuth flows and real token management come in Checkpoint 3.
            Toggle buttons above simulate connected/disconnected state for UI development.
          </div>
        </div>
      </div>
    </div>
  )
}
