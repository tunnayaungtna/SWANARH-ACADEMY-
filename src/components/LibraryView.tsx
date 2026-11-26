import React, { useState, useEffect, useMemo } from 'react';
import {
  Course,
  User,
  LibraryItem,
  LibraryItemType,
  LibraryAccessRules,
  LibraryChannelConfig,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AcademyLogo } from './AcademyLogo';
import { OFFICIAL_ACADEMY_LOGO } from '../assets/officialLogoData';
import {
  BookOpen,
  FileText,
  Youtube,
  Video,
  Plus,
  Search,
  Lock,
  EyeOff,
  Eye,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  Trash2,
  Pin,
  RefreshCw,
  Download,
  X,
  Upload,
  Sparkles,
  Users,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Play,
  Sliders,
} from 'lucide-react';

interface LibraryViewProps {
  course?: Course;
  currentUser: User;
  onRefresh: () => void;
  onNavigateTab?: (tab: 'attendance' | 'quizzes') => void;
}

type LibraryFilterTab = 'all' | 'ebook' | 'long_note' | 'youtube' | 'tiktok';

interface LiveYouTubeFeedVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  videoUrl: string;
}

interface LiveTikTokFeedVideo {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl: string;
}

const GLOBAL_LIBRARY_COURSE_FALLBACK: Course = {
  id: 'GLOBAL_LIBRARY',
  code: 'LIBRARY',
  title: 'Swanarh Academy Digital Library',
  section: 'All Batches',
  batch: 'Academy-Wide',
  description: 'Official Swanarh Academy Digital Library',
  instructorName: 'Dr. Si Thu Aung',
  instructorEmail: 'admin@swanarhacademy.com',
  bannerImage: '',
  themeColor: 'indigo',
  enrolledStudentIds: [],
  totalLessons: 0,
  totalAssignments: 0,
  totalQuizzes: 0,
};

function extractYouTubeVideoId(url: string): string {
  const clean = (url || '').trim();
  if (!clean) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m && m[1]) return m[1];
  }
  return '';
}

function extractTikTokVideoId(url: string): string {
  const clean = (url || '').trim();
  if (!clean) return '';
  if (/^\d{15,22}$/.test(clean)) return clean;
  const m = clean.match(/\/video\/(\d{15,22})/i) || clean.match(/\/v\/(\d{15,22})/i);
  return m && m[1] ? m[1] : '';
}

function extractTikTokHandle(urlOrHandle: string): string {
  const clean = (urlOrHandle || '').trim();
  if (!clean) return 'dr..si.thu.aung.s';
  const m = clean.match(/tiktok\.com\/@([a-zA-Z0-9._-]+)/i);
  if (m && m[1]) return m[1].replace(/\?.*$/, '');
  const candidate = clean.replace(/^@+/, '').split(/[/?#]/)[0] || 'dr..si.thu.aung.s';
  return /^[a-zA-Z0-9._-]{2,60}$/.test(candidate) ? candidate : 'dr..si.thu.aung.s';
}

function extractYouTubeHandle(urlOrHandle: string): string {
  const clean = (urlOrHandle || '').trim();
  if (!clean) return '@swanarhacademy';
  const m = clean.match(/youtube\.com\/(@[a-zA-Z0-9._-]+)/i);
  if (m && m[1]) return m[1];
  const base = clean.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').split(/[/?#]/)[0];
  if (!base) return '@swanarhacademy';
  const candidate = base.startsWith('@') ? base : `@${base.replace(/^@+/, '')}`;
  return /^@[a-zA-Z0-9._-]{2,60}$/.test(candidate) ? candidate : '@swanarhacademy';
}

function isSafeLibraryFileUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|data:application\/pdf;base64,|data:application\/epub\+zip;base64,)/i.test(
    trimmed
  );
}

function isSafePdfEmbedUrl(rawUrl?: string): boolean {
  if (!isSafeLibraryFileUrl(rawUrl)) return false;
  const trimmed = (rawUrl || '').trim();
  if (/^data:application\/pdf;base64,/i.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        parsed.pathname.toLowerCase().endsWith('.pdf')
      );
    } catch {
      return false;
    }
  }
  return false;
}

const OFFICIAL_SWANARH_YOUTUBE_CHANNEL_ID = 'UCk0VikA7fYKBuoJkI_cOxRg';
const CLOUD_RELAY_ORIGIN = 'https://ais-pre-x3aphtm3a4npfd5tmiiqhv-683201169391.asia-southeast1.run.app';

const OFFICIAL_SWANARH_YOUTUBE_VIDEOS: LiveYouTubeFeedVideo[] = [
  {
    videoId: 'JuojeHJ4u4c',
    title: 'A heartfelt message from one of my beloved students in Japan.',
    publishedAt: 'Nov 12, 2026',
  },
  {
    videoId: '-nOET2U31rg',
    title: 'A personal stake',
    publishedAt: 'Nov 10, 2026',
  },
  {
    videoId: 'ypvtik2fgRg',
    title: 'Even as',
    publishedAt: 'Nov 6, 2026',
  },
  {
    videoId: 'zGWCnHqvSSw',
    title: 'Jet lag',
    publishedAt: 'Nov 5, 2026',
  },
  {
    videoId: 'JdcDs1Aj0VE',
    title: 'No matter how',
    publishedAt: 'Nov 4, 2026',
  },
  {
    videoId: 'P2LLq2L5KAA',
    title: '၄ /၂၀၂၆ နှင့် ၅/ ၂၀၂၆ ကြေငြာစာအတွက် ရာထူးဝင်ခွင့်သင်တန်း',
    publishedAt: 'Nov 3, 2026',
  },
  {
    videoId: 'CSJm7Kt33VY',
    title: 'Get over',
    publishedAt: 'Oct 30, 2026',
  },
  {
    videoId: 'DVsIznkQAoI',
    title: 'Compound noun',
    publishedAt: 'Oct 29, 2026',
  },
  {
    videoId: 'YxrztqjZLFU',
    title: 'Back when + Clause',
    publishedAt: 'Oct 27, 2026',
  },
  {
    videoId: 'wubX0qYHAeU',
    title: 'Future Perfect',
    publishedAt: 'Oct 26, 2026',
  },
  {
    videoId: 'twcAmPkXL_A',
    title: 'Future Tense (Part 5)',
    publishedAt: 'Oct 25, 2026',
  },
  {
    videoId: '7sjjyMF4wYk',
    title: 'Future Tense (Part 4)',
    publishedAt: 'Oct 24, 2026',
  },
  {
    videoId: 'DAK2RLg9jtg',
    title: 'Future Tense (Part 3)',
    publishedAt: 'Oct 23, 2026',
  },
  {
    videoId: 'O1keiMKZrPw',
    title: 'Future Tense (Part 2)',
    publishedAt: 'Oct 22, 2026',
  },
  {
    videoId: 'kxyotbO4ZhY',
    title: 'Future Tense (Part 1)',
    publishedAt: 'Oct 21, 2026',
  },
  {
    videoId: '0WmU26TcUeQ',
    title: 'Present and Past Perfect Continuous',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '9tAjIvvEosQ',
    title: 'Lest',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '0qXycEEhoy4',
    title: 'Now that (Usage & Examples)',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'aRblqAMoiXk',
    title: 'A couple of',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '9zK663jFzGA',
    title: 'And... as well / as well as',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'pZBNDH2Ztns',
    title: 'Now that',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '6Bby3ND-4og',
    title: 'Have a hard time + Ving',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'zfb2BZdW1i4',
    title: 'Go overboard',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'rvHxkMuUqZg',
    title: 'As far as',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'PxmBf9eqVt8',
    title: 'As long as',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'OFK7Q3fXNX8',
    title: 'As soon as',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '9_B70m3L3Zs',
    title: 'Feel like',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'xQA4pvOKyFY',
    title: 'Past Simple',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: 'QDGqPQJpStc',
    title: 'Reach and Arrive',
    publishedAt: 'SwanArh Academy',
  },
  {
    videoId: '6jS8DHNeI1A',
    title: 'What matters most',
    publishedAt: 'SwanArh Academy',
  },
].map((v) => ({
  ...v,
  thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
  videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
}));

