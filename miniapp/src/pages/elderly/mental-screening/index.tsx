import { useEffect, useMemo, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Camera, Text, View } from '@tarojs/components';
import {
  getMentalScreenings,
  submitLiveMentalScreening,
  type LiveScreeningResult,
  type MentalScreening,
} from '@/services/mentalHealth';
import { formatDateTimeText } from '@/utils/format';
import { useElderlyPreferenceClassNames } from '@/utils/elderlyPreferences';
import { getElderlySession } from '@/utils/session';

const steps = [
  { key: 'center', title: '请正对屏幕', hint: '将面部完整放入圆框内，保持不动。', mode: 'stable' },
  { key: 'blink', title: '请眨眨眼', hint: '保持正对屏幕，按提示眨眼一次。', mode: 'motion' },
  { key: 'turn', title: '请缓慢转头', hint: '保持面部在框内，向左或向右转头。', mode: 'motion' },
  { key: 'hold', title: '请保持不动', hint: '重新正对屏幕，保持 3 秒完成核验。', mode: 'hold' },
] as const;

type StepMode = (typeof steps)[number]['mode'];
type StepKey = (typeof steps)[number]['key'];

interface FrameStats {
  brightness: number;
  motion: number;
  qualityScore: number;
}

interface ActionState {
  stepStartedAt: number;
  stableSince: number;
  holdStartedAt: number;
  motionSeen: boolean;
  motionSeenAt: number;
  motionStartedAt: number;
  motionHitCount: number;
  lastMotionAt: number;
}

interface VisionFaceTelemetry {
  valid: boolean;
  confidence: number;
  yaw: number;
  pitch: number;
  roll: number;
  yawDelta: number;
  landmarkMotion: number;
  centerOffset: number;
  faceRatio: number;
  inFrame: boolean;
  detectedAt: number;
}

interface VisionDetectResult {
  [key: string]: unknown;
}

interface FaceDetectionSession {
  provider?: 'faceDetect';
  detectFace?: (options: Record<string, unknown>) => unknown;
  start?: (callback?: (status: unknown) => void) => void;
  stop?: () => void;
  destroy?: () => void;
}

declare const wx: {
  initFaceDetect?: (options: Record<string, unknown>) => unknown;
  faceDetect?: (options: Record<string, unknown>) => unknown;
  stopFaceDetect?: (options?: Record<string, unknown>) => unknown;
} | undefined;

function takePhoto(cameraId: string) {
  return new Promise<string>((resolve, reject) => {
    const camera = Taro.createCameraContext(cameraId);
    camera.takePhoto({
      quality: 'normal',
      success: (result) => resolve(result.tempImagePath),
      fail: (error) => reject(error),
    });
  });
}

function getRiskTone(level?: string) {
  if (level === 'high') return 'high';
  if (level === 'medium' || level === 'review') return 'medium';
  return 'low';
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) && value.length ? value[0] : null;
}

function appendPointNumbers(value: unknown, result: number[], depth = 0) {
  if (result.length >= 120 || depth > 3) {
    return;
  }

  if (typeof value === 'number') {
    result.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 80).forEach((item) => appendPointNumbers(item, result, depth + 1));
    return;
  }

  if (value && typeof value === 'object') {
    const point = value as Record<string, unknown>;
    if (typeof point.x === 'number' || typeof point.y === 'number') {
      result.push(toNumber(point.x));
      result.push(toNumber(point.y));
      return;
    }
    Object.values(point).slice(0, 80).forEach((item) => appendPointNumbers(item, result, depth + 1));
  }
}

function extractPointNumbers(value: unknown): number[] {
  const result: number[] = [];
  appendPointNumbers(value, result);
  return result.filter((item) => Number.isFinite(item));
}

function extractFlatPointNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: number[] = [];
  value.slice(0, 80).forEach((item) => {
    if (typeof item === 'number') {
      result.push(item);
      return;
    }
    if (item && typeof item === 'object') {
      const point = item as Record<string, unknown>;
      result.push(toNumber(point.x));
      result.push(toNumber(point.y));
    }
  });
  return result;
}

