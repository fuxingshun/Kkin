import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Database,
  Download,
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
import '../index.css';
import './admin.css';

type AdminPage = 'dashboard' | 'users' | 'content' | 'alerts' | 'service' | 'analytics' | 'settings';

const navItems: Array<{ id: AdminPage; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'content', label: '内容管理', icon: FileText },
  { id: 'alerts', label: '预警与风控', icon: AlertTriangle },
  { id: 'service', label: '服务协同', icon: Briefcase },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
  { id: 'settings', label: '系统设置', icon: Settings },
];

const activityData = [
  { month: '1月', users: 120 },
  { month: '2月', users: 150 },
  { month: '3月', users: 180 },
  { month: '4月', users: 220 },
  { month: '5月', users: 280 },
  { month: '6月', users: 350 },
];

const emotionData = [
  { emotion: '开心', count: 450 },
  { emotion: '平稳', count: 380 },
  { emotion: '疲惫', count: 120 },
  { emotion: '难过', count: 80 },
  { emotion: '焦虑', count: 60 },
  { emotion: '生气', count: 30 },
];

const users = [
  { id: 1, name: '张翠花', age: 68, family: 2, risk: '高', status: '活跃' },
  { id: 2, name: '李秀英', age: 72, family: 1, risk: '中', status: '活跃' },
  { id: 3, name: '王大爷', age: 75, family: 3, risk: '低', status: '正常' },
];

const alerts = [
  { id: 1, elder: '张翠花', type: '情绪异常', reason: '连续3天情绪低落', level: '高', time: '30分钟前', status: '未处理' },
  { id: 2, elder: '李秀英', type: '任务未完成', reason: '护理任务逾期2小时', level: '中', time: '2小时前', status: '未处理' },
  { id: 3, elder: '王大爷', type: '互动骤减', reason: '3天未进行AI互动', level: '中', time: '5小时前', status: '已处理' },
];

const userTrendData = [
  { month: '1月', elderly: 100, family: 180 },
  { month: '2月', elderly: 120, family: 210 },
  { month: '3月', elderly: 150, family: 260 },
  { month: '4月', elderly: 180, family: 310 },
  { month: '5月', elderly: 220, family: 380 },
  { month: '6月', elderly: 280, family: 480 },
];

const weeklyActivityData = [
  { day: '周一', ai: 450, memory: 230 },
  { day: '周二', ai: 520, memory: 280 },
  { day: '周三', ai: 480, memory: 250 },
  { day: '周四', ai: 590, memory: 310 },
  { day: '周五', ai: 630, memory: 340 },
  { day: '周六', ai: 700, memory: 420 },
  { day: '周日', ai: 680, memory: 390 },
];

