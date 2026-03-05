import { useEffect, useState } from 'react'
import { api } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const PageTitle = styled.h1`font-size:20px;font-weight:600;color:#facc15;margin:0 0 8px;`
const Grid = styled.div`display:grid;grid-template-columns:1fr 1fr;gap:20px;`
const Card = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:20px;margin-bottom:20px;`
const CardTitle = styled.h3`font-size:13px;color:#555;margin:0 0 16px;text-transform:uppercase;letter-spacing:.05em;`
const Label = styled.div`font-size:12px;color:#666;margin-bottom:6px;`
const Input = styled.input`background:#0d0d0d;border:1px solid #222;border-radius:6px;padding:9px 14px;color:#e0e0e0;font-size:13px;outline:none;width:100%;box-sizing:border-box;&:focus{border-color:#facc15;}&::placeholder{color:#333;}`
const Btn = styled.button<{$primary?:boolean,$danger?:boolean}>`padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;border:none;transition:all .15s;background:${p=>p.$primary?'#facc15':p.$danger?'#2a0d0d':'#1a1a1a'};color:${p=>p.$primary?'#000':p.$danger?'#e55':'#888'};&:hover{opacity:.85;}&:disabled{opacity:.4;cursor:default;}`
const Row = styled.div`display:flex;gap:10px;align-items:flex-end;margin-bottom:16px;`
const FullRow = styled.div`margin-bottom:16px;`
const Table = styled.table`width:100%;border-collapse:collapse;font-size:12px;`
const Th = styled.th`padding:8px 12px;text-align:left;font-weight:500;color:#555;border-bottom:1px solid #1e1e1e;`
const Td = styled.td`padding:8px 12px;border-bottom:1px solid #161616;`
const Tr = styled.tr`&:hover{background:#141414;}`
const Toast = styled.div<{$ok?:boolean}>`position:fixed;bottom:24px;right:24px;background:${p=>p.$ok?'#0d2a1a':'#2a0d0d'};border:1px solid ${p=>p.$ok?'#1a4a2a':'#4a1a1a'};color:${p=>p.$ok?'#4caf6e':'#e55'};border-radius:8px;padding:12px 20px;font-size:13px;z-index:1000;`
const Mono = styled.span`font-family:monospace;font-size:11px;`
const CopyBtn = styled.button`background:none;border:1px solid #222;border-radius:4px;padding:2px 8px;font-size:10px;color:#555;cursor:pointer;&:hover{color:#e0e0e0;border-color:#444;}`
const SectionSep = styled.div`border-top:1px solid #1a1a1a;margin:20px 0;`
const Badge = styled.span`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:#1a1a1a;color:#888;`
const Err = styled.div`color:#e55;background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;`

