import React, { useState, useEffect } from 'react';
import { Mic, Users, Image } from 'lucide-react';
import { AvatarStage } from '../components/AvatarStage';
import { MedicationCard } from '../components/MedicationCard';
import { MoodBoard } from '../components/MoodBoard';
import { MemoryPlayer } from '../components/MemoryPlayer';
import { MediaPlayer } from '../components/MediaPlayer';
import { EmergencySheet } from '../components/EmergencySheet';
import { ScheduleList } from '../components/ScheduleList';
import { ScheduleReminderToast } from '../components/ScheduleReminderToast';
import { ToastMessage } from '../components/ToastMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TransparentMediaOverlay } from '../components/TransparentMediaOverlay';
import { LogNotification } from '../components/LogNotification';
import * as scheduleService from '../services/scheduleService';
import * as mediaService from '../services/mediaService';
import * as messageService from '../services/messageService';
import * as alertService from '../services/alertService';
import * as moodService from '../../family/services/moodService';
import { API_BASE_URL, FAY_HTTP_BASE_URL } from '../../config/runtime';

/**
 * 老人端主页
 * 优化为 9:16 竖屏使用（如平板竖屏）
 * 包含数字人、大按钮和各类卡片叠加层
 */
export const HomePage: React.FC = () => {
  const [activeOverlay, setActiveOverlay] = useState<
    'none' | 'medication' | 'mood' | 'memory' | 'emergency' | 'schedule' | 'media'
  >('none');
  const [isAvatarActive, setIsAvatarActive] = useState(false);
  const [memoryMode, setMemoryMode] = useState<'pip' | 'fullscreen'>('fullscreen');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'calling'; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [sdkStatus, setSDKStatus] = useState<'loading' | 'ready' | 'error' | 'config-missing'>('loading');
  const [wsStatus, setWSStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [todaySchedules, setTodaySchedules] = useState<scheduleService.Schedule[]>([]);
  const [reminderSchedule, setReminderSchedule] = useState<scheduleService.Schedule | null>(null);
  const [shownReminders, setShownReminders] = useState<Set<number>>(new Set());
  const [postponedReminders, setPostponedReminders] = useState<Map<number, Date>>(new Map()); // 记录推迟的日程和推迟到的时间
  const [recommendedMedia, setRecommendedMedia] = useState<mediaService.RecommendedMedia[]>([]);
  const [playedMessages, setPlayedMessages] = useState<Set<number>>(new Set()); // 记录已播报的留言ID
  const [mediaOverlay, setMediaOverlay] = useState<{
    filename: string;
    type: 'photo' | 'video';
    text?: string;
    duration?: number;
  } | null>(null); // 透明窗口媒体展示状态
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState<boolean>(true); // 麦克风状态
  const [currentMood, setCurrentMood] = useState<moodService.MoodType | null>(null); // 当前情绪
  const [logMessage, setLogMessage] = useState<string | null>(null); // WebSocket log消息
  const [isIdle, setIsIdle] = useState<boolean>(false); // 是否处于空闲状态
  const isIdleRef = React.useRef<boolean>(false); // 用于在回调中检查空闲状态
  const [resetIdleTrigger, setResetIdleTrigger] = useState<number>(0); // 用于触发空闲计时器重置
  const [isAvatarVisible, setIsAvatarVisible] = useState<boolean>(true); // 数字人是否可见（不影响WebSocket连接）
  const familyId = 'family_001'; // 实际使用时从用户上下文获取
  const elderlyId = 1; // 老人用户ID，实际使用时从用户上下文获取

  // 轮询检查联系家人的alerts（与家属端相同的方案）
  useEffect(() => {
    let lastAlertId = 0; // 记录上次处理的alert ID
    let isInitialized = false; // 标记是否已初始化

    const checkContactFamilyAlerts = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/family/alerts?family_id=${familyId}&handled=false&alert_type=contact_family&limit=1`
        );

        if (!response.ok) {
          console.error('[HomePage] 查询alerts失败:', response.status);
          return;
        }

        const data = await response.json();
        const alerts = data.alerts || [];

        if (alerts.length > 0) {
          const alert = alerts[0];

          // 首次初始化：只记录ID，不显示Toast（避免刷新页面时重复显示旧alert）
          if (!isInitialized) {
            lastAlertId = alert.id;
            isInitialized = true;
            console.log('[HomePage] 初始化lastAlertId:', lastAlertId);
            return;
          }

          // 只处理新的alert（避免重复显示）
          if (alert.id > lastAlertId) {
            lastAlertId = alert.id;

            console.log('[HomePage] ✓ 收到联系家人alert:', alert);

            // 显示Toast
            const message = alert.metadata?.is_emergency
              ? "正在紧急通知家人..."
              : "正在通知家人...";

            setToastMessage({
              type: 'calling',
              message: message
            });
            console.log('[HomePage] ✓ Toast已显示:', message);

            // 10秒后自动关闭
            setTimeout(() => {
              console.log('[HomePage] 关闭Toast');
              setToastMessage(null);
            }, 10000);
          }
        } else {
          // 没有未处理的alert时，标记为已初始化
          if (!isInitialized) {
            isInitialized = true;
            console.log('[HomePage] 初始化完成，当前无未处理alert');
          }
        }
      } catch (error) {
        console.error('[HomePage] 检查alerts失败:', error);
      }
    };

    // 立即执行一次
    checkContactFamilyAlerts();

    // 每2秒检查一次新alerts
    const interval = setInterval(checkContactFamilyAlerts, 2000);

    return () => clearInterval(interval);
  }, [familyId]);

  // 加载今日日程
  useEffect(() => {
    loadTodaySchedules();
    // 每分钟刷新一次
    const interval = setInterval(loadTodaySchedules, 60000);
    return () => clearInterval(interval);
  }, []);

  // 监听日程状态变化，自动关闭已完成/已忽略的弹窗
  useEffect(() => {
    if (reminderSchedule && reminderSchedule.id) {
      // 在最新的日程列表中查找当前弹窗对应的日程
      const updatedSchedule = todaySchedules.find(s => s.id === reminderSchedule.id);
      // 如果日程状态不是pending，关闭弹窗
      if (updatedSchedule && updatedSchedule.status !== 'pending') {
        console.log(`日程 ${reminderSchedule.title} 状态已变更为 ${updatedSchedule.status}，关闭弹窗`);
        setReminderSchedule(null);
      }
    }
  }, [todaySchedules, reminderSchedule]);


  // 加载当前情绪
  const loadCurrentMood = async () => {
    try {
      const response = await moodService.getFamilyMoods(familyId, { limit: 1 });
      if (response.records && response.records.length > 0) {
        setCurrentMood(response.records[0].mood_type);
      }
    } catch (error) {
      console.error('加载当前情绪失败:', error);
    }
  };

  // 初始化加载当前情绪
  useEffect(() => {
    loadCurrentMood();
  }, []);

  // 加载推荐媒体
  const loadRecommendedMedia = async () => {
      try {
        const response = await mediaService.getRecommendedMedia(familyId, elderlyId);
        setRecommendedMedia(response.media);
        console.log('加载到推荐媒体:', response.media.length, '个');
      } catch (error) {
        console.error('加载推荐媒体失败:', error);
      }
    };

  // 处理空闲状态变化
  const handleIdleStateChange = async (idle: boolean) => {
    console.log(`[HomePage] 空闲状态变化: ${idle ? '进入空闲' : '退出空闲'}`);
    setIsIdle(idle);
    isIdleRef.current = idle; // 同步更新ref，供定时器回调使用

    if (idle) {
      // 进入空闲状态，隐藏数字人（但保持WebSocket连接）并打开媒体播放器界面
      console.log('[HomePage] 进入空闲模式，隐藏数字人，打开媒体播放器');
      setIsAvatarVisible(false);
      await loadRecommendedMedia();
      setActiveOverlay('media');
    } else {
      // 退出空闲状态，显示数字人，关闭媒体播放器
      console.log('[HomePage] 退出空闲模式，显示数字人，关闭媒体播放器');
      setIsAvatarVisible(true);
      if (activeOverlay === 'media') {
        setActiveOverlay('none');
      }
    }
  };

  // 当推荐媒体更新且处于空闲状态时，确保媒体播放器打开
  useEffect(() => {
    if (isIdle && recommendedMedia.length > 0 && activeOverlay !== 'media') {
      setActiveOverlay('media');
    }
  }, [recommendedMedia, isIdle]);

  // 处理媒体播放器关闭（用户手动关闭）
  const handleMediaPlayerClose = () => {
    console.log('[HomePage] 用户手动关闭媒体播放器');
    setActiveOverlay('none');
    // 重置空闲状态，这样空闲检测会重新开始计时
    setIsIdle(false);
    isIdleRef.current = false;
    // 显示数字人（不需要重新初始化，因为WebSocket一直保持连接）
    setIsAvatarVisible(true);
    // 触发 XmovAvatar 重置空闲计时器
    setResetIdleTrigger(prev => prev + 1);
  };

  // 检测日程到达时间
  useEffect(() => {
    const checkScheduleTime = () => {
      const now = new Date();

      // 遍历今日日程，查找需要提醒的
      todaySchedules.forEach((schedule) => {
        if (!schedule.id) return;

        // 只处理待执行状态的日程
        if (schedule.status !== 'pending') return;

        // 已经提醒过的跳过
        if (shownReminders.has(schedule.id)) return;

        // 检查是否被推迟，如果被推迟且未到推迟时间，则跳过
        const postponedTime = postponedReminders.get(schedule.id);
        if (postponedTime && now < postponedTime) {
          console.log(`日程 ${schedule.title} 已推迟到 ${postponedTime.toLocaleTimeString()}，暂不提醒`);
          return;
        }

        // 如果已过推迟时间，清除推迟记录
        if (postponedTime && now >= postponedTime) {
          console.log(`日程 ${schedule.title} 推迟时间已到，现在提醒`);
          setPostponedReminders(prev => {
            const newMap = new Map(prev);
            newMap.delete(schedule.id!);
            return newMap;
          });
        }

        const scheduleTime = new Date(schedule.schedule_time);
        const diffMinutes = (scheduleTime.getTime() - now.getTime()) / (1000 * 60);

        // 到达时间（允许 1 分钟误差）
        if (diffMinutes <= 1 && diffMinutes >= -1) {
          console.log('日程到达时间，显示提醒:', schedule.title);

          // 构建提醒内容
          const timeStr = scheduleService.formatTime(schedule.schedule_time);
          const typeLabel = scheduleService.getScheduleTypeLabel(schedule.schedule_type || 'other');
          let reminderText = `${timeStr}，${typeLabel}提醒：${schedule.title}`;

          // 如果有描述，添加描述
          if (schedule.description) {
            reminderText += `。${schedule.description}`;
          }

          // 添加操作询问
          reminderText += `。请问您要标记完成、推迟执行，还是忽略行程？`;

          // 推送播报内容到数字人
          sendToAvatar(reminderText);

          // 显示弹窗提醒
          setReminderSchedule(schedule);
          setShownReminders(prev => new Set(prev).add(schedule.id!));
        }
      });
    };

    // 每 10 秒检查一次
    const interval = setInterval(checkScheduleTime, 10000);
    checkScheduleTime(); // 立即执行一次

    return () => clearInterval(interval);
  }, [todaySchedules, shownReminders, postponedReminders]);

  const loadTodaySchedules = async () => {
    try {
      const now = new Date().toLocaleTimeString('zh-CN');
      console.log(`[${now}] 自动检查日程更新...`);
      const data = await scheduleService.getTodaySchedules(familyId);
      setTodaySchedules(data);
      console.log(`[${now}] 加载到 ${data.length} 条日程`);
    } catch (error) {
      console.error('加载今日日程失败:', error);
    }
  };

  // 检查并播报待播放的留言
  const checkAndPlayMessages = async () => {
    try {
      const now = new Date().toLocaleTimeString('zh-CN');
      console.log(`[${now}] 检查待播放留言...`);

      const pendingMessages = await messageService.getPendingMessages(familyId);

      if (pendingMessages.length > 0) {
        console.log(`发现 ${pendingMessages.length} 条待播放留言`);

        for (const message of pendingMessages) {
          // 检查是否已经播报过（避免重复播报）
          if (!playedMessages.has(message.id)) {
            console.log(`播报留言 ID: ${message.id} - 来自${message.sender_relation}${message.sender_name}`);

            // 推送到数字人播报
            await messageService.playMessageOnAvatar(message);

            // 显示Toast字幕提示（30秒）
            const toastText = `来自${message.sender_relation}${message.sender_name}的留言：${message.content}`;
            setToastMessage({ type: 'info', message: toastText });

            // 30秒后自动关闭Toast
            setTimeout(() => {
              setToastMessage(null);
            }, 30000);

            // 标记为已播放
            await messageService.markAsPlayed(message.id);

            // 记录已播报
            setPlayedMessages((prev) => new Set(prev).add(message.id));

            console.log(`留言 ID: ${message.id} 播报完成`);
          }
        }
      }
    } catch (error) {
      console.error('检查并播报留言失败:', error);
    }
  };

  // 定时检查待播放留言（每分钟检查一次）
  useEffect(() => {
    checkAndPlayMessages(); // 立即执行一次
    const interval = setInterval(checkAndPlayMessages, 60000); // 每分钟检查
    return () => clearInterval(interval);
  }, [playedMessages]);

  // 轮询媒体展示事件（每5秒检查一次）
  const pollMediaEvents = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/elderly/poll-media-events?family_id=${familyId}`
      );

      if (!response.ok) {
        throw new Error(`轮询媒体事件失败: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.event && data.event.metadata) {
        const metadata = data.event.metadata;
        console.log('收到媒体展示事件:', metadata);

        // 推送播报内容到数字人（与日程模块相同的逻辑）
        if (metadata.avatar_text) {
          console.log('准备调用 sendToAvatar，文本内容:', metadata.avatar_text);

          // 确保麦克风已开启（媒体展示时需要数字人播报）
          await ensureMicrophoneEnabled();

          await sendToAvatar(metadata.avatar_text);
          console.log('sendToAvatar 调用完成');
        } else {
          console.warn('没有 avatar_text，跳过数字人播报');
        }

        // 设置媒体展示状态，触发透明窗口弹出
        setMediaOverlay({
          filename: metadata.media_filename,
          type: metadata.media_type || 'photo',
          text: metadata.avatar_text,
          duration: metadata.duration || 30,
        });
      }
    } catch (error) {
      console.error('轮询媒体事件错误:', error);
    }
  };

  // 定时轮询媒体展示事件（每5秒检查一次）
  useEffect(() => {
    pollMediaEvents(); // 立即执行一次
    const interval = setInterval(pollMediaEvents, 5000); // 每5秒检查
    return () => clearInterval(interval);
  }, []);

  // 确保麦克风已开启
  const ensureMicrophoneEnabled = async () => {
    try {
      console.log('[ensureMicrophoneEnabled] 确保麦克风已开启...');
      const response = await fetch(`${FAY_HTTP_BASE_URL}/api/toggle-microphone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
      });

      if (!response.ok) {
        throw new Error(`开启麦克风失败: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[ensureMicrophoneEnabled] 麦克风状态:', result);
    } catch (error) {
      console.error('[ensureMicrophoneEnabled] 开启麦克风错误:', error);
    }
  };

  // 向数字人推送播报内容
  const sendToAvatar = async (text: string) => {
    try {
      console.log('[sendToAvatar] 开始推送播报内容:', text);
      console.log(`[sendToAvatar] 请求URL: ${FAY_HTTP_BASE_URL}/transparent-pass`);

      const requestBody = {
        user: 'User',
        text: text,
      };
      console.log('[sendToAvatar] 请求体:', requestBody);

      const response = await fetch(`${FAY_HTTP_BASE_URL}/transparent-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[sendToAvatar] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sendToAvatar] 响应错误内容:', errorText);
        throw new Error(`推送播报失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[sendToAvatar] 播报内容推送成功，响应:', result);
    } catch (error) {
      console.error('[sendToAvatar] 推送播报内容错误:', error);
      // 不抛出错误，让流程继续（即使播报失败，也要显示媒体）
    }
  };

  // 模拟媒体库数据
  const mediaLibrary = [
    { id: '1', url: '/placeholder-photo.jpg', type: 'photo' as const, caption: '小米 2018 秋游' },
    { id: '2', url: '/placeholder-photo-2.jpg', type: 'photo' as const, caption: '2019 春节团聚' },
    { id: '3', url: '/placeholder-photo-3.jpg', type: 'photo' as const, caption: '奶奶80岁生日' },
    { id: '4', url: '/placeholder-photo-4.jpg', type: 'photo' as const, caption: '家庭野餐' },
    { id: '5', url: '/placeholder-photo-5.jpg', type: 'photo' as const, caption: '小孙子周岁' },
  ];

  // 获取当前时间和日期信息
  const now = new Date();
  const currentTime = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const currentDate = now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
  const currentDay = now.toLocaleDateString('zh-CN', {
    weekday: 'long',
  });
  // 模拟天气信息（实际使用时应从天气API获取）
  const weather = '晴 22°C';

  // 切换麦克风开关
  const handleMicClick = async () => {
    try {
      console.log('[handleMicClick] 切换麦克风状态，当前状态:', isMicrophoneEnabled);

      // 先显示视觉反馈
      setIsAvatarActive(true);
      setTimeout(() => setIsAvatarActive(false), 1000);

      // 调用麦克风切换API（不传参数则自动切换）
      const response = await fetch(`${FAY_HTTP_BASE_URL}/api/toggle-microphone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 不传参数，自动切换状态
      });

      if (!response.ok) {
        throw new Error(`切换麦克风失败: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[handleMicClick] 麦克风切换结果:', result);

      // 更新UI状态
      setIsMicrophoneEnabled(result.enabled);

    } catch (error) {
      console.error('[handleMicClick] 切换麦克风错误:', error);
    }
  };

  const handleFamilyClick = async () => {
    setToastMessage({ type: 'calling', message: '正在呼叫家人...' });
    // 推送普通消息到家属端
    try {
      await alertService.sendContactFamilyAlert(familyId);
      console.log('已通知家人');
    } catch (error) {
      console.error('通知家人失败:', error);
    }
  };

  const handleEmergencyClick = () => {
    setActiveOverlay('emergency');
  };

  const handlePhotosClick = async () => {
    // 加载推荐媒体
    await loadRecommendedMedia();
    setActiveOverlay('media');
  };

  const handleNextMedia = () => {
    if (currentMediaIndex < mediaLibrary.length - 1) {
      setCurrentMediaIndex(currentMediaIndex + 1);
    }
  };

  const handlePreviousMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(currentMediaIndex - 1);
    }
  };

  const handleSelectMedia = (index: number) => {
    setCurrentMediaIndex(index);
  };

  // 获取临近日程（前后30分钟内）
  const getNextSchedule = () => {
    if (todaySchedules.length === 0) return null;

    const now = new Date();
    const sorted = scheduleService.sortSchedulesByTime(todaySchedules);

    // 查找在时间窗口内的日程（前30分钟到后30分钟）
    for (const schedule of sorted) {
      const scheduleTime = new Date(schedule.schedule_time);
      const diffMinutes = (scheduleTime.getTime() - now.getTime()) / (1000 * 60);

      // 如果在前后30分钟范围内，显示这个日程
      if (diffMinutes >= -30 && diffMinutes <= 30) {
        return schedule;
      }

      // 如果日程还在30分钟之后，也显示（即将到来）
      if (diffMinutes > 30) {
        return schedule;
      }
    }

    // 如果所有日程都已过期超过30分钟，不显示任何日程
    return null;
  };

  // 获取临近的药物提醒（前后30分钟内）
  const getNearbyMedicationReminder = () => {
    if (todaySchedules.length === 0) return null;

    const now = new Date();

    // 查找前后30分钟内的药物提醒
    for (const schedule of todaySchedules) {
      if (schedule.schedule_type !== 'medication') continue;

      const scheduleTime = new Date(schedule.schedule_time);
      const diffMinutes = (scheduleTime.getTime() - now.getTime()) / (1000 * 60);

      // 如果在前后30分钟范围内，返回这个药物提醒
      if (diffMinutes >= -30 && diffMinutes <= 30) {
        return schedule;
      }
    }

    return null;
  };

  const nextSchedule = getNextSchedule();
  const nearbyMedication = getNearbyMedicationReminder();

  return (
    <div className="h-screen w-full relative elderly-mode overflow-hidden">
      {/* 主内容区域 - 满屏显示 */}
      <div className="relative w-full h-full bg-gray-50">
        {/* 数字人画面 - 全屏背景（隐藏时保持WebSocket连接，用z-index控制层级而非visibility） */}
        <div className={`absolute inset-0 ${isAvatarVisible ? 'z-0' : 'z-[-1]'}`}>
          <AvatarStage
            isActive={isAvatarActive}
            onSDKStatusChange={setSDKStatus}
            onWSStatusChange={setWSStatus}
            onLogMessage={setLogMessage}
            onIdleStateChange={handleIdleStateChange}
            idleTimeout={10 * 60 * 1000} // 10分钟无互动后进入媒体播放
            resetIdleTrigger={resetIdleTrigger}
          />
        </div>

      {/* PIP 模式的媒体播放器 */}
      {activeOverlay === 'memory' && memoryMode === 'pip' && (
        <MemoryPlayer
          mediaType="photo"
          mode="pip"
          mediaList={mediaLibrary}
          currentIndex={currentMediaIndex}
          onLike={() => console.log('Liked')}
          onDislike={() => console.log('Disliked')}
          onClose={() => setActiveOverlay('none')}
          onToggleMode={() => setMemoryMode('fullscreen')}
          onNext={handleNextMedia}
          onPrevious={handlePreviousMedia}
          onSelectMedia={handleSelectMedia}
        />
      )}

      {/* 顶部状态栏 - 悬浮层 */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/40 to-transparent px-4 py-3">
        <div className="flex items-center justify-between text-white">
          {/* 左侧区域：状态指示器 + 时间日期 */}
          <div className="flex items-center gap-4">
            {/* 连接状态指示器 - 竖排两个绿点 */}
            <div className="flex flex-col gap-2">
              <span
                className={`w-3 h-3 rounded-full animate-pulse ${
                  sdkStatus === 'ready' ? 'bg-green-500' : sdkStatus === 'loading' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                title={sdkStatus === 'ready' ? 'SDK就绪' : sdkStatus === 'loading' ? 'SDK初始化中' : 'SDK错误'}
              />
              <span
                className={`w-3 h-3 rounded-full animate-pulse ${
                  wsStatus === 'connected' ? 'bg-green-500' : wsStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}
                title={wsStatus === 'connected' ? 'WebSocket已连接' : wsStatus === 'connecting' ? 'WebSocket连接中' : 'WebSocket未连接'}
              />
            </div>

            {/* 时间日期信息 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold drop-shadow-lg">
                  {currentTime}
                </span>
                <span className="text-base drop-shadow-md">
                  {currentDate}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm drop-shadow-md">
                <span>{currentDay}</span>
                <span className="text-yellow-300">☀️ {weather}</span>
              </div>
            </div>
          </div>

          {/* 中间Logo区域 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="flex items-baseline gap-2 justify-center mb-1">
              <h1 className="text-2xl font-bold drop-shadow-lg">KinEcho</h1>
              <span className="text-sm drop-shadow-md opacity-90">亲情回声</span>
            </div>
            <p className="text-xs drop-shadow-md opacity-80 italic whitespace-nowrap">
              Bring family moments to life. / 把家人的声音带到眼前。
            </p>
          </div>

          {nextSchedule && (
            <button
              onClick={() => setActiveOverlay('schedule')}
              className="text-xl font-bold bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/30 active:scale-95 transition-all"
            >
              {scheduleService.getScheduleTypeIcon(nextSchedule.schedule_type || 'other')}{' '}
              {scheduleService.formatTime(nextSchedule.schedule_time)}{' '}
              {nextSchedule.title}
            </button>
          )}
        </div>
      </div>

      {/* 左侧按钮组 - 功能按钮垂直排列 */}
      <div className="absolute left-4 flex flex-col gap-3 z-40" style={{ bottom: '38.2%', transform: 'translateY(50%)' }}>
        {/* 麦克风按钮容器 - 用于承载log通知 */}
        <div className="relative">
          <button
            onClick={handleMicClick}
            className={`w-16 h-16 flex items-center justify-center ${
              isMicrophoneEnabled
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-500 hover:bg-gray-600'
            } text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all`}
            aria-label={isMicrophoneEnabled ? '点击关闭麦克风' : '点击开启麦克风'}
          >
            <Mic size={32} strokeWidth={2.5} />
          </button>

          {/* Log通知 - 从麦克风按钮向右延伸 */}
          {logMessage && (
            <LogNotification
              message={logMessage}
              onHide={() => setLogMessage(null)}
            />
          )}
        </div>
        <button
          onClick={handleFamilyClick}
          className="w-16 h-16 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
          aria-label="联系家人"
        >
          <Users size={32} strokeWidth={2.5} />
        </button>
        <button
          onClick={handlePhotosClick}
          className="w-16 h-16 flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
          aria-label="查看照片和视频"
        >
          <Image size={32} strokeWidth={2.5} />
        </button>
      </div>

      {/* 右下角 - 紧急求助按钮 */}
      <div className="absolute right-4 bottom-4 z-40">
        <button
          onClick={handleEmergencyClick}
          className="w-20 h-20 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-pulse"
          aria-label="我不舒服，需要帮助"
        >
          <span className="text-4xl">🆘</span>
        </button>
      </div>

      {/* 叠加层 - 用药提醒 */}
      {activeOverlay === 'medication' && (
        <MedicationCard
          medicationName="氯沙坦"
          dosage="50mg"
          timing="早餐后"
          graceMinutes={30}
          onTaken={() => {
            setActiveOverlay('none');
            setToastMessage({ type: 'success', message: '已记录服药' });
          }}
          onSnooze={(mins) => {
            setActiveOverlay('none');
            setToastMessage({ type: 'info', message: `将在 ${mins} 分钟后再次提醒` });
          }}
          onSkip={() => {
            setActiveOverlay('none');
            setConfirmDialog({
              message: '跳过服药可能影响健康，确定吗？',
              onConfirm: () => {
                setConfirmDialog(null);
                setToastMessage({ type: 'info', message: '已记录跳过' });
              }
            });
          }}
          onInfo={() => {
            setToastMessage({ type: 'info', message: '氯沙坦用于降血压，请随餐服用，避免空腹。' });
          }}
        />
      )}

      {/* 叠加层 - 心情选择 */}
      {activeOverlay === 'mood' && (
        <MoodBoard
          familyId={familyId}
          elderlyId={elderlyId}
          onMoodSelect={(mood) => {
            console.log('Selected mood:', mood);
            // 更新当前情绪显示
            setCurrentMood(mood as moodService.MoodType);
            // 根据心情触发不同的回忆内容
            setActiveOverlay('memory');
          }}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {/* 叠加层 - 媒体播放（全屏） */}
      {activeOverlay === 'memory' && memoryMode === 'fullscreen' && (
        <MemoryPlayer
          mediaType="photo"
          mode="fullscreen"
          mediaList={mediaLibrary}
          currentIndex={currentMediaIndex}
          onLike={() => console.log('Liked')}
          onDislike={() => console.log('Disliked')}
          onClose={() => setActiveOverlay('none')}
          onToggleMode={() => setMemoryMode('pip')}
          onNext={handleNextMedia}
          onPrevious={handlePreviousMedia}
          onSelectMedia={handleSelectMedia}
        />
      )}

      {/* 叠加层 - 紧急求助 */}
      {activeOverlay === 'emergency' && (
        <EmergencySheet
          onContactFamily={async () => {
            setActiveOverlay('none');
            setToastMessage({ type: 'calling', message: '正在呼叫家人...' });
            // 推送SOS紧急消息到家属端
            try {
              await alertService.sendSOSAlert(familyId);
              console.log('已发送SOS紧急通知给家人');
            } catch (error) {
              console.error('发送SOS紧急通知失败:', error);
            }
          }}
          onContactEmergency={async () => {
            setActiveOverlay('none');
            setToastMessage({ type: 'info', message: '暂未对接应急中心，已通知家人' });
            // 也推送SOS紧急消息到家属端
            try {
              await alertService.sendSOSAlert(familyId);
              console.log('已发送SOS紧急通知给家人');
            } catch (error) {
              console.error('发送SOS紧急通知失败:', error);
            }
          }}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {/* 叠加层 - 智能媒体播放器 */}
      {activeOverlay === 'media' && recommendedMedia.length > 0 && (
        <MediaPlayer
          familyId={familyId}
          elderlyId={elderlyId}
          onClose={handleMediaPlayerClose}
        />
      )}

      {/* 叠加层 - 日程列表 */}
      {activeOverlay === 'schedule' && (
        <ScheduleList
          schedules={todaySchedules}
          onClose={() => setActiveOverlay('none')}
        />
      )}

      {/* Toast 消息提示 */}
      {toastMessage && (
        <ToastMessage
          type={toastMessage.type}
          message={toastMessage.message}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* 透明窗口媒体展示 */}
      {mediaOverlay && (
        <TransparentMediaOverlay
          mediaFilename={mediaOverlay.filename}
          mediaType={mediaOverlay.type}
          avatarText={mediaOverlay.text}
          duration={mediaOverlay.duration}
          onClose={() => setMediaOverlay(null)}
        />
      )}

      {/* 日程提醒 Toast */}
      {reminderSchedule && (
        <ScheduleReminderToast
          schedule={reminderSchedule}
          onComplete={async () => {
            try {
              if (reminderSchedule.id) {
                // 更新日程状态为已完成
                await scheduleService.updateScheduleStatus(reminderSchedule.id, 'completed');
              }
              setReminderSchedule(null);
              // 重新加载日程列表
              loadTodaySchedules();
            } catch (error) {
              console.error('标记完成失败:', error);
            }
          }}
          onSkip={async () => {
            try {
              if (reminderSchedule.id) {
                // 更新日程状态为已忽略
                await scheduleService.updateScheduleStatus(reminderSchedule.id, 'skipped');
              }
              setReminderSchedule(null);
              // 重新加载日程列表
              loadTodaySchedules();
            } catch (error) {
              console.error('忽略行程失败:', error);
            }
          }}
          onDismiss={async () => {
            if (!reminderSchedule) return;

            console.log('推迟执行日程:', reminderSchedule);

            try {
              // 计算10分钟后的时间
              const postponedTime = new Date();
              postponedTime.setMinutes(postponedTime.getMinutes() + 10);

              // 如果是每日重复的日程，只推迟当前实例
              if (reminderSchedule.repeat_type === 'daily') {
                // 记录推迟时间到 postponedReminders Map
                setPostponedReminders(prev => {
                  const newMap = new Map(prev);
                  newMap.set(reminderSchedule.id!, postponedTime);
                  return newMap;
                });
                // 从已显示列表中移除，允许再次提醒
                setShownReminders(prev => {
                  const newSet = new Set(prev);
                  if (reminderSchedule.id) newSet.delete(reminderSchedule.id);
                  return newSet;
                });
                console.log(`每日重复日程已推迟到 ${postponedTime.toLocaleTimeString()}，原日程保持不变`);
                setReminderSchedule(null);
              } else {
                // 如果是一次性日程，更新数据库中的 schedule_time
                const response = await fetch(
                  `${API_BASE_URL}/family/schedules/${reminderSchedule.id}`,
                  {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      family_id: reminderSchedule.family_id,
                      title: reminderSchedule.title,
                      description: reminderSchedule.description,
                      schedule_type: reminderSchedule.schedule_type,
                      schedule_time: postponedTime.toISOString(),
                      repeat_type: reminderSchedule.repeat_type,
                      repeat_days: reminderSchedule.repeat_days,
                      auto_remind: reminderSchedule.auto_remind,
                      status: 'pending', // 推迟后重置为pending状态
                    }),
                  }
                );

                if (response.ok) {
                  console.log('一次性日程时间已更新为10分钟后:', postponedTime.toISOString());
                  setReminderSchedule(null);
                  // 从已显示列表中移除，允许10分钟后再次提醒
                  setShownReminders(prev => {
                    const newSet = new Set(prev);
                    if (reminderSchedule.id) newSet.delete(reminderSchedule.id);
                    return newSet;
                  });
                  // 重新加载日程列表
                  loadTodaySchedules();
                } else {
                  const errorText = await response.text();
                  console.error('更新失败响应:', errorText);
                  throw new Error('更新日程时间失败');
                }
              }
            } catch (error) {
              console.error('推迟执行失败:', error);
            }
          }}
          onMissed={async () => {
            try {
              if (reminderSchedule?.id) {
                console.log('30分钟无操作，自动标记为已错过:', reminderSchedule.title);
                // 更新日程状态为已错过
                await scheduleService.updateScheduleStatus(reminderSchedule.id, 'missed');
              }
              setReminderSchedule(null);
              // 重新加载日程列表
              loadTodaySchedules();
            } catch (error) {
              console.error('标记已错过失败:', error);
              setReminderSchedule(null);
            }
          }}
          onClose={() => {
            // 手动关闭提醒（不做任何操作，只是隐藏）
            setReminderSchedule(null);
          }}
        />
      )}

        {/* 调试按钮 - 方便演示 */}
        <div className="absolute left-4 flex flex-col gap-3 opacity-30 hover:opacity-100 transition-opacity z-40" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          {/* 药物提醒按钮 - 只在前后30分钟有药物提醒时显示 */}
          {nearbyMedication && (
            <button
              onClick={() => setActiveOverlay('medication')}
              className="w-16 h-16 flex items-center justify-center bg-blue-600 text-white text-3xl rounded-full shadow-2xl backdrop-blur-sm hover:scale-110 active:scale-95 transition-all"
            >
              💊
            </button>
          )}
          <button
            onClick={() => setActiveOverlay('mood')}
            className="w-16 h-16 flex items-center justify-center bg-amber-500 text-white text-3xl rounded-full shadow-2xl backdrop-blur-sm hover:scale-110 active:scale-95 transition-all"
          >
            {currentMood ? moodService.moodEmojiMap[currentMood] : '😊'}
          </button>
        </div>
      </div>
    </div>
  );
};