export const LibraryView: React.FC<LibraryViewProps> = ({
  course,
  currentUser,
  onRefresh,
  onNavigateTab,
}) => {
  const activeCourse = course || GLOBAL_LIBRARY_COURSE_FALLBACK;
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';

  const [filterTab, setFilterTab] = useState<LibraryFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`library_bookmarks_${currentUser.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Instructor preview & management states
  const [previewAsRestrictedStudent, setPreviewAsRestrictedStudent] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState(false);
  const [showAccessInspectorModal, setShowAccessInspectorModal] = useState(false);
  const [activeReaderItem, setActiveReaderItem] = useState<LibraryItem | null>(null);

  // Reader appearance states
  const [readerFontSize, setReaderFontSize] = useState<number>(17);
  const [readerTheme, setReaderTheme] = useState<'light' | 'sepia' | 'dark'>('sepia');

  // Live Auto-Sync YouTube & TikTok Channel Feed states (Pre-seeded with official @swanarhacademy videos so 0ms blank state never happens)
  const [liveYtVideos, setLiveYtVideos] = useState<LiveYouTubeFeedVideo[]>(
    () => OFFICIAL_SWANARH_YOUTUBE_VIDEOS
  );
  const [liveYtChannelId, setLiveYtChannelId] = useState<string>(
    () => OFFICIAL_SWANARH_YOUTUBE_CHANNEL_ID
  );
  const [activeLiveYtVideoId, setActiveLiveYtVideoId] = useState<string>(
    () => OFFICIAL_SWANARH_YOUTUBE_VIDEOS[0]?.videoId || 'JuojeHJ4u4c'
  );

  const [liveTtVideos, setLiveTtVideos] = useState<LiveTikTokFeedVideo[]>([]);
  const [activeLiveTtVideoId, setActiveLiveTtVideoId] = useState<string>('');
  const [isSyncingChannels, setIsSyncingChannels] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Form states for Create / Edit Library Item
  const [formType, setFormType] = useState<LibraryItemType>('long_note');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formWatermark, setFormWatermark] = useState(true);
  const [formRules, setFormRules] = useState<LibraryAccessRules>({
    enabled: true,
    allowedCourseIds: [],
    blockedCourseIds: [],
    minAttendancePercentage: 80,
    requireAllExamsSubmitted: true,
    requireAllExamsPassed: false,
    requireAllDataFormsSubmitted: true,
    hideWhenRestricted: true,
  });
  const [isFetchingOembed, setIsFetchingOembed] = useState(false);

  const channelConfig: LibraryChannelConfig = ClassroomDB.getLibraryChannelConfig(
    activeCourse.id
  );
  const [cfgYoutubeUrl, setCfgYoutubeUrl] = useState(channelConfig.youtubeChannelUrl);
  const [cfgYoutubeChannelId, setCfgYoutubeChannelId] = useState(
    channelConfig.youtubeChannelId || ''
  );
  const [cfgTiktokUrl, setCfgTiktokUrl] = useState(channelConfig.tiktokProfileUrl);
  const [cfgAutoEmbed, setCfgAutoEmbed] = useState(channelConfig.autoEmbedLiveFeeds);
  const [cfgDefaultRules, setCfgDefaultRules] = useState<LibraryAccessRules>(
    channelConfig.defaultEbookNoteAccessRules
  );

  // All courses in the academy so teachers can configure class-level visibility (Allowed / Blocked Classes)
  const allManagedCourses = useMemo(() => {
    const adminUser =
      ClassroomDB.getAllUsers().find((u) => u.role === 'admin') || currentUser;
    return ClassroomDB.getCourses(adminUser);
  }, [currentUser]);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4200);
  };

  // Fetch all YouTube & TikTok videos automatically from the channels (works on Cloud Run AND static GitHub Pages)
  const syncLiveChannelFeeds = async (force: boolean = false) => {
    setIsSyncingChannels(true);
    try {
      const ytHandle = extractYouTubeHandle(channelConfig.youtubeChannelUrl);
      const isDefaultSwanarh = ytHandle.toLowerCase() === '@swanarhacademy';
      const cid =
        channelConfig.youtubeChannelId ||
        (isDefaultSwanarh ? OFFICIAL_SWANARH_YOUTUBE_CHANNEL_ID : '');
      const ttHandle = extractTikTokHandle(channelConfig.tiktokProfileUrl);

      const mergeYouTubeVideos = (incoming: LiveYouTubeFeedVideo[]) => {
        const mergedMap = new Map<string, LiveYouTubeFeedVideo>();
        incoming.forEach((v) => {
          if (v && /^[a-zA-Z0-9_-]{11}$/.test(v.videoId)) {
            mergedMap.set(v.videoId, {
              videoId: v.videoId,
              title: v.title || 'SwanArh Academy Video',
              publishedAt: v.publishedAt || 'SwanArh Academy',
              thumbnailUrl: v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              videoUrl: v.videoUrl || `https://www.youtube.com/watch?v=${v.videoId}`,
            });
          }
        });
        if (isDefaultSwanarh) {
          OFFICIAL_SWANARH_YOUTUBE_VIDEOS.forEach((v) => {
            if (!mergedMap.has(v.videoId)) {
              mergedMap.set(v.videoId, v);
            }
          });
        }
        return Array.from(mergedMap.values());
      };

      const ytQuery = `handle=${encodeURIComponent(ytHandle)}&channelId=${encodeURIComponent(
        cid
      )}${force ? '&force=1' : ''}`;
      const ttQuery = `handle=${encodeURIComponent(ttHandle)}${force ? '&force=1' : ''}`;

      // Tier 1: Same-origin API -> Tier 2: Cloud Run Relay -> Tier 3: Public RSS2JSON Fallback
      const fetchYouTubeFeedWithFallbacks = async (): Promise<{
        videos: LiveYouTubeFeedVideo[];
        channelId: string;
      } | null> => {
        const endpoints = [
          `/api/youtube-feed?${ytQuery}`,
          `${CLOUD_RELAY_ORIGIN}/api/youtube-feed?${ytQuery}`,
        ];
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep);
            if (!resp.ok) continue;
            const contentType = resp.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) continue;
            const data = await resp.json();
            if (Array.isArray(data?.videos) && data.videos.length > 0) {
              return {
                videos: data.videos,
                channelId: data.channelId || cid,
              };
            }
          } catch {
            // try next endpoint
          }
        }

        // Tier 3: Pure Client-Side Public RSS-to-JSON Fallback (for static hosting if Cloud Run relay is unreachable)
        if (cid) {
          try {
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
              cid
            )}`;
            const rss2JsonRes = await fetch(
              `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`
            );
            if (rss2JsonRes.ok) {
              const rssData = await rss2JsonRes.json();
              if (Array.isArray(rssData?.items) && rssData.items.length > 0) {
                const parsed: LiveYouTubeFeedVideo[] = [];
                for (const item of rssData.items) {
                  const vid =
                    extractYouTubeVideoId(String(item.link || '')) ||
                    String(item.guid || '').replace(/^yt:video:/, '');
                  if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
                    parsed.push({
                      videoId: vid,
                      title: String(item.title || 'SwanArh Academy Video').trim(),
                      publishedAt: String(item.pubDate || 'SwanArh Academy'),
                      thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                      videoUrl: `https://www.youtube.com/watch?v=${vid}`,
                    });
                  }
                }
                if (parsed.length > 0) {
                  return { videos: parsed, channelId: cid };
                }
              }
            }
          } catch {
            // ignore fallback error
          }
        }
        return null;
      };

      const fetchTikTokFeedWithFallbacks = async (): Promise<LiveTikTokFeedVideo[] | null> => {
        const endpoints = [
          `/api/tiktok-feed?${ttQuery}`,
          `${CLOUD_RELAY_ORIGIN}/api/tiktok-feed?${ttQuery}`,
        ];
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep);
            if (!resp.ok) continue;
            const contentType = resp.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) continue;
            const data = await resp.json();
            if (Array.isArray(data?.videos) && data.videos.length > 0) {
              return data.videos;
            }
          } catch {
            // try next endpoint
          }
        }
        return null;
      };

      const [ytPayload, ttVideos] = await Promise.all([
        fetchYouTubeFeedWithFallbacks(),
        fetchTikTokFeedWithFallbacks(),
      ]);

      if (ytPayload && ytPayload.videos.length > 0) {
        const merged = mergeYouTubeVideos(ytPayload.videos);
        setLiveYtVideos(merged);
        setActiveLiveYtVideoId((prev) =>
          prev && merged.some((v) => v.videoId === prev) ? prev : merged[0].videoId
        );
        if (ytPayload.channelId) {
          setLiveYtChannelId(ytPayload.channelId);
        }
      } else if (isDefaultSwanarh) {
        setLiveYtVideos((prev) =>
          prev.length > 0 ? prev : OFFICIAL_SWANARH_YOUTUBE_VIDEOS
        );
        setLiveYtChannelId((prev) => prev || OFFICIAL_SWANARH_YOUTUBE_CHANNEL_ID);
      }

      if (ttVideos && ttVideos.length > 0) {
        setLiveTtVideos(ttVideos);
        setActiveLiveTtVideoId((prev) => prev || ttVideos[0].videoId);
      }

      if (force) {
        showToast('YouTube နှင့် TikTok ဗီဒီယိုစာရင်း အသစ်များကို Sync ဆွဲပြီးပါပြီ!', 'info');
      }
    } catch {
      // ignore offline
    } finally {
      setIsSyncingChannels(false);
    }
  };

  useEffect(() => {
    ClassroomDB.syncLibraryFromCloud(course?.id, true).then((changed) => {
      if (changed) onRefresh();
    });
    syncLiveChannelFeeds(false);

    // Auto-poll YouTube & TikTok channels every 60 seconds and on tab focus so new uploads appear automatically
    const pollInterval = window.setInterval(() => {
      syncLiveChannelFeeds(false);
    }, 60 * 1000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncLiveChannelFeeds(false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [activeCourse.id]);

  const toggleBookmark = (itemId: string) => {
    const next = bookmarkedIds.includes(itemId)
      ? bookmarkedIds.filter((id) => id !== itemId)
      : [...bookmarkedIds, itemId];
    setBookmarkedIds(next);
    try {
      localStorage.setItem(`library_bookmarks_${currentUser.id}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const allItems = ClassroomDB.getLibraryItems(course?.id);

  // Current student's own eligibility status against default rules
  const myDefaultEligibility = useMemo(() => {
    return ClassroomDB.evaluateLibraryItemAccess(
      activeCourse.id,
      currentUser,
      channelConfig.defaultEbookNoteAccessRules
    );
  }, [activeCourse.id, currentUser, channelConfig.defaultEbookNoteAccessRules]);

  // Evaluate access for each item (YouTube & TikTok videos are ALWAYS allowed and visible for all students)
  const evaluatedItems = useMemo(() => {
    return allItems.map((item) => {
      const isVideoItem = item.itemType === 'youtube' || item.itemType === 'tiktok';
      const realAccess = ClassroomDB.evaluateLibraryItemAccess(
        item.courseId || activeCourse.id,
        currentUser,
        item.accessRules,
        item.itemType
      );
      if (
        !isVideoItem &&
        isStaff &&
        previewAsRestrictedStudent &&
        item.accessRules?.enabled
      ) {
        return {
          item,
          access: {
            ...realAccess,
            allowed: false,
            hideCompletely: Boolean(item.accessRules.hideWhenRestricted),
            attendancePct: 65,
            requiredAttendancePct: item.accessRules.minAttendancePercentage || 80,
            attendanceMet: false,
            examsMet: !item.accessRules.requireAllExamsSubmitted,
            dataFormsMet: !item.accessRules.requireAllDataFormsSubmitted,
            missingReasons: [
              `Roll Call အနည်းဆုံး ${
                item.accessRules.minAttendancePercentage || 80
              }% ပြည့်မီရန် လိုအပ်ပါသည် (လက်ရှိ နမူနာ Roll Call: 65%)`,
              ...(item.accessRules.requireAllExamsSubmitted
                ? ['Exam စာမေးပွဲ ဖြေဆိုပြီးသူ ဖြစ်ရပါမည်']
                : []),
              ...(item.accessRules.requireAllDataFormsSubmitted
                ? ['ကျောင်းသားအချက်အလက် Form ဖြည့်သွင်းပြီးသူ ဖြစ်ရပါမည်']
                : []),
            ],
          },
        };
      }
      return { item, access: realAccess };
    });
  }, [allItems, activeCourse.id, currentUser, isStaff, previewAsRestrictedStudent]);

  // Filter items according to visibility rules, tab, search, and bookmarks
  const visibleEvaluatedItems = useMemo(() => {
    return evaluatedItems.filter(({ item, access }) => {
      if ((!isStaff || previewAsRestrictedStudent) && !access.allowed && access.hideCompletely) {
        return false;
      }
      if (filterTab !== 'all' && item.itemType !== filterTab) {
        return false;
      }
      if (showBookmarksOnly && !bookmarkedIds.includes(item.id)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSub = (item.subtitle || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        return matchTitle || matchSub || matchCat || matchDesc;
      }
      return true;
    });
  }, [
    evaluatedItems,
    isStaff,
    previewAsRestrictedStudent,
    filterTab,
    showBookmarksOnly,
    bookmarkedIds,
    searchQuery,
  ]);

  // Student eligibility inspector summary for Admin / Co-Admin
  const studentEligibilityRoster = useMemo(() => {
    if (!isStaff) return [];
    const allUsers = ClassroomDB.getAllUsers();
    const targetStudents = course
      ? allUsers.filter(
          (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
        )
      : allUsers.filter((u) => u.role === 'student');

    return targetStudents
      .map((stu) => {
        const ev = ClassroomDB.evaluateLibraryItemAccess(
          activeCourse.id,
          stu,
          channelConfig.defaultEbookNoteAccessRules
        );
        return { student: stu, evalResult: ev };
      })
      .sort((a, b) => b.evalResult.attendancePct - a.evalResult.attendancePct);
  }, [isStaff, course, activeCourse.id, channelConfig.defaultEbookNoteAccessRules]);

  const openCreateModal = (defaultType: LibraryItemType = 'long_note') => {
    const isRestrictedType = defaultType === 'ebook' || defaultType === 'long_note';
    setEditingItem(null);
    setFormType(defaultType);
    setFormTitle('');
    setFormSubtitle(
      defaultType === 'youtube'
        ? '@swanarhacademy • YouTube Video'
        : defaultType === 'tiktok'
        ? '@dr..si.thu.aung.s • TikTok Video'
        : 'Dr. Si Thu Aung • Swanarh Academy'
    );
    setFormCategory(
      defaultType === 'ebook'
        ? 'သင်တန်းစာအုပ် (eBook)'
        : defaultType === 'long_note'
        ? 'အထူးမှတ်စု (Long Note)'
        : defaultType === 'youtube'
        ? 'YouTube သင်ခန်းစာ'
        : 'TikTok ဗီဒီယို'
    );
    setFormDescription('');
    setFormContent('');
    setFormFileUrl('');
    setFormFileName('');
    setFormFileSize('');
    setFormVideoUrl('');
    setFormIsPinned(false);
    setFormWatermark(isRestrictedType);
    setFormRules(
      isRestrictedType
        ? {
            ...channelConfig.defaultEbookNoteAccessRules,
            allowedCourseIds:
              channelConfig.defaultEbookNoteAccessRules.allowedCourseIds || [],
            blockedCourseIds:
              channelConfig.defaultEbookNoteAccessRules.blockedCourseIds || [],
          }
        : {
            enabled: false,
            allowedCourseIds: [],
            blockedCourseIds: [],
            minAttendancePercentage: 80,
            requireAllExamsSubmitted: false,
            requireAllExamsPassed: false,
            requireAllDataFormsSubmitted: false,
            hideWhenRestricted: false,
          }
    );
    setShowEditorModal(true);
  };

  const openEditModal = (item: LibraryItem) => {
    setEditingItem(item);
    setFormType(item.itemType);
    setFormTitle(item.title);
    setFormSubtitle(item.subtitle || '');
    setFormCategory(item.category || '');
    setFormDescription(item.description || '');
    setFormContent(item.content || '');
    setFormFileUrl(item.fileUrl || '');
    setFormFileName(item.fileName || '');
    setFormFileSize(item.fileSize || '');
    setFormVideoUrl(item.videoUrl || '');
    setFormIsPinned(Boolean(item.isPinned));
    setFormWatermark(item.watermarkProtected !== false);
    setFormRules({
      ...item.accessRules,
      allowedCourseIds: item.accessRules.allowedCourseIds || [],
      blockedCourseIds: item.accessRules.blockedCourseIds || [],
    });
    setShowEditorModal(true);
  };

  const toggleAllowedCourse = (cid: string, isDefaultConfig: boolean = false) => {
    if (isDefaultConfig) {
      setCfgDefaultRules((prev) => {
        const cur = prev.allowedCourseIds || [];
        const nextAllowed = cur.includes(cid)
          ? cur.filter((id) => id !== cid)
          : [...cur, cid];
        const nextBlocked = (prev.blockedCourseIds || []).filter((id) => id !== cid);
        return { ...prev, allowedCourseIds: nextAllowed, blockedCourseIds: nextBlocked };
      });
      return;
    }
    setFormRules((prev) => {
      const cur = prev.allowedCourseIds || [];
      const nextAllowed = cur.includes(cid)
        ? cur.filter((id) => id !== cid)
        : [...cur, cid];
      const nextBlocked = (prev.blockedCourseIds || []).filter((id) => id !== cid);
      return { ...prev, allowedCourseIds: nextAllowed, blockedCourseIds: nextBlocked };
    });
  };

  const toggleBlockedCourse = (cid: string, isDefaultConfig: boolean = false) => {
    if (isDefaultConfig) {
      setCfgDefaultRules((prev) => {
        const cur = prev.blockedCourseIds || [];
        const nextBlocked = cur.includes(cid)
          ? cur.filter((id) => id !== cid)
          : [...cur, cid];
        const nextAllowed = (prev.allowedCourseIds || []).filter((id) => id !== cid);
        return { ...prev, blockedCourseIds: nextBlocked, allowedCourseIds: nextAllowed };
      });
      return;
    }
    setFormRules((prev) => {
      const cur = prev.blockedCourseIds || [];
      const nextBlocked = cur.includes(cid)
        ? cur.filter((id) => id !== cid)
        : [...cur, cid];
      const nextAllowed = (prev.allowedCourseIds || []).filter((id) => id !== cid);
      return { ...prev, blockedCourseIds: nextBlocked, allowedCourseIds: nextAllowed };
    });
  };

  const handleAutoFetchVideoMetadata = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    setIsFetchingOembed(true);
    try {
      const isTikTok = url.toLowerCase().includes('tiktok.com');
      const isYouTube =
        url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be');
      if (isTikTok && formType !== 'tiktok') setFormType('tiktok');
      if (isYouTube && formType !== 'youtube') setFormType('youtube');

      const oembedEndpoint = isTikTok
        ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        : isYouTube
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        : '';

      if (oembedEndpoint) {
        const res = await fetch(oembedEndpoint);
        if (res.ok) {
          const data = await res.json();
          if (data.title && !formTitle.trim()) {
            setFormTitle(String(data.title).slice(0, 140));
          }
          if (data.author_name) {
            setFormSubtitle(`${data.author_name} • ${isTikTok ? 'TikTok' : 'YouTube'}`);
          }
          showToast('ဗီဒီယို ခေါင်းစဉ်နှင့် အချက်အလက်များကို အလိုအလျောက် ဆွဲယူပြီးပါပြီ!', 'info');
        }
      }
    } catch {
      // ignore
    } finally {
      setIsFetchingOembed(false);
    }
  };

  const handleEbookFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setFormFileName(file.name);
    setFormFileSize(`${sizeMB} MB`);
    if (!formTitle.trim()) {
      setFormTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormFileUrl(reader.result);
        showToast(`"${file.name}" (${sizeMB} MB) တင်သွင်းပြီးပါပြီ။`, 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('ကျေးဇူးပြု၍ ခေါင်းစဉ် (Title) ထည့်သွင်းပေးပါ။', 'warning');
      return;
    }

    let embedId = '';
    let channelHandle = '';
    if (formType === 'youtube') {
      embedId = extractYouTubeVideoId(formVideoUrl);
      channelHandle = extractYouTubeHandle(channelConfig.youtubeChannelUrl);
    } else if (formType === 'tiktok') {
      embedId = extractTikTokVideoId(formVideoUrl);
      channelHandle = `@${extractTikTokHandle(formVideoUrl || channelConfig.tiktokProfileUrl)}`;
    }

    ClassroomDB.saveLibraryItem(
      {
        id: editingItem?.id,
        course: activeCourse,
        itemType: formType,
        title: formTitle,
        subtitle: formSubtitle,
        category: formCategory,
        description: formDescription,
        content: formContent,
        fileUrl: formFileUrl,
        fileName: formFileName,
        fileSize: formFileSize,
        videoUrl: formVideoUrl,
        embedId,
        channelHandle,
        isPinned: formIsPinned,
        watermarkProtected: formWatermark,
        accessRules: formRules,
      },
      currentUser
    );

    setShowEditorModal(false);
    onRefresh();
    showToast(
      editingItem
        ? 'စာကြည့်တိုက် အချက်အလက် ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ!'
        : 'စာကြည့်တိုက်သို့ အသစ်ထည့်သွင်းပြီးပါပြီ!'
    );
  };

  const handleDeleteItem = (item: LibraryItem) => {
    ClassroomDB.deleteLibraryItem(item.id, currentUser);
    if (activeReaderItem?.id === item.id) {
      setActiveReaderItem(null);
    }
    onRefresh();
    showToast(`"${item.title}" ကို စာကြည့်တိုက်မှ ဖယ်ရှားပြီးပါပြီ။`, 'info');
  };

  const handleSaveChannelSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const ytHandle = extractYouTubeHandle(cfgYoutubeUrl);
    const ttHandle = `@${extractTikTokHandle(cfgTiktokUrl)}`;
    ClassroomDB.saveLibraryChannelConfig(
      activeCourse.id,
      {
        youtubeChannelUrl: cfgYoutubeUrl.trim() || 'https://youtube.com/@swanarhacademy',
        youtubeHandle: ytHandle,
        youtubeChannelId: cfgYoutubeChannelId.trim(),
        tiktokProfileUrl:
          cfgTiktokUrl.trim() || 'https://www.tiktok.com/@dr..si.thu.aung.s',
        tiktokHandle: ttHandle,
        autoEmbedLiveFeeds: cfgAutoEmbed,
        defaultEbookNoteAccessRules: cfgDefaultRules,
      },
      currentUser
    );

    ClassroomDB.bulkUpdateLibraryAccessRules(
      activeCourse.id,
      ['ebook', 'long_note'],
      cfgDefaultRules,
      currentUser
    );

    setShowChannelSettingsModal(false);
    syncLiveChannelFeeds(true);
    onRefresh();
    showToast('စာကြည့်တိုက် Channel နှင့် အတန်းလိုက် ကန့်သတ်ချက် စည်းမျဉ်းများ သိမ်းဆည်းပြီးပါပြီ!');
  };

  const tiktokCleanHandle = extractTikTokHandle(channelConfig.tiktokProfileUrl);
  const youtubeCleanHandle = extractYouTubeHandle(channelConfig.youtubeChannelUrl);

  const uploadsPlaylistId = useMemo(() => {
    const cid = liveYtChannelId || channelConfig.youtubeChannelId || '';
    if (/^UC[a-zA-Z0-9_-]{20,28}$/.test(cid)) {
      return `UU${cid.slice(2)}`;
    }
    return '';
  }, [liveYtChannelId, channelConfig.youtubeChannelId]);

  // Merge all live channel videos + custom instructor-added YouTube / TikTok items (UNRESTRICTED for all students)
  const allYouTubeGalleryVideos = useMemo(() => {
    const map = new Map<string, LiveYouTubeFeedVideo>();
    const q = searchQuery.trim().toLowerCase();
    liveYtVideos.forEach((v) => {
      if (!q || v.title.toLowerCase().includes(q)) {
        map.set(v.videoId, v);
      }
    });
    allItems.forEach((item) => {
      if (item.itemType === 'youtube') {
        if (showBookmarksOnly && !bookmarkedIds.includes(item.id)) return;
        if (
          q &&
          !item.title.toLowerCase().includes(q) &&
          !(item.description || '').toLowerCase().includes(q)
        ) {
          return;
        }
        const vid = item.embedId || extractYouTubeVideoId(item.videoUrl || '');
        if (vid && !map.has(vid)) {
          map.set(vid, {
            videoId: vid,
            title: item.title,
            publishedAt: item.createdAt,
            thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            videoUrl: item.videoUrl || `https://www.youtube.com/watch?v=${vid}`,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [liveYtVideos, allItems, searchQuery, showBookmarksOnly, bookmarkedIds]);

  const allTikTokGalleryVideos = useMemo(() => {
    const map = new Map<string, LiveTikTokFeedVideo>();
    const q = searchQuery.trim().toLowerCase();
    liveTtVideos.forEach((v) => {
      if (!q || v.title.toLowerCase().includes(q)) {
        map.set(v.videoId, v);
      }
    });
    allItems.forEach((item) => {
      if (item.itemType === 'tiktok') {
        if (showBookmarksOnly && !bookmarkedIds.includes(item.id)) return;
        if (
          q &&
          !item.title.toLowerCase().includes(q) &&
          !(item.description || '').toLowerCase().includes(q)
        ) {
          return;
        }
        const vid = item.embedId || extractTikTokVideoId(item.videoUrl || '');
        if (vid && !map.has(vid)) {
          map.set(vid, {
            videoId: vid,
            title: item.title,
            videoUrl:
              item.videoUrl || `https://www.tiktok.com/@${tiktokCleanHandle}/video/${vid}`,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [liveTtVideos, allItems, tiktokCleanHandle, searchQuery, showBookmarksOnly, bookmarkedIds]);

  const readingItems = useMemo(() => {
    return visibleEvaluatedItems.filter(
      ({ item }) => item.itemType === 'ebook' || item.itemType === 'long_note'
    );
  }, [visibleEvaluatedItems]);

  const counts = useMemo(() => {
    let ebook = 0;
    let long_note = 0;
    visibleEvaluatedItems.forEach(({ item }) => {
      if (item.itemType === 'ebook') ebook++;
      else if (item.itemType === 'long_note') long_note++;
    });
    return {
      all: ebook + long_note + allYouTubeGalleryVideos.length + allTikTokGalleryVideos.length,
      ebook,
      long_note,
      youtube: allYouTubeGalleryVideos.length,
      tiktok: allTikTokGalleryVideos.length,
    };
  }, [visibleEvaluatedItems, allYouTubeGalleryVideos.length, allTikTokGalleryVideos.length]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-sm ${
            toastMessage.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
              : 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            ပိတ်မည်
          </button>
        </div>
      )}

      {/* PREMIUM ARCHITECTURAL LIBRARY HEADER */}
      <div className="neu-raised rounded-3xl overflow-hidden border border-amber-500/20">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-7 py-5 sm:py-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <AcademyLogo size="md" className="ring-2 ring-amber-400/70 shadow-lg" />
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-widest text-amber-300/90 font-semibold">
                  Swanarh Academy · Royal Digital Athenaeum
                </div>
                <h2 className="text-lg sm:text-2xl font-serif font-extrabold tracking-tight text-white truncate">
                  စွမ်းအား ဒစ်ဂျစ်တယ် စာကြည့်တိုက် (Grand Library)
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  သင်တန်းလက်စွဲ eBook စာအုပ်များ · အထူးစာရှည်မှတ်စုများ · {youtubeCleanHandle} YouTube နှင့် @{tiktokCleanHandle} TikTok ဗီဒီယိုစုစည်းမှု
                </p>
              </div>
            </div>

            {/* Instructor Management Toolbar */}
            {isStaff && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openCreateModal('long_note')}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>စာအုပ် / မှတ်စုရှည် / Video အသစ်တင်ရန်</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAccessInspectorModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="မည်သည့်ကျောင်းသားများ မြင်တွေ့ခွင့်ရှိသလဲ စစ်ဆေးရန်"
                >
                  <Users className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    မြင်တွေ့ခွင့် စစ်ရန် (
                    {studentEligibilityRoster.filter((s) => s.evalResult.allowed).length}/
                    {studentEligibilityRoster.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCfgYoutubeUrl(channelConfig.youtubeChannelUrl);
                    setCfgYoutubeChannelId(channelConfig.youtubeChannelId || '');
                    setCfgTiktokUrl(channelConfig.tiktokProfileUrl);
                    setCfgAutoEmbed(channelConfig.autoEmbedLiveFeeds);
                    setCfgDefaultRules({
                      ...channelConfig.defaultEbookNoteAccessRules,
                      allowedCourseIds:
                        channelConfig.defaultEbookNoteAccessRules.allowedCourseIds || [],
                      blockedCourseIds:
                        channelConfig.defaultEbookNoteAccessRules.blockedCourseIds || [],
                    });
                    setShowChannelSettingsModal(true);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-300" />
                  <span>အတန်းလိုက် ကန့်သတ်ချက် & Channel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Bar: Instructor Access Rule Summary & Student Eligibility Status */}
        <div className="p-4 sm:p-5 space-y-4">
          {isStaff && (
            <div className="neu-inset rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    လက်ရှိ eBook & Note ကန့်သတ်ချက် —{' '}
                  </span>
                  {channelConfig.defaultEbookNoteAccessRules.enabled ? (
                    <span>
                      Roll Call ≥{' '}
                      {channelConfig.defaultEbookNoteAccessRules.minAttendancePercentage || 80}% ·{' '}
                      {channelConfig.defaultEbookNoteAccessRules.requireAllExamsSubmitted
                        ? 'Exam ဖြေပြီးသူ · '
                        : ''}
                      {channelConfig.defaultEbookNoteAccessRules.requireAllDataFormsSubmitted
                        ? 'အချက်အလက် Form ဖြည့်ပြီးသူ · '
                        : ''}
                      {(channelConfig.defaultEbookNoteAccessRules.allowedCourseIds?.length || 0) > 0
                        ? `ရွေးချယ်ထားသော အတန်း (${channelConfig.defaultEbookNoteAccessRules.allowedCourseIds?.length}) ခုသာ မြင်ရမည် · `
                        : 'အတန်းအားလုံး (သတ်မှတ်ချက်ပြည့်မီသူ) · '}
                      {(channelConfig.defaultEbookNoteAccessRules.blockedCourseIds?.length || 0) > 0
                        ? `ဖျောက်ထားသော အတန်း (${channelConfig.defaultEbookNoteAccessRules.blockedCourseIds?.length}) ခု · `
                        : ''}
                      {channelConfig.defaultEbookNoteAccessRules.hideWhenRestricted
                        ? 'မကိုက်ညီသူများအား လုံးဝဖျောက်ထားသည်'
                        : 'သော့ခတ်ပုံစံဖြင့် လိုအပ်ချက်ပြသသည်'}
                    </span>
                  ) : (
                    <span>ကန့်သတ်ချက် ပိတ်ထားသည်</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewAsRestrictedStudent((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                  previewAsRestrictedStudent
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                {previewAsRestrictedStudent ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>ကန့်သတ်ခံရသူအမြင် စမ်းသပ်နေသည် (ပြန်ပိတ်ရန်)</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>ကန့်သတ်ခံရသူအမြင် စမ်းကြည့်ရန်</span>
                  </>
                )}
              </button>
            </div>
          )}

          {!isStaff && channelConfig.defaultEbookNoteAccessRules.enabled && (
            <div className="neu-inset rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="font-extrabold text-slate-900 dark:text-white">
                  သင်၏ စာကြည့်တိုက် ဝင်ရောက်ခွင့် အခြေအနေ —
                </span>
                <span>
                  Roll Call: <strong>{myDefaultEligibility.attendancePct}%</strong> (လိုအပ်ချက် ≥{' '}
                  {myDefaultEligibility.requiredAttendancePct || 80}%)
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Exam: <strong>{myDefaultEligibility.submittedExams}/{myDefaultEligibility.totalExams}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Data Form:{' '}
                  <strong>
                    {myDefaultEligibility.submittedDataForms}/{myDefaultEligibility.totalDataForms}
                  </strong>
                </span>
              </div>

              {!myDefaultEligibility.allowed && onNavigateTab && (
                <div className="flex items-center gap-2 shrink-0">
                  {!myDefaultEligibility.attendanceMet && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('attendance')}
                      className="px-3 py-1.5 rounded-xl neu-btn text-[11px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      Attendance ကြည့်ရန် →
                    </button>
                  )}
                  {(!myDefaultEligibility.examsMet || !myDefaultEligibility.dataFormsMet) && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('quizzes')}
                      className="px-3 py-1.5 rounded-xl neu-btn text-[11px] font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                    >
                      Exam / Form ဖြည့်ရန် →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Segmented Library Section Controls & Search (Responsive across Mobile, Tablet & Browser) */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="neu-inset p-1.5 rounded-2xl grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`col-span-2 sm:col-span-1 px-3 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer text-center ${
                  filterTab === 'all'
                    ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                စာကြည့်တိုက် အားလုံး ({counts.all})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('ebook')}
                className={`px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filterTab === 'ebook'
                    ? 'neu-raised-sm text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">eBook စာအုပ်စင် ({counts.ebook})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('long_note')}
                className={`px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filterTab === 'long_note'
                    ? 'neu-raised-sm text-amber-700 dark:text-amber-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">စာရှည်မှတ်စုများ ({counts.long_note})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('youtube')}
                className={`px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filterTab === 'youtube'
                    ? 'neu-raised-sm text-rose-700 dark:text-rose-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Youtube className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate">YouTube ဗီဒီယို ({counts.youtube})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('tiktok')}
                className={`px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filterTab === 'tiktok'
                    ? 'neu-raised-sm text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="truncate">TikTok ဗီဒီယို</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="စာအုပ်၊ မှတ်စု၊ ဗီဒီယို ရှာရန်..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl neu-inset text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowBookmarksOnly((b) => !b)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 ${
                  showBookmarksOnly
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">မှတ်သားထားသည်များ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: PREMIUM WOODEN BOOKSHELF FOR EBOOKS & LONG-FORM STUDY NOTES */}
      {(filterTab === 'all' || filterTab === 'ebook' || filterTab === 'long_note') && (
        <div className="neu-raised rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700/60 pb-3.5">
            <div>
              <h3 className="text-sm sm:text-base font-serif font-extrabold text-slate-900 dark:text-slate-100">
                သင်တန်း စာအုပ်စင်နှင့် အထူးစာရှည်မှတ်စုများ (eBooks & Long-Form Archives)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                စာအုပ် သို့မဟုတ် မှတ်စုကို နှိပ်၍ စာကြည့်တိုက် စာဖတ်ခန်း (Reading Room) ဖြင့် အေးချမ်းစွာ ဖတ်ရှုနိုင်ပါသည်
              </p>
            </div>
            {isStaff && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openCreateModal('ebook')}
                  className="px-3 py-1.5 rounded-xl neu-btn text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>eBook တင်ရန်</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateModal('long_note')}
                  className="px-3 py-1.5 rounded-xl neu-btn text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>စာရှည်တင်ရန်</span>
                </button>
              </div>
            )}
          </div>

          {readingItems.length === 0 ? (
            <div className="neu-inset rounded-2xl p-8 text-center space-y-2">
              <BookOpen className="w-9 h-9 text-indigo-500 mx-auto opacity-75" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ဖော်ပြရန် eBook သို့မဟုတ် စာရှည်မှတ်စု မရှိသေးပါ
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                သတ်မှတ်ထားသော အတန်း၊ Roll Call %၊ Exam နှင့် အချက်အလက် Form ပြည့်မီသော ကျောင်းသားများအတွက် စာအုပ်များ ဤစာအုပ်စင်တွင် ပေါ်လာပါမည်။
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {readingItems.map(({ item, access }) => {
                const isBookmarked = bookmarkedIds.includes(item.id);
                const isLockedForStudent = !access.allowed;
                const isEbook = item.itemType === 'ebook';

                const allowedClassNames =
                  item.accessRules?.allowedCourseIds &&
                  item.accessRules.allowedCourseIds.length > 0
                    ? allManagedCourses
                        .filter((c) => item.accessRules.allowedCourseIds?.includes(c.id))
                        .map((c) => c.code)
                        .join(', ')
                    : '';

                return (
                  <div
                    key={item.id}
                    className="neu-inset rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 border border-slate-200/60 dark:border-slate-800/80 hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex gap-4">
                      {/* Realistic 3D Hardcover Book Spine Visual */}
                      <div
                        onClick={() => {
                          if (!isLockedForStudent) setActiveReaderItem(item);
                        }}
                        className={`w-24 sm:w-28 h-36 sm:h-40 rounded-r-xl rounded-l-sm shrink-0 relative overflow-hidden shadow-lg flex flex-col justify-between p-2.5 text-white select-none ${
                          !isLockedForStudent ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'opacity-75'
                        } ${
                          isEbook
                            ? 'bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 border-l-4 border-amber-400'
                            : 'bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border-l-4 border-amber-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <img
                            src={OFFICIAL_ACADEMY_LOGO}
                            alt="Logo"
                            className="w-6 h-6 rounded-full bg-white p-0.5 object-contain"
                          />
                          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                            {isEbook ? 'EBOOK' : 'NOTE'}
                          </span>
                        </div>
                        <div className="my-auto">
                          <div className="text-[11px] font-serif font-extrabold leading-tight line-clamp-3 text-amber-50">
                            {item.title}
                          </div>
                        </div>
                        <div className="text-[8px] font-mono text-amber-300/90 truncate border-t border-white/15 pt-1">
                          SWANARH LIBRARY
                        </div>
                      </div>

                      {/* Book Metadata & Details */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {isEbook ? 'သင်တန်းစာအုပ် (eBook)' : 'စာရှည်မှတ်စု (Long Note)'}
                            </span>
                            {item.isPinned && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-bold">
                                  <Pin className="w-3 h-3" /> Pinned
                                </span>
                              </>
                            )}
                            {item.accessRules?.enabled && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <Lock className="w-3 h-3" /> Roll Call ≥{' '}
                                  {item.accessRules.minAttendancePercentage || 80}%
                                </span>
                              </>
                            )}
                            {allowedClassNames && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-indigo-600 dark:text-indigo-300 font-semibold">
                                  အတန်း: {allowedClassNames}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleBookmark(item.id)}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                isBookmarked
                                  ? 'text-amber-500'
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}
                              title="မှတ်သားရန်"
                            >
                              {isBookmarked ? (
                                <BookmarkCheck className="w-4 h-4" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>
                            {isStaff && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                  title="ပြင်ဆင်ရန် / အတန်းနှင့် ကန့်သတ်ချက်ရွေးရန်"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                  title="ဖျက်ရန်"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <h4 className="text-sm sm:text-base font-serif font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                          {item.title}
                        </h4>

                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {isLockedForStudent ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1">
                            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 text-xs font-extrabold">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>ဖတ်ရှုရန် လိုအပ်ချက်များ —</span>
                            </div>
                            <ul className="text-[11px] text-slate-700 dark:text-slate-300 pl-4 list-disc space-y-0.5">
                              {access.missingReasons.map((r, idx) => (
                                <li key={idx} className="font-semibold">
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          item.content && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                              "{item.content.replace(/[#*`_>-]/g, '').slice(0, 140)}..."
                            </p>
                          )
                        )}
                      </div>
                    </div>

                    {/* Shelf Footer */}
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.authorName} · {item.createdAt}
                      </span>

                      {!isLockedForStudent && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveReaderItem(item)}
                            className="px-4 py-2 rounded-xl neu-btn-primary text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>
                              {isEbook ? 'စာအုပ်ဖွင့်ဖတ်ရန်' : 'စာရှည် အပြည့်အစုံဖတ်ရန်'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          {isSafeLibraryFileUrl(item.fileUrl) && (
                            <a
                              href={item.fileUrl}
                              download={item.fileName || `${item.title}.pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 rounded-xl neu-btn text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: COMPLETE YOUTUBE & TIKTOK VIDEO GALLERIES (No External "မူရင်း Link ဖွင့်ရန်" Buttons) */}
      {(filterTab === 'all' || filterTab === 'youtube' || filterTab === 'tiktok') && (
        <div className="space-y-6">
          {/* 2A. YouTube Channel Complete Video Theater (@swanarhacademy) */}
          {(filterTab === 'all' || filterTab === 'youtube') && (
            <div className="neu-raised rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700/60 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-serif font-extrabold text-slate-900 dark:text-slate-100">
                      Swanarh Academy — YouTube သင်ခန်းစာနှင့် ဗီဒီယိုစာကြည့်တိုက် ({youtubeCleanHandle})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      YouTube Channel မှ ဗီဒီယိုအားလုံး အလိုအလျောက် တန်းပေါ်ပြီး စာကြည့်တိုက်အတွင်း တိုက်ရိုက်ကြည့်ရှုနိုင်ပါသည်
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => syncLiveChannelFeeds(true)}
                    disabled={isSyncingChannels}
                    className="px-3 py-2 rounded-xl neu-btn text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-rose-600 ${
                        isSyncingChannels ? 'animate-spin' : ''
                      }`}
                    />
                    <span>ဗီဒီယိုအသစ်များ Sync ဆွဲရန်</span>
                  </button>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => openCreateModal('youtube')}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>YouTube Video ထည့်ရန်</span>
                    </button>
                  )}
                </div>
              </div>

              {/* YouTube Cinema Player + Full Video Catalog */}
              {(() => {
                const currentVideoId =
                  /^[a-zA-Z0-9_-]{11}$/.test(activeLiveYtVideoId)
                    ? activeLiveYtVideoId
                    : allYouTubeGalleryVideos[0]?.videoId ||
                      OFFICIAL_SWANARH_YOUTUBE_VIDEOS[0]?.videoId ||
                      'JuojeHJ4u4c';
                const currentVideoObj =
                  allYouTubeGalleryVideos.find((v) => v.videoId === currentVideoId) ||
                  OFFICIAL_SWANARH_YOUTUBE_VIDEOS.find((v) => v.videoId === currentVideoId);
                const displayVideos =
                  allYouTubeGalleryVideos.length > 0
                    ? allYouTubeGalleryVideos
                    : OFFICIAL_SWANARH_YOUTUBE_VIDEOS;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                    {/* Main Cinema Player */}
                    <div className="lg:col-span-7 space-y-2.5 min-w-0">
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 shadow-lg border border-slate-800">
                        <iframe
                          key={currentVideoId}
                          src={`https://www.youtube.com/embed/${encodeURIComponent(
                            currentVideoId
                          )}?rel=0&modestbranding=1&playsinline=1`}
                          title={currentVideoObj?.title || 'Swanarh Academy YouTube Theater'}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                      <div className="px-1 flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                          {currentVideoObj?.title || 'Swanarh Academy YouTube Video'}
                        </p>
                        {currentVideoObj?.publishedAt && (
                          <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold shrink-0">
                            {currentVideoObj.publishedAt}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Full Scrollable Gallery of All Channel Videos */}
                    <div className="lg:col-span-5 space-y-2 min-w-0">
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 px-1 flex items-center justify-between gap-2">
                        <span>
                          Channel ဗီဒီယိုစာရင်း အားလုံး ({displayVideos.length} ခု) — နှိပ်၍ ကြည့်ရှုပါ
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[380px] sm:max-h-[430px] overflow-y-auto pr-1">
                        {displayVideos.map((v, idx) => {
                          const isPlaying = v.videoId === currentVideoId;
                          return (
                            <button
                              key={v.videoId}
                              type="button"
                              onClick={() => setActiveLiveYtVideoId(v.videoId)}
                              className={`p-2 sm:p-2.5 rounded-2xl text-left transition-all cursor-pointer flex items-center gap-2.5 sm:gap-3 min-w-0 ${
                                isPlaying
                                  ? 'ring-2 ring-rose-500 bg-rose-500/10'
                                  : 'neu-inset hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <div className="relative w-24 sm:w-28 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0">
                                <img
                                  src={v.thumbnailUrl}
                                  alt={v.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <Play className="w-4 h-4 text-white fill-white" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold truncate">
                                  #{idx + 1} {isPlaying ? '· ▶ ယခုဖွင့်ထားသည်' : ''}
                                </div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                                  {v.title}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 2B. TikTok Channel Complete Video Gallery (@dr..si.thu.aung.s) */}
          {(filterTab === 'all' || filterTab === 'tiktok') && (
            <div className="neu-raised rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-700/60 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-serif font-extrabold text-slate-900 dark:text-slate-100">
                      Dr. Si Thu Aung — TikTok သင်ခန်းစာနှင့် ဗီဒီယိုစာကြည့်တိုက် (@{tiktokCleanHandle})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      TikTok Channel ရှိ ဗီဒီယိုများအားလုံးကို စာကြည့်တိုက်အတွင်း တိုက်ရိုက်ရွေးချယ် ကြည့်ရှုနိုင်ပါသည်
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => syncLiveChannelFeeds(true)}
                    disabled={isSyncingChannels}
                    className="px-3 py-2 rounded-xl neu-btn text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-cyan-600 ${
                        isSyncingChannels ? 'animate-spin' : ''
                      }`}
                    />
                    <span>TikTok အသစ်များ Sync ဆွဲရန်</span>
                  </button>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => openCreateModal('tiktok')}
                      className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>TikTok Video ထည့်ရန်</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Live Creator Profile Embed Stream (Shows all latest TikTok videos from @dr..si.thu.aung.s) */}
                <div
                  className={`${
                    allTikTokGalleryVideos.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                  } space-y-2`}
                >
                  <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 px-1">
                    @{tiktokCleanHandle} ၏ TikTok ဗီဒီယိုစုစည်းမှု (ဗီဒီယိုတစ်ခုချင်းစီကို နှိပ်၍ ကြည့်ရှုနိုင်ပါသည်)
                  </div>
                  <div className="w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                    <iframe
                      src={`https://www.tiktok.com/embed/@${encodeURIComponent(tiktokCleanHandle)}`}
                      title={`TikTok Creator @${tiktokCleanHandle}`}
                      className="w-full h-[540px]"
                      allow="encrypted-media;"
                      allowFullScreen
                    />
                  </div>
                </div>

                {/* Individual Discovered & Curated TikTok Video Player */}
                {allTikTokGalleryVideos.length > 0 && (
                  <div className="lg:col-span-5 space-y-3">
                    {/^\d{15,22}$/.test(activeLiveTtVideoId) && (
                      <div className="w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                        <iframe
                          src={`https://www.tiktok.com/embed/v2/${encodeURIComponent(
                            activeLiveTtVideoId
                          )}`}
                          title="TikTok Video Player"
                          className="w-full h-[460px]"
                          allow="encrypted-media;"
                          allowFullScreen
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {allTikTokGalleryVideos.map((tv, i) => (
                        <button
                          key={tv.videoId}
                          type="button"
                          onClick={() => setActiveLiveTtVideoId(tv.videoId)}
                          className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2.5 cursor-pointer ${
                            activeLiveTtVideoId === tv.videoId
                              ? 'ring-2 ring-cyan-500 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                              : 'neu-inset text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span className="truncate">
                            #{i + 1} · {tv.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DISTRACTION-FREE READING ROOM MODAL WITH OFFICIAL CLASSROOM LOGO WATERMARK */}
      {activeReaderItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div
            className={`relative w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${
              readerTheme === 'dark'
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : readerTheme === 'sepia'
                ? 'bg-[#fbf6ea] border-[#e6d8b8] text-[#2d2417]'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Reader Top Control Bar */}
            <div className="relative z-20 px-4 sm:px-6 py-3.5 border-b border-current/10 flex flex-wrap items-center justify-between gap-3 bg-inherit">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <AcademyLogo size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono opacity-75">
                    Swanarh Academy Digital Library ·{' '}
                    {activeReaderItem.itemType === 'ebook' ? 'eBook Reader' : 'Study Note Reader'}
                  </div>
                  <h3 className="text-sm sm:text-base font-serif font-extrabold truncate">
                    {activeReaderItem.title}
                  </h3>
                </div>
              </div>

              {/* Font Size & Theme Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setReaderFontSize((s) => Math.max(13, s - 2))}
                  className="px-2.5 py-1.5 rounded-xl border border-current/20 text-xs font-extrabold cursor-pointer hover:bg-current/5"
                >
                  A-
                </button>
                <span className="text-xs font-mono px-1">{readerFontSize}px</span>
                <button
                  type="button"
                  onClick={() => setReaderFontSize((s) => Math.min(26, s + 2))}
                  className="px-2.5 py-1.5 rounded-xl border border-current/20 text-xs font-extrabold cursor-pointer hover:bg-current/5"
                >
                  A+
                </button>

                <div className="h-4 w-[1px] bg-current/15 mx-1" />

                <button
                  type="button"
                  onClick={() => setReaderTheme('light')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    readerTheme === 'light'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-current/20'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setReaderTheme('sepia')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    readerTheme === 'sepia'
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'border-current/20'
                  }`}
                >
                  Sepia
                </button>
                <button
                  type="button"
                  onClick={() => setReaderTheme('dark')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    readerTheme === 'dark'
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'border-current/20'
                  }`}
                >
                  Dark
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReaderItem(null)}
                  className="ml-2 p-2 rounded-xl bg-rose-600 text-white cursor-pointer"
                  title="ပိတ်ရန်"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reader Content Viewport with Official Classroom Logo Watermark */}
            <div className="relative flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 select-text">
              {activeReaderItem.watermarkProtected && (
                <div
                  className="pointer-events-none select-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden z-10"
                  aria-hidden="true"
                >
                  {/* Large Center Official Classroom Crest Logo Watermark */}
                  <img
                    src={OFFICIAL_ACADEMY_LOGO}
                    alt=""
                    className="w-72 h-72 sm:w-96 sm:h-96 object-contain opacity-[0.07]"
                  />
                  {/* Diagonal Repeating Logo + Student Identity Watermark Grid */}
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-16 opacity-[0.06]">
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="-rotate-12 flex items-center gap-2.5 text-xs font-mono font-extrabold whitespace-nowrap"
                      >
                        <img
                          src={OFFICIAL_ACADEMY_LOGO}
                          alt=""
                          className="w-7 h-7 rounded-full object-contain"
                        />
                        <span>
                          SWANARH ACADEMY · {currentUser.name} (@{currentUser.username})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded PDF / External eBook Viewer if fileUrl is present and passes strict URL scheme validation */}
              {isSafeLibraryFileUrl(activeReaderItem.fileUrl) && (
                <div className="relative z-20 space-y-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>
                        ပူးတွဲပါ eBook ဖိုင်: {activeReaderItem.fileName || 'Course_eBook.pdf'}
                        {activeReaderItem.fileSize ? ` (${activeReaderItem.fileSize})` : ''}
                      </span>
                    </div>
                    <a
                      href={activeReaderItem.fileUrl}
                      download={activeReaderItem.fileName || `${activeReaderItem.title}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>eBook ဒေါင်းလုဒ်ဆွဲရန်</span>
                    </a>
                  </div>

                  {isSafePdfEmbedUrl(activeReaderItem.fileUrl) ? (
                    <iframe
                      src={activeReaderItem.fileUrl}
                      title={activeReaderItem.title}
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-[520px] rounded-2xl border border-current/15"
                    />
                  ) : null}
                </div>
              )}

              {/* Formatted Long-Form Article / Note Body */}
              {activeReaderItem.content && (
                <article
                  style={{ fontSize: `${readerFontSize}px`, lineHeight: 1.85 }}
                  className="relative z-20 max-w-3xl mx-auto space-y-4 whitespace-pre-wrap font-sans"
                >
                  {activeReaderItem.content}
                </article>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSTRUCTOR CREATE / EDIT LIBRARY ITEM MODAL WITH CLASS-BASED & STUDENT GATING */}
      {showEditorModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="neu-raised rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {editingItem
                  ? 'စာကြည့်တိုက် အချက်အလက်နှင့် အတန်းလိုက် ကန့်သတ်ချက် ပြင်ဆင်ရန်'
                  : 'စာကြည့်တိုက်သို့ စာအုပ် / မှတ်စုရှည် / Video အသစ်ထည့်သွင်းရန်'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="p-2 rounded-xl neu-btn text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Item Type Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'long_note', label: 'စာရှည်မှတ်စု' },
                  { id: 'ebook', label: 'eBook (PDF)' },
                  { id: 'youtube', label: 'YouTube Video' },
                  { id: 'tiktok', label: 'TikTok Video' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const nextType = t.id as LibraryItemType;
                      setFormType(nextType);
                      if (!editingItem) {
                        const isGateType = nextType === 'ebook' || nextType === 'long_note';
                        setFormRules((prev) => ({
                          ...prev,
                          enabled: isGateType,
                        }));
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl font-extrabold cursor-pointer transition-all ${
                      formType === t.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'neu-btn text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {(formType === 'youtube' || formType === 'tiktok') && (
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                    {formType === 'youtube'
                      ? 'YouTube Video Link (ထည့်လိုက်သည်နှင့် Library တွင် Video တန်းပေါ်ပါမည်)'
                      : 'TikTok Video Link (ထည့်လိုက်သည်နှင့် Library တွင် Video တန်းပေါ်ပါမည်)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      onBlur={() => handleAutoFetchVideoMetadata(formVideoUrl)}
                      placeholder={
                        formType === 'youtube'
                          ? 'https://www.youtube.com/watch?v=...'
                          : 'https://www.tiktok.com/@dr..si.thu.aung.s/video/...'
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleAutoFetchVideoMetadata(formVideoUrl)}
                      disabled={isFetchingOembed}
                      className="px-3 py-2 rounded-xl neu-btn font-bold text-indigo-600 dark:text-indigo-300 shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isFetchingOembed ? 'ဆွဲယူနေသည်...' : 'ခေါင်းစဉ်ယူရန်'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                    ခေါင်းစဉ် (Title) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ဥပမာ — အခန်း (၁) အထူးမှတ်စုရှည် / သင်တန်း eBook..."
                    className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                    ရေးသားသူ / ကဏ္ဍ (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="Dr. Si Thu Aung • Swanarh Academy"
                    className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                  အကျဉ်းချုပ် ဖော်ပြချက် (Short Summary)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ဤစာအုပ် / မှတ်စု အကြောင်း အကျဉ်းချုပ်..."
                  className="w-full px-3.5 py-2 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                />
              </div>

              {formType === 'ebook' && (
                <div className="neu-inset rounded-2xl p-3.5 space-y-3">
                  <label className="font-extrabold text-slate-800 dark:text-slate-100 block">
                    eBook PDF ဖိုင် တင်ရန် သို့မဟုတ် Direct eBook Link ထည့်ရန်
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <label className="px-3.5 py-2 rounded-xl neu-btn font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 cursor-pointer w-fit">
                      <Upload className="w-3.5 h-3.5" />
                      <span>PDF / eBook ဖိုင် ရွေးချယ်ရန်</span>
                      <input
                        type="file"
                        accept=".pdf,.epub,.doc,.docx"
                        onChange={handleEbookFileUpload}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={formFileUrl}
                      onChange={(e) => setFormFileUrl(e.target.value)}
                      placeholder="သို့မဟုတ် eBook URL ထည့်ပါ..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  {formFileName && (
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      ရွေးချယ်ထားသောဖိုင်: {formFileName} ({formFileSize})
                    </p>
                  )}
                </div>
              )}

              {(formType === 'long_note' || formType === 'ebook') && (
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                    သင်တန်း စာရှည်ကြီး / အထူးမှတ်စု အပြည့်အစုံ (Long-Form Content)
                  </label>
                  <textarea
                    rows={8}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="သင်တန်းမှ စာရှည်ကြီးများ၊ သင်ခန်းစာ မှတ်စုရှည်များကို ဤနေရာတွင် ရိုက်ထည့်/Paste လုပ်နိုင်ပါသည်..."
                    className="w-full px-3.5 py-3 rounded-2xl neu-inset text-slate-800 dark:text-slate-100 font-sans leading-relaxed"
                  />
                </div>
              )}

              {/* CLASS-LEVEL & STUDENT REQUIREMENT GATING (ONLY FOR EBOOKS & LONG NOTES; VIDEOS ARE UNRESTRICTED) */}
              {formType === 'ebook' || formType === 'long_note' ? (
                <div className="neu-inset rounded-2xl p-4 space-y-3.5 border border-indigo-500/30">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                        eBook နှင့် စာရှည်မှတ်စု အတန်းလိုက် မြင်တွေ့ခွင့်နှင့် Roll Call / Exam / Form ကန့်သတ်ချက်များ
                      </span>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formRules.enabled}
                        onChange={(e) =>
                          setFormRules((r) => ({ ...r, enabled: e.target.checked }))
                        }
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                        ကန့်သတ်ချက် ဖွင့်ထားမည်
                      </span>
                    </label>
                  </div>

                  {/* 1. Which Classes CAN see & Which Classes CANNOT see */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-300/50 dark:border-slate-700/50">
                    <div className="space-y-1.5">
                      <label className="font-extrabold text-emerald-700 dark:text-emerald-300 block">
                        ၁။ မည်သည့်အတန်းများကို မြင်စေမည်နည်း (ရွေးချယ်ထားသော အတန်းများသာ မြင်ရမည် · မရွေးပါက အတန်းအားလုံး မြင်ရမည်):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {allManagedCourses.map((c) => {
                          const isSelected = (formRules.allowedCourseIds || []).includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleAllowedCourse(c.id, false)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isSelected ? '✓ ' : ''}
                              {c.code} ({c.title})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-extrabold text-rose-700 dark:text-rose-300 block">
                        ၂။ မည်သည့်အတန်းများကို လုံးဝ မမြင်စေချင်သနည်း (ဖျောက်ထားမည့် အတန်းများ ရွေးရန်):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {allManagedCourses.map((c) => {
                          const isBlocked = (formRules.blockedCourseIds || []).includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleBlockedCourse(c.id, false)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border transition-all ${
                                isBlocked
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isBlocked ? '✕ မမြင်ရ: ' : ''}
                              {c.code} ({c.title})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {formRules.enabled && (
                    <div className="space-y-3 pt-2 border-t border-slate-300/50 dark:border-slate-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="font-bold text-slate-700 dark:text-slate-200">
                          ၃။ ကျောင်းသား Roll Call အနည်းဆုံး ရှိရမည့် % (မပြည့်သူများ မမြင်ရပါ):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={formRules.minAttendancePercentage ?? 80}
                            onChange={(e) =>
                              setFormRules((r) => ({
                                ...r,
                                minAttendancePercentage: Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0)
                                ),
                              }))
                            }
                            className="w-20 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-extrabold text-center"
                          />
                          <span className="font-extrabold">% နှင့်အထက်</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(formRules.requireAllExamsSubmitted)}
                            onChange={(e) =>
                              setFormRules((r) => ({
                                ...r,
                                requireAllExamsSubmitted: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="font-bold">
                            Exam စာမေးပွဲ မဖြေဆိုရသေးသူများအား မမြင်စေရန် ပိတ်ထားမည်
                          </span>
                        </label>

                        <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(formRules.requireAllDataFormsSubmitted)}
                            onChange={(e) =>
                              setFormRules((r) => ({
                                ...r,
                                requireAllDataFormsSubmitted: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="font-bold">
                            အချက်အလက် Form မဖြည့်ရသေးသူများအား မမြင်စေရန် ပိတ်ထားမည်
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setFormRules((r) => ({ ...r, hideWhenRestricted: true }))
                          }
                          className={`p-2.5 rounded-xl text-left font-bold border cursor-pointer transition-all ${
                            formRules.hideWhenRestricted
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>လုံးဝ မမြင်ရအောင် ဖျောက်ထားမည် (Strict Hide)</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFormRules((r) => ({ ...r, hideWhenRestricted: false }))
                          }
                          className={`p-2.5 rounded-xl text-left font-bold border cursor-pointer transition-all ${
                            !formRules.hideWhenRestricted
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-extrabold">
                            <Lock className="w-3.5 h-3.5" />
                            <span>သော့ခတ်ပုံစံဖြင့် လိုအပ်ချက်ပြမည် (Locked Card)</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-300/50 dark:border-slate-700/50">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={formIsPinned}
                        onChange={(e) => setFormIsPinned(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span>စာကြည့်တိုက် ထိပ်ဆုံးတွင် Pin ထိုးထားမည်</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={formWatermark}
                        onChange={(e) => setFormWatermark(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span>Classroom Logo နှင့် ကျောင်းသားအမည် Watermark ထည့်ထားမည်</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="neu-inset rounded-2xl p-3.5 border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      YouTube နှင့် TikTok ဗီဒီယိုများကို မည်သည့် သင်တန်းသားမဆို ကန့်သတ်ချက်မရှိ ကြည့်ရှုနိုင်ပါသည် (eBook နှင့် စာရှည်မှတ်စုများကိုသာ ကန့်သတ်ပါသည်)
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span>ထိပ်ဆုံးတွင် Pin ထိုးထားမည်</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2.5 rounded-xl neu-btn font-bold cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl neu-btn-primary font-extrabold cursor-pointer"
                >
                  သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANNEL & GLOBAL CLASS ACCESS RULES SETTINGS MODAL */}
      {showChannelSettingsModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="neu-raised rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                အတန်းလိုက် မြင်တွေ့ခွင့်၊ Roll Call / Exam / Form နှင့် Channel စည်းမျဉ်းများ
              </h3>
              <button
                type="button"
                onClick={() => setShowChannelSettingsModal(false)}
                className="p-2 rounded-xl neu-btn cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChannelSettings} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                  သင်တန်း YouTube Channel Link (@swanarhacademy)
                </label>
                <input
                  type="url"
                  value={cfgYoutubeUrl}
                  onChange={(e) => setCfgYoutubeUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-200 block">
                  သင်တန်း TikTok Channel Link (@dr..si.thu.aung.s)
                </label>
                <input
                  type="url"
                  value={cfgTiktokUrl}
                  onChange={(e) => setCfgTiktokUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="neu-inset rounded-2xl p-4 space-y-3.5 border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    eBook နှင့် စာရှည်မှတ်စုများအားလုံးအတွက် ကန့်သတ်ချက်
                  </span>
                  <input
                    type="checkbox"
                    checked={cfgDefaultRules.enabled}
                    onChange={(e) =>
                      setCfgDefaultRules((r) => ({ ...r, enabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                </div>

                {/* Allowed Classes */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-emerald-700 dark:text-emerald-300 block">
                    မြင်တွေ့ခွင့်ပြုမည့် အတန်းများ (မရွေးပါက အတန်းအားလုံး):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allManagedCourses.map((c) => {
                      const isSel = (cfgDefaultRules.allowedCourseIds || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleAllowedCourse(c.id, true)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${
                            isSel
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {isSel ? '✓ ' : ''}
                          {c.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Blocked Classes */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-rose-700 dark:text-rose-300 block">
                    မမြင်စေချင်သော အတန်းများ (ဖျောက်ထားမည့် အတန်းများ):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allManagedCourses.map((c) => {
                      const isBlk = (cfgDefaultRules.blockedCourseIds || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleBlockedCourse(c.id, true)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border ${
                            isBlk
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {isBlk ? '✕ မမြင်ရ: ' : ''}
                          {c.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-bold">အနည်းဆုံး Roll Call % (79% အောက် ဖျောက်ရန် = 80%):</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={cfgDefaultRules.minAttendancePercentage ?? 80}
                    onChange={(e) =>
                      setCfgDefaultRules((r) => ({
                        ...r,
                        minAttendancePercentage: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-20 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-extrabold text-center"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(cfgDefaultRules.requireAllExamsSubmitted)}
                    onChange={(e) =>
                      setCfgDefaultRules((r) => ({
                        ...r,
                        requireAllExamsSubmitted: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span>Exam စာမေးပွဲ မဖြေဆိုရသေးသူများအား မမြင်ရအောင် ကန့်သတ်မည်</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(cfgDefaultRules.requireAllDataFormsSubmitted)}
                    onChange={(e) =>
                      setCfgDefaultRules((r) => ({
                        ...r,
                        requireAllDataFormsSubmitted: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span>ကျောင်းသား အချက်အလက် Form မဖြည့်ရသေးသူများအား မမြင်ရအောင် ကန့်သတ်မည်</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700 dark:text-indigo-300">
                  <input
                    type="checkbox"
                    checked={Boolean(cfgDefaultRules.hideWhenRestricted)}
                    onChange={(e) =>
                      setCfgDefaultRules((r) => ({
                        ...r,
                        hideWhenRestricted: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span>မကိုက်ညီသူများအား လုံးဝမမြင်ရအောင် ဖျောက်ထားမည်</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChannelSettingsModal(false)}
                  className="px-4 py-2 rounded-xl neu-btn font-bold cursor-pointer"
                >
                  ပိတ်မည်
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl neu-btn-primary font-extrabold cursor-pointer"
                >
                  သိမ်းဆည်းပြီး အားလုံးသို့ သက်ရောက်စေမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSTRUCTOR STUDENT ELIGIBILITY INSPECTOR MODAL */}
      {showAccessInspectorModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="neu-raised rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  eBook & စာရှည်မှတ်စု မြင်တွေ့ခွင့်ရှိသူ / ကန့်သတ်ခံရသူ စာရင်းစစ်ဆေးရန်
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  အတန်း၊ Roll Call ≥ {channelConfig.defaultEbookNoteAccessRules.minAttendancePercentage || 80}% နှင့် Exam / Data Form ပြည့်မီမှု အခြေအနေ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccessInspectorModal(false)}
                className="p-2 rounded-xl neu-btn cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="neu-inset p-3 rounded-2xl">
                <span className="text-slate-500 block">စုစုပေါင်း ကျောင်းသား</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {studentEligibilityRoster.length} ဦး
                </span>
              </div>
              <div className="neu-inset p-3 rounded-2xl">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold block">
                  မြင်တွေ့ဖတ်ရှုခွင့် ရရှိသူ
                </span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                  {studentEligibilityRoster.filter((s) => s.evalResult.allowed).length} ဦး
                </span>
              </div>
              <div className="neu-inset p-3 rounded-2xl">
                <span className="text-rose-600 dark:text-rose-400 font-bold block">
                  ကန့်သတ်/ဖျောက်ထားခံရသူ
                </span>
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                  {studentEligibilityRoster.filter((s) => !s.evalResult.allowed).length} ဦး
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {studentEligibilityRoster.map(({ student, evalResult }, idx) => (
                <div
                  key={student.id}
                  className="neu-inset rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="text-slate-400 font-mono">#{idx + 1}</span>
                      <span>{student.name}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        @{student.username}
                      </span>
                    </div>
                    {!evalResult.allowed && evalResult.missingReasons.length > 0 && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                        အကြောင်းရင်း: {evalResult.missingReasons.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px] font-bold">
                    <span
                      className={
                        evalResult.attendanceMet
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }
                    >
                      Roll Call: {evalResult.attendancePct}%
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        evalResult.examsMet
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      Exam: {evalResult.submittedExams}/{evalResult.totalExams}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        evalResult.dataFormsMet
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      Form: {evalResult.submittedDataForms}/{evalResult.totalDataForms}
                    </span>
                    <span aria-hidden="true">·</span>
                    {evalResult.allowed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>မြင်ရသည်</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ဖျောက်ထားသည်</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