function meanPointMotion(points: number[], previous?: number[] | null) {
  if (!points.length || !previous?.length) {
    return 0;
  }
  const length = Math.min(points.length, previous.length, 80);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(points[index] - previous[index]);
  }
  return Math.round((total / length) * 10) / 10;
}

function getPointBox(points: number[], width?: number, height?: number) {
  if (points.length < 8 || !width || !height) {
    return { centerOffset: 1, faceRatio: 0, inFrame: false };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX || maxY <= minY) {
    return { centerOffset: 1, faceRatio: 0, inFrame: false };
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const normalizedX = Math.abs(centerX - width / 2) / Math.max(1, width / 2);
  const normalizedY = Math.abs(centerY - height / 2) / Math.max(1, height / 2);
  const faceRatio = Math.max((maxX - minX) / width, (maxY - minY) / height);
  const centerOffset = Math.max(normalizedX, normalizedY);
  return {
    centerOffset,
    faceRatio,
    inFrame: centerOffset < 0.46 && faceRatio > 0.18 && faceRatio < 0.92,
  };
}

function pickFacePayload(result: VisionDetectResult) {
  const body = asObject(result);
  const candidates = [
    firstArrayItem(body.faceInfos),
    firstArrayItem(body.faces),
    firstArrayItem(body.faceInfo),
    firstArrayItem(body.result),
    firstArrayItem(body.data),
    body.faceInfo,
    body.face,
    body,
  ];

  return asObject(candidates.find((item) => item && typeof item === 'object'));
}

function extractAngles(face: Record<string, unknown>) {
  const pose = asObject(face.pose || face.euler || face.rotation);
  const angleArray = Array.isArray(face.angleArray) ? face.angleArray : [];
  return {
    pitch: toNumber(face.pitch, toNumber(face.angleX, toNumber(pose.pitch, toNumber(angleArray[0])))),
    yaw: toNumber(face.yaw, toNumber(face.angleY, toNumber(pose.yaw, toNumber(angleArray[1])))),
    roll: toNumber(face.roll, toNumber(face.angleZ, toNumber(pose.roll, toNumber(angleArray[2])))),
  };
}

function extractLandmarks(face: Record<string, unknown>) {
  const sources = [
    face.points,
    face.point,
    face.keypoints,
    face.keyPoints,
    face.landmarks,
    face.landmark,
    face.pointArray,
    face.pointsArray,
    face.facePoints,
    face.facePoint,
  ];
  for (const source of sources) {
    const points = extractPointNumbers(source);
    if (points.length) {
      return points;
    }
  }
  const flatPoints = extractFlatPointNumbers(face);
  if (flatPoints.length) {
    return flatPoints;
  }
  return [];
}

function getFrameStats(data: ArrayBuffer, previous?: Uint8ClampedArray | null): { stats: FrameStats; sample: Uint8ClampedArray } {
  const pixels = new Uint8ClampedArray(data);
  const pixelCount = Math.max(1, Math.floor(pixels.length / 4));
  const step = Math.max(16, Math.floor(pixelCount / 220) * 4);
  const sample: number[] = [];
  let total = 0;
  let count = 0;
  let diff = 0;

  for (let index = 0; index < pixels.length; index += step) {
    const luminance = Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114);
    sample.push(luminance);
    total += luminance;
    if (previous && count < previous.length) {
      diff += Math.abs(luminance - previous[count]);
    }
    count += 1;
  }

  const brightness = Math.round(total / Math.max(1, count));
  const motion = previous ? Math.round((diff / Math.max(1, count)) * 10) / 10 : 0;
  const brightnessScore = brightness < 40 ? 40 : brightness > 220 ? 55 : 92;
  const stabilityScore = motion > 36 ? 70 : 94;
  const qualityScore = Math.min(100, Math.round(brightnessScore * 0.65 + stabilityScore * 0.35));

  return {
    stats: { brightness, motion, qualityScore },
    sample: new Uint8ClampedArray(sample),
  };
}

