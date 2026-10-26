import {
  Manga,
  Chapter,
  ChapterPage,
  ReadingHistoryItem,
} from '../../src/types';

export const mockMangaSoloLeveling: Manga = {
  id: '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0',
  title: 'Solo Leveling, Vol. 5',
  altTitle: '나 혼자만 레벨업',
  description:
    'In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo finds a secret program.',
  status: 'completed',
  year: 2018,
  contentRating: 'safe',
  originalLanguage: 'ko',
  lastChapter: '200',
  updatedAt: '2026-10-26T08:00:00.000Z',
  coverUrl:
    '/api/proxy-image?url=https%3A%2F%2Fuploads.mangadex.org%2Fcovers%2F32d76d19-8a05-4db0-9fc2-e0b0648fe9d0%2Fcover.512.jpg',
  coverUrlFull:
    '/api/proxy-image?url=https%3A%2F%2Fuploads.mangadex.org%2Fcovers%2F32d76d19-8a05-4db0-9fc2-e0b0648fe9d0%2Fcover.jpg',
  author: 'Chugong',
  artist: 'DUBU (REDICE STUDIO)',
  tags: [
    {
      id: '391b0423-d847-456f-aff0-8b0cfc03066b',
      name: 'Action',
      group: 'genre',
    },
    {
      id: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
      name: 'Fantasy',
      group: 'genre',
    },
  ],
  rating: '4.95',
  follows: 285400,
};

export const mockChapterList: Chapter[] = [
  {
    id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    chapter: '32',
    volume: '5',
    title: 'The Monarch Awakens',
    translatedLanguage: 'id',
    pages: 42,
    publishAt: '2026-10-25T12:00:00.000Z',
    groupName: 'Ciaran ID Scans',
  },
  {
    id: 'b2c3d4e5-f6a7-4901-bcde-f12345678901',
    chapter: '31',
    volume: '5',
    title: 'Dungeon Gate',
    translatedLanguage: 'en',
    pages: 38,
    publishAt: '2026-10-20T12:00:00.000Z',
    groupName: 'Flame Scans',
  },
];

export const mockChapterPages: ChapterPage[] = [
  {
    index: 1,
    url: '/api/proxy-image?url=https%3A%2F%2Fcmdxd98sb0x3yprd.mangadex.network%2Fdata-saver%2Fhash123%2F1.jpg',
    rawUrl: 'https://cmdxd98sb0x3yprd.mangadex.network/data-saver/hash123/1.jpg',
  },
  {
    index: 2,
    url: '/api/proxy-image?url=https%3A%2F%2Fcmdxd98sb0x3yprd.mangadex.network%2Fdata-saver%2Fhash123%2F2.jpg',
    rawUrl: 'https://cmdxd98sb0x3yprd.mangadex.network/data-saver/hash123/2.jpg',
  },
];

export const mockReadingHistoryItem: ReadingHistoryItem = {
  mangaId: mockMangaSoloLeveling.id,
  mangaTitle: mockMangaSoloLeveling.title,
  author: mockMangaSoloLeveling.author,
  coverUrl: mockMangaSoloLeveling.coverUrl,
  chapterId: mockChapterList[0].id,
  chapterNumber: mockChapterList[0].chapter,
  chapterTitle: mockChapterList[0].title,
  language: 'id',
  currentPage: 33,
  totalPages: 42,
  progressPercent: 78,
  readAt: '2026-10-26T09:00:00.000Z',
};