type Tenant = { tenant_id: string; key_count: number; created_at: string }
type Key = { id: string; tenant_id: string; created_at: string }

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('tl_api_key') || '')
    const [adminKey, setAdminKey] = useState('')
    const [newTenantId, setNewTenantId] = useState('')
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [myKeys, setMyKeys] = useState<Key[]>([])
    const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null)
    const [loadingTenants, setLoadingTenants] = useState(false)
    const [error, setError] = useState<string|null>(null)
    const [rotatingTenant, setRotatingTenant] = useState<string|null>(null)

    const showToast = (msg: string, ok = true) => {
        setToast({msg, ok})
        setTimeout(()=>setToast(null), 3000)
    }

    const saveKey = () => {
        localStorage.setItem('tl_api_key', apiKey)
        showToast('API key saved')
    }

    const loadMyKeys = async () => {
        try {
            const data = await api.keys.list() as any
            setMyKeys(data.items ?? data)
        } catch(e:any) { console.warn('Could not load keys:', e.message) }
    }

    const loadTenants = async () => {
        if (!adminKey.trim()) return
        setLoadingTenants(true); setError(null)
        try {
            const data = await api.admin.listTenants(adminKey) as any
            setTenants(data.items ?? data ?? [])
        } catch(e:any) { setError('Admin key invalid or server error: '+e.message) }
        finally { setLoadingTenants(false) }
    }

    const registerTenant = async () => {
        if (!newTenantId.trim() || !adminKey.trim()) return
        try {
            const data = await api.admin.register(newTenantId.trim(), adminKey) as any
            showToast(`Tenant "${newTenantId}" registered. API key: ${data.api_key||'generated'}`)
            setNewTenantId('')
            loadTenants()
        } catch(e:any) { setError(e.message) }
    }

    const rotateTenantKey = async (tenantId: string) => {
        setRotatingTenant(tenantId)
        try {
            const data = await api.admin.rotateKey(tenantId, adminKey) as any
            showToast(`New key for ${tenantId}: ${data.api_key?.slice(0,12)}…`)
            loadTenants()
        } catch(e:any) { setError(e.message) }
        finally { setRotatingTenant(null) }
    }

    useEffect(() => { loadMyKeys() }, [])

    const copy = (text: string) => { navigator.clipboard.writeText(text); showToast('Copied to clipboard') }

    return (
        <Page>
            <PageTitle>Settings</PageTitle>
            <div style={{color:'#555',fontSize:12,marginBottom:24}}>SDK configuration, API keys, and tenant management</div>

            <Grid>
                <div>
                    <Card>
                        <CardTitle>SDK Configuration</CardTitle>
                        <FullRow>
                            <Label>API Key (stored in browser)</Label>
                            <Row>
                                <Input type="password" placeholder="tl_..." value={apiKey} onChange={e=>setApiKey(e.target.value)} />
                                <Btn $primary onClick={saveKey}>Save</Btn>
                            </Row>
                        </FullRow>
                        <SectionSep />
                        <div style={{fontSize:12,color:'#555',marginBottom:12}}>Your API keys</div>
                        {myKeys.length===0 ? (
                            <div style={{color:'#333',fontSize:12}}>No keys found for current session. Set a valid API key above.</div>
                        ) : (
                            myKeys.map(k=>(
                                <div key={k.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #161616'}}>
                                    <Mono style={{color:'#777'}}>{k.id.slice(0,8)}… <Badge>{k.tenant_id}</Badge></Mono>
                                    <span style={{fontSize:11,color:'#444'}}>{new Date(k.created_at).toLocaleDateString()}</span>
                                </div>
                            ))
                        )}
                    </Card>

                    <Card>
                        <CardTitle>Quick Start</CardTitle>
                        <div style={{fontSize:12,color:'#666',lineHeight:1.8}}>
                            <div style={{marginBottom:8}}>Install the SDK:</div>
                            <div style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:6,padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#aaa',marginBottom:14}}>
                                pip install temporallayr
                            </div>
                            <div style={{marginBottom:8}}>Instrument your agent:</div>
                            <div style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:6,padding:'10px 12px',fontFamily:'monospace',fontSize:11,color:'#aaa',whiteSpace:'pre'}}{...{}}>
{`import temporallayr as tl

tl.init(api_key="${apiKey||'YOUR_API_KEY'}")

@tl.track_llm
async def call_gpt(prompt):
    ...`}
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardTitle>Admin — Tenant Management</CardTitle>
                        <FullRow>
                            <Label>Admin Key</Label>
                            <Row>
                                <Input type="password" placeholder="admin key" value={adminKey} onChange={e=>setAdminKey(e.target.value)} />
                                <Btn onClick={loadTenants} disabled={loadingTenants||!adminKey.trim()}>
                                    {loadingTenants?'…':'Load'}
                                </Btn>
                            </Row>
                        </FullRow>

                        {error && <Err>{error}</Err>}

                        <SectionSep />
                        <Label>Register New Tenant</Label>
                        <Row style={{marginBottom:16}}>
                            <Input placeholder="tenant-id (e.g. acme-corp)" value={newTenantId} onChange={e=>setNewTenantId(e.target.value)} onKeyDown={e=>e.key==='Enter'&&registerTenant()} />
                            <Btn $primary disabled={!newTenantId.trim()||!adminKey.trim()} onClick={registerTenant}>Register</Btn>
                        </Row>

                        {tenants.length>0 && (
                            <>
                                <div style={{fontSize:12,color:'#555',marginBottom:10}}>{tenants.length} tenants</div>
                                <Table>
                                    <thead><Tr><Th>Tenant ID</Th><Th>Keys</Th><Th>Created</Th><Th></Th></Tr></thead>
                                    <tbody>
                                        {tenants.map(t=>(
                                            <Tr key={t.tenant_id}>
                                                <Td><Mono>{t.tenant_id}</Mono></Td>
                                                <Td style={{color:'#888'}}>{t.key_count}</Td>
                                                <Td style={{color:'#555',fontSize:11}}>{new Date(t.created_at).toLocaleDateString()}</Td>
                                                <Td>
                                                    <Btn $danger style={{fontSize:11,padding:'3px 8px'}} disabled={rotatingTenant===t.tenant_id} onClick={()=>rotateTenantKey(t.tenant_id)}>
                                                        {rotatingTenant===t.tenant_id?'…':'Rotate Key'}
                                                    </Btn>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </>
                        )}
                    </Card>

                    <Card>
                        <CardTitle>Server Info</CardTitle>
                        <div style={{fontSize:12,color:'#666',lineHeight:2}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                                <span>API Endpoint</span>
                                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                    <Mono style={{color:'#888'}}>{import.meta.env?.VITE_API_URL||'/api'}</Mono>
                                    <CopyBtn onClick={()=>copy(import.meta.env?.VITE_API_URL||'/api')}>copy</CopyBtn>
                                </div>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                                <span>Dashboard Version</span>
                                <Badge>v0.2.1</Badge>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between'}}>
                                <span>Docs</span>
                                <a href="https://github.com/CodeWizarz/Temporallayr-Powerhouse" target="_blank" rel="noreferrer" style={{color:'#facc15',fontSize:11}}>GitHub →</a>
                            </div>
                        </div>
                    </Card>
                </div>
            </Grid>

            {toast && <Toast $ok={toast.ok}>{toast.ok?'✓':' ✗'} {toast.msg}</Toast>}
        </Page>
    )
}
