import { useUIStore, Notification } from '../../store/ui.store'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export default function NotificationStack() {
  const { notifications, removeNotification } = useUIStore()

  const icons = {
    success: <CheckCircle size={16} style={{color:'var(--color-success-500)',flexShrink:0}}/>,
    error: <XCircle size={16} style={{color:'var(--color-danger-500)',flexShrink:0}}/>,
    warning: <AlertTriangle size={16} style={{color:'var(--color-warning-500)',flexShrink:0}}/>,
    info: <Info size={16} style={{color:'var(--color-accent-500)',flexShrink:0}}/>,
  }

  if (notifications.length === 0) return null

  return (
    <div style={{position:'fixed',bottom:'20px',right:'20px',display:'flex',flexDirection:'column',gap:'8px',zIndex:'var(--z-toast)',maxWidth:'340px'}}>
      {notifications.map(n => (
        <div key={n.id} className="animate-slideInLeft"
          style={{background:'var(--color-base-700)',border:'1px solid var(--color-border-default)',borderRadius:'var(--radius-lg)',padding:'12px 16px',boxShadow:'var(--shadow-lg)',display:'flex',alignItems:'flex-start',gap:'10px'}}>
          {icons[n.type]}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'var(--text-sm)',fontWeight:'var(--weight-semibold)',color:'var(--color-text-200)'}}>{n.title}</div>
            {n.message && <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-500)',marginTop:'2px'}}>{n.message}</div>}
          </div>
          <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px',flexShrink:0}} onClick={() => removeNotification(n.id)}>
            <X size={11}/>
          </button>
        </div>
      ))}
    </div>
  )
}
