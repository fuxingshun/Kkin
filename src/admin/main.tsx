import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  Image,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  TrendingUp,
  Trash2,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ADMIN_FAMILY_ID,
  createPsychologyQuestion,
  createPsychologyVideo,
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  getAdminFamilies,
  getAdminAnalytics,
  getAdminCounselors,
  getAdminServiceSummary,
  getAlertStats,
  getAlerts,
  getCareInsight,
  getHealth,
  getMedia,
  getMoodStats,
  getPsychologyResources,
  getPrivacyRequests,
  getRetentionSummary,
  getServiceCertifications,
  getUsers,
  handleAlert as handleAlertRequest,
  loginAdmin as loginAdminRequest,
  reviewPrivacyRequest,
  reviewServiceCertification,
  updatePsychologyQuestion,
  updatePsychologyVideo,
  updateAdminCounselor,
  updateUser as updateUserRequest,
  uploadMedia,
  type ApiAlert,
  type ApiAdminAnalytics,
  type ApiAdminFamily,
  type ApiAdminServiceSummary,
  type ApiCareInsight,
  type ApiCounselor,
  type ApiLoginResult,
  type ApiMedia,
  type ApiMoodStats,
  type ApiPsychologyResources,
  type ApiPrivacyRequest,
  type ApiServiceCertification,
  type ApiUser,
} from './api';
import '../index.css';
import './admin.css';

type AdminPage = 'dashboard' | 'users' | 'content' | 'alerts' | 'service' | 'analytics' | 'settings';
type Notify = (title: string, body?: string) => void;
type AdminNotice = { title: string; body: string } | null;
type AdminSession = { username: string; displayName: string; role: string; sessionToken?: string };
type UserFormState = {
  userType: 'elderly' | 'family';
  name: string;
  phone: string;
  familyId: string;
};

const ADMIN_SESSION_KEY = 'kin-admin-session';

const pilotNavItems: Array<{ id: AdminPage; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: '运营总览', icon: LayoutDashboard },
  { id: 'users', label: '家庭档案', icon: Users },
  { id: 'content', label: '内容管理', icon: FileText },
  { id: 'alerts', label: '风险队列', icon: AlertTriangle },
  { id: 'service', label: '服务协同', icon: Briefcase },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
  { id: 'settings', label: '试点设置', icon: Settings },
];

const navItems: Array<{ id: AdminPage; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'content', label: '内容管理', icon: FileText },
  { id: 'alerts', label: '预警与风控', icon: AlertTriangle },
  { id: 'service', label: '服务协同', icon: Briefcase },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
  { id: 'settings', label: '系统设置', icon: Settings },
];

const visibleNavItems = pilotNavItems.length ? pilotNavItems : navItems;

interface AdminUser {
  id: number;
  name: string;
  userType: 'elderly' | 'family' | string;
  role: string;
  phone: string;
  familyId: string;
  family: number;
  risk: '高' | '中' | '低';
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AdminAlert {
  id: number;
  elder: string;
  type: string;
  reason: string;
  level: '高' | '中' | '低';
  time: string;
  status: '未处理' | '处理中' | '已处理';
}

function toCsvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function mapRiskLevel(level?: string): AdminUser['risk'] {
  if (level === 'high' || level === '高') return '高';
  if (level === 'medium' || level === '中') return '中';
  return '低';
}

function getAlertStatus(alert: ApiAlert): AdminAlert['status'] {
  if (alert.handled) return '已处理';
  if (alert.read) return '处理中';
  return '未处理';
}

function getAlertTypeLabel(type: string) {
  const labels: Record<string, string> = {
    sos_emergency: '紧急求助',
    contact_family: '联系家人',
    medication: '用药提醒',
    emotion: '情绪波动',
    inactive: '长时间未活动',
    emergency: '异常事件',
  };

  return labels[type] || type;
}

function getMoodLabel(type: string) {
  const labels: Record<string, string> = {
    happy: '开心',
    calm: '平稳',
    sad: '难过',
    anxious: '焦虑',
    angry: '生气',
    tired: '疲惫',
  };

  return labels[type] || type;
}

function getPrivacyRequestTypeLabel(type: string) {
  const labels: Record<string, string> = {
    export: '数据导出',
    delete: '数据删除',
    correction: '数据更正',
  };

  return labels[type] || type;
}

function getPrivacyRequestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    rejected: '已拒绝',
  };

  return labels[status] || status;
}

function createContentSlug(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `psychology-${Date.now()}`;
}

