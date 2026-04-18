import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Clock,
  AlertCircle,
  Pill,
  Heart,
  Activity,
  Utensils,
  Droplets,
  Moon,
} from 'lucide-react';
import * as scheduleService from '../services/scheduleService';
import { Toast, ToastType } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

type CareType = 'medication' | 'exercise' | 'meal' | 'hydration' | 'sleep' | 'checkup' | 'other';

interface CareTask {
  id: string;
  type: CareType;
  name: string;
  description?: string;
  times: string[];
  active: boolean;
  autoRemind: boolean; // 数字人自动提醒
  status?: 'pending' | 'completed' | 'skipped' | 'missed';
  repeatType?: 'once' | 'daily' | 'weekly' | 'monthly';
  // 用药专用字段
  dosage?: string;
  route?: string;
  withFood?: boolean;
  gracePeriod?: number;
}

/**
 * 家属端护理计划界面
 * 管理老人的用药、饮食、运动等护理任务
 */
export const CarePlan: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | CareType>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [formType, setFormType] = useState<CareType>('medication');
  const [schedules, setSchedules] = useState<scheduleService.Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTime, setFormTime] = useState('08:00');
  const [formRepeatDaily, setFormRepeatDaily] = useState(true);
  const [formAutoRemind, setFormAutoRemind] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const familyId = 'family_001'; // 实际使用时从用户上下文获取

  // 加载日程数据
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      console.log('开始加载日程，family_id:', familyId);
      const data = await scheduleService.getFamilySchedules(familyId);
      console.log('加载到的日程数据:', data);
      setSchedules(data);
      setApiConnected(true); // 标记 API 已连接
      console.log('API 已连接，日程数量:', data.length);
    } catch (error) {
      console.error('加载日程失败:', error);
      setApiConnected(false);
      // 只在第一次加载失败时提示
      if (!apiConnected) {
        setToast({
          message: '加载日程失败，请检查服务器是否已启动',
          type: 'warning',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // 将 Schedule 转换为 CareTask 格式（用于兼容现有 UI）
  const convertScheduleToTask = (schedule: scheduleService.Schedule): CareTask => {
    // 安全地提取时间部分
    let time = '00:00';
    try {
      const dateTime = scheduleService.formatDateTime(new Date(schedule.schedule_time));
      const parts = dateTime.split(' ');
      if (parts.length >= 2) {
        time = parts[1].slice(0, 5);
      }
    } catch (error) {
      console.error('时间格式转换失败:', schedule.schedule_time, error);
    }

    const autoRemind = schedule.auto_remind === 1;
    console.log(`转换日程 "${schedule.title}": auto_remind=${schedule.auto_remind} → autoRemind=${autoRemind}`);

    return {
      id: schedule.id?.toString() || '',
      type: (schedule.schedule_type || 'other') as CareType,
      name: schedule.title,
      description: schedule.description,
      times: [time],
      active: schedule.is_active === 1,
      autoRemind: autoRemind,
      status: schedule.status || 'pending',
      repeatType: schedule.repeat_type || 'once',
    };
  };

  // 模拟数据已移除 - 始终使用真实API数据

  const careTypeConfig = {
    medication: { label: '用药', icon: Pill, color: 'blue' },
    exercise: { label: '运动', icon: Activity, color: 'green' },
    meal: { label: '饮食', icon: Utensils, color: 'orange' },
    hydration: { label: '饮水', icon: Droplets, color: 'cyan' },
    sleep: { label: '睡眠', icon: Moon, color: 'purple' },
    checkup: { label: '检查', icon: Heart, color: 'red' },
    other: { label: '其他', icon: Clock, color: 'gray' },
  };

  // 根据护理类型获取提示词
  const getPlaceholders = (type: CareType) => {
    const placeholders: Record<CareType, { title: string; description: string }> = {
      medication: {
        title: '例如：氯沙坦、阿司匹林',
        description: '例如：饭后服用，每日一次，50mg'
      },
      exercise: {
        title: '例如：晨间散步、太极拳',
        description: '例如：小区公园散步30分钟，注意安全'
      },
      meal: {
        title: '例如：早餐、午餐、晚餐',
        description: '例如：低盐低糖，营养均衡，多吃蔬菜'
      },
      hydration: {
        title: '例如：饮水提醒',
        description: '例如：每次200ml左右，温开水为宜'
      },
      sleep: {
        title: '例如：午休、就寝',
        description: '例如：30-60分钟，保证充足睡眠'
      },
      checkup: {
        title: '例如：血压测量、血糖检测',
        description: '例如：记录数据并上传，如有异常及时联系医生'
      },
      other: {
        title: '例如：阅读时光、听音乐',
        description: '例如：详细描述此活动的具体内容和注意事项'
      }
    };
    return placeholders[type];
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      orange: 'bg-orange-50 text-orange-700 border-orange-200',
      cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      gray: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  // 始终使用 API 数据
  let careTasks: CareTask[] = [];
  try {
    careTasks = schedules.map(convertScheduleToTask);
  } catch (error) {
    console.error('转换日程数据失败:', error);
    careTasks = [];
  }

  const filteredTasks =
    activeTab === 'all'
      ? careTasks
      : careTasks.filter((task) => task.type === activeTab);

  const handleEdit = (task: CareTask) => {
    setEditingTask(task);
    setFormType(task.type);
    setFormTitle(task.name);
    setFormDescription(task.description || '');
    // 设置时间：从 times 数组中取第一个时间
    setFormTime(task.times && task.times.length > 0 ? task.times[0] : '08:00');
    // 设置重复：daily 表示每日重复，once 表示不重复
    setFormRepeatDaily(task.repeatType === 'daily');
    // 设置自动提醒：明确使用布尔值，undefined 时默认为 true
    const autoRemindValue = task.autoRemind === undefined ? true : task.autoRemind;
    setFormAutoRemind(autoRemindValue);
    console.log('编辑任务，task.autoRemind:', task.autoRemind, '最终设置为:', autoRemindValue);
    setShowForm(true);
  };

  const handleDelete = async (taskId: string) => {
    setConfirmDialog({
      message: '确定要删除这个护理计划吗？删除后无法恢复。',
      onConfirm: async () => {
        try {
          console.log('正在删除日程 ID:', taskId);
          const success = await scheduleService.deleteSchedule(Number(taskId));
          console.log('删除结果:', success);

          // 重新加载列表
          await loadSchedules();
          console.log('重新加载后的日程数量:', schedules.length);

          setToast({ message: '删除成功', type: 'success' });
        } catch (error) {
          console.error('删除失败:', error);
          setToast({ message: '删除失败，请重试', type: 'error' });
        }
      },
    });
  };

  const handleAddNew = (type: CareType) => {
    setEditingTask(null);
    setFormType(type);
    setFormTitle('');
    setFormDescription('');
    setFormTime('08:00');
    setFormRepeatDaily(true);
    setFormAutoRemind(true);
    setShowForm(true);
  };

  // 显示加载状态
  if (loading && schedules.length === 0 && !apiConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载护理计划...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">护理计划</h1>
            <button
              onClick={() => handleAddNew('medication')}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={18} />
              添加
            </button>
          </div>

          {/* 标签栏 */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部 ({careTasks.length})
            </button>
            {(Object.entries(careTypeConfig) as [CareType, any][]).map(
              ([type, config]) => {
                const count = careTasks.filter((t) => t.type === type).length;
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                      activeTab === type
                        ? getColorClasses(config.color)
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon size={16} />
                    {config.label} ({count})
                  </button>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* 主要内容区 - 手机优化列表 */}
      <div className="px-4 py-4">
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const config = careTypeConfig[task.type];
            const Icon = config.icon;

            return (
              <div
                key={task.id}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                {/* 头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${getColorClasses(
                        config.color
                      )}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-gray-900">
                          {task.name}
                        </h3>
                        {/* 日程状态标签 */}
                        {task.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            ⏳ 待执行
                          </span>
                        )}
                        {task.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            ✓ 已完成
                          </span>
                        )}
                        {task.status === 'skipped' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            ○ 已忽略
                          </span>
                        )}
                        {task.status === 'missed' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            ⚠ 已错过
                          </span>
                        )}
                        {/* 如果没有状态，默认显示待执行 */}
                        {!task.status && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            ⏳ 待执行
                          </span>
                        )}
                        {task.autoRemind && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            🤖 自动提醒
                          </span>
                        )}
                        {task.repeatType === 'daily' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            🔄 每日重复
                          </span>
                        )}
                      </div>

                      {/* 用药专用信息 */}
                      {task.type === 'medication' && (
                        <div className="text-sm text-gray-600 mb-2">
                          {task.dosage} · {task.route}
                          {task.withFood && ' · 随餐'}
                        </div>
                      )}

                      {/* 其他描述 */}
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {task.description}
                        </p>
                      )}

                      {/* 时间标签 */}
                      <div className="flex flex-wrap gap-2">
                        {task.times.map((time, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded flex items-center gap-1"
                          >
                            <Clock size={12} />
                            {time}
                          </span>
                        ))}
                      </div>

                      {/* 用药宽限期 */}
                      {task.type === 'medication' && task.gracePeriod && (
                        <div className="text-xs text-gray-500 mt-2">
                          宽限期：{task.gracePeriod} 分钟
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="编辑"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="删除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 空状态 */}
        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无护理计划</p>
            <button
              onClick={() => handleAddNew(activeTab === 'all' ? 'medication' : activeTab)}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              添加第一个计划
            </button>
          </div>
        )}

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertCircle
              className="text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              size={20}
            />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">护理计划提示</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>护理计划会在设定时间提醒老人执行</li>
                <li>用药计划超时未确认将自动发送通知给家属</li>
                <li>如需调整护理方案请咨询专业医护人员</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑/添加表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTask ? '编辑' : '添加'}
                {careTypeConfig[formType]?.label || ''}计划
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* 表单内容 - 可滚动 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 类型选择 */}
              {!editingTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    计划类型
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(careTypeConfig) as [CareType, any][]).map(
                      ([type, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => setFormType(type)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              formType === type
                                ? `${getColorClasses(config.color)} border-current`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon size={24} className="mx-auto mb-1" />
                            <div className="text-xs font-medium">
                              {config.label}
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* 名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formType === 'medication' ? '药品名称' : '计划名称'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={getPlaceholders(formType).title}
                  value={formTitle || editingTask?.name || ''}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* 用药专用字段 */}
              {formType === 'medication' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      剂量 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例如：50mg"
                      defaultValue={editingTask?.dosage}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      给药途径
                    </label>
                    <select
                      defaultValue={editingTask?.route}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option>口服</option>
                      <option>外用</option>
                      <option>注射</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={editingTask?.withFood}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">
                        需要随餐服用
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      宽限期（分钟）
                    </label>
                    <select
                      defaultValue={editingTask?.gracePeriod}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="15">15 分钟</option>
                      <option value="30">30 分钟</option>
                      <option value="60">60 分钟</option>
                      <option value="120">120 分钟</option>
                    </select>
                  </div>
                </>
              )}

              {/* 非用药的描述字段 */}
              {formType !== 'medication' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述说明
                  </label>
                  <textarea
                    placeholder={getPlaceholders(formType).description}
                    value={formDescription || editingTask?.description || ''}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                  />
                </div>
              )}

              {/* 执行时间 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  执行时间 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 是否每日重复 */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRepeatDaily}
                    onChange={(e) => setFormRepeatDaily(e.target.checked)}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700">
                      每日重复执行
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      启用后，此日程将每天在设定的时间自动执行
                    </p>
                  </div>
                </label>
              </div>

              {/* 数字人自动提醒 */}
              <div className="pt-4 border-t">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoRemind}
                    onChange={(e) => {
                      console.log('自动提醒复选框改变:', e.target.checked);
                      setFormAutoRemind(e.target.checked);
                    }}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700">
                      数字人自动提醒老人 {formAutoRemind ? '(当前: 是)' : '(当前: 否)'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      启用后，数字人会在设定时间主动提醒老人执行此护理任务
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-4 border-t flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  // 验证必填字段
                  const title = formTitle.trim() || editingTask?.name || '';
                  if (!title) {
                    setToast({ message: '请输入日程名称', type: 'warning' });
                    return;
                  }

                  // 构建日程时间：使用今天的日期 + 用户选择的时间
                  const today = new Date();
                  const [hours, minutes] = formTime.split(':').map(Number);
                  const scheduleDateTime = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                    hours,
                    minutes,
                    0
                  );

                  // 获取表单数据
                  const formData: scheduleService.Schedule = {
                    family_id: familyId,
                    title: title,
                    description: formDescription.trim() || editingTask?.description || '',
                    schedule_type: formType === 'hydration' || formType === 'sleep' ? 'other' : formType,
                    schedule_time: scheduleService.formatDateTime(scheduleDateTime),
                    repeat_type: formRepeatDaily ? 'daily' : 'once',
                    auto_remind: formAutoRemind ? 1 : 0,
                  };

                  // 如果是编辑操作，且新时间在当前时间之后，自动重置状态为pending
                  if (editingTask) {
                    const now = new Date();
                    if (scheduleDateTime > now) {
                      formData.status = 'pending';
                      console.log('日程时间在未来，自动重置状态为pending');
                    }
                  }

                  try {
                    if (editingTask) {
                      // 更新
                      await scheduleService.updateSchedule(Number(editingTask.id), formData);
                      console.log('更新成功');
                    } else {
                      // 创建
                      const newId = await scheduleService.createSchedule(formData);
                      console.log('创建成功，新 ID:', newId);
                    }
                    setShowForm(false);
                    setFormTitle('');
                    setFormDescription('');
                    setFormTime('08:00');
                    setFormRepeatDaily(true);
                    setFormAutoRemind(true);
                    // 等待重新加载完成
                    await loadSchedules();
                    setToast({
                      message: editingTask ? '更新成功' : '创建成功',
                      type: 'success',
                    });
                  } catch (error) {
                    console.error('保存失败:', error);
                    setToast({
                      message: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
                      type: 'error',
                    });
                  }
                }}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          type="danger"
          confirmText="删除"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
