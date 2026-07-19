import './Sidebar.css';

export type SidebarMenu = 'account' | 'recovery' | 'reset';

interface SidebarProps {
  open: boolean;
  email?: string | null;
  onClose: () => void;
  onSelect: (menu: SidebarMenu) => void;
  onLogout: () => void;
}

const ITEMS: { id: SidebarMenu; label: string }[] = [
  { id: 'account', label: '계정 설정' },
  { id: 'recovery', label: '복구 키 재발급' },
  { id: 'reset', label: '초기화' },
];

export function Sidebar({ open, email, onClose, onSelect, onLogout }: SidebarProps) {
  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-head">
          <p className="sidebar-label">메뉴</p>
          {email && <p className="sidebar-email">{email}</p>}
        </div>
        <nav className="sidebar-nav">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sidebar-item"
              onClick={() => {
                onSelect(item.id);
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-item sidebar-logout"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