function RiskBadge({ level }: { level: string }) {
  const className = level === '高' ? 'admin-badge admin-badge--high' : level === '中' ? 'admin-badge admin-badge--medium' : 'admin-badge admin-badge--low';
  return <span className={className}>{level}{level === '低' ? '' : '风险'}</span>;
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="admin-login">
      <section className="admin-login__shell">
        <button className="admin-login__back" type="button">
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
              <input placeholder="请输入用户名" type="text" />
            </label>
            <label>
              <span>密码</span>
              <div className="admin-login__password">
                <input placeholder="请输入密码" type={showPassword ? 'text' : 'password'} />
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
              <button type="button">忘记密码？</button>
            </div>
            <button className="admin-login__submit" type="button" onClick={onLogin}>
              立即登录
            </button>
            <p>
              还没有账号？<button type="button">立即注册</button>
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
  children,
}: {
  page: AdminPage;
  setPage: (page: AdminPage) => void;
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
          {navItems.map((item) => {
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
          <div className="admin-topbar__profile">
            <div>
              <strong>管理员</strong>
              <span>admin@platform.com</span>
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

function DashboardPage() {
  const stats = [
    { label: '老人用户数', value: '1,248', change: '+12.5%', icon: Users, tone: 'purple' },
    { label: '家属用户数', value: '986', change: '+8.3%', icon: Shield, tone: 'pink' },
    { label: '日活跃用户', value: '856', change: '+15.2%', icon: Activity, tone: 'green' },
    { label: '今日预警', value: '12', change: '-5.1%', icon: AlertTriangle, tone: 'orange' },
  ];

  return (
    <div className="admin-page-stack">
      <PageHeader title="平台总览" desc="实时监控平台运营数据和关键指标" />
      <section className="admin-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <div className={`admin-stat-card__icon admin-stat-card__icon--${stat.tone}`}>
                <Icon size={24} />
              </div>
              <span className={stat.change.startsWith('+') ? 'admin-change admin-change--up' : 'admin-change admin-change--down'}>
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
              <LineChart data={activityData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#3b82a6" strokeWidth={3} dot={{ fill: '#3b82a6', r: 4 }} />
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
              <BarChart data={emotionData}>
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
            {alerts.slice(0, 3).map((alert) => (
              <div className="admin-list-row" key={alert.id}>
                <div>
                  <strong>{alert.elder}</strong>
                  <span>{alert.reason}</span>
                </div>
                <RiskBadge level={alert.level} />
              </div>
            ))}
          </div>
        </article>
        <article className="admin-panel">
          <h2>活跃机构排行</h2>
          <div className="admin-list">
            {[
              { name: '阳光社区', elderly: 45, score: 95 },
              { name: '和谐社区', elderly: 38, score: 92 },
              { name: '幸福社区', elderly: 32, score: 88 },
            ].map((org, index) => (
              <div className="admin-rank-row" key={org.name}>
                <span>{index + 1}</span>
                <div>
                  <strong>{org.name}</strong>
                  <small>{org.elderly}位老人</small>
                </div>
                <b>{org.score}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function UsersPage() {
  return (
    <div className="admin-page-stack">
      <PageHeader
        title="用户管理"
        desc="管理老人用户和家属用户信息"
        action={<button className="admin-primary"><Download size={16} />导出数据</button>}
      />
      <section className="admin-panel admin-panel--flush">
        <div className="admin-table-toolbar">
          <label className="admin-search">
            <Search size={20} />
            <input placeholder="搜索用户..." />
          </label>
          <select>
            <option>全部风险等级</option>
            <option>高风险</option>
            <option>中风险</option>
            <option>低风险</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>年龄</th>
                <th>家属数</th>
                <th>风险等级</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.age}岁</td>
                  <td>{user.family}位</td>
                  <td><RiskBadge level={user.risk} /></td>
                  <td><span className="admin-badge admin-badge--low">{user.status}</span></td>
                  <td><button className="admin-link" type="button">查看详情</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-footer">
          <span>显示 1-3 条，共 1,248 条</span>
          <div>
            <button>上一页</button>
            <button className="admin-table-footer__active">1</button>
            <button>2</button>
            <button>下一页</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentPage() {
  return (
    <div className="admin-page-stack">
      <PageHeader
        title="内容管理"
        desc="管理回忆媒体内容和推荐策略"
        action={<button className="admin-primary"><Plus size={16} />新增内容</button>}
      />
      <section className="admin-panel">
        <div className="admin-content-grid">
          {Array.from({ length: 8 }).map((_, index) => {
            const Icon = index % 2 === 0 ? Video : Image;
            return (
              <article className="admin-media-card" key={index}>
                <div>
                  <Icon size={48} />
                </div>
                <section>
                  <strong>回忆内容 #{index + 1}</strong>
                  <span><Eye size={12} />156次观看</span>
                </section>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AlertsPage() {
  return (
    <div className="admin-page-stack">
      <PageHeader title="预警与风控中心" desc="监控和管理系统预警事件" />
      <section className="admin-alert-stats">
        {[
          { label: '待处理预警', value: '23', tone: 'high' },
          { label: '今日预警', value: '45', tone: 'medium' },
          { label: '本周预警', value: '189', tone: 'info' },
        ].map((item) => (
          <article className={`admin-alert-stat admin-alert-stat--${item.tone}`} key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>
      <section className="admin-panel admin-panel--flush">
        <div className="admin-tabs">
          {['全部', '未处理', '处理中', '已处理'].map((tab, index) => (
            <button className={index === 0 ? 'admin-tabs__active' : ''} key={tab} type="button">{tab}</button>
          ))}
        </div>
        <div className="admin-alert-list">
          {alerts.map((alert) => (
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
                {alert.status === '未处理' ? <button className="admin-primary" type="button">立即处理</button> : null}
                <button className="admin-secondary" type="button">查看详情</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServicePage() {
  return (
    <div className="admin-page-stack">
      <PageHeader title="服务协同管理" desc="管理服务人员和机构信息" />
      <section className="admin-two-col">
        <article className="admin-panel">
          <h2>服务人员统计</h2>
          <div className="admin-list">
            {[
              { role: '心理咨询师', count: 12 },
              { role: '医生', count: 8 },
              { role: '社工', count: 15 },
              { role: '护理员', count: 25 },
            ].map((item) => (
              <div className="admin-list-row" key={item.role}>
                <strong>{item.role}</strong>
                <b>{item.count}人</b>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-panel">
          <h2>机构管理</h2>
          <div className="admin-list">
            {[
              { name: '阳光社区', elderly: 45 },
              { name: '和谐社区', elderly: 38 },
              { name: '幸福社区', elderly: 32 },
            ].map((org) => (
              <div className="admin-list-row" key={org.name}>
                <strong>{org.name}</strong>
                <span>{org.elderly}位老人</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function AnalyticsPage() {
  return (
    <div className="admin-page-stack">
      <PageHeader title="数据分析" desc="深入了解平台运营数据和用户行为" />
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
              <LineChart data={userTrendData}>
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
              <p>AI互动与回忆观看统计</p>
            </div>
          </div>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivityData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="ai" fill="#6366f1" name="AI互动" />
                <Bar dataKey="memory" fill="#f59e0b" name="观看回忆" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}

function SettingsPage() {
  const sections = [
    { icon: Settings, title: '基础配置', desc: '系统基础参数设置', items: ['平台名称', '联系方式', '服务协议'] },
    { icon: Shield, title: '角色权限', desc: '管理用户角色和权限', items: ['管理员权限', '运营人员权限', '内容管理权限'] },
    { icon: Bell, title: '通知设置', desc: '配置系统通知规则', items: ['预警通知', '任务提醒', '系统消息'] },
    { icon: Database, title: '数据管理', desc: '数据备份和导出', items: ['数据备份', '数据导出', '日志管理'] },
  ];

  return (
    <div className="admin-page-stack admin-page-stack--narrow">
      <PageHeader title="系统设置" desc="配置系统参数和权限" />
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
                  <button key={item} type="button">{item}</button>
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState<AdminPage>('dashboard');
  const current = useMemo(() => {
    switch (page) {
      case 'users':
        return <UsersPage />;
      case 'content':
        return <ContentPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'service':
        return <ServicePage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  }, [page]);

  if (!loggedIn) {
    return <AdminLogin onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <AdminLayout page={page} setPage={setPage}>
      {current}
    </AdminLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminShell />
  </React.StrictMode>
);