function formatAdminTime(value?: string) {
  if (!value) {
    return '--';
  }

  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function toAdminUsers(apiUsers: ApiUser[], apiAlerts: ApiAlert[]): AdminUser[] {
  const familyCountByFamily = apiUsers.reduce<Record<string, number>>((acc, user) => {
    if (user.user_type === 'family') {
      acc[user.family_id] = (acc[user.family_id] || 0) + 1;
    }
    return acc;
  }, {});

  return apiUsers.map((user) => {
    const openAlerts = apiAlerts.filter((alert) => alert.elderly_id === user.id && !alert.handled);
    const highestAlert = openAlerts.find((alert) => alert.level === 'high') || openAlerts[0];

    return {
      id: user.id,
      name: user.name,
      userType: user.user_type,
      role: user.user_type === 'elderly' ? '老人' : user.user_type === 'family' ? '家属' : user.user_type,
      phone: user.phone || '未填写',
      familyId: user.family_id || ADMIN_FAMILY_ID,
      family: familyCountByFamily[user.family_id] || 0,
      risk: user.user_type === 'elderly' ? mapRiskLevel(highestAlert?.level) : '低',
      status: openAlerts.length ? '需关注' : '正常',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  });
}

function toAdminAlerts(apiAlerts: ApiAlert[]): AdminAlert[] {
  return apiAlerts.map((alert) => ({
    id: alert.id,
    elder: alert.elderly_name || `老人${alert.elderly_id ?? ''}` || '未绑定老人',
    type: alert.title || getAlertTypeLabel(alert.alert_type),
    reason: alert.message,
    level: mapRiskLevel(alert.level),
    time: formatAdminTime(alert.created_at),
    status: getAlertStatus(alert),
  }));
}

function RiskBadge({ level }: { level: string }) {
  const className = level === '高' ? 'admin-badge admin-badge--high' : level === '中' ? 'admin-badge admin-badge--medium' : 'admin-badge admin-badge--low';
  return <span className={className}>{level}{level === '低' ? '' : '风险'}</span>;
}

function getStoredAdminSession(): AdminSession | null {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    if (!parsed?.username) {
      return null;
    }
    return {
      username: parsed.username,
      displayName: parsed.displayName || '平台管理员',
      role: parsed.role || 'admin',
      sessionToken: typeof parsed.sessionToken === 'string' ? parsed.sessionToken : undefined,
    };
  } catch {
    return null;
  }
}

function saveAdminSession(session: AdminSession) {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

function AdminLogin({ onLogin, notify }: { onLogin: (session: AdminSession) => void; notify: Notify }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!username.trim()) {
      notify('登录失败', '请输入后台用户名。');
      return;
    }
    if (!password.trim()) {
      notify('登录失败', '请输入后台密码。');
      return;
    }

    try {
      setSubmitting(true);
      const result: ApiLoginResult = await loginAdminRequest(username, password);
      const session: AdminSession = {
        username: result.username || username.trim(),
        displayName: result.display_name || '平台管理员',
        role: result.role || 'admin',
        sessionToken: result.session_token,
      };
      saveAdminSession(session);
      onLogin(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : '后台登录失败';
      notify('登录失败', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__shell">
        <button
          className="admin-login__back"
          type="button"
          onClick={() => notify('返回角色选择', '管理端为独立 Web 入口，移动端角色选择请在小程序端进入。')}
        >
          返回角色选择
        </button>
        <div className="admin-login__card">
          <div className="admin-login__head">
            <div className="admin-login__icon">
              <Shield size={36} />
            </div>
            <h1>后台管理端</h1>
            <p>平台运营，数据管理</p>
          </div>
          <div className="admin-login__form">
            <label>
              <span>用户名</span>
              <input placeholder="请输入用户名" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              <span>密码</span>
              <div className="admin-login__password">
                <input
                  placeholder="请输入密码"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
            <div className="admin-login__row">
              <label className="admin-login__remember">
                <input type="checkbox" />
                <span>记住我</span>
              </label>
              <button type="button" onClick={() => notify('密码找回', '请联系平台超级管理员重置后台账号密码。')}>忘记密码？</button>
            </div>
            <button className="admin-login__submit" type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? '登录中...' : '立即登录'}
            </button>
            <p>
              还没有账号？
              <button type="button" onClick={() => notify('账号开通', '后台账号需由机构管理员在权限中心开通。')}>立即注册</button>
            </p>
          </div>
        </div>
        <div className="admin-login__safe">您的信息将被安全加密保护</div>
      </section>
    </main>
  );
}

function AdminLayout({
  page,
  setPage,
  session,
  families,
  selectedFamilyId,
  onFamilyChange,
  children,
}: {
  page: AdminPage;
  setPage: (page: AdminPage) => void;
  session: AdminSession;
  families: ApiAdminFamily[];
  selectedFamilyId: string;
  onFamilyChange: (familyId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${open ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__mark">心</div>
          <div>
            <strong>陪护平台</strong>
            <span>管理后台</span>
          </div>
        </div>
        <nav className="admin-sidebar__nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                className={active ? 'admin-sidebar__item admin-sidebar__item--active' : 'admin-sidebar__item'}
                key={item.id}
                type="button"
                onClick={() => {
                  setPage(item.id);
                  setOpen(false);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      {open ? <button className="admin-sidebar__mask" type="button" onClick={() => setOpen(false)} /> : null}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-topbar__menu" type="button" onClick={() => setOpen(true)}>
            <Menu size={24} />
          </button>
          <label className="admin-topbar__family">
            <span>家庭档案</span>
            <select value={selectedFamilyId} onChange={(event) => onFamilyChange(event.target.value)}>
              {(families.length ? families : [{ family_id: selectedFamilyId, total_users: 0, elderly_count: 0, family_count: 0, open_alerts: 0 }]).map((family) => (
                <option key={family.family_id} value={family.family_id}>
                  {family.family_id} · 老人 {family.elderly_count} · 预警 {family.open_alerts}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-topbar__profile">
            <div>
              <strong>{session.displayName}</strong>
              <span>{session.username}</span>
            </div>
            <div className="admin-topbar__avatar">管</div>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="admin-page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
}

function AdminNoticeDialog({ notice, onClose }: { notice: AdminNotice; onClose: () => void }) {
  if (!notice) {
    return null;
  }

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-notice-title">
      <button className="admin-modal__mask" type="button" aria-label="关闭弹窗" onClick={onClose} />
      <section className="admin-modal__panel">
        <h2 id="admin-notice-title">{notice.title}</h2>
        <p>{notice.body}</p>
        <button className="admin-primary" type="button" onClick={onClose}>
          知道了
        </button>
      </section>
    </div>
  );
}

function DashboardPage({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [summary, setSummary] = useState<ApiAdminServiceSummary | null>(null);
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null);
  const [careInsight, setCareInsight] = useState<ApiCareInsight | null>(null);
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([]);
  const [moodStats, setMoodStats] = useState<ApiMoodStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        const [nextSummary, nextAnalytics, alertsResult, nextMoodStats, nextCareInsight] = await Promise.all([
          getAdminServiceSummary(selectedFamilyId),
          getAdminAnalytics(selectedFamilyId, { months: 6, days: 7 }),
          getAlerts(selectedFamilyId, { limit: 30 }),
          getMoodStats(selectedFamilyId),
          getCareInsight(selectedFamilyId),
        ]);

        if (!mounted) {
          return;
        }

        setSummary(nextSummary);
        setAnalytics(nextAnalytics);
        setCareInsight(nextCareInsight);
        setAdminAlerts(toAdminAlerts(alertsResult.alerts));
        setMoodStats(nextMoodStats);
      } catch (error) {
        if (mounted) {
          notify('管理端数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [notify, selectedFamilyId]);
  const overview = summary?.overview;
  const analyticsSummary = analytics?.summary;
  const casePreviewRows = (summary?.case_rows ?? []).slice(0, 3).map((row, index) => ({
    id: row.elderly_id,
    rank: index + 1,
    name: row.elderly_name,
    detail: `${row.open_alerts} 条风险 / ${row.active_consultations} 次随访`,
    risk: mapRiskLevel(row.risk_level),
  }));
  const dashboardStats = [
    {
      label: '老人档案',
      value: String(analyticsSummary?.elderly_users ?? 0),
      change: loading ? '同步中' : `总用户 ${analyticsSummary?.total_users ?? 0}`,
      icon: Users,
      tone: 'purple',
    },
    {
      label: '家属账号',
      value: String(analyticsSummary?.family_users ?? 0),
      change: loading ? '同步中' : `7日随访 ${analyticsSummary?.followups ?? 0}`,
      icon: Shield,
      tone: 'pink',
    },
    {
      label: '情绪记录',
      value: String(analyticsSummary?.mood_records ?? moodStats?.overall?.total_records ?? 0),
      change: loading
        ? '同步中'
        : `平均 ${analyticsSummary ? analyticsSummary.avg_mood_score.toFixed(1) : (moodStats?.overall?.avg_score ?? 0).toFixed(1)} 分`,
      icon: Activity,
      tone: 'green',
    },
    {
      label: '待处理风险',
      value: String(overview?.pending_alerts ?? adminAlerts.length),
      change: loading ? '同步中' : `高风险 ${overview?.high_risk_cases ?? 0}`,
      icon: AlertTriangle,
      tone: 'orange',
    },
  ];
  const chartGrowthData = analytics?.user_growth ?? [];
  const dashboardEmotionData =
    moodStats?.mood_type_stats?.map((item) => ({
      emotion: getMoodLabel(item.mood_type),
      count: item.count,
    })) ?? [];


  return (
    <div className="admin-page-stack">
      <PageHeader title="平台总览" desc="实时监控平台运营数据和关键指标" />
      <section className={`admin-panel admin-care-command admin-care-command--${careInsight?.risk_level || 'low'}`}>
        <div className="admin-care-command__head">
          <div>
            <span className="admin-kicker">机构照护闭环</span>
            <h2>{careInsight?.status_label || '正在同步照护洞察'}</h2>
            <p>{careInsight?.summary || '系统会汇总任务、情绪、预警和服务记录，形成每日运营判断。'}</p>
          </div>
          <div className="admin-care-command__score">
            <strong>{careInsight?.metrics?.completion_rate ?? 0}%</strong>
            <span>任务完成率</span>
          </div>
        </div>
        <div className="admin-care-command__grid">
          <div>
            <span>风险原因</span>
            <strong>{careInsight?.reason || '暂无异常风险'}</strong>
          </div>
          <div>
            <span>下一步</span>
            <strong>{careInsight?.next_step || '保持例行观察'}</strong>
          </div>
          <div>
            <span>服务回流</span>
            <strong>{careInsight?.latest_service_record || '暂无新的服务记录'}</strong>
          </div>
        </div>
      </section>

      <section className="admin-stat-grid">
        {dashboardStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <div className={`admin-stat-card__icon admin-stat-card__icon--${stat.tone}`}>
                <Icon size={24} />
              </div>
              <span className="admin-change admin-change--up">
                {stat.change}
              </span>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          );
        })}
      </section>

      <section className="admin-two-col">
        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>用户增长趋势</h2>
              <p>近6个月用户数量变化</p>
            </div>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartGrowthData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="elderly" stroke="#3b82a6" strokeWidth={2} dot={{ fill: '#3b82a6', r: 3 }} name="老人档案" />
                <Line type="monotone" dataKey="family" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="家属账号" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>情绪分布统计</h2>
              <p>本月情绪记录分类</p>
            </div>
            <Activity size={20} color="#6366f1" />
          </div>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardEmotionData}>
                <XAxis dataKey="emotion" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="admin-two-col">
        <article className="admin-panel">
          <h2>今日待处理预警</h2>
          <div className="admin-list">
            {adminAlerts.length ? (
              adminAlerts.slice(0, 3).map((alert) => (
                <div className="admin-list-row" key={alert.id}>
                  <div>
                    <strong>{alert.elder}</strong>
                    <span>{alert.reason}</span>
                  </div>
                  <RiskBadge level={alert.level} />
                </div>
              ))
            ) : (
              <div className="admin-list-row">
                <div>
                  <strong>暂无待处理预警</strong>
                  <span>当前家庭没有需要服务端接手的工单</span>
                </div>
              </div>
            )}
          </div>
        </article>
        <article className="admin-panel">
          <h2>家庭档案概况</h2>
          <div className="admin-list">
            {casePreviewRows.length ? (
              casePreviewRows.map((row) => (
                <div className="admin-rank-row" key={row.id}>
                  <span>{row.rank}</span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.detail}</small>
                  </div>
                  <RiskBadge level={row.risk} />
                </div>
              ))
            ) : (
              <div className="admin-list-row">
                <div>
                  <strong>{selectedFamilyId}</strong>
                  <span>暂无可展示的老人档案</span>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function UsersPage({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<UserFormState>({
    userType: 'elderly',
    name: '',
    phone: '',
    familyId: selectedFamilyId,
  });
  const pageSize = 2;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [nextUsers, alertsResult] = await Promise.all([
        getUsers(selectedFamilyId),
        getAlerts(selectedFamilyId, { limit: 100 }),
      ]);
      setAdminUsers(toAdminUsers(nextUsers, alertsResult.alerts));
    } catch (error) {
      notify('用户数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    } finally {
      setLoading(false);
    }
  }, [notify, selectedFamilyId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return adminUsers.filter((user) => {
      const keyword = query.trim();
      const matchesQuery =
        !keyword ||
        user.name.includes(keyword) ||
        user.phone.includes(keyword) ||
        String(user.id).includes(keyword);
      const matchesRisk = riskFilter ? user.risk === riskFilter : true;
      return matchesQuery && matchesRisk;
    });
  }, [adminUsers, query, riskFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  function exportUsers() {
    const csv = [
      ['ID', '姓名', '角色', '电话', '家庭档案', '家属数', '风险等级', '状态'],
      ...filteredUsers.map((user) => [
        user.id,
        user.name,
        user.role,
        user.phone,
        user.familyId,
        user.family,
        user.risk,
        user.status,
      ]),
    ]
      .map((row) => row.map(toCsvCell).join(','))
      .join('\n');

    downloadTextFile('kinecho-users.csv', csv);
    notify('导出完成', `已导出 ${filteredUsers.length} 条用户数据。`);
  }

  function openCreateUser() {
    setEditingUser(null);
    setFormState({
      userType: 'elderly',
      name: '',
      phone: '',
      familyId: selectedFamilyId,
    });
    setFormOpen(true);
  }

  function openEditUser(user: AdminUser) {
    setEditingUser(user);
    setFormState({
      userType: user.userType === 'family' ? 'family' : 'elderly',
      name: user.name,
      phone: user.phone === '未填写' ? '' : user.phone,
      familyId: user.familyId || selectedFamilyId,
    });
    setFormOpen(true);
  }

  function closeUserForm() {
    if (!saving) {
      setFormOpen(false);
      setEditingUser(null);
    }
  }

  async function handleSaveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = formState.name.trim();
    const nextPhone = formState.phone.trim();
    const nextFamilyId = formState.familyId.trim() || selectedFamilyId;

    if (!nextName) {
      notify('无法保存用户', '请填写用户姓名。');
      return;
    }

    try {
      setSaving(true);
      if (editingUser) {
        await updateUserRequest(editingUser.id, {
          family_id: nextFamilyId,
          name: nextName,
          phone: nextPhone,
        });
        notify('用户已更新', `${nextName} 的资料已同步到 Java 后端。`);
      } else {
        await createUserRequest({
          user_type: formState.userType,
          family_id: nextFamilyId,
          name: nextName,
          phone: nextPhone,
        });
        notify('用户已新增', `${nextName} 已加入家庭档案 ${nextFamilyId}。`);
      }
      setFormOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      notify('用户保存失败', error instanceof Error ? error.message : '请确认 Java 后端可用。');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.userType !== 'family') {
      notify('老人档案不可删除', '如需调整老人资料，请使用编辑操作。');
      return;
    }

    if (!window.confirm(`确认删除家属「${user.name}」吗？删除后老人端求助联系人会同步移除。`)) {
      return;
    }

    try {
      await deleteUserRequest(user.id, user.familyId);
      notify('用户已删除', `${user.name} 已从家庭档案中移除。`);
      await loadUsers();
    } catch (error) {
      notify('用户删除失败', error instanceof Error ? error.message : '请确认 Java 后端可用。');
    }
  }

  function showUserDetail(user: AdminUser) {
    notify(
      `${user.name} 的用户档案`,
      `角色：${user.role}\n电话：${user.phone}\n家庭档案：${user.familyId}\n家属数：${user.family}位\n风险等级：${user.risk}\n状态：${user.status}\n最近更新：${formatAdminTime(user.updatedAt)}`
    );
  }

  return (
    <div className="admin-page-stack">
      <PageHeader
        title="用户管理"
        desc="管理老人用户和家属用户信息"
        action={
          <div className="admin-header-actions">
            <button className="admin-secondary" type="button" onClick={exportUsers}><Download size={16} />导出数据</button>
            <button className="admin-primary" type="button" onClick={openCreateUser}><Plus size={16} />新增用户</button>
          </div>
        }
      />
      <section className="admin-panel admin-panel--flush">
        <div className="admin-table-toolbar">
          <label className="admin-search">
            <Search size={20} />
            <input
              placeholder="搜索用户..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            value={riskFilter}
            onChange={(event) => {
              setRiskFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部风险等级</option>
            <option value="高">高风险</option>
            <option value="中">中风险</option>
            <option value="低">低风险</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>角色</th>
                <th>家属数</th>
                <th>风险等级</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.role}</td>
                  <td>{user.family}位</td>
                  <td><RiskBadge level={user.risk} /></td>
                  <td><span className="admin-badge admin-badge--low">{user.status}</span></td>
                  <td>{formatAdminTime(user.updatedAt || user.createdAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button className="admin-link" type="button" onClick={() => showUserDetail(user)}><Eye size={14} />详情</button>
                      <button className="admin-link" type="button" onClick={() => openEditUser(user)}><Edit3 size={14} />编辑</button>
                      <button
                        className="admin-link admin-link--danger"
                        type="button"
                        disabled={user.userType !== 'family'}
                        onClick={() => {
                          void handleDeleteUser(user);
                        }}
                      >
                        <Trash2 size={14} />删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer">
          <span>显示 {visibleUsers.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filteredUsers.length)} 条，共 {filteredUsers.length} 条</span>
          {loading ? <span>正在同步 Java 后端...</span> : null}
          <div>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                className={safePage === index + 1 ? 'admin-table-footer__active' : ''}
                key={index + 1}
                type="button"
                onClick={() => setPage(index + 1)}
              >
                {index + 1}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
          </div>
        </div>
      </section>
      {formOpen ? (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-form-title">
          <button className="admin-modal__mask" type="button" aria-label="关闭弹窗" onClick={closeUserForm} />
          <form className="admin-modal__panel admin-user-form" onSubmit={(event) => {
            void handleSaveUser(event);
          }}>
            <h2 id="admin-user-form-title">{editingUser ? '编辑用户' : '新增用户'}</h2>
            <label>
              <span>角色</span>
              <select
                value={formState.userType}
                disabled={Boolean(editingUser)}
                onChange={(event) => setFormState((value) => ({ ...value, userType: event.target.value as UserFormState['userType'] }))}
              >
                <option value="elderly">老人</option>
                <option value="family">家属</option>
              </select>
            </label>
            <label>
              <span>姓名</span>
              <input
                value={formState.name}
                placeholder="请输入姓名"
                onChange={(event) => setFormState((value) => ({ ...value, name: event.target.value }))}
              />
            </label>
            <label>
              <span>联系电话</span>
              <input
                value={formState.phone}
                placeholder="请输入联系电话"
                onChange={(event) => setFormState((value) => ({ ...value, phone: event.target.value }))}
              />
            </label>
            <label>
              <span>家庭档案</span>
              <input
                value={formState.familyId}
                placeholder="family_001"
                disabled={Boolean(editingUser)}
                onChange={(event) => setFormState((value) => ({ ...value, familyId: event.target.value }))}
              />
            </label>
            <div className="admin-modal__actions">
              <button className="admin-secondary" type="button" disabled={saving} onClick={closeUserForm}>取消</button>
              <button className="admin-primary" type="submit" disabled={saving}>{saving ? '保存中' : '保存'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ContentPage({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [contentItems, setContentItems] = useState<ApiMedia[]>([]);
  const [psychologyResources, setPsychologyResources] = useState<ApiPsychologyResources | null>(null);
  const [uploading, setUploading] = useState(false);
  const [psychologySaving, setPsychologySaving] = useState(false);

  const psychologyVideos = psychologyResources?.videos ?? [];
  const psychologyCategories = psychologyResources?.categories ?? [];
  const psychologyQuestions = psychologyResources?.questions ?? [];
  const psychologyReplyCount = psychologyQuestions.reduce((total, item) => total + (item.reply_count ?? 0), 0);

  const loadContent = useCallback(async () => {
    try {
      const [nextMedia, nextPsychologyResources] = await Promise.all([
        getMedia(selectedFamilyId),
        getPsychologyResources(),
      ]);
      setContentItems(nextMedia);
      setPsychologyResources(nextPsychologyResources);
    } catch (error) {
      notify('内容数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }, [notify, selectedFamilyId]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      setUploading(true);
      const title = file.name.replace(/\.[^.]+$/, '') || '后台上传内容';
      await uploadMedia(file, title, '由管理端上传的回忆内容', selectedFamilyId);
      notify('上传成功', `已上传「${title}」，老人端推荐列表会同步读取。`);
      await loadContent();
    } catch (error) {
      notify('上传失败', error instanceof Error ? error.message : '请检查文件格式和后端状态。');
    } finally {
      setUploading(false);
    }
  }

  async function handleCreatePsychologyVideo() {
    const title = window.prompt('视频标题');
    if (!title?.trim()) {
      return;
    }
    const sourceUrl = window.prompt('视频来源 URL');
    if (!sourceUrl?.trim()) {
      notify('心理视频未创建', '视频来源 URL 不能为空。');
      return;
    }
    const category = window.prompt('分类', '心理科普') || '心理科普';

    try {
      setPsychologySaving(true);
      await createPsychologyVideo({
        slug: createContentSlug(title),
        title: title.trim(),
        category: category.trim(),
        source_url: sourceUrl.trim(),
        speaker: 'KinEcho 内容运营',
        summary: '由管理端维护的试点心理内容。',
        license: 'pilot-curated',
        is_active: 1,
        sort_order: psychologyVideos.length + 1,
      });
      notify('心理视频已创建', `「${title.trim()}」已进入老人端心理百科。`);
      await loadContent();
    } catch (error) {
      notify('心理视频创建失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    } finally {
      setPsychologySaving(false);
    }
  }

  async function handleDeactivatePsychologyVideo(videoId: number, title: string) {
    if (!window.confirm(`确认下架心理视频「${title}」吗？`)) {
      return;
    }
    try {
      setPsychologySaving(true);
      await updatePsychologyVideo(videoId, { is_active: 0 });
      notify('心理视频已下架', `「${title}」不会再出现在老人端心理百科。`);
      await loadContent();
    } catch (error) {
      notify('心理视频下架失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    } finally {
      setPsychologySaving(false);
    }
  }

  async function handleCreatePsychologyQuestion() {
    const question = window.prompt('问答题目');
    if (!question?.trim()) {
      return;
    }

    try {
      setPsychologySaving(true);
      await createPsychologyQuestion({
        question: question.trim(),
        sort_order: psychologyQuestions.length + 1,
        is_active: 1,
      });
      notify('问答条目已创建', `「${question.trim()}」已进入心理内容库。`);
      await loadContent();
    } catch (error) {
      notify('问答条目创建失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    } finally {
      setPsychologySaving(false);
    }
  }

  async function handleDeactivatePsychologyQuestion(questionId: number, question: string) {
    if (!window.confirm(`确认下架问答「${question}」吗？`)) {
      return;
    }
    try {
      setPsychologySaving(true);
      await updatePsychologyQuestion(questionId, { is_active: 0 });
      notify('问答条目已下架', `「${question}」不会再出现在老人端心理百科。`);
      await loadContent();
    } catch (error) {
      notify('问答条目下架失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    } finally {
      setPsychologySaving(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <PageHeader
        title="内容管理"
        desc="管理回忆媒体内容和推荐策略"
        action={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(event) => {
                void handleUpload(event);
              }}
            />
            <button className="admin-primary" type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Plus size={16} />{uploading ? '上传中' : '新增内容'}
            </button>
          </>
        }
      />
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <h2>心理内容库</h2>
            <p>同步老人端心理百科的视频、分类和问答库存</p>
          </div>
          <div className="admin-inline-actions">
            <button className="admin-secondary" type="button" disabled={psychologySaving} onClick={() => void handleCreatePsychologyQuestion()}>
              <Plus size={14} />问答
            </button>
            <button className="admin-primary" type="button" disabled={psychologySaving} onClick={() => void handleCreatePsychologyVideo()}>
              <Plus size={14} />视频
            </button>
          </div>
        </div>
        <div className="admin-stat-grid">
          {[
            { label: '视频内容', value: psychologyVideos.length },
            { label: '内容分类', value: psychologyCategories.length },
            { label: '问答条目', value: psychologyQuestions.length },
            { label: '累计回复', value: psychologyReplyCount },
          ].map((stat) => (
            <article className="admin-stat-card" key={stat.label}>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          ))}
        </div>
        <div className="admin-list">
          {psychologyVideos.slice(0, 3).map((item) => (
            <div className="admin-list-row" key={`video-${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.category || '未分类'} · {item.duration || '未配置时长'} · {item.speaker || '未配置讲师'}</span>
              </div>
              <div className="admin-inline-actions">
                <b>{item.sort_order ?? '--'}</b>
                <button className="admin-secondary" type="button" disabled={psychologySaving} onClick={() => void handleDeactivatePsychologyVideo(item.id, item.title)}>
                  下架
                </button>
              </div>
            </div>
          ))}
          {psychologyQuestions.slice(0, 3).map((item) => (
            <div className="admin-list-row" key={`question-${item.id}`}>
              <div>
                <strong>{item.question}</strong>
                <span>问答内容 · {item.reply_count ?? 0} 条回复</span>
              </div>
              <div className="admin-inline-actions">
                <b>{item.sort_order ?? '--'}</b>
                <button className="admin-secondary" type="button" disabled={psychologySaving} onClick={() => void handleDeactivatePsychologyQuestion(item.id, item.question)}>
                  下架
                </button>
              </div>
            </div>
          ))}
          {!psychologyVideos.length && !psychologyQuestions.length ? (
            <p className="admin-empty-text">暂无心理内容，请维护 psychology_videos、psychology_categories 或 psychology_questions 数据。</p>
          ) : null}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <h2>回忆媒体库</h2>
            <p>管理家庭可播放的图片和视频内容</p>
          </div>
          <Image size={20} color="#3b82a6" />
        </div>
        <div className="admin-content-grid">
          {contentItems.map((item) => {
            const Icon = item.media_type === 'video' ? Video : Image;
            return (
              <button
                className="admin-media-card"
                key={item.id}
                type="button"
                onClick={() =>
                  notify(
                    item.title,
                    `类型：${item.media_type === 'video' ? '视频' : '图片'}\n播放次数：${item.play_count ?? 0} 次\n优先级：${item.priority ?? '--'}`
                  )
                }
              >
                <div>
                  <Icon size={48} />
                </div>
                <section>
                  <strong>{item.title}</strong>
                  <span><Eye size={12} />{item.play_count ?? 0}次观看</span>
                </section>
              </button>
            );
          })}
        </div>
        {!contentItems.length ? <p className="admin-empty-text">暂无媒体内容，可以从右上角上传图片或视频。</p> : null}
      </section>
    </div>
  );
}

function AlertsPage({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [activeTab, setActiveTab] = useState('全部');
  const [alertRows, setAlertRows] = useState<AdminAlert[]>([]);
  const [stats, setStats] = useState({ today: 0, unhandled: 0, handled: 0 });

  const loadAlerts = useCallback(async () => {
    try {
      const [alertsResult, nextStats] = await Promise.all([
        getAlerts(selectedFamilyId, { limit: 100 }),
        getAlertStats(selectedFamilyId),
      ]);
      setAlertRows(toAdminAlerts(alertsResult.alerts));
      setStats({
        today: nextStats.today_count || 0,
        unhandled: nextStats.status_stats.unhandled || 0,
        handled: nextStats.status_stats.handled || 0,
      });
    } catch (error) {
      notify('预警数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }, [notify, selectedFamilyId]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const visibleAlerts = useMemo(() => {
    if (activeTab === '全部') {
      return alertRows;
    }

    return alertRows.filter((alert) => alert.status === activeTab);
  }, [activeTab, alertRows]);

  async function handleAlert(alert: AdminAlert) {
    try {
      await handleAlertRequest(alert.id, '管理端已查看并完成处理', selectedFamilyId);
      notify('预警已处理', `${alert.elder} 的「${alert.type}」已写入 Java 后端。`);
      await loadAlerts();
    } catch (error) {
      notify('处理失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }

  return (
    <div className="admin-page-stack">
      <PageHeader title="预警与风控中心" desc="监控和管理系统预警事件" />
      <section className="admin-alert-stats">
        {[
          { label: '待处理预警', value: stats.unhandled, tone: 'high' },
          { label: '今日预警', value: stats.today, tone: 'medium' },
          { label: '已处理预警', value: stats.handled, tone: 'info' },
        ].map((item) => (
          <article className={`admin-alert-stat admin-alert-stat--${item.tone}`} key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>
      <section className="admin-panel admin-panel--flush">
        <div className="admin-tabs">
          {['全部', '未处理', '处理中', '已处理'].map((tab) => (
            <button
              className={activeTab === tab ? 'admin-tabs__active' : ''}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="admin-alert-list">
          {visibleAlerts.map((alert) => (
            <article className="admin-alert-row" key={alert.id}>
              <div>
                <div className="admin-alert-row__meta">
                  <RiskBadge level={alert.level} />
                  <strong>{alert.elder}</strong>
                  <span>{alert.type}</span>
                </div>
                <p>{alert.reason}</p>
                <small>{alert.time}</small>
              </div>
              <div>
                {alert.status === '未处理' ? (
                  <button className="admin-primary" type="button" onClick={() => void handleAlert(alert)}>立即处理</button>
                ) : null}
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={() => notify(`${alert.elder} · ${alert.type}`, `${alert.reason}\n等级：${alert.level}\n状态：${alert.status}`)}
                >
                  查看详情
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServicePageLive({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [summary, setSummary] = useState<ApiAdminServiceSummary | null>(null);
  const [certifications, setCertifications] = useState<ApiServiceCertification[]>([]);
  const [counselors, setCounselors] = useState<ApiCounselor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServiceData = useCallback(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [nextSummary, nextCertifications, nextCounselors] = await Promise.all([
          getAdminServiceSummary(selectedFamilyId),
          getServiceCertifications('pending'),
          getAdminCounselors(),
        ]);
        if (mounted) {
          setSummary(nextSummary);
          setCertifications(nextCertifications);
          setCounselors(nextCounselors);
        }
      } catch (error) {
        if (mounted) {
          notify('服务协同数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [notify, selectedFamilyId]);

  useEffect(() => loadServiceData(), [loadServiceData]);

  async function handleCertification(certification: ApiServiceCertification, status: 'approved' | 'rejected') {
    try {
      const rejectReason = status === 'rejected' ? '资料不完整，请补充资质证明后重新提交。' : '';
      await reviewServiceCertification(certification.id, {
        status,
        reviewer: 'admin',
        reject_reason: rejectReason,
      });
      notify(status === 'approved' ? '认证已通过' : '认证已拒绝', `${certification.name} 的服务人员认证已更新。`);
      setCertifications((current) => current.filter((item) => item.id !== certification.id));
    } catch (error) {
      notify('认证审核失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }

  async function handleCounselorAvailability(counselor: ApiCounselor) {
    try {
      await updateAdminCounselor(counselor.id, {
        available: counselor.available ? 0 : 1,
        availability_text: counselor.available ? '暂停接单，等待运营重新开放时段' : '试点期间可预约',
      });
      notify(counselor.available ? '咨询师已暂停接单' : '咨询师已开放预约', `${counselor.name} 的可预约状态已更新。`);
      setCounselors((current) =>
        current.map((item) =>
          item.id === counselor.id
            ? {
                ...item,
                available: !counselor.available,
                availability_text: counselor.available ? '暂停接单，等待运营重新开放时段' : '试点期间可预约',
              }
            : item
        )
      );
    } catch (error) {
      notify('咨询师状态更新失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }

  const overview = summary?.overview;
  const statCards = [
    { label: '服务人员', value: String(overview?.total_counselors ?? 0), change: loading ? '同步中' : `${overview?.available_counselors ?? 0} 位可接单`, icon: Users, tone: 'purple' },
    { label: '在跟进个案', value: String(overview?.active_consultations ?? 0), change: `${overview?.scheduled_consultations ?? 0} 个待安排`, icon: Briefcase, tone: 'pink' },
    { label: '待处理预警', value: String(overview?.pending_alerts ?? 0), change: `${overview?.case_total ?? 0} 位服务对象`, icon: AlertTriangle, tone: 'orange' },
    { label: '高风险个案', value: String(overview?.high_risk_cases ?? 0), change: loading ? '同步中' : '实时评估', icon: Shield, tone: 'green' },
  ];
  const roleRows = summary?.role_stats.length
    ? summary.role_stats
    : [{
        role: loading ? '同步中' : '暂无服务人员数据',
        count: 0,
        available_count: 0,
        active_cases: 0,
      }];
  const caseRows = summary?.case_rows.length
    ? summary.case_rows
    : [{
        elderly_id: 0,
        elderly_name: loading ? '同步中' : '暂无重点服务对象',
        risk_level: 'low',
        open_alerts: 0,
        active_consultations: 0,
        latest_mood_score: 0,
        last_followup_at: '',
      }];

  return (
    <div className="admin-page-stack">
      <PageHeader title="服务协同管理" desc="基于真实后端数据查看人员供给、跟进负载和重点个案" />
      <section className="admin-stat-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <div className={`admin-stat-card__icon admin-stat-card__icon--${stat.tone}`}>
                <Icon size={24} />
              </div>
              <span className="admin-change admin-change--up">{stat.change}</span>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          );
        })}
      </section>
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <h2>服务认证审核</h2>
            <p>{certifications.length ? `待审核 ${certifications.length} 条申请` : '暂无待审核服务人员申请'}</p>
          </div>
          <Shield size={20} color="#10b981" />
        </div>
        <div className="admin-list">
          {certifications.length ? certifications.map((item) => (
            <div className="admin-list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.organization} · 工号 {item.staff_no} · {item.phone}</span>
              </div>
              <div className="admin-inline-actions">
                <button className="admin-secondary" type="button" onClick={() => void handleCertification(item, 'rejected')}>
                  拒绝
                </button>
                <button className="admin-primary" type="button" onClick={() => void handleCertification(item, 'approved')}>
                  通过
                </button>
              </div>
            </div>
          )) : (
            <p className="admin-empty-text">服务人员在小程序端提交认证后，会在这里进入审核队列。</p>
          )}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <h2>咨询师管理</h2>
            <p>{counselors.length ? `${counselors.length} 位咨询师，${counselors.filter((item) => item.available).length} 位可预约` : '暂无咨询师资料'}</p>
          </div>
          <Users size={20} color="#3b82f6" />
        </div>
        <div className="admin-list">
          {counselors.length ? counselors.map((item) => (
            <div className="admin-list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.title} · {item.next_available_text || item.availability_text || '未配置可约时段'}</span>
              </div>
              <div className="admin-inline-actions">
                <span className={item.available ? 'admin-badge admin-badge--low' : 'admin-badge admin-badge--medium'}>
                  {item.available ? '可预约' : '暂停'}
                </span>
                <button className="admin-secondary" type="button" onClick={() => void handleCounselorAvailability(item)}>
                  {item.available ? '暂停接单' : '开放预约'}
                </button>
              </div>
            </div>
          )) : (
            <p className="admin-empty-text">维护 counselors 数据后，老人端和家属端会按可预约状态展示咨询师。</p>
          )}
        </div>
      </section>
      <section className="admin-two-col">
        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>服务人员统计</h2>
              <p>{loading ? '正在同步 Java 后端...' : `共 ${summary?.role_stats.length ?? 0} 个服务角色`}</p>
            </div>
            <Users size={20} color="#3b82f6" />
          </div>
          <div className="admin-list">
            {roleRows.map((item) => (
              <div className="admin-list-row" key={item.role}>
                <div>
                  <strong>{item.role}</strong>
                  <span>{item.available_count} 位可接单 · {item.active_cases} 个在跟进个案</span>
                </div>
                <b>{item.count}人</b>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>重点服务对象</h2>
              <p>{loading ? '正在同步风险与跟进状态...' : `共 ${summary?.case_rows.length ?? 0} 位重点对象`}</p>
            </div>
            <AlertTriangle size={20} color="#f59e0b" />
          </div>
          <div className="admin-list">
            {caseRows.map((item) => (
              <div className="admin-list-row" key={`${item.elderly_id}-${item.elderly_name}`}>
                <div>
                  <strong>{item.elderly_name}</strong>
                  <span>
                    待处理预警 {item.open_alerts} 条 · 跟进 {item.active_consultations} 次 · 最近心情 {item.latest_mood_score || 0} 分
                    {item.last_followup_at ? ` · 最近跟进 ${formatAdminTime(item.last_followup_at)}` : ''}
                  </span>
                </div>
                <RiskBadge level={mapRiskLevel(item.risk_level)} />
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function AnalyticsPageLive({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      try {
        setLoading(true);
        const nextAnalytics = await getAdminAnalytics(selectedFamilyId, { months: 6, days: 7 });
        if (mounted) {
          setAnalytics(nextAnalytics);
        }
      } catch (error) {
        if (mounted) {
          notify('分析数据加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();
    return () => {
      mounted = false;
    };
  }, [notify, selectedFamilyId]);

  const summary = analytics?.summary;
  const statCards = [
    { label: '用户总数', value: String(summary?.total_users ?? 0), change: `老人 ${summary?.elderly_users ?? 0} / 家属 ${summary?.family_users ?? 0}`, icon: Users, tone: 'purple' },
    { label: '近7日跟进', value: String(summary?.followups ?? 0), change: loading ? '同步中' : '真实排期统计', icon: Briefcase, tone: 'pink' },
    { label: '回忆播放', value: String(summary?.media_plays ?? 0), change: `${summary?.mood_records ?? 0} 条情绪记录`, icon: Video, tone: 'orange' },
    { label: '平均情绪', value: summary ? summary.avg_mood_score.toFixed(1) : '0.0', change: loading ? '同步中' : '近7日平均分', icon: Activity, tone: 'green' },
  ];
  const trendData = analytics?.user_growth || [];
  const activityRows = analytics?.weekly_activity || [];

  return (
    <div className="admin-page-stack">
      <PageHeader title="数据分析" desc="按真实后端数据查看用户增长、服务跟进与回忆活跃度" />
      <section className="admin-stat-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <div className={`admin-stat-card__icon admin-stat-card__icon--${stat.tone}`}>
                <Icon size={24} />
              </div>
              <span className="admin-change admin-change--up">{stat.change}</span>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
            </article>
          );
        })}
      </section>
      <section className="admin-two-col">
        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>用户增长趋势</h2>
              <p>近 {analytics?.months ?? 6} 个月老人与家属用户增长</p>
            </div>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="elderly" stroke="#3b82a6" strokeWidth={2} name="老人用户" />
                <Line type="monotone" dataKey="family" stroke="#10b981" strokeWidth={2} name="家属用户" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>本周活跃度</h2>
              <p>服务跟进与回忆观看统计</p>
            </div>
          </div>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityRows}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="followups" fill="#6366f1" name="服务跟进" />
                <Bar dataKey="memory" fill="#f59e0b" name="回忆观看" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}


function SettingsPage({ notify, selectedFamilyId }: { notify: Notify; selectedFamilyId: string }) {
  const [health, setHealth] = useState<string>('未同步');
  const [privacyRequests, setPrivacyRequests] = useState<ApiPrivacyRequest[]>([]);
  const sections = [
    { icon: Settings, title: '基础配置', desc: '系统基础参数设置', items: ['平台名称', '联系方式', '服务协议'] },
    { icon: Shield, title: '角色权限', desc: '管理用户角色和权限', items: ['管理员权限', '运营人员权限', '内容管理权限'] },
    { icon: Bell, title: '通知设置', desc: '配置系统通知规则', items: ['预警通知', '任务提醒', '系统消息'] },
    { icon: Database, title: '数据管理', desc: '数据备份、导出和保留策略', items: ['数据备份', '数据导出', '保留策略', '日志管理'] },
  ];

  const loadPrivacyRequests = useCallback(() => {
    let mounted = true;

    async function load() {
      try {
        const requests = await getPrivacyRequests(selectedFamilyId, 'pending');
        if (mounted) {
          setPrivacyRequests(requests);
        }
      } catch (error) {
        if (mounted) {
          notify('隐私请求加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [notify, selectedFamilyId]);

  useEffect(() => loadPrivacyRequests(), [loadPrivacyRequests]);

  async function handleSettingItem(sectionTitle: string, item: string) {
    try {
      if (item === '数据备份' || item === '数据导出') {
        const [nextUsers, alertsResult, nextMedia, nextPrivacyRequests] = await Promise.all([
          getUsers(selectedFamilyId),
          getAlerts(selectedFamilyId, { limit: 100 }),
          getMedia(selectedFamilyId),
          getPrivacyRequests(selectedFamilyId, ''),
        ]);
        const payload = JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            family_id: selectedFamilyId,
            users: nextUsers,
            alerts: alertsResult.alerts,
            media: nextMedia,
            privacy_requests: nextPrivacyRequests,
          },
          null,
          2
        );
        downloadTextFile('kinecho-admin-export.json', payload);
        notify('导出完成', '已从 Java 后端拉取用户、预警和媒体数据。');
        return;
      }

      if (item === '日志管理' || item === '保留策略') {
        const [nextHealth, retention] = await Promise.all([
          getHealth(),
          getRetentionSummary(),
        ]);
        setHealth(`${nextHealth.backend} · ${nextHealth.status}`);
        notify(
          item === '保留策略' ? '保留策略' : '后端状态',
          `服务：${nextHealth.backend}\n状态：${nextHealth.status}\n时间：${nextHealth.timestamp}\nAI 语音回复：保留最近 ${retention.policy.ai_audio_retention_count} 个，签名 ${retention.policy.ai_audio_url_ttl_seconds} 秒\n老人录音：${retention.policy.ai_voice_retention_days} 天\n心理筛查帧：${retention.policy.mental_frame_retention_days} 天\nAI 聊天：${retention.policy.ai_chat_retention_days} 天\n咨询记录：${retention.policy.consultation_retention_days} 天\n审计日志：${retention.policy.audit_log_retention_days} 天`
        );
        return;
      }

      notify(item, `已打开「${sectionTitle}」下的 ${item} 配置入口。当前配置以 Java 后端配置文件和数据库状态为准。`);
    } catch (error) {
      notify('设置操作失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }

  async function handlePrivacyRequest(request: ApiPrivacyRequest, status: 'processing' | 'completed' | 'rejected') {
    try {
      const processNote =
        status === 'completed'
          ? '已按试点隐私流程处理并记录。'
          : status === 'processing'
            ? '已进入人工核验流程。'
            : '请求信息不足或不符合保留要求，已拒绝。';
      await reviewPrivacyRequest(request.id, {
        status,
        reviewer: 'admin',
        process_note: processNote,
      });
      notify('隐私请求已更新', `#${request.id} ${getPrivacyRequestTypeLabel(request.request_type)} 已标记为${getPrivacyRequestStatusLabel(status)}。`);
      setPrivacyRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (error) {
      notify('隐私请求处理失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
    }
  }

  return (
    <div className="admin-page-stack admin-page-stack--narrow">
      <PageHeader title="系统设置" desc={`配置系统参数和权限 · 后端 ${health}`} />
      <article className="admin-panel">
        <div className="admin-panel__head">
          <div>
            <h2>隐私请求队列</h2>
            <p>{privacyRequests.length ? `待处理 ${privacyRequests.length} 条删除、更正或导出请求` : '暂无待处理隐私请求'}</p>
          </div>
          <Shield size={20} color="#10b981" />
        </div>
        <div className="admin-list">
          {privacyRequests.length ? privacyRequests.map((request) => (
            <div className="admin-list-row" key={request.id}>
              <div>
                <strong>#{request.id} {getPrivacyRequestTypeLabel(request.request_type)}</strong>
                <span>
                  {request.family_id} · {request.requested_by || '家属端'} · {formatAdminTime(request.created_at)}
                </span>
                <span>{request.reason || '未填写原因'} · {getPrivacyRequestStatusLabel(request.status)}</span>
              </div>
              <div className="admin-inline-actions">
                <button className="admin-secondary" type="button" onClick={() => void handlePrivacyRequest(request, 'rejected')}>
                  拒绝
                </button>
                <button className="admin-secondary" type="button" onClick={() => void handlePrivacyRequest(request, 'processing')}>
                  处理中
                </button>
                <button className="admin-primary" type="button" onClick={() => void handlePrivacyRequest(request, 'completed')}>
                  完成
                </button>
              </div>
            </div>
          )) : (
            <p className="admin-empty-text">家属端提交数据导出、删除或更正请求后，会在这里进入人工处理队列。</p>
          )}
        </div>
      </article>
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <article className="admin-setting-card" key={section.title}>
            <div className="admin-setting-card__icon">
              <Icon size={24} />
            </div>
            <div>
              <h2>{section.title}</h2>
              <p>{section.desc}</p>
              <div>
                {section.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      void handleSettingItem(section.title, item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AdminShell() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => getStoredAdminSession());
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [notice, setNotice] = useState<AdminNotice>(null);
  const [families, setFamilies] = useState<ApiAdminFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState(ADMIN_FAMILY_ID);
  const notify = useCallback<Notify>((title, body = '操作已完成。') => {
    setNotice({ title, body });
  }, []);

  useEffect(() => {
    if (!adminSession) {
      setFamilies([]);
      return;
    }

    let mounted = true;

    async function loadFamilies() {
      try {
        const nextFamilies = await getAdminFamilies();
        if (!mounted) {
          return;
        }

        setFamilies(nextFamilies);
        setSelectedFamilyId((current: string) => {
          if (!nextFamilies.length || nextFamilies.some((family) => family.family_id === current)) {
            return current || ADMIN_FAMILY_ID;
          }

          return nextFamilies[0].family_id;
        });
      } catch (error) {
        if (mounted) {
          notify('家庭列表加载失败', error instanceof Error ? error.message : '请确认 Java 后端已启动。');
        }
      }
    }

    void loadFamilies();
    return () => {
      mounted = false;
    };
  }, [adminSession, notify]);

  const handleFamilyChange = useCallback((familyId: string) => {
    setSelectedFamilyId(familyId || ADMIN_FAMILY_ID);
  }, []);

  const current = useMemo(() => {
    switch (page) {
      case 'users':
        return <UsersPage notify={notify} selectedFamilyId={selectedFamilyId} />;
      case 'content':
        return <ContentPage notify={notify} selectedFamilyId={selectedFamilyId} />;
      case 'alerts':
        return <AlertsPage notify={notify} selectedFamilyId={selectedFamilyId} />;
      case 'service':
        return <ServicePageLive notify={notify} selectedFamilyId={selectedFamilyId} />;
      case 'analytics':
        return <AnalyticsPageLive notify={notify} selectedFamilyId={selectedFamilyId} />;
      case 'settings':
        return <SettingsPage notify={notify} selectedFamilyId={selectedFamilyId} />;
      default:
        return <DashboardPage notify={notify} selectedFamilyId={selectedFamilyId} />;
    }
  }, [notify, page, selectedFamilyId]);

  if (!adminSession) {
    return (
      <>
        <AdminLogin onLogin={(session) => setAdminSession(session)} notify={notify} />
        <AdminNoticeDialog notice={notice} onClose={() => setNotice(null)} />
      </>
    );
  }

  return (
    <>
      <AdminLayout
        page={page}
        setPage={setPage}
        session={adminSession}
        families={families}
        selectedFamilyId={selectedFamilyId}
        onFamilyChange={handleFamilyChange}
      >
        {current}
      </AdminLayout>
      <AdminNoticeDialog notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminShell />
  </React.StrictMode>
);
