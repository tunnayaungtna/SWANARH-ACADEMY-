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
import { SupabaseService } from './supabase';
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
  private static getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
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
    this.setItem(STORAGE_KEYS.DELETED_IDS, Array.from(current));
  }

  // Init default storage
  static init(): void {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      this.setItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.COURSES)) {
      this.setItem(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      this.setItem(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) {
      this.setItem(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      this.setItem(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUIZZES)) {
      this.setItem(STORAGE_KEYS.QUIZZES, INITIAL_QUIZZES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUIZ_SUBMISSIONS)) {
      this.setItem(STORAGE_KEYS.QUIZ_SUBMISSIONS, INITIAL_QUIZ_SUBMISSIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROGRESS)) {
      this.setItem(STORAGE_KEYS.PROGRESS, INITIAL_PROGRESS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      this.setItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      this.setItem(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE_SESSIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS)) {
      const defaultSec: SecuritySettings = {
        textProtectionEnabled: true,
        dynamicWatermarkEnabled: true,
        watermarkOpacity: 0.22,
        domainRestriction: 'ais-dev-x3aphtm3a4npfd5tmiiqhv-683201169391.asia-southeast1.run.app',
      };
      this.setItem(STORAGE_KEYS.SECURITY_SETTINGS, defaultSec);
    }
    // Initialize theme
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

    // Verify user still exists in database and keep session profile fresh
    const allUsers = this.getAllUsers();
    const freshUser = allUsers.find((u) => u.id === storedUser.id);
    if (!freshUser) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return null;
    }
    return freshUser;
  }

  static setCurrentUser(user: User | null): void {
    if (user === null) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      this.setItem(STORAGE_KEYS.CURRENT_USER, user);
    }
  }

  static logout(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  static login(
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

    // Check rate limit on login attempts (max 6 attempts per 60 seconds per identifier)
    const rateCheck = this.checkRateLimit('auth_login', cleanId || 'ip', 6, 60);
    if (!rateCheck.allowed) {
      return {
        user: null,
        error: `လုံခြုံရေးအရ ဝင်ရောက်ရန် ကြိုးပမ်းမှု များပြားနေပါသည်။ ${rateCheck.retryAfterSeconds} စက္ကန့် စောင့်ဆိုင်းပြီးမှ ပြန်လည်ကြိုးစားပါ။`,
      };
    }

    const allUsers = this.getAllUsers();

    // Find user by email or username
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

    // Strict Password validation: only accept the specific user's registered password
    const defaultPwd =
      matched.role === 'admin'
        ? 'admin123'
        : matched.role === 'co_admin'
        ? 'coadmin123'
        : 'student123';
    const userPassword = matched.password || defaultPwd;

    if (cleanPwd !== userPassword) {
      return {
        user: null,
        error: genericAuthError,
      };
    }

    // Strict Role Tab verification (Checked only after valid credentials so usernames are never enumerated)
    if (expectedRole && matched.role !== expectedRole) {
      return {
        user: null,
        error:
          'ရွေးချယ်ထားသော အကောင့်အမျိုးအစား (Role Tab) နှင့် ကိုက်ညီမှု မရှိပါ။ သက်ဆိုင်ရာ Login Tab ကို ပြောင်းလဲရွေးချယ်ပြီး ဝင်ရောက်ပါ။',
      };
    }

    this.setCurrentUser(matched);
    return { user: matched };
  }

  static getAllUsers(): User[] {
    return this.getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
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

    // Curated high quality avatars if none provided
    const avatarPool = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    ];
    const finalAvatar = data.avatar?.trim() || avatarPool[users.length % avatarPool.length];

    const newUser: User = {
      id: `user-${data.role}-${Date.now()}`,
      name: data.name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password: cleanPassword,
      phone: data.phone.trim() || '+95 9 000 000000',
      role: data.role,
      avatar: finalAvatar,
      title: data.title?.trim() || (data.role === 'admin' ? 'Administrator' : data.role === 'co_admin' ? 'Course Coordinator & Assistant Instructor' : undefined),
      gender: data.gender || 'male',
      address: data.address?.trim() || undefined,
    };

    const updatedUsers = [...users, newUser];
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
    this.setItem(STORAGE_KEYS.USERS, users);

    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.id === userId) {
      currentLogged.avatar = avatarUrl;
      this.setCurrentUser(currentLogged);
    }

    try {
      SupabaseService.upsertProfile(users[userIndex]).catch(() => {});
    } catch {
      // ignore
    }

    return { success: true, user: users[userIndex] };
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

    const currentPwd =
      users[userIndex].password ||
      (users[userIndex].role === 'admin'
        ? 'admin123'
        : users[userIndex].role === 'co_admin'
        ? 'coadmin123'
        : 'student123');

    if (oldPassword.trim() !== currentPwd) {
      return { success: false, error: 'လက်ရှိ လျှို့ဝှက်နံပါတ် (Current Password) မှားယွင်းနေပါသည်။' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'လျှို့ဝှက်နံပါတ် အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။' };
    }

    users[userIndex].password = newPassword.trim();
    this.setItem(STORAGE_KEYS.USERS, users);

    const currentLogged = this.getCurrentUser();
    if (currentLogged && currentLogged.id === userId) {
      currentLogged.password = newPassword.trim();
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
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ (Admin သို့မဟုတ် Co-Admin သာ ပြောင်းလဲခွင့်ရှိပါသည်)။' };
    }

    const users = this.getAllUsers();
    const userIndex = users.findIndex((u) => u.id === studentId);
    if (userIndex === -1) {
      return { success: false, error: 'အကောင့် မတွေ့ရှိပါ။' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'လျှို့ဝှက်နံပါတ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။' };
    }

    users[userIndex].password = newPassword.trim();
    this.setItem(STORAGE_KEYS.USERS, users);

    if (currentLogged && currentLogged.id === studentId) {
      currentLogged.password = newPassword.trim();
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
    if (currentLogged && currentLogged.role !== 'admin' && currentLogged.role !== 'co_admin') {
      return { success: false, error: 'ခွင့်ပြုချက် မရှိပါ။' };
    }

    const users = this.getAllUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'အသုံးပြုသူ မတွေ့ရှိပါ။' };
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

  // Strict Course & Class Access Control (RLS simulation)
  static getCourses(currentUser: User): Course[] {
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
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
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const id = `course-${Date.now()}`;
    const course: Course = { ...newCourse, id };
    this.setItem(STORAGE_KEYS.COURSES, [course, ...courses]);
    try {
      SupabaseService.upsertCourse(course).catch(() => {});
    } catch {
      // ignore
    }
    return course;
  }

  static updateCourseBanner(courseId: string, bannerImage: string): Course | null {
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    let updatedCourse: Course | null = null;
    const updated = courses.map((c) => {
      if (c.id === courseId) {
        updatedCourse = {
          ...c,
          bannerImage: bannerImage.trim(),
        };
        return updatedCourse;
      }
      return c;
    });

    if (updatedCourse) {
      this.setItem(STORAGE_KEYS.COURSES, updated);
      try {
        SupabaseService.upsertCourse(updatedCourse).catch(() => {});
      } catch {
        // ignore
      }
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

  static async syncWithSupabase(): Promise<{
    success: boolean;
    syncedUsers: number;
    syncedCourses: number;
    error?: string;
  }> {
    const users = this.getAllUsers();
    const courses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const assignments = this.getItem<Assignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
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
      deletedIds
    );
  }

  private static activePullPromise: Promise<boolean> | null = null;

  /**
   * Pull latest users and courses from Supabase into local storage
   * while respecting locally deleted IDs so deleted items never reappear.
   * Deduplicates concurrent calls so startup never fires duplicate network requests.
   */
  static async pullFromSupabase(): Promise<boolean> {
    if (this.activePullPromise) {
      return this.activePullPromise;
    }

    this.activePullPromise = (async () => {
      try {
        const deletedSet = new Set(this.getDeletedIds());
        const [remoteProfiles, remoteCourses] = await Promise.all([
          SupabaseService.getRemoteProfiles(),
          SupabaseService.getRemoteCourses(),
        ]);

        let updated = false;

        if (remoteProfiles && remoteProfiles.length > 0) {
          const localUsers = this.getAllUsers().filter((u) => !deletedSet.has(u.id));
          const userMap = new Map<string, User>();
          localUsers.forEach((u) => userMap.set(u.id, u));
          remoteProfiles.forEach((ru) => {
            if (deletedSet.has(ru.id)) {
              SupabaseService.deleteProfile(ru.id).catch(() => {});
              return;
            }
            const existing = userMap.get(ru.id);
            userMap.set(ru.id, {
              ...existing,
              ...ru,
              password:
                ru.password ||
                existing?.password ||
                (ru.role === 'admin' ? 'admin123' : ru.role === 'co_admin' ? 'coadmin123' : 'student123'),
            });
          });
          this.setItem(STORAGE_KEYS.USERS, Array.from(userMap.values()));
          updated = true;
        }

        if (remoteCourses) {
          const localCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES).filter(
            (c) => !deletedSet.has(c.id)
          );
          const courseMap = new Map<string, Course>();
          localCourses.forEach((c) => courseMap.set(c.id, c));
          remoteCourses.forEach((rc) => {
            if (deletedSet.has(rc.id)) {
              SupabaseService.deleteCourse(rc.id).catch(() => {});
              return;
            }
            const existing = courseMap.get(rc.id);
            courseMap.set(rc.id, {
              ...existing,
              ...rc,
            });
          });
          this.setItem(STORAGE_KEYS.COURSES, Array.from(courseMap.values()));
          updated = true;
        }

        return updated;
      } catch {
        return false;
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
    const processedPosts = allPosts.map((post) => {
      if (post.status === 'scheduled' && post.scheduledFor) {
        const scheduledTime = new Date(post.scheduledFor).getTime();
        if (scheduledTime <= now) {
          hasAutoPublished = true;
          return {
            ...post,
            status: 'published' as const,
            createdAt: 'Just now',
          };
        }
      }
      return post;
    });

    if (hasAutoPublished) {
      this.setItem(STORAGE_KEYS.POSTS, processedPosts);
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

    // Sort: Pinned posts first (up to 3 pinned, ordered by pinOrder or pinnedAt), then non-pinned
    return visiblePosts.sort((a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (bPinned !== aPinned) {
        return bPinned - aPinned;
      }
      // If both are pinned, sort by pinOrder ascending (1, 2, 3) or pinnedAt descending
      if (a.isPinned && b.isPinned) {
        if (a.pinOrder && b.pinOrder) {
          return a.pinOrder - b.pinOrder;
        }
        if (a.pinnedAt && b.pinnedAt) {
          return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
        }
      }
      return 0;
    });
  }

  static addPost(
    postData: Omit<CoursePost, 'id' | 'createdAt' | 'likes' | 'comments'> & {
      status?: 'published' | 'scheduled';
      scheduledFor?: string;
      scheduledForDisplay?: string;
    },
    currentUser: User
  ): { post: CoursePost | null; error?: string } {
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

    const newPost: CoursePost = {
      ...postData,
      isPinned,
      status: isScheduled ? 'scheduled' : 'published',
      id: `post-${Date.now()}`,
      createdAt: isScheduled
        ? `Scheduled for ${postData.scheduledForDisplay || 'upcoming'}`
        : 'Just now',
      likes: [],
      comments: [],
    };

    this.setItem(STORAGE_KEYS.POSTS, [newPost, ...posts]);
    try {
      SupabaseService.upsertPost(newPost).catch(() => {});
    } catch {
      // ignore
    }

    // Send notifications to enrolled students only if published immediately
    if (!isScheduled) {
      const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
      const course = allCourses.find((c) => c.id === postData.courseId);
      if (course) {
        course.enrolledStudentIds.forEach((studentId) => {
          this.addNotification({
            userId: studentId,
            courseId: course.id,
            courseTitle: course.title,
            title: `New ${postData.postType === 'lesson' ? 'Lesson' : 'Post'}: ${postData.title}`,
            message: `${currentUser.name} posted in ${course.code}`,
            type: 'post',
          });
        });
      }
    }

    return { post: newPost };
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
  ): { success: boolean; error?: string } {
    if (currentUser.role !== 'admin' && currentUser.role !== 'co_admin') {
      return { success: false, error: 'Unauthorized: Only instructors/admins/co-admins can publish scheduled posts.' };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const target = posts.find((p) => p.id === postId);
    if (!target) {
      return { success: false, error: 'Post not found.' };
    }

    let publishedPost: CoursePost | null = null;
    const updated = posts.map((p) => {
      if (p.id === postId) {
        publishedPost = {
          ...p,
          status: 'published' as const,
          createdAt: 'Just now',
          scheduledFor: undefined,
          scheduledForDisplay: undefined,
        };
        return publishedPost;
      }
      return p;
    });

    this.setItem(STORAGE_KEYS.POSTS, updated);
    if (publishedPost) {
      try {
        SupabaseService.upsertPost(publishedPost).catch(() => {});
      } catch {
        // ignore
      }
    }

    // Send notifications to enrolled students
    const allCourses = this.getItem<Course[]>(STORAGE_KEYS.COURSES, INITIAL_COURSES);
    const course = allCourses.find((c) => c.id === target.courseId);
    if (course) {
      course.enrolledStudentIds.forEach((studentId) => {
        this.addNotification({
          userId: studentId,
          courseId: course.id,
          courseTitle: course.title,
          title: `Published: ${target.title}`,
          message: `${currentUser.name} published a scheduled post in ${course.code}`,
          type: 'post',
        });
      });
    }

    return { success: true };
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
    this.recordDeletedIds([postId]);

    // Auto-delete from Supabase SQL database
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
    const rateCheck = this.checkRateLimit('comment_post', currentUser.id, 6, 60);
    if (!rateCheck.allowed) {
      return {
        comment: null,
        error: `Anti-spam rate limit triggered. Please wait ${rateCheck.retryAfterSeconds}s before commenting again.`,
      };
    }

    const posts = this.getItem<CoursePost[]>(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    const newComment: PostComment = {
      id: `comm-${Date.now()}`,
      postId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.avatar,
      content,
      createdAt: 'Just now',
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
    const submissions = this.getItem<AssignmentSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    const target = submissions.find((s) => s.id === submissionId);
    if (!target) return false;

    let gradedSub: AssignmentSubmission | null = null;
    const updated = submissions.map((s) => {
      if (s.id === submissionId) {
        gradedSub = {
          ...s,
          status: 'graded' as const,
          grade,
          feedback,
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
      message: `Your score: ${grade}/100. "${feedback}"`,
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
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
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
      verificationUrl: `https://classroomos.edu/verify/${certId}`,
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

    this.setItem(STORAGE_KEYS.ATTENDANCE, [newSession, ...sessions]);
    try {
      SupabaseService.upsertAttendanceSession(newSession).catch(() => {});
    } catch {
      // ignore
    }
    return newSession;
  }

  static toggleAttendanceSessionOpen(sessionId: string, isOpen: boolean): AttendanceSession | null {
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
    const sessions = this.getAttendanceSessions(courseId);
    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        presentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        absentCount: 0,
        percentage: 100,
      };
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
    return {
      totalSessions,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      percentage,
    };
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
      const str = String(val ?? '');
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
      const str = String(val ?? '');
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

  // Notifications
  static getNotifications(userId: string): NotificationItem[] {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    return notifs.filter((n) => n.userId === userId);
  }

  static markAllNotificationsRead(userId: string): void {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const updated = notifs.map((n) => (n.userId === userId ? { ...n, isRead: true } : n));
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, updated);
  }

  static addNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>): void {
    const notifs = this.getItem<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}`,
      createdAt: 'Just now',
      isRead: false,
    };
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...notifs]);
  }
}