function isFrameUsable(stats: FrameStats) {
  return stats.brightness >= 38 && stats.brightness <= 225;
}

function createActionState(): ActionState {
  return {
    stepStartedAt: Date.now(),
    stableSince: 0,
    holdStartedAt: 0,
    motionSeen: false,
    motionSeenAt: 0,
    motionStartedAt: 0,
    motionHitCount: 0,
    lastMotionAt: 0,
  };
}

function callCallbackApi(api: ((options: Record<string, unknown>) => unknown) | undefined, source: unknown, options: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    if (!api) {
      reject(new Error('api unavailable'));
      return;
    }

    let settled = false;
    const finish = (callback: (value: unknown) => void, value: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };

    const payload = {
      ...options,
      success: (response: unknown) => finish(resolve, response),
      fail: (error: unknown) => finish(reject, error),
      complete: (response: unknown) => {
        if (!settled) {
          finish(resolve, response);
        }
      },
    };

    try {
      const maybePromise = api.call(source, payload) as Promise<unknown> | undefined;
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((response) => finish(resolve, response)).catch((error) => finish(reject, error));
      }
    } catch (error) {
      finish(reject, error);
    }
  });
}

function getWxFaceApi() {
  try {
    return typeof wx === 'undefined' ? null : wx;
  } catch {
    return null;
  }
}

async function createNativeFaceDetectSession(): Promise<FaceDetectionSession | null> {
  const taroApi = Taro as unknown as {
    initFaceDetect?: (options: Record<string, unknown>) => unknown;
    faceDetect?: (options: Record<string, unknown>) => unknown;
    stopFaceDetect?: (options?: Record<string, unknown>) => unknown;
  };
  const wxApi = getWxFaceApi();
  const sources = [wxApi, taroApi].filter((source): source is {
    initFaceDetect?: (options: Record<string, unknown>) => unknown;
    faceDetect: (options: Record<string, unknown>) => unknown;
    stopFaceDetect?: (options?: Record<string, unknown>) => unknown;
  } => Boolean(source?.faceDetect));

  for (const source of sources) {
    try {
      if (source.initFaceDetect) {
        await callCallbackApi(source.initFaceDetect, source, {}).catch(() => undefined);
      }
      return {
        provider: 'faceDetect',
        detectFace: (options) => source.faceDetect.call(source, {
          frameBuffer: options.frameBuffer,
          width: options.width,
          height: options.height,
          enablePoint: true,
          enableConf: true,
          enableAngle: true,
          enableMultiFace: false,
          success: options.success,
          fail: options.fail,
          complete: options.complete,
        }),
        stop: () => {
          source.stopFaceDetect?.call(source, {});
        },
      };
    } catch {
      // Try the next face-detect provider.
    }
  }

  return null;
}

async function createFaceDetectionSession() {
  return createNativeFaceDetectSession();
}

