import {
  User,
  UserRole,
  Course,
  CoursePost,
  PostComment,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizSubmission,
  StudentProgress,
  CertificateData,
  NotificationItem,
  AttendanceSession,
  AttendanceStatus,
  AttendanceRecord,
} from '../types/classroom';
import { SupabaseService, NOTIFICATION_TTL_MS } from './supabase';
import {
  encryptPassword,
  decryptPassword,
  verifyPassword,
  isEncryptedPassword,
  getEncryptedHashFingerprint,
} from '../utils/passwordCrypto';
import {
  INITIAL_USERS,
  INITIAL_COURSES,
  INITIAL_POSTS,
  INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS,
  INITIAL_QUIZZES,
  INITIAL_QUIZ_SUBMISSIONS,
  INITIAL_PROGRESS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ATTENDANCE_SESSIONS,
} from '../data/mockData';

const STORAGE_KEYS = {
  CURRENT_USER: 'classroom_current_user',
  USERS: 'classroom_users',
  COURSES: 'classroom_courses',
  POSTS: 'classroom_posts',
  ASSIGNMENTS: 'classroom_assignments',
  SUBMISSIONS: 'classroom_submissions',
  QUIZZES: 'classroom_quizzes',
  QUIZ_SUBMISSIONS: 'classroom_quiz_submissions',
  PROGRESS: 'classroom_progress',
  NOTIFICATIONS: 'classroom_notifications',
  ATTENDANCE: 'classroom_attendance_sessions',
  RATE_LIMITS: 'classroom_rate_limits',
  SECURITY_SETTINGS: 'classroom_security_settings',
  THEME: 'classroom_theme',
  DELETED_IDS: 'classroom_deleted_ids',
  DEVICE_ID: 'classroom_os_device_id_v1',
  SESSION_TOKEN: 'classroom_os_session_token_v1',
  RECENT_WRITES: 'classroom_os_recent_writes_v1',
  CLOUD_SYNCED: 'classroom_os_cloud_synced_v1',
  KICK_REASON: 'classroom_os_kick_reason_v1',
  NOTIFIED_POST_IDS: 'classroom_os_notified_post_ids_v1',
};

// Rate limiting in-memory / storage tracker
interface RateLimitBucket {
  timestamps: number[];
}

export interface SecuritySettings {
  textProtectionEnabled: boolean; // disable selection and right click
  dynamicWatermarkEnabled: boolean;
  watermarkOpacity: number; // 0.15 - 0.40
  domainRestriction: string;
}

export class ClassroomDB {
  // Fast O(1) in-memory cache to eliminate repeated localStorage JSON.parse calls during high-traffic UI renders
  private static memoryCache = new Map<string, unknown>();
  // O(1) memoized attendance stats cache for 2,000+ student lists (invalidated on attendance mutation)
  private static attendanceStatsCache = new Map<
    string,
    {
      totalSessions: number;
      presentCount: number;
      lateCount: number;
      excusedCount: number;
      absentCount: number;
      percentage: number;
    }
  >();
  private static storageListenerAttached = false;

  private static ensureStorageListener(): void {
    if (this.storageListenerAttached || typeof window === 'undefined') return;
    this.storageListenerAttached = true;
    window.addEventListener('storage', (e) => {
      if (e.key) {
        this.memoryCache.delete(e.key);
        if (e.key === STORAGE_KEYS.ATTENDANCE) {
          this.attendanceStatsCache.clear();
        }
      } else {
        this.memoryCache.clear();
        this.attendanceStatsCache.clear();
      }
    });
  }

  private static getItem<T>(key: string, defaultValue: T): T {
    this.ensureStorageListener();
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      const parsed = JSON.parse(item) as T;
      this.memoryCache.set(key, parsed);
      return parsed;
    } catch {
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    this.ensureStorageListener();
    this.memoryCache.set(key, value);
    if (key === STORAGE_KEYS.ATTENDANCE) {
      this.attendanceStatsCache.clear();
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage quota exceeded or error writing:', e);
    }
  }

  private static getDeletedIds(): string[] {
    return this.getItem<string[]>(STORAGE_KEYS.DELETED_IDS, []);
  }

  private static recordDeletedIds(ids: string[]): void {
    if (!ids.length) return;
    const current = new Set(this.getDeletedIds());
    ids.forEach((id) => current.add(id));
    // Bound DELETED_IDS to the latest 800 items so localStorage stays lean
    const bounded = Array.from(current).slice(-800);
    this.setItem(STORAGE_KEYS.DELETED_IDS, bounded);
  }

  static getDeviceId(): string {
    try {
      let devId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!devId) {
        devId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, devId);
      }
      return devId;
    } catch {
      return 'dev-fallback-local';
    }
  }

  static getSessionToken(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) || '';
    } catch {
      return '';
    }
  }

  private static generateAndSaveSessionToken(): string {
    const token = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    } catch {
      // ignore
    }
    return token;
  }

  static setKickReason(reason: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.KICK_REASON, reason);
    } catch {
      // ignore
    }
  }

  static consumeKickReason(): string | null {
    try {
      const reason = localStorage.getItem(STORAGE_KEYS.KICK_REASON);
      if (reason) {
        localStorage.removeItem(STORAGE_KEYS.KICK_REASON);
      }
      return reason;
    } catch {
      return null;
    }
  }

  private static markLocalWrite(id: string): void {
    if (!id) return;
    const now = Date.now();
    const map = this.getItem<Record<string, number>>(STORAGE_KEYS.RECENT_WRITES, {});
    const next: Record<string, number> = { [id]: now };
    for (const [k, ts] of Object.entries(map)) {
      if (now - ts < 30_000) {
        next[k] = ts;
      }
    }
    this.setItem(STORAGE_KEYS.RECENT_WRITES, next);
  }

  private static isRecentLocalWrite(id: string, maxAgeMs: number = 25_000): boolean {
    if (!id) return false;
    const map = this.getItem<Record<string, number>>(STORAGE_KEYS.RECENT_WRITES, {});
    const ts = map[id];
    if (!ts) return false;
    return Date.now() - ts < maxAgeMs;
  }

  // Init default storage (Non-destructive: preserves live user data across all future AI Studio updates)
  static init(): void {
    const isCloudSynced = localStorage.getItem(STORAGE_KEYS.CLOUD_SYNCED) === 'true';
    const deletedSet = new Set(this.getDeletedIds());

    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      this.setItem(
        STORAGE_KEYS.USERS,
        INITIAL_USERS.filter((u) => !deletedSet.has(u.id)).map((u) => ({
          ...u,
          avatar: u.role === 'student' ? '' : u.avatar,
          password: encryptPassword(u.password, u.role, u.id),
        }))
      );
    } else {
      // Ensure existing local student accounts never retain any profile photo
      // and automatically encrypt any legacy plaintext passwords into ENC_V1 ciphertext
      const existingUsers = this.getItem<User[]>(STORAGE_KEYS.USERS, []);
      let usersChanged = false;
      const upgradedUsersForCloud: User[] = [];
      const sanitizedUsers = existingUsers.map((u) => {
        const shouldStripAvatar = u.role === 'student' && Boolean(u.avatar);
        const needsEncryption = !isEncryptedPassword(u.password);
        if (shouldStripAvatar || needsEncryption) {
          usersChanged = true;
          const upgraded: User = {
            ...u,
            avatar: u.role === 'student' ? '' : u.avatar,
            password: encryptPassword(u.password, u.role, u.id),
          };
          if (needsEncryption) {
            upgradedUsersForCloud.push(upgraded);
          }
          return upgraded;
        }
        return u;
      });
      if (usersChanged) {
        this.setItem(STORAGE_KEYS.USERS, sanitizedUsers);
        // Push migrated encrypted passwords to Supabase in the background
        upgradedUsersForCloud.forEach((u) => {
          try {
            SupabaseService.upsertProfile(u).catch(() => {});
          } catch {
            // ignore
          }
        });
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.COURSES)) {
      this.setItem(
        STORAGE_KEYS.COURSES,
        isCloudSynced ? [] : INITIAL_COURSES.filter((c) => !deletedSet.has(c.id))
      );
    } else {
      // Upgrade any legacy local /src/assets/images/ banner paths to the new classroom header photos
      const existingCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, []);
      let coursesChanged = false;
      const upgradedCourses = existingCourses.map((c) => {
        if (!c.bannerImage || c.bannerImage.startsWith('/src/assets/images/')) {
          coursesChanged = true;
          const nextBanner =
            c.id === 'course-data-sci'
              ? 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&h=300&fit=crop&q=85'
              : c.id === 'course-cyber-sec'
              ? 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=300&fit=crop&q=85'
              : 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=300&fit=crop&q=85';
          return { ...c, bannerImage: nextBanner };
        }
        return c;
      });
      if (coursesChanged) {
        this.setItem(STORAGE_KEYS.COURSES, upgradedCourses);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      this.setItem(
        STORAGE_KEYS.POSTS,
        isCloudSynced ? [] : INITIAL_POSTS.filter((p) => !deletedSet.has(p.id))
      );
    } else {
      // Remove legacy demo scheduled post-103 if present so it never loops notifications
      const existingPosts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, []);
      if (existingPosts.some((p) => p.id === 'post-103')) {
        this.setItem(
          STORAGE_KEYS.POSTS,
          existingPosts.filter((p) => p.id !== 'post-103')
        );
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) {
      this.setItem(
        STORAGE_KEYS.ASSIGNMENTS,
        isCloudSynced ? [] : INITIAL_ASSIGNMENTS.filter((a) => !deletedSet.has(a.id))
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      this.setItem(
        STORAGE_KEYS.SUBMISSIONS,
        isCloudSynced ? [] : INITIAL_SUBMISSIONS.filter((s) => !deletedSet.has(s.id))
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUIZZES)) {
      this.setItem(
        STORAGE_KEYS.QUIZZES,
        isCloudSynced ? [] : INITIAL_QUIZZES.filter((q) => !deletedSet.has(q.id))
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUIZ_SUBMISSIONS)) {
      this.setItem(
        STORAGE_KEYS.QUIZ_SUBMISSIONS,
        isCloudSynced ? [] : INITIAL_QUIZ_SUBMISSIONS.filter((qs) => !deletedSet.has(qs.id))
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROGRESS)) {
      this.setItem(STORAGE_KEYS.PROGRESS, isCloudSynced ? [] : INITIAL_PROGRESS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, isCloudSynced ? [] : INITIAL_NOTIFICATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      this.setItem(
        STORAGE_KEYS.ATTENDANCE,
        isCloudSynced ? [] : INITIAL_ATTENDANCE_SESSIONS.filter((att) => !deletedSet.has(att.id))
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS)) {
      const defaultSec: SecuritySettings = {
        textProtectionEnabled: true,
        dynamicWatermarkEnabled: true,
        watermarkOpacity: 0.22,
        domainRestriction: 'www.swanarhclassroom.online',
      };
      this.setItem(STORAGE_KEYS.SECURITY_SETTINGS, defaultSec);
    }
    // Initialize persistent device ID & theme
    this.getDeviceId();
    this.setTheme(this.getTheme());
  }

  // Theme Management
  static getTheme(): 'light' | 'dark' {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  static setTheme(theme: 'light' | 'dark'): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch {
      // ignore
    }
  }

  // Reset database to initial state
  static resetAll(): void {
    this.memoryCache.clear();
    localStorage.clear();
    this.init();
  }

  // Security Settings
  static getSecuritySettings(): SecuritySettings {
    return this.getItem<SecuritySettings>(STORAGE_KEYS.SECURITY_SETTINGS, {
      textProtectionEnabled: true,
      dynamicWatermarkEnabled: true,
      watermarkOpacity: 0.22,
      domainRestriction: window.location.host,
    });
  }

  static updateSecuritySettings(settings: Partial<SecuritySettings>): SecuritySettings {
    const current = this.getSecuritySettings();
    const updated = { ...current, ...settings };
    this.setItem(STORAGE_KEYS.SECURITY_SETTINGS, updated);
    return updated;
  }

  // Rate Limiting (Sliding Window Algorithm)
  static checkRateLimit(
    actionKey: string,
    userId: string,
    limit: number = 8,
    windowSeconds: number = 60
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const bucketKey = `${actionKey}:${userId}`;
    const allBuckets = this.getItem<Record<string, number[]>>(STORAGE_KEYS.RATE_LIMITS, {});

    const history = (allBuckets[bucketKey] || []).filter((timestamp) => now - timestamp < windowMs);

    if (history.length >= limit) {
      const oldestInWindow = history[0];
      const retryAfterSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    // Add current timestamp and save
    history.push(now);
    allBuckets[bucketKey] = history;
    this.setItem(STORAGE_KEYS.RATE_LIMITS, allBuckets);

    return {
      allowed: true,
      remaining: limit - history.length,
      retryAfterSeconds: 0,
    };
  }

  // Current User & Authentication
  static getCurrentUser(): User | null {
    this.init();
    const storedUser = this.getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!storedUser) return null;

    // Verify user still exists in database and keep session profile fresh (without exposing plaintext password in session state)
    const allUsers = this.getAllUsers();
    const freshUser = allUsers.find((u) => u.id === storedUser.id);
    if (!freshUser) {
      this.memoryCache.delete(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return null;
    }
    const { password: _pwd, ...safeUser } = freshUser;
    return safeUser;
  }

  static setCurrentUser(user: User | null): void {
    if (user === null) {
      this.memoryCache.delete(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      const { password: _pwd, ...safeSessionUser } = user;
      this.setItem(STORAGE_KEYS.CURRENT_USER, safeSessionUser);
    }
  }

  static logout(): void {
    const storedUser = this.getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    this.memoryCache.delete(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);

    // Only mark activeDeviceId as LOGGED_OUT for student accounts (since Admin/Co-Admin can be active on multiple devices simultaneously)
    if (storedUser && storedUser.role === 'student') {
      const allUsers = this.getAllUsers();
      const idx = allUsers.findIndex((u) => u.id === storedUser.id);
      const baseUser = idx >= 0 ? allUsers[idx] : storedUser;
      const unlockedUser: User = {
        ...baseUser,
        avatar: '',
        activeDeviceId: 'LOGGED_OUT',
        activeSessionToken: '',
        sessionUpdatedAtMs: Date.now(),
      };
      if (idx >= 0) {
        allUsers[idx] = unlockedUser;
        this.setItem(STORAGE_KEYS.USERS, allUsers);
      }
      this.markLocalWrite(unlockedUser.id);
      try {
        SupabaseService.upsertProfile(unlockedUser).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  private static forceLocalLogoutWithReason(reason: string): void {
    this.memoryCache.delete(STORAGE_KEYS.CURRENT_USER);
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    } catch {
      // ignore
    }
    this.setKickReason(reason);
  }

  private static verifyCredentialsOnly(
    identifier: string,
    password: string,
    expectedRole?: UserRole
  ): { user: User | null; error?: string } {
    this.init();

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPwd = (password || '').trim();

    if (!cleanId || !cleanPwd) {
      return {
        user: null,
        error: 'Username နှင့် Password နှစ်ခုလုံး ပြည့်စုံစွာ ရိုက်ထည့်ပေးပါ။',
      };
    }

    const allUsers = this.getAllUsers();
    const matched = allUsers.find(
      (u) => u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId
    );

    const genericAuthError =
      'Username သို့မဟုတ် Password မှားယွင်းနေပါသည်။ ကျေးဇူးပြု၍ သေချာစွာ ပြန်လည်စစ်ဆေးပြီး ဝင်ရောက်ပါ။ (Invalid username or password)';

    if (!matched) {
      return {
        user: null,
        error: genericAuthError,
      };
    }

    if (! verifyPassword(cleanPwd, matched.password, matched.role)) {
      return {
        user: null,
        error: genericAuthError,
      };
    }

    if (expectedRole && matched.role !== expectedRole) {
      return {
        user: null,
        error:
          'ရွေးချယ်ထားသော အကောင့်အမျိုးအစား (Role Tab) နှင့် ကိုက်ညီမှု မရှိပါ။ သက်ဆိုင်ရာ Login Tab ကို ပြောင်းလဲရွေးချယ်ပြီး ဝင်ရောက်ပါ။',
      };
    }

    return { user: matched };
  }

  /**
   * Decrypts a user's stored ENC_V1 ciphertext password in memory for authorized Admin / Co-Admin inspection or credential copy.
   */
  static getDecryptedPassword(user: User): string {
    return decryptPassword(user.password, user.role);
  }

  /**
   * Returns a short cryptographic fingerprint (e.g., ENC_V1:9f3a2b…e491c0) of the user's encrypted password.
   */
  static getPasswordFingerprint(user: User): string {
    return getEncryptedHashFingerprint(user.password, user.role, user.id);
  }

  static login(
    identifier: string,
    password: string,
    expectedRole?: UserRole,
    forceTakeover: boolean = false
  ): { user: User | null; deviceLocked?: boolean; error?: string } {
    const cleanId = (identifier || '').trim().toLowerCase();
    const rateCheck = this.checkRateLimit('auth_login', cleanId || 'ip', 8, 60);
    if (!rateCheck.allowed) {
      return {
        user: null,
        error: `လုံခြုံရေးအရ ဝင်ရောက်ရန် ကြိုးပမ်းမှု များပြားနေပါသည်။ ${rateCheck.retryAfterSeconds} စက္ကန့် စောင့်ဆိုင်းပြီးမှ ပြန်လည်ကြိုးစားပါ။`,
      };
    }

    const check = this.verifyCredentialsOnly(identifier, password, expectedRole);
    if (!check.user) {
      return { user: null, error: check.error };
    }

    const matched = check.user;
    const localDeviceId = this.getDeviceId();
    const activeDev = matched.activeDeviceId || '';

    // Enforce Single-Device Policy (1 Account = 1 Device Only) STRICTLY FOR STUDENTS ONLY.
    // Admin and Co-Admin accounts are allowed to log in on multiple devices simultaneously.
    if (
      matched.role === 'student' &&
      activeDev &&
      activeDev !== 'LOGGED_OUT' &&
      activeDev !== localDeviceId &&
      !forceTakeover
    ) {
      return {
        user: null,
        deviceLocked: true,
        error:
          'ဤကျောင်းသားအကောင့်သည် အခြားစက် (Device) တစ်ခုတွင် လက်ရှိ Login ဝင်ရောက်သုံးစွဲနေပါသည်။ ကျောင်းသားအကောင့်တစ်ခုလျှင် စက်တစ်ခုတည်းသာ (1 Student Account = 1 Device Only) အသုံးပြုခွင့်ရှိပါသည်။ ပထမစက်မှ Logout အရင်ထွက်ပေးပါ သို့မဟုတ် အောက်ပါခလုတ်ဖြင့် အခြားစက်မှ အကောင့်ထွက်ပြီး ဤစက်တွင် ပြောင်းလဲဝင်ရောက်ပါ။',
      };
    }

    const sessionToken = this.generateAndSaveSessionToken();
    const stampedUser: User = {
      ...matched,
      avatar: matched.role === 'student' ? '' : matched.avatar,
      ...(matched.role === 'student'
        ? {
            activeDeviceId: localDeviceId,
            activeSessionToken: sessionToken,
            sessionUpdatedAtMs: Date.now(),
          }
        : {}),
    };

    const allUsers = this.getAllUsers();
    const idx = allUsers.findIndex((u) => u.id === stampedUser.id);
    if (idx >= 0) {
      allUsers[idx] = stampedUser;
      this.setItem(STORAGE_KEYS.USERS, allUsers);
    }

    this.markLocalWrite(stampedUser.id);
    this.setCurrentUser(stampedUser);
    if (stampedUser.role === 'student') {
      try {
        SupabaseService.upsertProfile(stampedUser).catch(() => {});
      } catch {
        // ignore
      }
    }

    return { user: stampedUser };
  }

  /**
   * High-Concurrency Login with Authoritative Single-Device Verification:
   * Queries the single matching profile row from Supabase (~0.3KB) to verify live credentials
   * and check whether the account is already active on another device (1 Account = 1 Device Only).
   */
  static async loginWithRemoteFallback(
    identifier: string,
    password: string,
    expectedRole?: UserRole,
    forceTakeover: boolean = false
  ): Promise<{ user: User | null; deviceLocked?: boolean; error?: string }> {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPwd = (password || '').trim();
    if (!cleanId || !cleanPwd) {
      return {
        user: null,
        error: 'Username နှင့် Password နှစ်ခုလုံး ပြည့်စုံစွာ ရိုက်ထည့်ပေးပါ။',
      };
    }

    const rateCheck = this.checkRateLimit('auth_login_remote', cleanId || 'ip', 10, 60);
    if (!rateCheck.allowed) {
      return {
        user: null,
        error: `လုံခြုံရေးအရ ဝင်ရောက်ရန် ကြိုးပမ်းမှု များပြားနေပါသည်။ ${rateCheck.retryAfterSeconds} စက္ကန့် စောင့်ဆိုင်းပြီးမှ ပြန်လည်ကြိုးစားပါ။`,
      };
    }

    // 1. Always fetch the latest single-row profile from Supabase (when online) so we see live password & activeDeviceId
    const deletedSet = new Set(this.getDeletedIds());
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      const remoteUser = await SupabaseService.getRemoteProfileByIdentifier(cleanId, true);
      if (remoteUser && !deletedSet.has(remoteUser.id)) {
        const localUsers = this.getAllUsers();
        const idx = localUsers.findIndex((u) => u.id === remoteUser.id);
        const mergedUser: User = {
          ...(idx >= 0 ? localUsers[idx] : {}),
          ...remoteUser,
          activeDeviceId: remoteUser.activeDeviceId,
          activeSessionToken: remoteUser.activeSessionToken,
          sessionUpdatedAtMs: remoteUser.sessionUpdatedAtMs,
          rulesAccepted: Boolean(remoteUser.rulesAccepted || (idx >= 0 && localUsers[idx].rulesAccepted)),
          rulesAcceptedAt: remoteUser.rulesAcceptedAt || (idx >= 0 ? localUsers[idx].rulesAcceptedAt : undefined),
          password: encryptPassword(
            remoteUser.password || (idx >= 0 ? localUsers[idx].password : undefined),
            remoteUser.role,
            remoteUser.id
          ),
        };
        if (idx >= 0) {
          localUsers[idx] = mergedUser;
        } else {
          localUsers.push(mergedUser);
        }
        this.setItem(STORAGE_KEYS.USERS, localUsers);
      }
    }

    // 2. Verify credentials and Single-Device Lock against updated user record
    const res = this.login(cleanId, cleanPwd, expectedRole, forceTakeover);
    if (res.user) {
      try {
        await SupabaseService.upsertProfile(res.user);
      } catch {
        // ignore
      }
    }
    return res;
  }

  static getAllUsers(): User[] {
    const users = this.getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return users.map((u) => (u.role === 'student' && u.avatar ? { ...u, avatar: '' } : u));
  }

  static registerNewUser(data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: UserRole;
    password?: string;
    avatar?: string;
    title?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    initialCourseId?: string;
    initialCourseIds?: string[];
  }): { user: User | null; error?: string } {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return {
        user: null,
        error: 'ခွင့်ပြုချက် မရှိပါ: အကောင့်အသစ် ဖန်တီးခွင့်သည် Admin နှင့် Co-Admin အကောင့်များအတွက်သာ ဖြစ်ပါသည်။',
      };
    }
    if (currentLogged && currentLogged.role === 'co_admin' && data.role === 'admin') {
      return {
        user: null,
        error: 'ခွင့်ပြုချက် မရှိပါ: Primary Admin အကောင့်အသစ်ကို Main Admin ကသာ ဖန်တီးနိုင်ပါသည်။',
      };
    }

    const users = this.getAllUsers();
    const cleanUsername = data.username.trim().toLowerCase();
    const cleanEmail = data.email.trim().toLowerCase();
    const defaultPwd = data.role === 'admin' ? 'admin123' : data.role === 'co_admin' ? 'coadmin123' : 'student123';
    const cleanPassword = data.password?.trim() || defaultPwd;

    // Check duplicate username or email
    const duplicate = users.find(
      (u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      return {
        user: null,
        error: `User with username "${data.username}" or email "${data.email}" already exists. (အဆိုပါ username သို့မဟုတ် email ဖြင့် အကောင့်ရှိပြီးဖြစ်ပါသည်)`,
      };
    }

    // Curated high quality avatars for Admin & Co-Admin only (Students never have profile photos)
    const avatarPool = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    ];
    const finalAvatar =
      data.role === 'student'
        ? ''
        : data.avatar?.trim() || avatarPool[users.length % avatarPool.length];

    const newUserId = `user-${data.role}-${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      name: data.name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password: encryptPassword(cleanPassword, data.role, newUserId),
      phone: data.phone.trim() || '+95 9 000 000000',
      role: data.role,
      avatar: finalAvatar,
      title: data.title?.trim() || (data.role === 'admin' ? 'Administrator' : data.role === 'co_admin' ? 'Course Coordinator & Assistant Instructor' : undefined),
      gender: data.gender || 'male',
      address: data.address?.trim() || undefined,
    };

    const updatedUsers = [...users, newUser];
    this.markLocalWrite(newUser.id);
    this.setItem(STORAGE_KEYS.USERS, updatedUsers);

    // If initialCourseIds or initialCourseId provided, enroll student into all selected courses
    const coursesToEnroll = new Set<string>();
    if (data.initialCourseId) {
      coursesToEnroll.add(data.initialCourseId);
    }
    if (data.initialCourseIds && Array.isArray(data.initialCourseIds)) {
      data.initialCourseIds.forEach((cId) => coursesToEnroll.add(cId));
    }

    coursesToEnroll.forEach((cId) => {
      this.enrollStudent(cId, newUser.id);
    });

    // Background sync to Supabase if configured
    try {
      SupabaseService.upsertProfile(newUser).catch(() => {});
    } catch {
      // ignore
    }

    return { user: newUser };
  }

  static registerNewStudent(data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    password?: string;
    avatar?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    initialCourseId?: string;
    initialCourseIds?: string[];
  }): { student: User | null; error?: string } {
    const res = this.registerNewUser({
      ...data,
      role: 'student',
    });
    return { student: res.user, error: res.error };
  }

  static updateUserProfilePicture(
    userId: string,
    avatarUrl: string
  ): { success: boolean; user?: User; error?: string } {
    const users = this.getAllUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return { success: false, error: 'User not found (အသုံးပြုသူ ရှာမတွေ့ပါ)' };
    }

    if (users[userIndex].role !== 'admin' && users[userIndex].role !== 'co_admin') {
      return {
        success: false,
        error: 'Profile photo ပြောင်းလဲခွင့်သည် Admin နှင့် Co-Admin အကောင့်များအတွက်သာ ခွင့်ပြုထားပါသည်။',
      };
    }

    users[userIndex].avatar = avatarUrl;
    this.markLocalWrite(userId);
    this.setItem(STORAGE_KEYS.USERS, users);

    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.id === userId) {
      currentLogged.avatar = avatarUrl;
      this.setCurrentUser(currentLogged);
    }

    // Immediately propagate the new Admin/Co-Admin profile picture to all their authored posts & comments
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const updatedPostsToSync: CoursePost[] = [];
    let postsChanged = false;
    const nextPosts = posts.map((p) => {
      let postModified = false;
      let nextAuthorAvatar = p.authorAvatar;
      if (p.authorId === userId && p.authorAvatar !== avatarUrl) {
        nextAuthorAvatar = avatarUrl;
        postModified = true;
      }
      const nextComments = (p.comments || []).map((c) => {
        if (c.authorId === userId && c.authorAvatar !== avatarUrl) {
          postModified = true;
          return { ...c, authorAvatar: avatarUrl };
        }
        return c;
      });
      if (postModified) {
        postsChanged = true;
        const updatedPost = { ...p, authorAvatar: nextAuthorAvatar, comments: nextComments };
        updatedPostsToSync.push(updatedPost);
        return updatedPost;
      }
      return p;
    });

    if (postsChanged) {
      this.setItem(STORAGE_KEYS.POSTS, nextPosts);
      updatedPostsToSync.forEach((up) => {
        this.markLocalWrite(up.id);
        try {
          SupabaseService.upsertPost(up).catch(() => {});
        } catch {
          // ignore
        }
      });
    }

    try {
      SupabaseService.upsertProfile(users[userIndex]).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true, user: users[userIndex] };
  }

  static acceptAcademyRules(userId: string): User | null {
    const users = this.getAllUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) return null;

    const acceptedStamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    users[userIndex] = {
      ...users[userIndex],
      rulesAccepted: true,
      rulesAcceptedAt: acceptedStamp,
    };
    this.setItem(STORAGE_KEYS.USERS, users);

    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.id === userId) {
      this.setCurrentUser(users[userIndex]);
    }

    try {
      SupabaseService.upsertProfile(users[userIndex]).catch(() => {});
    } catch {
      // ignore
    }

    return users[userIndex];
  }

  static changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const users = this.getAllUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return { success: false, error: 'အသုံးပြုသူ အကောင့် မတွေ့ရှိပါ။' };
    }

    if (!verifyPassword(oldPassword.trim(), users[userIndex].password, users[userIndex].role)) {
      return { success: false, error: 'လက်ရှိ လျှို့ဝှက်နံပါတ် (Current Password) မှားယွင်းနေပါသည်။' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'လျှို့ဝှက်နံပါတ် အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။' };
    }

    const encryptedNewPwd = encryptPassword(
      newPassword.trim(),
      users[userIndex].role,
      users[userIndex].id
    );
    users[userIndex].password = encryptedNewPwd;
    this.markLocalWrite(userId);
    this.setItem(STORAGE_KEYS.USERS, users);

    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.id === userId) {
      currentLogged.password = encryptedNewPwd;
      this.setCurrentUser(currentLogged);
    }

    try {
      SupabaseService.upsertProfile(users[userIndex]).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true };
  }

  static adminUpdateStudentPassword(
    studentId: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const currentLogged = this.getCurrentUser();
    if (!currentLogged || (currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin')) {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ (Admin သို့မဟုတ် Co-Admin သာ ပြောင်းလဲခွင့်ရှိပါသည်)။' };
    }

    const users = this.getAllUsers();
    const userIndex = users.findIndex((u) => u.id === studentId);
    if (userIndex === -1) {
      return { success: false, error: 'အကောင့် မတွေ့ရှိပါ။' };
    }

    // Prevent Co-Admin from resetting Primary Admin password
    if (currentLogged.role === 'co_admin' && users[userIndex].role === 'admin') {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ: Main Admin ၏ စကားဝှက်ကို Co-Admin မှ ပြောင်းလဲခွင့်မရှိပါ။' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'လျှို့ဝှက်နံပါတ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။' };
    }

    const encryptedNewPwd = encryptPassword(
      newPassword.trim(),
      users[userIndex].role,
      users[userIndex].id
    );
    users[userIndex].password = encryptedNewPwd;
    this.markLocalWrite(studentId);
    this.setItem(STORAGE_KEYS.USERS, users);

    if (currentLogged && currentLogged.id === studentId) {
      currentLogged.password = encryptedNewPwd;
      this.setCurrentUser(currentLogged);
    }

    try {
      SupabaseService.upsertProfile(users[userIndex]).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true };
  }

  static deleteUser(userId: string): { success: boolean; error?: string } {
    const currentLogged = this.getCurrentUser();
    if (!currentLogged || (currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin')) {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ။' };
    }

    const users = this.getAllUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'အသုံးပြုသူ မတွေ့ရှိပါ။' };
    }
    if (currentLogged.role === 'co_admin' && target.role === 'admin') {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ: Main Admin အကောင့်အား Co-Admin မှ ဖျက်ခွင့်မရှိပါ။' };
    }
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (target.role === 'admin' && adminCount <= 1) {
      return { success: false, error: 'တစ်ခုတည်းသော Primary Admin အား ဖျက်၍မရပါ။' };
    }

    const updatedUsers = users.filter((u) => u.id !== userId);
    this.setItem(STORAGE_KEYS.USERS, updatedUsers);
    this.recordDeletedIds([userId]);

    if (currentLogged && currentLogged.id === userId) {
      this.logout();
    }

    // Remove from all course enrollments
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const updatedCourses = courses.map((c) => {
      const updatedCourse = {
        ...c,
        enrolledStudentIds: c.enrolledStudentIds.filter((id) => id !== userId),
      };
      try {
        SupabaseService.upsertCourse(updatedCourse).catch(() => {});
      } catch {
        // ignore
      }
      return updatedCourse;
    });
    this.setItem(STORAGE_KEYS.COURSES, updatedCourses);

    // Clean up local student submissions, quiz submissions, progress & notifications
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const removedSubIds = submissions.filter((s) => s.studentId === userId).map((s) => s.id);
    this.recordDeletedIds(removedSubIds);
    this.setItem(
      STORAGE_KEYS.SUBMISSIONS,
      submissions.filter((s) => s.studentId !== userId)
    );

    const quizSubs = this.getItem<QuizSubmission[]>(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    this.setItem(
      STORAGE_KEYS.QUIZ_SUBMISSIONS,
      quizSubs.filter((qs) => qs.studentId !== userId)
    );

    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    this.setItem(
      STORAGE_KEYS.PROGRESS,
      allProgress.filter((p) => p.studentId !== userId)
    );

    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    this.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      notifs.filter((n) => n.userId !== userId)
    );

    // Auto-delete from Supabase SQL database
    try {
      SupabaseService.deleteProfile(userId).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true };
  }

  static deleteStudent(studentId: string): boolean {
    return this.deleteUser(studentId).success;
  }

  // Custom Classroom Ordering Helper (Admin & Co-Admin custom order reflected for all users)
  static sortCoursesByCustomOrder(courses: Course[]): Course[] {
    return courses
      .map((course, idx) => ({
        course,
        idx,
        order:
          typeof course.sortOrder === 'number' && Number.isFinite(course.sortOrder)
            ? course.sortOrder
            : idx + 1,
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.idx - b.idx;
      })
      .map((entry, normalizedIdx) => ({
        ...entry.course,
        sortOrder: normalizedIdx + 1,
      }));
  }

  // Strict Course & Class Access Control (RLS simulation)
  static getCourses(currentUser: User): Course[] {
    const rawCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const allCourses = this.sortCoursesByCustomOrder(rawCourses);
    if (currentUser.role === 'admin' || currentUser.role === 'co_admin') {
      return allCourses;
    }
    // Strict Visibility Rule: Students MUST ONLY see and access courses they are officially enrolled in.
    return allCourses.filter((course) => course.enrolledStudentIds.includes(currentUser.id));
  }

  static getCourseById(courseId: string, currentUser: User): { course: Course | null; error?: string } {
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const course = allCourses.find((c) => c.id === courseId);
    if (!course) {
      return { course: null, error: 'Course not found.' };
    }
    // RLS check: Admins & Co-admins can access all courses
    if (currentUser.role === 'student' && !course.enrolledStudentIds.includes(currentUser.id)) {
      return {
        course: null,
        error: `403 Forbidden: Row-Level Security policy "Enrolled students only" denied access to course "${course.title}".`,
      };
    }
    return { course };
  }

  static enrollStudent(courseId: string, studentId: string): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const updated = courses.map((course) => {
      if (course.id === courseId) {
        if (!course.enrolledStudentIds.includes(studentId)) {
          const updatedCourse = {
            ...course,
            enrolledStudentIds: [...course.enrolledStudentIds, studentId],
          };
          try {
            SupabaseService.upsertCourse(updatedCourse).catch(() => {});
          } catch {
            // ignore
          }
          return updatedCourse;
        }
      }
      return course;
    });
    this.setItem(STORAGE_KEYS.COURSES, updated);
    return true;
  }

  static unenrollStudent(courseId: string, studentId: string): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const updated = courses.map((course) => {
      if (course.id === courseId) {
        const updatedCourse = {
          ...course,
          enrolledStudentIds: course.enrolledStudentIds.filter((id) => id !== studentId),
        };
        try {
          SupabaseService.upsertCourse(updatedCourse).catch(() => {});
        } catch {
          // ignore
        }
        return updatedCourse;
      }
      return course;
    });
    this.setItem(STORAGE_KEYS.COURSES, updated);
    return true;
  }

  static createCourse(newCourse: Omit<Course, 'id'>): Course {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      throw new Error('Unauthorized: Only Admin or Co-Admin can create courses.');
    }
    const existing = this.sortCoursesByCustomOrder(
      this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES)
    );
    const id = `course-${Date.now()}`;
    const course: Course = { ...newCourse, id, sortOrder: 1 };
    const shifted = existing.map((c, idx) => {
      const next = { ...c, sortOrder: idx + 2 };
      this.markLocalWrite(next.id);
      return next;
    });
    const updatedList = [course, ...shifted];
    this.markLocalWrite(course.id);
    this.setItem(STORAGE_KEYS.COURSES, updatedList);
    updatedList.forEach((c) => {
      try {
        SupabaseService.upsertCourse(c).catch(() => {});
      } catch {
        // ignore
      }
    });
    return course;
  }

  /**
   * Reorders all classrooms according to an ordered array of course IDs (Admin & Co-Admin)
   * and immediately persists to LocalStorage + Supabase so all devices see the new order.
   */
  static reorderCourses(orderedCourseIds: string[]): Course[] {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    }
    const currentCourses = this.sortCoursesByCustomOrder(
      this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES)
    );
    const byId = new Map<string, Course>(currentCourses.map((c) => [c.id, c]));
    const reordered: Course[] = [];
    const seen = new Set<string>();

    orderedCourseIds.forEach((id) => {
      const found = byId.get(id);
      if (found && !seen.has(id)) {
        seen.add(id);
        reordered.push(found);
      }
    });

    currentCourses.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        reordered.push(c);
      }
    });

    const normalized = reordered.map((c, index) => {
      const updatedCourse: Course = { ...c, sortOrder: index + 1 };
      this.markLocalWrite(updatedCourse.id);
      return updatedCourse;
    });

    this.setItem(STORAGE_KEYS.COURSES, normalized);
    normalized.forEach((c) => {
      try {
        SupabaseService.upsertCourse(c).catch(() => {});
      } catch {
        // ignore
      }
    });

    return normalized;
  }

  /**
   * Moves a single course up, down, to top, to bottom, or to a specific 1-based position (Admin & Co-Admin).
   */
  static moveCourseOrder(
    courseId: string,
    target: 'up' | 'down' | 'top' | 'bottom' | number
  ): Course[] {
    const currentCourses = this.sortCoursesByCustomOrder(
      this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES)
    );
    const fromIndex = currentCourses.findIndex((c) => c.id === courseId);
    if (fromIndex === -1 || currentCourses.length <= 1) {
      return currentCourses;
    }

    let toIndex = fromIndex;
    if (target === 'up') {
      toIndex = Math.max(0, fromIndex - 1);
    } else if (target === 'down') {
      toIndex = Math.min(currentCourses.length - 1, fromIndex + 1);
    } else if (target === 'top') {
      toIndex = 0;
    } else if (target === 'bottom') {
      toIndex = currentCourses.length - 1;
    } else if (typeof target === 'number' && Number.isFinite(target)) {
      toIndex = Math.max(0, Math.min(currentCourses.length - 1, Math.round(target) - 1));
    }

    if (toIndex === fromIndex) {
      return currentCourses;
    }

    const nextIds = currentCourses.map((c) => c.id);
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, movedId);

    return this.reorderCourses(nextIds);
  }

  static updateCourseBanner(
    courseId: string,
    bannerImage: string,
    applyToAllCourses: boolean = false
  ): Course | null {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return null;
    }
    const cleanBanner = bannerImage.trim();
    if (/^(javascript|vbscript|data:text\/html)/i.test(cleanBanner)) {
      return null;
    }
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    let updatedCourse: Course | null = null;
    const coursesToSync: Course[] = [];
    const updated = courses.map((c) => {
      if (applyToAllCourses || c.id === courseId) {
        const nextCourse: Course = {
          ...c,
          bannerImage: cleanBanner,
        };
        if (c.id === courseId) {
          updatedCourse = nextCourse;
        }
        this.markLocalWrite(nextCourse.id);
        coursesToSync.push(nextCourse);
        return nextCourse;
      }
      return c;
    });

    if (coursesToSync.length > 0) {
      this.setItem(STORAGE_KEYS.COURSES, updated);
      coursesToSync.forEach((c) => {
        try {
          SupabaseService.upsertCourse(c).catch(() => {});
        } catch {
          // ignore
        }
      });
    }
    return updatedCourse;
  }

  static deleteCourse(
    courseId: string,
    currentUser: User
  ): { success: boolean; error?: string } {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') {
      return {
        success: false,
        error: 'ခွင့်ပြုချက် မရှိပါ: Classroom အတန်းများကို Admin နှင့် Co-Admin အကောင့်များသာ ဖျက်သိမ်းခွင့်ရှိပါသည်။',
      };
    }

    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const target = courses.find((c) => c.id === courseId);
    if (!target) {
      return { success: false, error: 'အတန်း ရှာမတွေ့ပါ။' };
    }

    // Collect child IDs for deletion tracking
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const removedPostIds = posts.filter((p) => p.courseId === courseId).map((p) => p.id);

    const assignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    const removedAssIds = assignments.filter((a) => a.courseId === courseId).map((a) => a.id);

    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const removedSubIds = submissions.filter((s) => s.courseId === courseId).map((s) => s.id);

    const quizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    const removedQuizIds = quizzes.filter((q) => q.courseId === courseId).map((q) => q.id);

    const attendance = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const removedAttIds = attendance.filter((att) => att.courseId === courseId).map((att) => att.id);

    this.recordDeletedIds([
      courseId,
      ...removedPostIds,
      ...removedAssIds,
      ...removedSubIds,
      ...removedQuizIds,
      ...removedAttIds,
    ]);

    // Remove course and all its child items from local storage
    this.setItem(
      STORAGE_KEYS.COURSES,
      courses.filter((c) => c.id !== courseId)
    );
    this.setItem(
      STORAGE_KEYS.POSTS,
      posts.filter((p) => p.courseId !== courseId)
    );
    this.setItem(
      STORAGE_KEYS.ASSIGNMENTS,
      assignments.filter((a) => a.courseId !== courseId)
    );
    this.setItem(
      STORAGE_KEYS.SUBMISSIONS,
      submissions.filter((s) => s.courseId !== courseId)
    );
    this.setItem(
      STORAGE_KEYS.QUIZZES,
      quizzes.filter((q) => q.courseId !== courseId)
    );
    const quizSubs = this.getItem<QuizSubmission[]>(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    this.setItem(
      STORAGE_KEYS.QUIZ_SUBMISSIONS,
      quizSubs.filter((qs) => qs.courseId !== courseId)
    );
    const progress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    this.setItem(
      STORAGE_KEYS.PROGRESS,
      progress.filter((pr) => pr.courseId !== courseId)
    );
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    this.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      notifs.filter((n) => n.courseId !== courseId)
    );
    this.setItem(
      STORAGE_KEYS.ATTENDANCE,
      attendance.filter((att) => att.courseId !== courseId)
    );

    // Auto-delete course and all child records in Supabase SQL database
    try {
      SupabaseService.deleteCourse(courseId).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true };
  }

  /**
   * Automatically detects and removes any orphaned records in LocalStorage AND Supabase
   * (e.g., enrollments for deleted users, or posts/assignments/submissions/quizzes/attendance/notifications
   * referencing a classroom course, post, assignment, quiz, or user that no longer exists).
   */
  static async cleanOrphanedLocalAndCloudData(
    forceCloudSweep: boolean = false
  ): Promise<{ localCleaned: number; cloudCleaned: number; details: string }> {
    let localCleaned = 0;
    const deletedSet = new Set(this.getDeletedIds());

    // 1. Clean valid users & courses
    const rawUsers = this.getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const validUsers = rawUsers.filter((u) => u && u.id && !deletedSet.has(u.id));
    if (validUsers.length !== rawUsers.length) {
      localCleaned += rawUsers.length - validUsers.length;
      this.setItem(STORAGE_KEYS.USERS, validUsers);
    }
    const validUserIds = new Set(validUsers.map((u) => u.id));

    const rawCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    let coursesMutated = false;
    const validCourses: Course[] = [];
    for (const c of rawCourses) {
      if (!c || !c.id || deletedSet.has(c.id)) {
        localCleaned++;
        coursesMutated = true;
        continue;
      }
      const cleanEnrolled = (c.enrolledStudentIds || []).filter(
        (stuId) => validUserIds.has(stuId) && !deletedSet.has(stuId)
      );
      if (cleanEnrolled.length !== (c.enrolledStudentIds || []).length) {
        localCleaned += (c.enrolledStudentIds || []).length - cleanEnrolled.length;
        coursesMutated = true;
        validCourses.push({ ...c, enrolledStudentIds: cleanEnrolled });
      } else {
        validCourses.push(c);
      }
    }
    if (coursesMutated) {
      this.setItem(STORAGE_KEYS.COURSES, validCourses);
    }
    const validCourseIds = new Set(validCourses.map((c) => c.id));

    // 2. Clean orphaned posts (and likes/comments from deleted users)
    const rawPosts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    let postsMutated = false;
    const validPosts: CoursePost[] = [];
    for (const p of rawPosts) {
      if (!p || !p.id || deletedSet.has(p.id) || !validCourseIds.has(p.courseId)) {
        localCleaned++;
        postsMutated = true;
        continue;
      }
      const cleanLikes = (p.likes || []).filter((uId) => validUserIds.has(uId));
      const cleanComments = (p.comments || []).filter(
        (cm) => cm && cm.id && !deletedSet.has(cm.id) && validUserIds.has(cm.authorId)
      );
      if (
        cleanLikes.length !== (p.likes || []).length ||
        cleanComments.length !== (p.comments || []).length
      ) {
        postsMutated = true;
        validPosts.push({ ...p, likes: cleanLikes, comments: cleanComments });
      } else {
        validPosts.push(p);
      }
    }
    if (postsMutated) {
      this.setItem(STORAGE_KEYS.POSTS, validPosts);
    }
    const validPostIds = new Set(validPosts.map((p) => p.id));

    // 3. Clean orphaned assignments & assignment submissions
    const rawAssignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    const validAssignments = rawAssignments.filter(
      (a) => a && a.id && !deletedSet.has(a.id) && validCourseIds.has(a.courseId)
    );
    if (validAssignments.length !== rawAssignments.length) {
      localCleaned += rawAssignments.length - validAssignments.length;
      this.setItem(STORAGE_KEYS.ASSIGNMENTS, validAssignments);
    }
    const validAssignmentIds = new Set(validAssignments.map((a) => a.id));

    const rawSubmissions = this.getItem<AssignmentSubmission[]>(
      STORAGE_KEYS.SUBMISSIONS,
      INITIAL_SUBMISSIONS
    );
    const validSubmissions = rawSubmissions.filter(
      (s) =>
        s &&
        s.id &&
        !deletedSet.has(s.id) &&
        validAssignmentIds.has(s.assignmentId) &&
        validUserIds.has(s.studentId) &&
        (!s.courseId || validCourseIds.has(s.courseId))
    );
    if (validSubmissions.length !== rawSubmissions.length) {
      localCleaned += rawSubmissions.length - validSubmissions.length;
      this.setItem(STORAGE_KEYS.SUBMISSIONS, validSubmissions);
    }

    // 4. Clean orphaned quizzes & quiz submissions
    const rawQuizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    const validQuizzes = rawQuizzes.filter(
      (q) => q && q.id && !deletedSet.has(q.id) && validCourseIds.has(q.courseId)
    );
    if (validQuizzes.length !== rawQuizzes.length) {
      localCleaned += rawQuizzes.length - validQuizzes.length;
      this.setItem(STORAGE_KEYS.QUIZZES, validQuizzes);
    }
    const validQuizIds = new Set(validQuizzes.map((q) => q.id));

    const rawQuizSubs = this.getItem<QuizSubmission[]>(
      STORAGE_KEYS.QUIZ_SUBMISSIONS,
      INITIAL_QUIZ_SUBMISSIONS
    );
    const validQuizSubs = rawQuizSubs.filter(
      (qs) =>
        qs &&
        qs.id &&
        !deletedSet.has(qs.id) &&
        validQuizIds.has(qs.quizId) &&
        validUserIds.has(qs.studentId) &&
        (!qs.courseId || validCourseIds.has(qs.courseId))
    );
    if (validQuizSubs.length !== rawQuizSubs.length) {
      localCleaned += rawQuizSubs.length - validQuizSubs.length;
      this.setItem(STORAGE_KEYS.QUIZ_SUBMISSIONS, validQuizSubs);
    }

    // 5. Clean orphaned attendance sessions & records for deleted students
    const rawAttendance = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    let attMutated = false;
    const validAttendance: AttendanceSession[] = [];
    for (const sess of rawAttendance) {
      if (!sess || !sess.id || deletedSet.has(sess.id) || !validCourseIds.has(sess.courseId)) {
        localCleaned++;
        attMutated = true;
        continue;
      }
      const records = sess.records || {};
      const recordKeys = Object.keys(records);
      const orphanRecordKeys = recordKeys.filter((stuId) => !validUserIds.has(stuId));
      if (orphanRecordKeys.length > 0) {
        const cleanRecords = { ...records };
        orphanRecordKeys.forEach((k) => delete cleanRecords[k]);
        attMutated = true;
        validAttendance.push({ ...sess, records: cleanRecords });
      } else {
        validAttendance.push(sess);
      }
    }
    if (attMutated) {
      this.setItem(STORAGE_KEYS.ATTENDANCE, validAttendance);
    }

    // 6. Clean orphaned student progress
    const rawProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    const validProgress = rawProgress.filter(
      (pr) =>
        pr &&
        validCourseIds.has(pr.courseId) &&
        validUserIds.has(pr.studentId)
    );
    if (validProgress.length !== rawProgress.length) {
      localCleaned += rawProgress.length - validProgress.length;
      this.setItem(STORAGE_KEYS.PROGRESS, validProgress);
    }

    // 7. Clean orphaned or expired notifications
    this.purgeExpiredNotifications(forceCloudSweep);
    const rawNotifs = this.getItem<NotificationItem[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      INITIAL_NOTIFICATIONS
    );
    const validNotifs = rawNotifs.filter(
      (n) =>
        n &&
        n.id &&
        !deletedSet.has(n.id) &&
        validCourseIds.has(n.courseId) &&
        validUserIds.has(n.userId) &&
        (!n.postId || validPostIds.has(n.postId))
    );
    if (validNotifs.length !== rawNotifs.length) {
      localCleaned += rawNotifs.length - validNotifs.length;
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, validNotifs);
    }

    // 8. Run Supabase cloud orphan cleanup
    const cloudRes = await SupabaseService.cleanOrphanedCloudData(
      Array.from(validCourseIds),
      Array.from(validUserIds),
      Array.from(deletedSet),
      forceCloudSweep
    );

    return {
      localCleaned,
      cloudCleaned: cloudRes.totalCleaned,
      details: `Local cleaned: ${localCleaned}, Cloud cleaned: ${cloudRes.totalCleaned}. ${cloudRes.details}`,
    };
  }

  static async syncWithSupabase(): Promise<{
    success: boolean;
    syncedUsers: number;
    syncedCourses: number;
    cleanedOrphans?: number;
    error?: string;
  }> {
    // First pull authoritative remote state so we never resurrect items deleted on another device
    await this.pullFromSupabase({ force: true });
    // Clean local orphaned references first so we never push stale/orphaned data to Supabase
    await this.cleanOrphanedLocalAndCloudData(false);

    const users = this.getAllUsers();
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const assignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const quizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    const attendance = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const deletedIds = this.getDeletedIds();
    return SupabaseService.syncAllData(
      users,
      courses,
      posts,
      assignments,
      quizzes,
      attendance,
      deletedIds,
      submissions
    );
  }

  private static activePullPromise: Promise<boolean> | null = null;
  private static lastFullPullAt = 0;
  private static lastCatalogPullAt = 0;
  private static lastProfilePullAt = 0;
  private static purgedRemoteIds = new Set<string>();

  private static extractTimestampFromId(id?: string): number | undefined {
    if (!id) return undefined;
    const match = id.match(/(\d{13})/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 1_600_000_000_000) {
        return parsed;
      }
    }
    return undefined;
  }

  static formatPostTimestamp(ms: number): string {
    try {
      return new Date(ms).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Just now';
    }
  }

  /**
   * Computes a deterministic numeric sort timestamp for any CoursePost so that
   * newly created posts ALWAYS appear at the very top (#1 spot) of the classroom stream.
   */
  static getPostSortTimestamp(post: CoursePost): number {
    if (!post) return 0;
    const now = Date.now();
    // Initial demo posts (post-100, post-101, etc.) get a fixed historical baseline (Jan 2024)
    // so any new post created by Admin or Co-Admin is ALWAYS sorted above demo posts
    if (/^post-\d{3}$/.test(post.id || '')) {
      const num = Number((post.id || '').replace('post-', '')) || 0;
      return 1_704_067_200_000 + num;
    }

    const idTs = this.extractTimestampFromId(post.id);
    let rawTs = 0;
    if (typeof post.createdAtMs === 'number' && Number.isFinite(post.createdAtMs) && post.createdAtMs > 0) {
      rawTs = idTs ? Math.max(post.createdAtMs, idTs) : post.createdAtMs;
    } else if (idTs) {
      rawTs = idTs;
    } else if (post.createdAt === 'Just now') {
      rawTs = now;
    } else if (post.createdAt && post.createdAt !== 'Recently') {
      const cleaned = post.createdAt.split('·')[0].replace('Scheduled for', '').trim();
      const parsed = Date.parse(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        rawTs = parsed;
      }
    }

    // Guard against simulated future clock timestamps (e.g., from AI Studio preview 2026 clock)
    // so that real-world posts created on user devices (Date.now()) ALWAYS sort at #1 top spot!
    if (rawTs > now + 120_000 && !this.isRecentLocalWrite(post.id)) {
      return 1_705_000_000_000 + (rawTs % 86_400_000);
    }

    return rawTs;
  }

  /**
   * Supabase High-Speed Authoritative Sync:
   * - Enforces Single-Device Session Lock (1 Student Account = 1 Device Only) for students while allowing multi-device for Admin & Co-Admin
   * - Reconciles remote deletions authoritatively so classrooms/posts/users deleted on one device disappear on all devices immediately
   * - Immediately syncs Admin/Co-Admin profile picture changes and Classroom header photo changes across all devices
   * - Sorts classroom stream posts strictly newest-first
   * - Automatically purges notifications older than 30 minutes from both local storage & Supabase
   */
  static async pullFromSupabase(options?: {
    force?: boolean;
    onlyProfiles?: boolean;
    background?: boolean;
  }): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    // Always run 30-minute notification cleanup first
    const purgedLocalNotifs = this.purgeExpiredNotifications();

    const force = Boolean(options?.force);
    const onlyProfiles = Boolean(options?.onlyProfiles);
    const isBackground = Boolean(options?.background);
    const now = Date.now();
    const COOLDOWN_MS = 20_000; // 20s background cooldown for fast cross-device propagation
    const CATALOG_TTL_MS = 45_000; // 45s catalog refresh so classroom/user edits & deletions propagate quickly

    if (!force) {
      if (onlyProfiles && now - this.lastProfilePullAt < COOLDOWN_MS) {
        return purgedLocalNotifs;
      }
      if (!onlyProfiles && now - this.lastFullPullAt < COOLDOWN_MS) {
        return purgedLocalNotifs;
      }
    }

    if (this.activePullPromise) {
      if (force) {
        try {
          await this.activePullPromise;
        } catch {
          // ignore
        }
      } else {
        return this.activePullPromise;
      }
    }

    this.activePullPromise = (async () => {
      try {
        const deletedSet = new Set(this.getDeletedIds());
        const newlyDiscoveredRemoteDeletions: string[] = [];

        if (onlyProfiles) {
          this.lastProfilePullAt = Date.now();
          const remoteProfiles = await SupabaseService.getRemoteProfiles();
          if (!remoteProfiles || remoteProfiles.length === 0) {
            return purgedLocalNotifs;
          }
          try {
            localStorage.setItem(STORAGE_KEYS.CLOUD_SYNCED, 'true');
          } catch {
            // ignore
          }
          const remoteProfileIds = new Set(remoteProfiles.map((ru) => ru.id));
          const localUsers = this.getAllUsers().filter((u) => !deletedSet.has(u.id));
          const prevJson = JSON.stringify(localUsers);
          const userMap = new Map<string, User>();
          localUsers.forEach((u) => {
            if (remoteProfileIds.has(u.id) || this.isRecentLocalWrite(u.id)) {
              userMap.set(u.id, u);
            } else {
              newlyDiscoveredRemoteDeletions.push(u.id);
              deletedSet.add(u.id);
            }
          });
          remoteProfiles.forEach((ru) => {
            if (deletedSet.has(ru.id)) return;
            const existing = userMap.get(ru.id);
            const resolvedAvatar =
              ru.role === 'student'
                ? ''
                : this.isRecentLocalWrite(ru.id)
                ? existing?.avatar || ru.avatar || ''
                : ru.avatar || existing?.avatar || '';
            userMap.set(ru.id, {
              ...existing,
              ...ru,
              rulesAccepted: Boolean(ru.rulesAccepted || existing?.rulesAccepted),
              rulesAcceptedAt: ru.rulesAcceptedAt || existing?.rulesAcceptedAt,
              avatar: resolvedAvatar,
              password: encryptPassword(
                this.isRecentLocalWrite(ru.id)
                  ? existing?.password || ru.password
                  : ru.password || existing?.password,
                ru.role,
                ru.id
              ),
            });
          });
          if (newlyDiscoveredRemoteDeletions.length > 0) {
            this.recordDeletedIds(newlyDiscoveredRemoteDeletions);
          }
          const mergedUsers = Array.from(userMap.values());
          if (JSON.stringify(mergedUsers) !== prevJson) {
            this.setItem(STORAGE_KEYS.USERS, mergedUsers);
            return true;
          }
          return purgedLocalNotifs;
        }

        this.lastFullPullAt = now;
        const shouldFetchCatalog = !isBackground || force || now - this.lastCatalogPullAt >= CATALOG_TTL_MS;
        if (shouldFetchCatalog) {
          this.lastCatalogPullAt = now;
          this.lastProfilePullAt = now;
        }

        const loggedUser = this.getCurrentUser();
        const currentCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES).filter(
          (c) => !deletedSet.has(c.id)
        );
        // Scope student queries only to their enrolled courses to save Supabase egress
        const studentScopedCourseIds =
          loggedUser && loggedUser.role === 'student'
            ? currentCourses
                .filter((c) => c.enrolledStudentIds.includes(loggedUser.id))
                .map((c) => c.id)
            : undefined;

        const [
          remoteProfiles,
          remoteCourses,
          remotePosts,
          remoteAssignments,
          remoteQuizzes,
          remoteAttendance,
          remoteNotifications,
          singleLoggedProfile,
        ] = await Promise.all([
          shouldFetchCatalog ? SupabaseService.getRemoteProfiles() : Promise.resolve(null),
          shouldFetchCatalog ? SupabaseService.getRemoteCourses() : Promise.resolve(null),
          SupabaseService.getRemotePosts(studentScopedCourseIds),
          shouldFetchCatalog ? SupabaseService.getRemoteAssignments() : Promise.resolve(null),
          shouldFetchCatalog ? SupabaseService.getRemoteQuizzes() : Promise.resolve(null),
          SupabaseService.getRemoteAttendanceSessions(studentScopedCourseIds),
          loggedUser ? SupabaseService.getRemoteNotifications(loggedUser.id) : Promise.resolve(null),
          !shouldFetchCatalog && loggedUser
            ? SupabaseService.getRemoteProfileByIdentifier(loggedUser.username || loggedUser.email, true)
            : Promise.resolve(null),
        ]);

        let updated = purgedLocalNotifs;
        const hasRemoteCatalogData =
          (remoteProfiles && remoteProfiles.length > 0) ||
          (remoteCourses && remoteCourses.length > 0);
        if (hasRemoteCatalogData) {
          try {
            localStorage.setItem(STORAGE_KEYS.CLOUD_SYNCED, 'true');
          } catch {
            // ignore
          }
        } else if (
          shouldFetchCatalog &&
          remoteProfiles !== null &&
          remoteProfiles.length === 0 &&
          remoteCourses !== null &&
          remoteCourses.length === 0 &&
          localStorage.getItem(STORAGE_KEYS.CLOUD_SYNCED) !== 'true'
        ) {
          // Brand-new empty Supabase tables detected: automatically push initial local data in the background
          try {
            const seedUsers = this.getAllUsers();
            const seedCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
            const seedPosts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
            const seedAssignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
            const seedSubmissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
            const seedQuizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
            const seedAttendance = this.getItem<AttendanceSession[]>(
              STORAGE_KEYS.ATTENDANCE,
              INITIAL_ATTENDANCE_SESSIONS
            );
            SupabaseService.syncAllData(
              seedUsers,
              seedCourses,
              seedPosts,
              seedAssignments,
              seedQuizzes,
              seedAttendance,
              Array.from(deletedSet),
              seedSubmissions
            )
              .then((res) => {
                if (res.success) {
                  try {
                    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNCED, 'true');
                  } catch {
                    // ignore
                  }
                }
              })
              .catch(() => {});
          } catch {
            // ignore
          }
        }
        const cloudActive =
          hasRemoteCatalogData ||
          localStorage.getItem(STORAGE_KEYS.CLOUD_SYNCED) === 'true';

        // 1. Reconcile Profiles & Verify Single-Device Session Lock (Students Only)
        const latestAvatarByUserId = new Map<string, string>();
        if (remoteProfiles && remoteProfiles.length > 0) {
          const remoteProfileIds = new Set(remoteProfiles.map((ru) => ru.id));
          const localUsers = this.getAllUsers().filter((u) => !deletedSet.has(u.id));
          const prevJson = JSON.stringify(localUsers);
          const userMap = new Map<string, User>();

          localUsers.forEach((u) => {
            if (remoteProfileIds.has(u.id) || this.isRecentLocalWrite(u.id)) {
              userMap.set(u.id, u);
            } else {
              newlyDiscoveredRemoteDeletions.push(u.id);
              deletedSet.add(u.id);
            }
          });

          remoteProfiles.forEach((ru) => {
            if (deletedSet.has(ru.id)) {
              if (!this.purgedRemoteIds.has(ru.id)) {
                this.purgedRemoteIds.add(ru.id);
                SupabaseService.deleteProfile(ru.id).catch(() => {});
              }
              return;
            }
            const existing = userMap.get(ru.id);
            const resolvedAvatar =
              ru.role === 'student'
                ? ''
                : this.isRecentLocalWrite(ru.id)
                ? existing?.avatar || ru.avatar || ''
                : ru.avatar || existing?.avatar || '';
            const mergedProfile: User = {
              ...existing,
              ...ru,
              activeDeviceId: ru.activeDeviceId,
              activeSessionToken: ru.activeSessionToken,
              sessionUpdatedAtMs: ru.sessionUpdatedAtMs,
              rulesAccepted: Boolean(ru.rulesAccepted || existing?.rulesAccepted),
              rulesAcceptedAt: ru.rulesAcceptedAt || existing?.rulesAcceptedAt,
              avatar: resolvedAvatar,
              password: encryptPassword(
                this.isRecentLocalWrite(ru.id)
                  ? existing?.password || ru.password
                  : ru.password || existing?.password,
                ru.role,
                ru.id
              ),
            };
            userMap.set(ru.id, mergedProfile);
            latestAvatarByUserId.set(ru.id, resolvedAvatar);
          });
          const merged = Array.from(userMap.values());
          if (JSON.stringify(merged) !== prevJson) {
            this.setItem(STORAGE_KEYS.USERS, merged);
            if (loggedUser && userMap.has(loggedUser.id)) {
              this.setCurrentUser(userMap.get(loggedUser.id)!);
            }
            updated = true;
          }
        } else {
          this.getAllUsers().forEach((u) => {
            latestAvatarByUserId.set(u.id, u.role === 'student' ? '' : u.avatar || '');
          });
        }

        // Single-Device Session Verification:
        // - Deleted accounts are logged out for any role.
        // - Single-Device Lock (1 Account = 1 Device Only) is enforced STRICTLY for 'student' accounts only!
        // - Admin and Co-Admin accounts can stay logged in on multiple devices simultaneously.
        if (loggedUser) {
          const remoteUserForSession =
            (remoteProfiles && remoteProfiles.find((ru) => ru.id === loggedUser.id)) ||
            singleLoggedProfile;

          if (
            remoteProfiles &&
            remoteProfiles.length > 0 &&
            !remoteUserForSession &&
            !this.isRecentLocalWrite(loggedUser.id)
          ) {
            this.forceLocalLogoutWithReason(
              'သင်၏ အကောင့်သည် စနစ်မှ ဖယ်ရှားခံထားရသဖြင့် အလိုအလျောက် Logout ထွက်ပေးထားပါသည်။'
            );
            updated = true;
          } else if (remoteUserForSession && loggedUser.role === 'student') {
            const localDeviceId = this.getDeviceId();
            const remoteDevId = remoteUserForSession.activeDeviceId || '';

            if (!remoteDevId) {
              // Claim single-device lock for existing student session
              const token = this.getSessionToken() || this.generateAndSaveSessionToken();
              const allUsers = this.getAllUsers();
              const idx = allUsers.findIndex((u) => u.id === loggedUser.id);
              const fullUser = idx >= 0 ? allUsers[idx] : loggedUser;
              const claimedUser: User = {
                ...fullUser,
                avatar: '',
                activeDeviceId: localDeviceId,
                activeSessionToken: token,
                sessionUpdatedAtMs: Date.now(),
              };
              if (idx >= 0) {
                allUsers[idx] = claimedUser;
                this.setItem(STORAGE_KEYS.USERS, allUsers);
              }
              this.markLocalWrite(claimedUser.id);
              this.setCurrentUser(claimedUser);
              SupabaseService.upsertProfile(claimedUser).catch(() => {});
            } else if (
              remoteDevId === 'LOGGED_OUT' &&
              !this.isRecentLocalWrite(loggedUser.id)
            ) {
              this.forceLocalLogoutWithReason(
                'သင်၏ အကောင့်သည် Logout ပြုလုပ်ထားသဖြင့် ကျေးဇူးပြု၍ ပြန်လည်ဝင်ရောက်ပေးပါ။'
              );
              updated = true;
            } else if (
              remoteDevId !== localDeviceId &&
              !this.isRecentLocalWrite(loggedUser.id)
            ) {
              this.forceLocalLogoutWithReason(
                'သင်၏ ကျောင်းသားအကောင့်ကို အခြားစက် (Device) တစ်ခုတွင် Login ဝင်ရောက်သုံးစွဲနေသဖြင့် လုံခြုံရေးစည်းမျဉ်း (1 Student Account = 1 Device Only) အရ ဤစက်မှ အလိုအလျောက် ထွက်ပေးထားပါသည်။'
              );
              updated = true;
            }
          }
        }

        // 2. Authoritative Courses Reconciliation (Deletions & Header Banner Edits on any device reflect immediately)
        if (remoteCourses !== null) {
          const remoteCourseIds = new Set(remoteCourses.map((rc) => rc.id));
          const localCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES).filter(
            (c) => !deletedSet.has(c.id)
          );
          const prevJson = JSON.stringify(localCourses);
          const courseMap = new Map<string, Course>();

          localCourses.forEach((c) => {
            if (!cloudActive || remoteCourseIds.has(c.id) || this.isRecentLocalWrite(c.id)) {
              courseMap.set(c.id, c);
            } else {
              // Course was deleted on another device!
              newlyDiscoveredRemoteDeletions.push(c.id);
              deletedSet.add(c.id);
            }
          });

          remoteCourses.forEach((rc) => {
            if (deletedSet.has(rc.id)) {
              if (!this.purgedRemoteIds.has(rc.id)) {
                this.purgedRemoteIds.add(rc.id);
                SupabaseService.deleteCourse(rc.id).catch(() => {});
              }
              return;
            }
            const existing = courseMap.get(rc.id);
            const isRecentWrite = this.isRecentLocalWrite(rc.id);
            const resolvedBanner = isRecentWrite
              ? existing?.bannerImage || rc.bannerImage || ''
              : rc.bannerImage || existing?.bannerImage || '';
            const resolvedSortOrder = isRecentWrite
              ? existing?.sortOrder ?? rc.sortOrder
              : rc.sortOrder ?? existing?.sortOrder;
            courseMap.set(rc.id, {
              ...existing,
              ...rc,
              bannerImage: resolvedBanner,
              sortOrder: resolvedSortOrder,
            });
          });
          const merged = this.sortCoursesByCustomOrder(Array.from(courseMap.values()));
          if (JSON.stringify(merged) !== prevJson) {
            this.setItem(STORAGE_KEYS.COURSES, merged);
            updated = true;
          }
        }

        // 3. Authoritative Posts Reconciliation & Strict Newest-First Ordering
        if (remotePosts !== null) {
          const remotePostIds = new Set(remotePosts.map((rp) => rp.id));
          const scopedCourseSet = studentScopedCourseIds ? new Set(studentScopedCourseIds) : null;
          const localPosts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS).filter(
            (p) => p.id !== 'post-103' && !deletedSet.has(p.id) && !deletedSet.has(p.courseId)
          );
          const prevJson = JSON.stringify(localPosts);
          const postMap = new Map<string, CoursePost>();

          localPosts.forEach((p) => {
            const isInQueriedScope = !scopedCourseSet || scopedCourseSet.has(p.courseId);
            if (!cloudActive || !isInQueriedScope || remotePostIds.has(p.id) || this.isRecentLocalWrite(p.id)) {
              postMap.set(p.id, p);
            } else {
              // Post was deleted on another device!
              newlyDiscoveredRemoteDeletions.push(p.id);
              deletedSet.add(p.id);
            }
          });

          remotePosts.forEach((rp) => {
            if (rp.id === 'post-103' || deletedSet.has(rp.id) || deletedSet.has(rp.courseId)) {
              if (!this.purgedRemoteIds.has(rp.id)) {
                this.purgedRemoteIds.add(rp.id);
                SupabaseService.deletePost(rp.id).catch(() => {});
              }
              return;
            }
            const existing = postMap.get(rp.id);
            const idTs = this.extractTimestampFromId(rp.id);
            let postTimestampMs =
              idTs ||
              rp.createdAtMs ||
              existing?.createdAtMs;

            // Clamp future simulated timestamps from AI Studio preview (Nov 2026) so real posts always stay on top
            if (postTimestampMs && postTimestampMs > Date.now() + 120_000 && !this.isRecentLocalWrite(rp.id)) {
              postTimestampMs = 1_705_000_000_000 + (postTimestampMs % 86_400_000);
            }

            const formattedTime =
              rp.status === 'scheduled'
                ? rp.createdAt
                : postTimestampMs
                ? this.formatPostTimestamp(postTimestampMs)
                : rp.createdAt || existing?.createdAt || 'Recently';

            const liveAuthorAvatar =
              rp.authorRole === 'student'
                ? ''
                : latestAvatarByUserId.get(rp.authorId) || rp.authorAvatar || existing?.authorAvatar || '';

            const syncedComments = (rp.comments && rp.comments.length > 0 ? rp.comments : existing?.comments || []).map(
              (cm) => ({
                ...cm,
                authorAvatar:
                  cm.authorRole === 'student'
                    ? ''
                    : latestAvatarByUserId.get(cm.authorId) || cm.authorAvatar || '',
              })
            );

            postMap.set(rp.id, {
              ...existing,
              ...rp,
              authorAvatar: liveAuthorAvatar,
              createdAt: formattedTime,
              createdAtMs: postTimestampMs,
              comments: syncedComments,
              attachments:
                rp.attachments && rp.attachments.length > 0
                  ? rp.attachments.map((att, idx) => {
                      const localAtt = existing?.attachments?.[idx];
                      if (att.url === '#attachment' && localAtt?.url) {
                        return localAtt;
                      }
                      return att;
                    })
                  : existing?.attachments || [],
            });
          });

          // Sort all posts newest-first so newly created posts are ALWAYS at the top of the stream!
          const merged = Array.from(postMap.values()).sort(
            (a, b) => this.getPostSortTimestamp(b) - this.getPostSortTimestamp(a)
          );
          if (JSON.stringify(merged) !== prevJson) {
            this.setItem(STORAGE_KEYS.POSTS, merged);
            updated = true;
          }
        }

        // 4. Authoritative Assignments & Quizzes Reconciliation
        if (remoteAssignments !== null && cloudActive) {
          const remoteAssIds = new Set(remoteAssignments.map((ra) => ra.id));
          const localAssignments = this.getItem<Assignment[]>(
            STORAGE_KEYS.ASSIGNMENTS,
            INITIAL_ASSIGNMENTS
          ).filter((a) => !deletedSet.has(a.id) && !deletedSet.has(a.courseId));
          const prevJson = JSON.stringify(localAssignments);
          const assMap = new Map<string, Assignment>();
          localAssignments.forEach((a) => {
            if (remoteAssIds.has(a.id) || this.isRecentLocalWrite(a.id)) {
              assMap.set(a.id, a);
            } else {
              newlyDiscoveredRemoteDeletions.push(a.id);
              deletedSet.add(a.id);
            }
          });
          remoteAssignments.forEach((ra) => {
            if (deletedSet.has(ra.id) || deletedSet.has(ra.courseId)) return;
            const existing = assMap.get(ra.id);
            assMap.set(ra.id, { ...existing, ...ra });
          });
          const mergedAss = Array.from(assMap.values());
          if (JSON.stringify(mergedAss) !== prevJson) {
            this.setItem(STORAGE_KEYS.ASSIGNMENTS, mergedAss);
            updated = true;
          }
        }

        if (remoteQuizzes !== null && cloudActive) {
          const remoteQuizIds = new Set(remoteQuizzes.map((rq) => rq.id));
          const localQuizzes = this.getItem<Quiz[]>(
            STORAGE_KEYS.QUIZZES,
            INITIAL_QUIZZES
          ).filter((q) => !deletedSet.has(q.id) && !deletedSet.has(q.courseId));
          const prevJson = JSON.stringify(localQuizzes);
          const quizMap = new Map<string, Quiz>();
          localQuizzes.forEach((q) => {
            if (remoteQuizIds.has(q.id) || this.isRecentLocalWrite(q.id)) {
              quizMap.set(q.id, q);
            } else {
              newlyDiscoveredRemoteDeletions.push(q.id);
              deletedSet.add(q.id);
            }
          });
          remoteQuizzes.forEach((rq) => {
            if (deletedSet.has(rq.id) || deletedSet.has(rq.courseId)) return;
            const existing = quizMap.get(rq.id);
            quizMap.set(rq.id, { ...existing, ...rq });
          });
          const mergedQuizzes = Array.from(quizMap.values());
          if (JSON.stringify(mergedQuizzes) !== prevJson) {
            this.setItem(STORAGE_KEYS.QUIZZES, mergedQuizzes);
            updated = true;
          }
        }

        // 5. Notifications Reconciliation
        if (remoteNotifications && remoteNotifications.length > 0) {
          const localNotifs = this.getItem<NotificationItem[]>(
            STORAGE_KEYS.NOTIFICATIONS,
            INITIAL_NOTIFICATIONS
          );
          const prevJson = JSON.stringify(localNotifs);
          const notifMap = new Map<string, NotificationItem>();
          localNotifs.forEach((n) => notifMap.set(n.id, n));
          remoteNotifications.forEach((rn) => {
            const createdMs = rn.createdAtMs || this.extractTimestampFromId(rn.id) || Date.now();
            if (Date.now() - createdMs >= NOTIFICATION_TTL_MS) {
              return;
            }
            const existing = notifMap.get(rn.id);
            notifMap.set(rn.id, {
              ...existing,
              ...rn,
              isRead: Boolean(existing?.isRead || rn.isRead),
            });
          });
          const mergedNotifs = Array.from(notifMap.values());
          if (JSON.stringify(mergedNotifs) !== prevJson) {
            this.setItem(STORAGE_KEYS.NOTIFICATIONS, mergedNotifs);
            updated = true;
          }
        }

        if (this.purgeExpiredNotifications()) {
          updated = true;
        }

        // 6. Authoritative Attendance Sessions Reconciliation
        if (remoteAttendance !== null) {
          const remoteAttIds = new Set(remoteAttendance.map((ratt) => ratt.id));
          const scopedCourseSet = studentScopedCourseIds ? new Set(studentScopedCourseIds) : null;
          const localAttendance = this.getItem<AttendanceSession[]>(
            STORAGE_KEYS.ATTENDANCE,
            INITIAL_ATTENDANCE_SESSIONS
          ).filter((att) => !deletedSet.has(att.id) && !deletedSet.has(att.courseId));
          const prevJson = JSON.stringify(localAttendance);
          const attMap = new Map<string, AttendanceSession>();

          localAttendance.forEach((att) => {
            const isInQueriedScope = !scopedCourseSet || scopedCourseSet.has(att.courseId);
            if (!cloudActive || !isInQueriedScope || remoteAttIds.has(att.id) || this.isRecentLocalWrite(att.id)) {
              attMap.set(att.id, att);
            } else {
              newlyDiscoveredRemoteDeletions.push(att.id);
              deletedSet.add(att.id);
            }
          });

          remoteAttendance.forEach((ratt) => {
            if (deletedSet.has(ratt.id) || deletedSet.has(ratt.courseId)) {
              if (!this.purgedRemoteIds.has(ratt.id)) {
                this.purgedRemoteIds.add(ratt.id);
                SupabaseService.deleteAttendanceSession(ratt.id).catch(() => {});
              }
              return;
            }
            const existing = attMap.get(ratt.id);
            attMap.set(ratt.id, {
              ...existing,
              ...ratt,
              records: {
                ...(existing?.records || {}),
                ...(ratt.records || {}),
              },
            });
          });
          const merged = Array.from(attMap.values());
          if (JSON.stringify(merged) !== prevJson) {
            this.setItem(STORAGE_KEYS.ATTENDANCE, merged);
            updated = true;
          }
        }

        if (newlyDiscoveredRemoteDeletions.length > 0) {
          this.recordDeletedIds(newlyDiscoveredRemoteDeletions);
          updated = true;
        }

        // Automatically clean up any orphaned data in LocalStorage and Supabase
        const orphanCleanup = await this.cleanOrphanedLocalAndCloudData(false);
        if (orphanCleanup.localCleaned > 0) {
          updated = true;
        }

        return updated;
      } catch {
        return purgedLocalNotifs;
      } finally {
        this.activePullPromise = null;
      }
    })();

    return this.activePullPromise;
  }

  // Posts / Stream Feed
  static getPostsForCourse(courseId: string, currentUser: User): CoursePost[] {
    const authResult = this.getCourseById(courseId, currentUser);
    if (!authResult.course) {
      return [];
    }
    const allPosts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const now = Date.now();

    // Check if any scheduled posts have reached their release date/time and auto-publish them
    let hasAutoPublished = false;
    const autoPublishedList: CoursePost[] = [];
    const processedPosts = allPosts.map((post) => {
      if (post.status === 'scheduled' && post.scheduledFor) {
        const scheduledTime = new Date(post.scheduledFor).getTime();
        if (scheduledTime <= now) {
          hasAutoPublished = true;
          const released: CoursePost = {
            ...post,
            status: 'published' as const,
            createdAt: this.formatPostTimestamp(now),
            createdAtMs: now,
            scheduledFor: undefined,
            scheduledForDisplay: undefined,
          };
          autoPublishedList.push(released);
          return released;
        }
      }
      return post;
    });

    if (hasAutoPublished) {
      this.setItem(STORAGE_KEYS.POSTS, processedPosts);
      const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
      autoPublishedList.forEach((ap) => {
        this.markLocalWrite(ap.id);
        try {
          SupabaseService.upsertPost(ap).catch(() => {});
        } catch {
          // ignore
        }
        const targetCourse = allCourses.find((c) => c.id === ap.courseId);
        if (targetCourse && (ap.authorRole === 'admin' || ap.authorRole === 'co_admin')) {
          this.notifyEnrolledStudentsOfCoursePost(
            targetCourse,
            ap,
            ap.authorName,
            ap.authorRole
          );
        }
      });
    }

    // Filter by course
    const coursePosts = processedPosts.filter((post) => post.courseId === courseId);

    // If current user is a student, only show published posts (or posts whose scheduled time is reached)
    const visiblePosts = (currentUser.role === 'admin' || currentUser.role === 'co_admin')
      ? coursePosts
      : coursePosts.filter((post) => {
          if (!post.status || post.status === 'published') return true;
          if (post.status === 'scheduled' && post.scheduledFor) {
            return new Date(post.scheduledFor).getTime() <= now;
          }
          return false;
        });

    // Strictly sort newest posts first (highest timestamp at index 0) so every new post appears at the very top of the classroom stream!
    return [...visiblePosts].sort(
      (a, b) => this.getPostSortTimestamp(b) - this.getPostSortTimestamp(a)
    );
  }

  static addPost(
    postData: Omit<CoursePost, 'id' | 'createdAt' | 'likes' | 'comments'> & {
      status?: 'published' | 'scheduled';
      scheduledFor?: string;
      scheduledForDisplay?: string;
    },
    currentUser: User
  ): { post: CoursePost | null; notifiedCount?: number; error?: string } {
    const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
    if (!isInstructor) {
      return {
        post: null,
        error: 'ခွင့်ပြုချက် မရှိပါ: သင်ခန်းစာနှင့် Post များကို Admin နှင့် Co-admin များသာ တင်ခွင့်ရှိပါသည်။ ကျောင်းသားများသည် Comment နှင့် Like သာ ပြုလုပ်နိုင်ပါသည်။',
      };
    }

    const rateCheck = this.checkRateLimit('post_create', currentUser.id, 10, 60);
    if (!rateCheck.allowed) {
      return { post: null, error: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds}s.` };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const isScheduled = isInstructor && postData.status === 'scheduled';
    const isPinned = isInstructor && Boolean(postData.isPinned);

    const nowMs = Date.now();
    const newPost: CoursePost = {
      ...postData,
      authorAvatar: currentUser.role === 'student' ? '' : currentUser.avatar || postData.authorAvatar,
      isPinned,
      status: isScheduled ? 'scheduled' : 'published',
      id: `post-${nowMs}`,
      createdAt: isScheduled
        ? `Scheduled for ${postData.scheduledForDisplay || 'upcoming'}`
        : this.formatPostTimestamp(nowMs),
      createdAtMs: nowMs,
      likes: [],
      comments: [],
    };

    this.markLocalWrite(newPost.id);
    const sortedPosts = [newPost, ...posts].sort(
      (a, b) => this.getPostSortTimestamp(b) - this.getPostSortTimestamp(a)
    );
    this.setItem(STORAGE_KEYS.POSTS, sortedPosts);
    try {
      SupabaseService.upsertPost(newPost).catch(() => {});
    } catch {
      // ignore
    }

    // Send notifications to all enrolled students in this classroom if published immediately
    let notifiedCount = 0;
    if (!isScheduled) {
      const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
      const course = allCourses.find((c) => c.id === postData.courseId);
      if (course) {
        notifiedCount = this.notifyEnrolledStudentsOfCoursePost(
          course,
          newPost,
          currentUser.name,
          currentUser.role
        );
      }
    }

    return { post: newPost, notifiedCount };
  }

  static updatePost(
    postId: string,
    updates: Partial<CoursePost>,
    currentUser: User
  ): { post: CoursePost | null; error?: string } {
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const target = posts.find((p) => p.id === postId);
    if (!target) {
      return { post: null, error: 'Post not found.' };
    }

    const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
    if (!isInstructor) {
      return { post: null, error: 'Unauthorized: Admin နှင့် Co-admin များသာ Post များကို ပြင်ဆင်ခွင့်ရှိပါသည်။' };
    }

    let updatedPost: CoursePost | null = null;

    const newPosts = posts.map((p) => {
      if (p.id === postId) {
        updatedPost = {
          ...p,
          ...updates,
        };
        return updatedPost;
      }
      return p;
    });

    if (!updatedPost) {
      return { post: null, error: 'Post not found.' };
    }

    this.setItem(STORAGE_KEYS.POSTS, newPosts);
    try {
      SupabaseService.upsertPost(updatedPost).catch(() => {});
    } catch {
      // ignore
    }
    return { post: updatedPost };
  }

  static togglePinPost(
    postId: string,
    currentUser: User
  ): { success: boolean; isPinned?: boolean; error?: string; pinnedCount?: number } {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only instructors/admins/co-admins can pin or unpin posts.' };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const target = posts.find((p) => p.id === postId);
    if (!target) {
      return { success: false, error: 'Post not found.' };
    }

    // Count existing pinned posts for this course (excluding the target post itself)
    const otherPinned = posts.filter((p) => p.courseId === target.courseId && p.isPinned && p.id !== postId);

    if (target.isPinned) {
      // Unpin post
      let updatedTarget: CoursePost | null = null;
      const updated = posts.map((p) => {
        if (p.id === postId) {
          updatedTarget = {
            ...p,
            isPinned: false,
            pinnedAt: undefined,
            pinOrder: undefined,
          };
          return updatedTarget;
        }
        return p;
      });
      this.setItem(STORAGE_KEYS.POSTS, updated);
      if (updatedTarget) {
        try {
          SupabaseService.upsertPost(updatedTarget).catch(() => {});
        } catch {
          // ignore
        }
      }
      return { success: true, isPinned: false, pinnedCount: otherPinned.length };
    } else {
      // Pin post - check max 3 pinned limit
      if (otherPinned.length >= 3) {
        return {
          success: false,
          error: 'ဤအတန်းတွင် Pin post အများဆုံး ၃ ခုသာ တစ်ပြိုင်တည်း ထားရှိနိုင်ပါသည်။ အခြား Pin post တစ်ခုကို Unpin ပြုလုပ်ပြီးမှ ထပ်မံ Pin လုပ်ပါ။ (Maximum 3 pinned posts reached)',
          pinnedCount: otherPinned.length,
        };
      }

      const newOrder = otherPinned.length + 1;
      let updatedTarget: CoursePost | null = null;
      const updated = posts.map((p) => {
        if (p.id === postId) {
          updatedTarget = {
            ...p,
            isPinned: true,
            pinnedAt: new Date().toISOString(),
            pinOrder: newOrder,
          };
          return updatedTarget;
        }
        return p;
      });
      this.setItem(STORAGE_KEYS.POSTS, updated);
      if (updatedTarget) {
        try {
          SupabaseService.upsertPost(updatedTarget).catch(() => {});
        } catch {
          // ignore
        }
      }
      return { success: true, isPinned: true, pinnedCount: newOrder };
    }
  }

  static publishScheduledPostNow(
    postId: string,
    currentUser: User
  ): { success: boolean; notifiedCount?: number; error?: string } {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only instructors/admins/co-admins can publish scheduled posts.' };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const target = posts.find((p) => p.id === postId);
    if (!target) {
      return { success: false, error: 'Post not found.' };
    }

    let publishedPost: CoursePost | null = null;
    const nowMs = Date.now();
    const updated = posts.map((p) => {
      if (p.id === postId) {
        publishedPost = {
          ...p,
          status: 'published' as const,
          createdAt: this.formatPostTimestamp(nowMs),
          createdAtMs: nowMs,
          scheduledFor: undefined,
          scheduledForDisplay: undefined,
        };
        return publishedPost;
      }
      return p;
    });

    const sortedUpdated = [...updated].sort(
      (a, b) => this.getPostSortTimestamp(b) - this.getPostSortTimestamp(a)
    );
    this.setItem(STORAGE_KEYS.POSTS, sortedUpdated);
    if (publishedPost) {
      this.markLocalWrite((publishedPost as CoursePost).id);
      try {
        SupabaseService.upsertPost(publishedPost).catch(() => {});
      } catch {
        // ignore
      }
    }

    // Send notifications to all enrolled students in this classroom
    let notifiedCount = 0;
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const course = allCourses.find((c) => c.id === target.courseId);
    if (course && publishedPost) {
      notifiedCount = this.notifyEnrolledStudentsOfCoursePost(
        course,
        publishedPost,
        currentUser.name,
        currentUser.role
      );
    }

    return { success: true, notifiedCount };
  }

  static deletePost(postId: string, currentUser: User): boolean {
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
    if (!isInstructor) {
      return false;
    }

    const updated = posts.filter((p) => p.id !== postId);
    this.setItem(STORAGE_KEYS.POSTS, updated);

    // Also remove any notifications linked to this post locally
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const removedNotifIds = notifs.filter((n) => n.postId === postId).map((n) => n.id);
    if (removedNotifIds.length > 0) {
      this.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        notifs.filter((n) => n.postId !== postId)
      );
    }

    this.recordDeletedIds([postId, ...removedNotifIds]);

    // Auto-delete post and its notifications from Supabase SQL database
    try {
      SupabaseService.deletePost(postId).catch(() => {});
    } catch {
      // ignore
    }

    return true;
  }

  static toggleLike(postId: string, userId: string): boolean {
    const rateCheck = this.checkRateLimit('like_toggle', userId, 25, 60);
    if (!rateCheck.allowed) return false;

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return false;

    const currentLogged = this.getCurrentUser();
    if (currentLogged) {
      const access = this.getCourseById(targetPost.courseId, currentLogged);
      if (!access.course) return false;
    }

    let updatedPost: CoursePost | null = null;
    const updated = posts.map((post) => {
      if (post.id === postId) {
        const hasLiked = post.likes.includes(userId);
        updatedPost = {
          ...post,
          likes: hasLiked ? post.likes.filter((id) => id !== userId) : [...post.likes, userId],
        };
        return updatedPost;
      }
      return post;
    });
    this.setItem(STORAGE_KEYS.POSTS, updated);
    if (updatedPost) {
      try {
        SupabaseService.upsertPost(updatedPost).catch(() => {});
      } catch {
        // ignore
      }
    }
    return true;
  }

  static addComment(
    postId: string,
    content: string,
    currentUser: User
  ): { comment: PostComment | null; error?: string } {
    const cleanContent = content.trim().slice(0, 2000);
    if (!cleanContent) {
      return { comment: null, error: 'Comment စာသား ရိုက်ထည့်ပေးပါ။' };
    }

    const rateCheck = this.checkRateLimit('comment_post', currentUser.id, 6, 60);
    if (!rateCheck.allowed) {
      return {
        comment: null,
        error: `Anti-spam rate limit triggered. Please wait ${rateCheck.retryAfterSeconds}s before commenting again.`,
      };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      return { comment: null, error: 'Post not found.' };
    }

    // Strict course enrollment verification before allowing comment
    const access = this.getCourseById(targetPost.courseId, currentUser);
    if (!access.course) {
      return { comment: null, error: access.error || 'Access denied.' };
    }

    const nowMs = Date.now();
    const newComment: PostComment = {
      id: `comm-${nowMs}`,
      postId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.role === 'student' ? '' : currentUser.avatar,
      content: cleanContent,
      createdAt: this.formatPostTimestamp(nowMs),
    };

    let updatedPost: CoursePost | null = null;
    const updated = posts.map((post) => {
      if (post.id === postId) {
        updatedPost = {
          ...post,
          comments: [...post.comments, newComment],
        };
        return updatedPost;
      }
      return post;
    });

    this.setItem(STORAGE_KEYS.POSTS, updated);
    if (updatedPost) {
      try {
        SupabaseService.upsertPost(updatedPost).catch(() => {});
      } catch {
        // ignore
      }
    }
    return { comment: newComment };
  }

  static deleteComment(postId: string, commentId: string, currentUser: User): boolean {
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return false;

    const targetComment = targetPost.comments.find((c) => c.id === commentId);
    if (!targetComment) return false;

    const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
    if (!isInstructor && targetComment.authorId !== currentUser.id) {
      return false;
    }

    let updatedPost: CoursePost | null = null;
    const updated = posts.map((post) => {
      if (post.id === postId) {
        updatedPost = {
          ...post,
          comments: post.comments.filter((c) => c.id !== commentId),
        };
        return updatedPost;
      }
      return post;
    });

    this.setItem(STORAGE_KEYS.POSTS, updated);
    if (updatedPost) {
      try {
        SupabaseService.upsertPost(updatedPost).catch(() => {});
      } catch {
        // ignore
      }
    }
    return true;
  }

  // Assignments
  static getAssignments(courseId: string): Assignment[] {
    const assignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    return assignments.filter((a) => a.courseId === courseId);
  }

  static getSubmissions(assignmentId: string, currentUser: User): AssignmentSubmission[] {
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    if (currentUser.role === 'admin' || currentUser.role === 'co_admin') {
      return submissions.filter((s) => s.assignmentId === assignmentId);
    }
    return submissions.filter((s) => s.assignmentId === assignmentId && s.studentId === currentUser.id);
  }

  static submitAssignment(
    assignmentId: string,
    courseId: string,
    submissionText: string,
    fileName: string,
    currentUser: User
  ): AssignmentSubmission {
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const existingIndex = submissions.findIndex(
      (s) => s.assignmentId === assignmentId && s.studentId === currentUser.id
    );

    const submission: AssignmentSubmission = {
      id: existingIndex >= 0 ? submissions[existingIndex].id : `sub-${Date.now()}`,
      assignmentId,
      courseId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentAvatar: currentUser.avatar,
      submissionText,
      fileAttachment: {
        name: fileName || `${currentUser.username}_assignment_submission.pdf`,
        size: '1.8 MB',
        uploadDate: 'Today',
        mockUrl: '#',
      },
      status: 'submitted',
      submittedAt: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let updated: AssignmentSubmission[];
    if (existingIndex >= 0) {
      updated = [...submissions];
      updated[existingIndex] = submission;
    } else {
      updated = [submission, ...submissions];
    }
    this.setItem(STORAGE_KEYS.SUBMISSIONS, updated);
    try {
      SupabaseService.upsertAssignmentSubmission(submission).catch(() => {});
    } catch {
      // ignore
    }

    // Track progress
    this.recordCompletedAssignment(currentUser.id, courseId, assignmentId);

    return submission;
  }

  static gradeAssignment(submissionId: string, grade: number, feedback: string): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const safeGrade = Math.max(0, Math.min(100, Number.isFinite(grade) ? Math.round(grade) : 0));
    const safeFeedback = (feedback || '').trim().slice(0, 2000);

    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const target = submissions.find((s) => s.id === submissionId);
    if (!target) return false;

    let gradedSub: AssignmentSubmission | null = null;
    const updated = submissions.map((s) => {
      if (s.id === submissionId) {
        gradedSub = {
          ...s,
          status: 'graded' as const,
          grade: safeGrade,
          feedback: safeFeedback,
          gradedAt: 'Just now',
        };
        return gradedSub;
      }
      return s;
    });

    this.setItem(STORAGE_KEYS.SUBMISSIONS, updated);
    if (gradedSub) {
      try {
        SupabaseService.upsertAssignmentSubmission(gradedSub).catch(() => {});
      } catch {
        // ignore
      }
    }

    // Notify student
    this.addNotification({
      userId: target.studentId,
      courseId: target.courseId,
      courseTitle: 'Course Assignment',
      title: 'Assignment Graded',
      message: `Your score: ${safeGrade}/100. "${safeFeedback}"`,
      type: 'grade',
    });

    return true;
  }

  static deleteAssignment(assignmentId: string, currentUser: User): boolean {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') return false;
    const assignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    if (!assignments.some((a) => a.id === assignmentId)) return false;

    this.setItem(
      STORAGE_KEYS.ASSIGNMENTS,
      assignments.filter((a) => a.id !== assignmentId)
    );
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const subIds = submissions.filter((s) => s.assignmentId === assignmentId).map((s) => s.id);
    this.setItem(
      STORAGE_KEYS.SUBMISSIONS,
      submissions.filter((s) => s.assignmentId !== assignmentId)
    );
    this.recordDeletedIds([assignmentId, ...subIds]);

    try {
      SupabaseService.deleteAssignment(assignmentId).catch(() => {});
    } catch {
      // ignore
    }
    return true;
  }

  static deleteSubmission(submissionId: string, currentUser: User): boolean {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') return false;
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    if (!submissions.some((s) => s.id === submissionId)) return false;

    this.setItem(
      STORAGE_KEYS.SUBMISSIONS,
      submissions.filter((s) => s.id !== submissionId)
    );
    this.recordDeletedIds([submissionId]);

    try {
      SupabaseService.deleteAssignmentSubmission(submissionId).catch(() => {});
    } catch {
      // ignore
    }
    return true;
  }

  // Quizzes & Scoring
  static getQuizzes(courseId: string): Quiz[] {
    const quizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    return quizzes.filter((q) => q.courseId === courseId);
  }

  static deleteQuiz(quizId: string, currentUser: User): boolean {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') return false;
    const quizzes = this.getItem<Quiz[]>(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    if (!quizzes.some((q) => q.id === quizId)) return false;

    this.setItem(
      STORAGE_KEYS.QUIZZES,
      quizzes.filter((q) => q.id !== quizId)
    );
    const quizSubs = this.getItem<QuizSubmission[]>(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    this.setItem(
      STORAGE_KEYS.QUIZ_SUBMISSIONS,
      quizSubs.filter((qs) => qs.quizId !== quizId)
    );
    this.recordDeletedIds([quizId]);

    try {
      SupabaseService.deleteQuiz(quizId).catch(() => {});
    } catch {
      // ignore
    }
    return true;
  }

  static getQuizSubmissions(quizId: string, studentId: string): QuizSubmission[] {
    const submissions = this.getItem<QuizSubmission[]>(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    return submissions.filter((qs) => qs.quizId === quizId && qs.studentId === studentId);
  }

  static submitQuiz(
    quiz: Quiz,
    answers: Record<string, number>,
    currentUser: User
  ): { submission: QuizSubmission; passed: boolean; score: number } {
    let correctCount = 0;
    const totalQuestions = quiz.questions?.length || 0;
    if (totalQuestions > 0) {
      quiz.questions.forEach((q) => {
        if (answers[q.id] === q.correctIndex) {
          correctCount++;
        }
      });
    }

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 100;
    const passed = score >= quiz.passingScore;

    const submissions = this.getItem<QuizSubmission[]>(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    const newSub: QuizSubmission = {
      id: `qsub-${Date.now()}`,
      quizId: quiz.id,
      courseId: quiz.courseId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      score,
      passed,
      answers,
      submittedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };

    this.setItem(STORAGE_KEYS.QUIZ_SUBMISSIONS, [newSub, ...submissions]);
    try {
      SupabaseService.upsertQuizSubmission({
        id: newSub.id,
        quizId: newSub.quizId,
        studentId: newSub.studentId,
        studentName: newSub.studentName,
        score: newSub.score,
        passed: newSub.passed,
        answers: newSub.answers,
      }).catch(() => {});
    } catch {
      // ignore
    }

    if (passed) {
      this.recordPassedQuiz(currentUser.id, quiz.courseId, quiz.id);
    }

    return { submission: newSub, passed, score };
  }

  // Progress Tracking & Completion
  static getStudentProgress(studentId: string, courseId: string): StudentProgress {
    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    const match = allProgress.find((p) => p.studentId === studentId && p.courseId === courseId);
    if (match) return match;

    const newProg: StudentProgress = {
      studentId,
      courseId,
      completedLessonIds: [],
      completedAssignmentIds: [],
      passedQuizIds: [],
    };
    return newProg;
  }

  static markLessonCompleted(studentId: string, courseId: string, lessonId: string): void {
    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    let found = false;
    const updated = allProgress.map((p) => {
      if (p.studentId === studentId && p.courseId === courseId) {
        found = true;
        if (!p.completedLessonIds.includes(lessonId)) {
          return {
            ...p,
            completedLessonIds: [...p.completedLessonIds, lessonId],
          };
        }
      }
      return p;
    });

    if (!found) {
      updated.push({
        studentId,
        courseId,
        completedLessonIds: [lessonId],
        completedAssignmentIds: [],
        passedQuizIds: [],
      });
    }

    this.setItem(STORAGE_KEYS.PROGRESS, updated);
  }

  static recordCompletedAssignment(studentId: string, courseId: string, assignmentId: string): void {
    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    let found = false;
    const updated = allProgress.map((p) => {
      if (p.studentId === studentId && p.courseId === courseId) {
        found = true;
        if (!p.completedAssignmentIds.includes(assignmentId)) {
          return {
            ...p,
            completedAssignmentIds: [...p.completedAssignmentIds, assignmentId],
          };
        }
      }
      return p;
    });

    if (!found) {
      updated.push({
        studentId,
        courseId,
        completedLessonIds: [],
        completedAssignmentIds: [assignmentId],
        passedQuizIds: [],
      });
    }

    this.setItem(STORAGE_KEYS.PROGRESS, updated);
  }

  static recordPassedQuiz(studentId: string, courseId: string, quizId: string): void {
    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    let found = false;
    const updated = allProgress.map((p) => {
      if (p.studentId === studentId && p.courseId === courseId) {
        found = true;
        if (!p.passedQuizIds.includes(quizId)) {
          return {
            ...p,
            passedQuizIds: [...p.passedQuizIds, quizId],
          };
        }
      }
      return p;
    });

    if (!found) {
      updated.push({
        studentId,
        courseId,
        completedLessonIds: [],
        completedAssignmentIds: [],
        passedQuizIds: [quizId],
      });
    }

    this.setItem(STORAGE_KEYS.PROGRESS, updated);
  }

  static issueCertificate(student: User, course: Course): CertificateData {
    const certId = `CERT-EDU-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const attStats = this.getStudentAttendanceStats(course.id, student.id);
    const cert: CertificateData = {
      certificateId: certId,
      courseId: course.id,
      courseTitle: course.title,
      courseCode: course.code,
      studentId: student.id,
      studentName: student.name,
      issuedAt: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      gradeAverage: 95,
      attendancePercentage: attStats.percentage,
      verificationUrl: `https://www.swanarhclassroom.online/verify/${certId}`,
      instructorSignature: `${course.instructorName} (Lead Faculty)`,
    };

    const allProgress = this.getItem<StudentProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    let found = false;
    const updated = allProgress.map((p) => {
      if (p.studentId === student.id && p.courseId === course.id) {
        found = true;
        return {
          ...p,
          certificate: cert,
        };
      }
      return p;
    });

    if (!found) {
      updated.push({
        studentId: student.id,
        courseId: course.id,
        completedLessonIds: [],
        completedAssignmentIds: [],
        passedQuizIds: [],
        certificate: cert,
      });
    }

    this.setItem(STORAGE_KEYS.PROGRESS, updated);

    // Notify student
    this.addNotification({
      userId: student.id,
      courseId: course.id,
      courseTitle: course.title,
      title: 'Certificate Issued!',
      message: `Your official completion certificate (${certId}) with ${attStats.percentage}% attendance is ready for download.`,
      type: 'certificate',
    });

    return cert;
  }

  // Student Attendance & Daily Check-in System
  static getAttendanceSessions(courseId: string): AttendanceSession[] {
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    return sessions
      .filter((s) => s.courseId === courseId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  static createAttendanceSession(
    courseId: string,
    title: string,
    date: string,
    isOpen: boolean,
    currentUser: User
  ): AttendanceSession {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') {
      throw new Error('Unauthorized: Only Admin or Co-Admin can create attendance sessions.');
    }
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const parsedDate = new Date(date + 'T00:00:00');
    const displayDate = isNaN(parsedDate.getTime())
      ? date
      : parsedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

    const newSession: AttendanceSession = {
      id: `att-sess-${Date.now()}`,
      courseId,
      date,
      displayDate,
      title: title.trim() || `Daily Class Check-in (${displayDate})`,
      isOpen,
      openedBy: currentUser.name,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      records: {},
    };

    this.markLocalWrite(newSession.id);
    this.setItem(STORAGE_KEYS.ATTENDANCE, [newSession, ...sessions]);
    try {
      SupabaseService.upsertAttendanceSession(newSession).catch(() => {});
    } catch {
      // ignore
    }
    return newSession;
  }

  static toggleAttendanceSessionOpen(sessionId: string, isOpen: boolean): AttendanceSession | null {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return null;
    }
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    let updatedSession: AttendanceSession | null = null;
    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        updatedSession = { ...s, isOpen };
        return updatedSession;
      }
      return s;
    });
    this.setItem(STORAGE_KEYS.ATTENDANCE, updated);
    if (updatedSession) {
      try {
        SupabaseService.upsertAttendanceSession(updatedSession).catch(() => {});
      } catch {
        // ignore
      }
    }
    return updatedSession;
  }

  static deleteAttendanceSession(sessionId: string): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const updated = sessions.filter((s) => s.id !== sessionId);
    this.setItem(STORAGE_KEYS.ATTENDANCE, updated);
    this.recordDeletedIds([sessionId]);

    // Auto-delete from Supabase SQL database
    try {
      SupabaseService.deleteAttendanceSession(sessionId).catch(() => {});
    } catch {
      // ignore
    }
    return true;
  }

  static studentCheckIn(
    sessionId: string,
    student: User
  ): { success: boolean; error?: string } {
    const rateCheck = this.checkRateLimit('attendance_checkin', student.id, 10, 60);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Check-in ကြိုးပမ်းမှု များပြားနေပါသည်။ ${rateCheck.retryAfterSeconds} စက္ကန့် စောင့်ဆိုင်းပါ။`,
      };
    }

    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) {
      return { success: false, error: 'Attendance session မတွေ့ရှိပါ။' };
    }
    if (!target.isOpen) {
      return { success: false, error: 'ဤအတန်းချိန်အတွက် Attendance ပိတ်ထားပါသည်။' };
    }

    // Verify student is enrolled in the course
    const access = this.getCourseById(target.courseId, student);
    if (!access.course) {
      return { success: false, error: 'သင်သည် ဤအတန်းတွင် စာရင်းသွင်းထားခြင်း မရှိပါ။' };
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let updatedSession: AttendanceSession | null = null;
    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        updatedSession = {
          ...s,
          records: {
            ...s.records,
            [student.id]: {
              studentId: student.id,
              studentName: student.name,
              status: 'present' as AttendanceStatus,
              checkedInAt: nowTime,
              checkedInBy: 'student' as const,
            },
          },
        };
        return updatedSession;
      }
      return s;
    });

    this.setItem(STORAGE_KEYS.ATTENDANCE, updated);
    if (updatedSession) {
      try {
        SupabaseService.upsertAttendanceSession(updatedSession).catch(() => {});
      } catch {
        // ignore
      }
    }
    return { success: true };
  }

  static instructorMarkAttendance(
    sessionId: string,
    student: User,
    status: AttendanceStatus,
    note?: string
  ): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let updatedSession: AttendanceSession | null = null;
    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        const prevRecord = s.records[student.id];
        updatedSession = {
          ...s,
          records: {
            ...s.records,
            [student.id]: {
              studentId: student.id,
              studentName: student.name,
              status,
              checkedInAt: status === 'absent' ? undefined : prevRecord?.checkedInAt || nowTime,
              checkedInBy: 'instructor' as const,
              note: note !== undefined ? note : prevRecord?.note,
            },
          },
        };
        return updatedSession;
      }
      return s;
    });

    this.setItem(STORAGE_KEYS.ATTENDANCE, updated);
    if (updatedSession) {
      try {
        SupabaseService.upsertAttendanceSession(updatedSession).catch(() => {});
      } catch {
        // ignore
      }
    }
    return true;
  }

  static markAllStudentsAttendance(
    sessionId: string,
    students: User[],
    status: AttendanceStatus
  ): boolean {
    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return false;
    }
    const sessions = this.getItem<AttendanceSession[]>(
      STORAGE_KEYS.ATTENDANCE,
      INITIAL_ATTENDANCE_SESSIONS
    );
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let updatedSession: AttendanceSession | null = null;
    const updated = sessions.map((s) => {
      if (s.id === sessionId) {
        const nextRecords: Record<string, AttendanceRecord> = { ...s.records };
        students.forEach((stu) => {
          nextRecords[stu.id] = {
            studentId: stu.id,
            studentName: stu.name,
            status,
            checkedInAt: status === 'absent' ? undefined : nextRecords[stu.id]?.checkedInAt || nowTime,
            checkedInBy: 'instructor',
          };
        });
        updatedSession = { ...s, records: nextRecords };
        return updatedSession;
      }
      return s;
    });

    this.setItem(STORAGE_KEYS.ATTENDANCE, updated);
    if (updatedSession) {
      try {
        SupabaseService.upsertAttendanceSession(updatedSession).catch(() => {});
      } catch {
        // ignore
      }
    }
    return true;
  }

  static getStudentAttendanceStats(
    courseId: string,
    studentId: string
  ): {
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    excusedCount: number;
    absentCount: number;
    percentage: number;
  } {
    const cacheKey = `${courseId}:${studentId}`;
    const cached = this.attendanceStatsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sessions = this.getAttendanceSessions(courseId);
    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      const emptyStats = {
        totalSessions: 0,
        presentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        absentCount: 0,
        percentage: 100,
      };
      this.attendanceStatsCache.set(cacheKey, emptyStats);
      return emptyStats;
    }

    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;
    let weightedAttended = 0;

    sessions.forEach((sess) => {
      const rec = sess.records[studentId];
      const status = rec?.status || (sess.isOpen ? 'absent' : 'absent');
      if (rec?.status === 'present') {
        presentCount++;
        weightedAttended += 1;
      } else if (rec?.status === 'late') {
        lateCount++;
        weightedAttended += 0.85; // Late counts as 85% credit
      } else if (rec?.status === 'excused') {
        excusedCount++;
        weightedAttended += 1; // Excused leave does not penalize percentage
      } else if (status === 'absent') {
        absentCount++;
      }
    });

    const percentage = Math.min(100, Math.round((weightedAttended / totalSessions) * 100));
    const computed = {
      totalSessions,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      percentage,
    };
    this.attendanceStatsCache.set(cacheKey, computed);
    return computed;
  }

  static calculateTotalAttendancePercentage(courseId: string, studentId: string): number {
    return this.getStudentAttendanceStats(courseId, studentId).percentage;
  }

  static downloadClassAttendanceCSV(courseId: string): {
    success: boolean;
    filename?: string;
    rowCount?: number;
  } {
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const course = allCourses.find((c) => c.id === courseId);
    if (!course) return { success: false };

    const allUsers = this.getAllUsers();
    const enrolledStudents = allUsers.filter(
      (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
    );

    // Chronological order of sessions for column headers
    const sessions = [...this.getAttendanceSessions(course.id)].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const escapeCsv = (val: string | number | undefined) => {
      let str = String(val ?? '');
      // Prevent CSV Formula Injection in Excel / Google Sheets
      if (/^[=+\-\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Student Name',
      'Username',
      'Email',
      'Phone',
      'Gender',
      'Address',
      'Course Code',
      'Course Title',
      'Batch',
      'Total Sessions',
      'Present Count',
      'Late Count',
      'Excused Count',
      'Absent Count',
      'Total Attendance (%)',
      'Certificate Eligibility (>=75%)',
      ...sessions.map((s) => `${s.date} (${s.title})`),
    ];

    const rows = enrolledStudents.map((stu) => {
      const stats = this.getStudentAttendanceStats(course.id, stu.id);
      const sessionCells = sessions.map((sess) => {
        const rec = sess.records[stu.id];
        if (!rec) return 'Absent';
        const statusLabel =
          rec.status.charAt(0).toUpperCase() + rec.status.slice(1);
        return rec.checkedInAt
          ? `${statusLabel} (${rec.checkedInAt})`
          : statusLabel;
      });

      return [
        stu.name,
        `@${stu.username}`,
        stu.email,
        stu.phone || '',
        stu.gender || '',
        stu.address || '',
        course.code,
        course.title,
        course.batch,
        stats.totalSessions,
        stats.presentCount,
        stats.lateCount,
        stats.excusedCount,
        stats.absentCount,
        `${stats.percentage}%`,
        stats.percentage >= 75 ? 'Eligible' : 'Below 75%',
        ...sessionCells,
      ].map(escapeCsv);
    });

    const csvContent =
      '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const safeCode = course.code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Attendance_Report_${safeCode}_${dateStamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      rowCount: enrolledStudents.length,
    };
  }

  static downloadAllClassesAttendanceCSV(): {
    success: boolean;
    filename?: string;
    rowCount?: number;
  } {
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const allUsers = this.getAllUsers();
    const students = allUsers.filter((u) => u.role === 'student');

    const escapeCsv = (val: string | number | undefined) => {
      let str = String(val ?? '');
      // Prevent CSV Formula Injection in Excel / Google Sheets
      if (/^[=+\-\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Course Code',
      'Course Title',
      'Batch',
      'Student Name',
      'Username',
      'Email',
      'Phone',
      'Gender',
      'Address',
      'Total Sessions',
      'Present Count',
      'Late Count',
      'Excused Count',
      'Absent Count',
      'Total Attendance (%)',
      'Certificate Eligibility (>=75%)',
    ];

    const rows: string[][] = [];
    allCourses.forEach((course) => {
      const enrolled = students.filter((s) => course.enrolledStudentIds.includes(s.id));
      enrolled.forEach((stu) => {
        const stats = this.getStudentAttendanceStats(course.id, stu.id);
        rows.push(
          [
            course.code,
            course.title,
            course.batch,
            stu.name,
            `@${stu.username}`,
            stu.email,
            stu.phone || '',
            stu.gender || '',
            stu.address || '',
            stats.totalSessions,
            stats.presentCount,
            stats.lateCount,
            stats.excusedCount,
            stats.absentCount,
            `${stats.percentage}%`,
            stats.percentage >= 75 ? 'Eligible' : 'Below 75%',
          ].map(escapeCsv)
        );
      });
    });

    const csvContent =
      '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `All_Classes_Attendance_Report_${dateStamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      rowCount: rows.length,
    };
  }

  static downloadRulesAcceptanceAuditCSV(
    filterMode: 'all' | 'accepted_only' = 'all'
  ): {
    success: boolean;
    filename?: string;
    acceptedCount: number;
    totalStudents: number;
  } {
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const allUsers = this.getAllUsers();
    const allStudents = allUsers.filter((u) => u.role === 'student');
    const targetStudents =
      filterMode === 'accepted_only'
        ? allStudents.filter((s) => Boolean(s.rulesAccepted))
        : allStudents;

    const escapeCsv = (val: string | number | undefined) => {
      let str = String(val ?? '');
      if (/^[=+\-\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Student ID',
      'Student Name',
      'Username',
      'Email',
      'Phone',
      'Gender',
      'Address',
      'Enrolled Courses',
      'Rule Status',
      'Declaration (သိရှိ လိုက်နာပါမည်)',
      'Accepted Timestamp',
    ];

    const rows = targetStudents.map((stu) => {
      const enrolledCodes = allCourses
        .filter((c) => c.enrolledStudentIds.includes(stu.id))
        .map((c) => `${c.code} (${c.batch})`)
        .join('; ');

      return [
        stu.id,
        stu.name,
        `@${stu.username}`,
        stu.email,
        stu.phone || '',
        stu.gender || '',
        stu.address || '',
        enrolledCodes || 'None',
        stu.rulesAccepted ? 'Accepted' : 'Pending',
        stu.rulesAccepted ? 'သိရှိ လိုက်နာပါမည် (Accepted)' : 'စည်းကမ်းချက် လက်ခံရန်ကျန် (Pending)',
        stu.rulesAccepted ? stu.rulesAcceptedAt || 'Accepted' : '—',
      ].map(escapeCsv);
    });

    const csvContent =
      '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `SwanArh_Rules_Acceptance_Audit_${dateStamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      acceptedCount: allStudents.filter((s) => Boolean(s.rulesAccepted)).length,
      totalStudents: allStudents.length,
    };
  }

  // Notifications (with 30-Minute Auto-Deletion locally & in Supabase)
  static purgeExpiredNotifications(forceCloudCleanup: boolean = false): boolean {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const now = Date.now();
    const expiredIds: string[] = [];
    let mutated = false;

    const activeNotifs: NotificationItem[] = [];

    for (const n of notifs) {
      let createdMs = n.createdAtMs;
      if (!createdMs) {
        createdMs =
          this.extractTimestampFromId(n.id) ||
          this.extractTimestampFromId(n.postId) ||
          now;
        mutated = true;
      }
      const expiresMs = n.expiresAtMs || createdMs + NOTIFICATION_TTL_MS;

      if (now >= expiresMs || now - createdMs >= NOTIFICATION_TTL_MS) {
        expiredIds.push(n.id);
        mutated = true;
      } else {
        activeNotifs.push(
          n.createdAtMs === createdMs && n.expiresAtMs === expiresMs
            ? n
            : { ...n, createdAtMs: createdMs, expiresAtMs: expiresMs }
        );
      }
    }

    if (mutated) {
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, activeNotifs);
    }

    if (expiredIds.length > 0 || forceCloudCleanup) {
      try {
        SupabaseService.purgeExpiredNotifications(expiredIds, forceCloudCleanup).catch(() => {});
      } catch {
        // ignore
      }
    }

    return expiredIds.length > 0;
  }

  static getNotifications(userId: string): NotificationItem[] {
    this.purgeExpiredNotifications();
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    return notifs.filter((n) => n.userId === userId);
  }

  static markNotificationRead(notificationId: string): void {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    let targetNotif: NotificationItem | null = null;
    const updated = notifs.map((n) => {
      if (n.id === notificationId) {
        targetNotif = { ...n, isRead: true };
        return targetNotif;
      }
      return n;
    });
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    if (targetNotif) {
      try {
        SupabaseService.upsertNotifications([targetNotif]).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  static markAllNotificationsRead(userId: string): void {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const updatedForUser: NotificationItem[] = [];
    const updated = notifs.map((n) => {
      if (n.userId === userId && !n.isRead) {
        const readItem = { ...n, isRead: true };
        updatedForUser.push(readItem);
        return readItem;
      }
      return n;
    });
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    if (updatedForUser.length > 0) {
      try {
        SupabaseService.upsertNotifications(updatedForUser).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  static addNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>): NotificationItem {
    this.purgeExpiredNotifications();
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const nowMs = Date.now();
    const timeLabel = new Date(nowMs).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: timeLabel,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + NOTIFICATION_TTL_MS,
      isRead: false,
    };
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...notifs]);
    try {
      SupabaseService.upsertNotifications([newNotif]).catch(() => {});
    } catch {
      // ignore
    }
    return newNotif;
  }

  /**
   * Dispatches a classroom post notification to every student enrolled in `course.enrolledStudentIds`.
   * Each notification is stamped with a 30-minute expiration window (`expiresAtMs`) and synced to Supabase,
   * after which it is automatically deleted from both local storage and Supabase.
   */
  static notifyEnrolledStudentsOfCoursePost(
    course: Course,
    post: CoursePost,
    authorName: string,
    authorRole: UserRole
  ): number {
    if (!course.enrolledStudentIds || course.enrolledStudentIds.length === 0) {
      return 0;
    }

    // Deduplicate by post.id so the same post can NEVER trigger notifications more than once
    const notifiedPostIds = new Set(
      this.getItem<string[]>(STORAGE_KEYS.NOTIFIED_POST_IDS, [])
    );
    if (notifiedPostIds.has(post.id)) {
      return 0;
    }

    this.purgeExpiredNotifications();

    const nowMs = Date.now();
    const postCreatedMs =
      post.createdAtMs ||
      this.extractTimestampFromId(post.id) ||
      nowMs;

    // Do not create notifications if the post is already older than 30 minutes
    if (nowMs - postCreatedMs >= NOTIFICATION_TTL_MS) {
      return 0;
    }

    notifiedPostIds.add(post.id);
    this.setItem(
      STORAGE_KEYS.NOTIFIED_POST_IDS,
      Array.from(notifiedPostIds).slice(-500)
    );

    const expiresMs = postCreatedMs + NOTIFICATION_TTL_MS;
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const existingKeys = new Set(
      notifs
        .filter((n) => n.postId)
        .map((n) => `${n.userId}:${n.postId}`)
    );

    const roleLabel =
      authorRole === 'admin'
        ? 'Admin (ဆရာ)'
        : authorRole === 'co_admin'
        ? 'Co-Admin (တွဲဖက်ဆရာ)'
        : 'Instructor';

    const typeLabel =
      post.postType === 'lesson'
        ? 'သင်ခန်းစာအသစ် (New Lesson)'
        : post.postType === 'resource'
        ? 'သင်ထောက်ကူဖိုင် (New Resource)'
        : 'ကြေညာချက်အသစ် (New Announcement)';

    const timeLabel = this.formatPostTimestamp(postCreatedMs);

    const createdList: NotificationItem[] = [];

    course.enrolledStudentIds.forEach((studentId) => {
      const dedupeKey = `${studentId}:${post.id}`;
      if (existingKeys.has(dedupeKey)) return;
      existingKeys.add(dedupeKey);

      createdList.push({
        id: `notif-post-${post.id}-${studentId}`,
        userId: studentId,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        postId: post.id,
        authorName,
        authorRole,
        title: `📢 [${course.code}] ${typeLabel}: ${post.title}`,
        message: `${authorName} (${roleLabel}) မှ "${course.title}" အတန်းတွင် ပို့စ်အသစ် တင်ထားပါသည်။`,
        type: 'post',
        isRead: false,
        createdAt: timeLabel,
        createdAtMs: postCreatedMs,
        expiresAtMs: expiresMs,
      });
    });

    if (createdList.length > 0) {
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, [...createdList, ...notifs]);

      // Sync new notifications to Supabase (where they will also auto-expire after 30 minutes)
      try {
        SupabaseService.upsertNotifications(createdList).catch(() => {});
      } catch {
        // ignore
      }

      // Trigger Browser Notification if the active user on this device is one of the notified students
      try {
        const loggedUser = this.getCurrentUser();
        if (
          loggedUser &&
          loggedUser.role === 'student' &&
          course.enrolledStudentIds.includes(loggedUser.id) &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(`📢 ${course.code} — ${post.title}`, {
            body: `${authorName} (${roleLabel}) မှ "${course.title}" အတန်းတွင် ပို့စ်အသစ် တင်ထားပါသည်။`,
            icon: './pwa-192x192.png',
          });
        }
      } catch {
        // ignore browser notification errors
      }
    }

    return course.enrolledStudentIds.length;
  }
}