function detectVisionFace(session: FaceDetectionSession, frame: { data: ArrayBuffer; width?: number; height?: number }) {
  return new Promise<VisionDetectResult | null>((resolve) => {
    if (!session.detectFace) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (value: VisionDetectResult | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), 320);
    const payload = {
      frameBuffer: frame.data,
      width: frame.width,
      height: frame.height,
      scoreThreshold: 0.7,
      success: (response: VisionDetectResult) => {
        clearTimeout(timer);
        finish(response);
      },
      fail: () => {
        clearTimeout(timer);
        finish(null);
      },
      complete: (response: VisionDetectResult) => {
        clearTimeout(timer);
        finish(response);
      },
    };

    try {
      const maybePromise = session.detectFace(payload) as Promise<VisionDetectResult> | undefined;
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((response) => {
          clearTimeout(timer);
          finish(response);
        }).catch(() => {
          clearTimeout(timer);
          finish(null);
        });
      }
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

export default function MentalScreeningPage() {
  const preferenceClassName = useElderlyPreferenceClassNames();
  const { familyId, elderlyId } = getElderlySession();
  const [agreed, setAgreed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LiveScreeningResult | null>(null);
  const [records, setRecords] = useState<MentalScreening[]>([]);
  const [scanStatus, setScanStatus] = useState('等待摄像头画面');
  const [holdProgress, setHoldProgress] = useState(0);
  const [visionStatus, setVisionStatus] = useState<'ready' | 'fallback' | 'pending'>('pending');
  const [visionPointCount, setVisionPointCount] = useState(0);
  const [visionProvider, setVisionProvider] = useState<'faceDetect' | 'none'>('none');

  const frameListenerRef = useRef<{ start?: (options?: unknown) => void; stop?: () => void } | null>(null);
  const visionSessionRef = useRef<FaceDetectionSession | null>(null);
  const previousSampleRef = useRef<Uint8ClampedArray | null>(null);
  const previousVisionPointsRef = useRef<number[] | null>(null);
  const previousVisionYawRef = useRef(0);
  const baselineYawRef = useRef(0);
  const visionBusyRef = useRef(false);
  const lastVisionAtRef = useRef(0);
  const faceTelemetryRef = useRef<VisionFaceTelemetry | null>(null);
  const actionStateRef = useRef<ActionState>(createActionState());
  const visionStatusRef = useRef<'ready' | 'fallback' | 'pending'>('pending');
  const stepIndexRef = useRef(0);
  const framesRef = useRef<string[]>([]);
  const completingRef = useRef(false);
  const navigatingRef = useRef(false);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = useMemo(() => Math.min(100, Math.round(((frames.length + holdProgress / 100) / steps.length) * 100)), [frames.length, holdProgress]);
  const finished = Boolean(result);

  async function loadRecords() {
    try {
      const nextRecords = await getMentalScreenings(familyId, elderlyId, 8);
      setRecords(nextRecords);
    } catch {
      setRecords([]);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    visionStatusRef.current = visionStatus;
  }, [visionStatus]);

  function updateVisionTelemetry(result: VisionDetectResult | null, frame?: { width?: number; height?: number }) {
    if (!result) {
      faceTelemetryRef.current = null;
      setVisionPointCount(0);
      return null;
    }

    const face = pickFacePayload(result);
    const points = extractLandmarks(face);
    setVisionPointCount(Math.floor(points.length / 2));
    const angles = extractAngles(face);
    const landmarkMotion = meanPointMotion(points, previousVisionPointsRef.current);
    const yawDelta = Math.abs(angles.yaw - previousVisionYawRef.current);
    const pointBox = getPointBox(points, frame?.width, frame?.height);
    if (points.length) {
      previousVisionPointsRef.current = points;
    }
    previousVisionYawRef.current = angles.yaw;

    const confidence = toNumber(face.confidence, toNumber(face.score, points.length ? 1 : 0));
    const telemetry: VisionFaceTelemetry = {
      valid: points.length >= 8,
      confidence,
      yaw: angles.yaw,
      pitch: angles.pitch,
      roll: angles.roll,
      yawDelta,
      landmarkMotion,
      centerOffset: pointBox.centerOffset,
      faceRatio: pointBox.faceRatio,
      inFrame: pointBox.inFrame,
      detectedAt: Date.now(),
    };
    faceTelemetryRef.current = telemetry;
    return telemetry;
  }

  function scheduleVisionDetect(frame: { data: ArrayBuffer; width?: number; height?: number }) {
    const session = visionSessionRef.current;
    const now = Date.now();
    if (!session || visionBusyRef.current || now - lastVisionAtRef.current < 180) {
      return;
    }

    visionBusyRef.current = true;
    lastVisionAtRef.current = now;
    void detectVisionFace(session, frame).then((response) => {
      const telemetry = updateVisionTelemetry(response, frame);
      if (!telemetry?.valid) {
        faceTelemetryRef.current = null;
        setVisionPointCount(0);
      }
    }).finally(() => {
      visionBusyRef.current = false;
    });
  }

  function stopDetectionSession() {
    try {
      frameListenerRef.current?.stop?.();
    } catch {
      // Ignore native cleanup errors while the camera page is being destroyed.
    }
    frameListenerRef.current = null;
    try {
      visionSessionRef.current?.stop?.();
      visionSessionRef.current?.destroy?.();
    } catch {
      // Ignore native cleanup errors while leaving the route.
    }
    visionSessionRef.current = null;
    visionBusyRef.current = false;
  }

  async function leaveToHome() {
    if (navigatingRef.current) {
      return;
    }
    navigatingRef.current = true;
    stopDetectionSession();
    setAgreed(false);

    await new Promise((resolve) => setTimeout(resolve, 120));
    try {
      const pages = Taro.getCurrentPages?.() || [];
      if (pages.length > 1) {
        await Taro.navigateBack({ delta: 1 });
        return;
      }
      await Taro.reLaunch({ url: '/pages/elderly/home/index' });
    } catch {
      try {
        await Taro.reLaunch({ url: '/pages/elderly/home/index' });
      } catch {
        navigatingRef.current = false;
      }
    }
  }

  async function completeCurrentStep(stats: FrameStats) {
    if (completingRef.current || submitting || finished) {
      return;
    }

    try {
      completingRef.current = true;
      setSubmitting(true);
      setScanStatus('动作已完成，正在采集关键帧');
      const framePath = await takePhoto('mentalCamera');
      const nextFrames = [...framesRef.current, framePath];
      setFrames(nextFrames);

      if (nextFrames.length < steps.length) {
        setStepIndex(nextFrames.length);
        actionStateRef.current = createActionState();
        previousSampleRef.current = null;
        baselineYawRef.current = faceTelemetryRef.current?.yaw || 0;
        setHoldProgress(0);
        setScanStatus('请按提示完成下一个动作');
        Taro.vibrateShort({ type: 'light' }).catch(() => undefined);
        return;
      }

      stopDetectionSession();
      Taro.showLoading({ title: '正在分析', mask: true });
      const livenessScore = Math.min(100, 74 + nextFrames.length * 5 + Math.round(stats.motion));
      const nextResult = await submitLiveMentalScreening({
        filePath: framePath,
        familyId,
        elderlyId,
        frameCount: nextFrames.length,
        completedActions: nextFrames.length,
        livenessScore,
        qualityScore: stats.qualityScore,
      });
      setResult(nextResult);
      setRecords((current) => [nextResult, ...current.filter((item) => item.id !== nextResult.id)].slice(0, 8));
      Taro.showToast({ title: '筛查完成', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '采集失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      Taro.hideLoading();
      setSubmitting(false);
      completingRef.current = false;
    }
  }

  function resetActionCounters(action: ActionState) {
    action.stableSince = 0;
    action.holdStartedAt = 0;
    action.motionStartedAt = 0;
    action.motionHitCount = 0;
    action.motionSeen = false;
    action.motionSeenAt = 0;
  }

  function evaluateAction(mode: StepMode, stats: FrameStats) {
    const now = Date.now();
    const action = actionStateRef.current;
    action.stepStartedAt = action.stepStartedAt || now;
    const currentKey = steps[stepIndexRef.current]?.key as StepKey | undefined;
    const usable = isFrameUsable(stats);

    if (!usable) {
      resetActionCounters(action);
      setHoldProgress(0);
      setScanStatus(stats.brightness < 38 ? '环境偏暗，请靠近光源' : '画面过亮，请避开强光');
      return;
    }

    const face = faceTelemetryRef.current;
    const faceFresh = Boolean(face?.valid && now - face.detectedAt < 900);
    const currentVisionStatus = visionStatusRef.current;
    if (currentVisionStatus !== 'ready') {
      resetActionCounters(action);
      setHoldProgress(0);
      setScanStatus(currentVisionStatus === 'pending' ? '正在启动人脸关键点模型' : '当前微信版本暂不支持端侧关键点检测');
      return;
    }

    if (!faceFresh || !face) {
      resetActionCounters(action);
      setHoldProgress(0);
      setScanStatus('请将面部放入取景框');
      return;
    }

    if (!face.inFrame) {
      resetActionCounters(action);
      setHoldProgress(0);
      setScanStatus(face.faceRatio < 0.18 ? '请靠近一点，将脸放入圆框' : face.faceRatio > 0.92 ? '请离远一点，保持完整面部' : '请将面部移到圆框中央');
      return;
    }

    const centeredFace = Math.abs(face.yaw) < 24 && Math.abs(face.pitch) < 24 && Math.abs(face.roll) < 28;
    const faceStill = face.landmarkMotion < 7 && face.yawDelta < 12;
    const stable = stats.motion < 22 && centeredFace && faceStill;
    const yawFromBaseline = Math.abs(face.yaw - baselineYawRef.current);
    const blinkMotion = currentKey === 'blink' && centeredFace && face.landmarkMotion > 2.2 && face.yawDelta < 12;
    const turnMotion = currentKey === 'turn' && (Math.abs(face.yaw) > 14 || yawFromBaseline > 12 || face.yawDelta > 8);
    const motionHit = currentKey === 'turn' ? turnMotion : blinkMotion;
    if (stable) {
      action.stableSince = action.stableSince || now;
    } else {
      action.stableSince = 0;
    }

    if (motionHit) {
      if (!action.motionStartedAt || now - action.lastMotionAt > 450) {
        action.motionStartedAt = now;
        action.motionHitCount = 0;
      }
      action.motionHitCount += 1;
      action.lastMotionAt = now;
      if (action.motionHitCount >= 2 && now - action.motionStartedAt >= 180) {
        action.motionSeen = true;
        action.motionSeenAt = now;
      }
    } else if (now - action.lastMotionAt > 350) {
      action.motionStartedAt = 0;
      action.motionHitCount = 0;
    }

    if (mode === 'stable') {
      const elapsed = action.stableSince ? now - action.stableSince : 0;
      setHoldProgress(Math.min(100, Math.round((elapsed / 1500) * 100)));
      setScanStatus(stable ? '识别成功，请保持' : '请正对屏幕并保持不动');
      if (elapsed >= 1500) {
        void completeCurrentStep(stats);
      }
      return;
    }

    if (mode === 'hold') {
      if (stable) {
        action.holdStartedAt = action.holdStartedAt || now;
      } else {
        action.holdStartedAt = 0;
      }
      const elapsed = action.holdStartedAt ? now - action.holdStartedAt : 0;
      setHoldProgress(Math.min(100, Math.round((elapsed / 3000) * 100)));
      setScanStatus(stable ? `保持中 ${Math.ceil(Math.max(0, 3000 - elapsed) / 1000)} 秒` : '请保持面部稳定');
      if (elapsed >= 3000) {
        void completeCurrentStep(stats);
      }
      return;
    }

    if (mode === 'motion') {
      setHoldProgress(action.motionSeen ? 100 : Math.min(80, action.motionHitCount * 36));
      setScanStatus(action.motionSeen ? '动作已完成' : currentKey === 'turn' ? '请缓慢转头，不要离开圆框' : '请眨眨眼，不要转头');
      if (action.motionSeen && now - action.motionSeenAt > 260) {
        void completeCurrentStep(stats);
      }
    }
  }

  function handleCameraFrame(frame: { data: ArrayBuffer; width?: number; height?: number }) {
    if (completingRef.current || result) {
      return;
    }

    const { stats, sample } = getFrameStats(frame.data, previousSampleRef.current);
    previousSampleRef.current = sample;
    scheduleVisionDetect(frame);
    evaluateAction(steps[stepIndexRef.current]?.mode || 'stable', stats);
  }

  useEffect(() => {
    if (!agreed || result) {
      stopDetectionSession();
      return undefined;
    }

    let active = true;
    const timer = setTimeout(() => {
      try {
        const camera = Taro.createCameraContext('mentalCamera');
        const listener = (camera as unknown as {
          onCameraFrame?: (callback: (frame: { data: ArrayBuffer; width: number; height: number }) => void) => {
            start?: (options?: unknown) => void;
            stop?: () => void;
          };
        }).onCameraFrame?.((frame) => handleCameraFrame(frame));

        if (listener?.start) {
          listener.start({});
          frameListenerRef.current = listener;
          setScanStatus('正在启动人脸关键点模型');
          void createFaceDetectionSession().then((session) => {
            if (!active) {
              try {
                session?.stop?.();
                session?.destroy?.();
              } catch {
                // Ignore native cleanup errors after route teardown.
              }
              return;
            }
            visionSessionRef.current = session;
            setVisionProvider(session?.provider || 'none');
            visionStatusRef.current = session ? 'ready' : 'fallback';
            baselineYawRef.current = faceTelemetryRef.current?.yaw || 0;
            setVisionStatus(session ? 'ready' : 'fallback');
            setScanStatus(session ? '正在检测微信人脸关键点' : '当前微信版本暂不支持端侧人脸检测');
          }).catch(() => {
            if (!active) {
              return;
            }
            setVisionProvider('none');
            visionStatusRef.current = 'fallback';
            setVisionStatus('fallback');
            setScanStatus('人脸关键点模型启动失败');
          });
        } else {
          setScanStatus('当前环境不支持实时帧检测，请使用微信真机预览');
        }
      } catch {
        setScanStatus('摄像头检测启动失败，请检查授权');
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
      stopDetectionSession();
    };
  }, [agreed, result]);

  function resetScreening() {
    stopDetectionSession();
    previousSampleRef.current = null;
    previousVisionPointsRef.current = null;
    previousVisionYawRef.current = 0;
    baselineYawRef.current = 0;
    faceTelemetryRef.current = null;
    visionStatusRef.current = 'pending';
    setVisionStatus('pending');
    setVisionPointCount(0);
    setVisionProvider('none');
    actionStateRef.current = createActionState();
    completingRef.current = false;
    navigatingRef.current = false;
    setStepIndex(0);
    setFrames([]);
    setResult(null);
    setScanStatus('正在检测画面质量');
    setHoldProgress(0);
  }

  if (result) {
    const visibleRecords = records.length ? records : [result];
    return (
      <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
        <View className='ef-topbar ef-topbar--sticky'>
          <Text className='ef-topbar__back' onClick={() => void leaveToHome()}>〈</Text>
          <Text className='ef-topbar__title'>心理关怀检测</Text>
        </View>

        <View className='mh-record-page'>
          <View className={`mh-record-hero mh-record-hero--${getRiskTone(result.risk_level)}`}>
            <Text className='mh-record-hero__label'>{result.status_label}</Text>
            <Text className='mh-record-hero__score'>{result.risk_score}</Text>
            <Text className='mh-record-hero__summary'>{result.summary}</Text>
            <Text className='mh-record-hero__tip'>{result.recommendation}</Text>
          </View>

          <View className='mh-record-section'>
            <View className='ef-section-head'>
              <Text className='ef-section-title'>检测记录</Text>
              <Text className='ef-muted'>{visibleRecords.length}条</Text>
            </View>
            <View className='mh-record-list'>
              {visibleRecords.map((item) => (
                <View className={`mh-record-card mh-record-card--${getRiskTone(item.risk_level)}`} key={item.id}>
                  <View className='mh-record-card__top'>
                    <Text>{item.status_label}</Text>
                    <Text>{formatDateTimeText(item.created_at)}</Text>
                  </View>
                  <Text className='mh-record-card__summary'>{item.summary}</Text>
                  <Text className='mh-record-card__tip'>建议：{item.recommendation}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text className='mh-record-disclaimer'>{result.disclaimer}</Text>
          <Button className='mh-primary-button' onClick={resetScreening}>再次检测</Button>
          <Button className='mh-ghost-button' onClick={() => void leaveToHome()}>返回首页</Button>
        </View>
      </View>
    );
  }

  if (!agreed) {
    return (
      <View className={`ef-page ef-page--sub ${preferenceClassName}`}>
        <View className='ef-topbar ef-topbar--sticky'>
          <Text className='ef-topbar__back' onClick={() => void leaveToHome()}>〈</Text>
          <Text className='ef-topbar__title'>心理关怀检测</Text>
        </View>

        <View className='mh-consent'>
          <View className='mh-consent__icon'>心</View>
          <Text className='mh-title'>现场心理关怀筛查</Text>
          <Text className='mh-desc'>
            本功能会像实名认证一样打开摄像头，现场检测动作完成情况，并自动生成关怀建议。
          </Text>
          <View className='mh-consent-card'>
            <Text>· 结果仅用于健康关怀提醒，不作为医学诊断。</Text>
            <Text>· 第一阶段只保存筛查摘要，原始图片不在前端长期保存。</Text>
            <Text>· 系统会按动作提示自动完成采集，无需手动拍摄。</Text>
          </View>
          <Button className='mh-primary-button' onClick={() => setAgreed(true)}>我同意并开始采集</Button>
          <Button className='mh-ghost-button' onClick={() => void leaveToHome()}>暂不检测</Button>
        </View>
      </View>
    );
  }

  return (
    <View className={`mh-page ${preferenceClassName}`}>
      <Camera
        id='mentalCamera'
        className='mh-camera'
        devicePosition='front'
        flash='off'
        onError={() => Taro.showToast({ title: '摄像头不可用，请检查授权', icon: 'none' })}
      />

      <View className='mh-camera-mask'>
        <View className='mh-topbar'>
          <Text onClick={() => void leaveToHome()}>〈 返回</Text>
          <Text>活体核验</Text>
        </View>

        <View className={`mh-face-ring ${visionStatus === 'ready' && faceTelemetryRef.current?.inFrame ? 'mh-face-ring--active' : ''}`}>
          <View className='mh-face-ring__inner' />
        </View>

        <View className='mh-control-panel'>
          <View className='mh-verify-steps'>
            {steps.map((item, index) => (
              <View
                className={index < frames.length ? 'mh-verify-step mh-verify-step--done' : index === stepIndex ? 'mh-verify-step mh-verify-step--active' : 'mh-verify-step'}
                key={item.key}
              >
                <Text>{index < frames.length ? '✓' : index + 1}</Text>
              </View>
            ))}
          </View>

          <Text className='mh-step-title'>{currentStep.title}</Text>
          <Text className='mh-step-hint'>{currentStep.hint}</Text>

          <View className='mh-live-card'>
            <View className='mh-live-card__row'>
              <Text>{submitting ? '正在处理' : scanStatus}</Text>
              <Text>{holdProgress}%</Text>
            </View>
            <View className='mh-live-progress'>
              <View className='mh-live-progress__fill' style={{ width: `${holdProgress}%` }} />
            </View>
            <View className='mh-live-metrics'>
              <Text>{visionStatus === 'ready' ? '已连接' : '连接中'}</Text>
              <Text>{visionProvider === 'faceDetect' ? '微信人脸' : '模型准备中'}</Text>
              <Text>{visionPointCount ? `${visionPointCount} 点` : '等待人脸'}</Text>
            </View>
          </View>

          <View className='mh-total-progress'>
            <View className='mh-total-progress__fill' style={{ width: `${progress}%` }} />
          </View>

          <Button className='mh-ghost-button' disabled={submitting} onClick={resetScreening}>重新核验</Button>
          <Text className='mh-privacy-tip'>请由本人完成核验，过程中不要遮挡面部或离开取景框。</Text>
        </View>
      </View>
    </View>
  );
}
