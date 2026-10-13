import conv from '../../data/conv.json';

export type Folder = (typeof conv.folders)[number];
export type Card = Folder['cards'][number];
export interface Cat { id: string; name: string; emoji: string; g: [string, string]; f: string[] }

export const FOLDERS: Folder[] = conv.folders;
export const TOTAL_CARDS = FOLDERS.reduce((a, f) => a + f.cards.length, 0);

/* 46개 주제를 11개 카테고리로 묶는다. 카드 이미지가 없으므로
   카테고리별 그라데이션 + 주제별 이모지로 대신한다. (legacy 그대로) */
export const FEMOJI: Record<string, string> = {
  'driving-on-the-road': '🚗', 'gym-and-workout': '🏋️', 'moving-and-housewarming': '📦',
  'cafe-and-ordering': '☕', 'business-meetings-conferences': '💼', 'banking-account-phrases': '🏦',
  'grocery-shopping-phrases': '🛒', 'doctor-pharmacy-phrases': '🏥', 'hair-salon-phrases': '✂️',
  'soothing-a-baby': '👶', 'bar-and-drinks': '🍻', 'watching-sports-game': '🏟️',
  'scrolling-social-media': '📱', 'relaxing-at-home': '🛋️', 'concert-and-show': '🎤',
  'evening-routine': '🌙', 'dog-care-routine': '🐕', 'korean-holiday-ancestral-rites': '🎎',
  'casual-agreement-replies': '👌', 'decorating-the-home': '🪴', 'at-the-airport': '✈️',
  'wedding-engagement': '💍', 'studying-and-learning': '📚', 'small-talk-questions-answers': '💬',
  'reading-books': '📖', 'wrapping-up-work-tasks': '📝', 'booking-and-packing': '🧳',
  'birthday-celebrations': '🎂', 'team-collaboration-talk': '🤝', 'cooking-and-meals': '🍳',
  'weekend-getaway-travel': '🏖️', 'small-talk-greetings': '👋', 'using-public-transit': '🚇',
  'sightseeing-and-travel': '🗺️', 'morning-routine': '☀️', 'car-rental': '🚙',
  'running-and-marathon': '🏃', 'ordering-at-a-restaurant': '🍽️', 'morning-grooming-routine': '🪥',
  'shopping-store-phrases': '🛍️', 'at-the-hotel': '🏨', 'tidying-up': '🧹',
  'christmas-celebration': '🎄', 'dating-and-relationships': '💖', 'weekend-routine': '🧺',
  'movie-theater-phrases': '🎬',
};

export const CATS: Cat[] = [
  { id: 'routine', name: '일상 루틴', emoji: '☀️', g: ['#FFF4DA', '#FFE2AE'],
    f: ['morning-routine', 'morning-grooming-routine', 'evening-routine', 'weekend-routine', 'relaxing-at-home', 'tidying-up'] },
  { id: 'home', name: '집과 살림', emoji: '🏠', g: ['#EAF4EE', '#CDE6D9'],
    f: ['moving-and-housewarming', 'decorating-the-home', 'cooking-and-meals', 'grocery-shopping-phrases'] },
  { id: 'eat', name: '먹고 마시기', emoji: '☕', g: ['#FAE8DB', '#F2CFB3'],
    f: ['cafe-and-ordering', 'ordering-at-a-restaurant', 'bar-and-drinks'] },
  { id: 'travel', name: '여행', emoji: '✈️', g: ['#E5EFFC', '#C6DCF7'],
    f: ['at-the-airport', 'at-the-hotel', 'sightseeing-and-travel', 'booking-and-packing', 'car-rental', 'weekend-getaway-travel', 'using-public-transit', 'driving-on-the-road'] },
  { id: 'health', name: '운동과 건강', emoji: '🏃', g: ['#E7F7F0', '#BEEDD9'],
    f: ['gym-and-workout', 'running-and-marathon', 'doctor-pharmacy-phrases', 'watching-sports-game'] },
  { id: 'work', name: '일과 비즈니스', emoji: '💼', g: ['#EDEEF7', '#D3D6EE'],
    f: ['business-meetings-conferences', 'wrapping-up-work-tasks', 'team-collaboration-talk', 'banking-account-phrases'] },
  { id: 'social', name: '관계와 대화', emoji: '💬', g: ['#FDE9EE', '#F7CBD9'],
    f: ['small-talk-questions-answers', 'small-talk-greetings', 'casual-agreement-replies', 'dating-and-relationships'] },
  { id: 'event', name: '기념일과 행사', emoji: '🎉', g: ['#F4EAFB', '#DFC9F4'],
    f: ['wedding-engagement', 'birthday-celebrations', 'korean-holiday-ancestral-rites', 'christmas-celebration'] },
  { id: 'leisure', name: '여가와 취미', emoji: '🎬', g: ['#FFEFE4', '#FFD5BB'],
    f: ['scrolling-social-media', 'concert-and-show', 'reading-books', 'movie-theater-phrases', 'studying-and-learning'] },
  { id: 'care', name: '돌봄', emoji: '🐾', g: ['#EAF6F9', '#C9E6EF'],
    f: ['soothing-a-baby', 'dog-care-routine'] },
  { id: 'shop', name: '쇼핑과 관리', emoji: '🛍️', g: ['#F1F3EA', '#DCE2C9'],
    f: ['shopping-store-phrases', 'hair-salon-phrases'] },
];

export const fById = (id: string): Folder | undefined => FOLDERS.find(f => f.id === id);
export const catById = (id: string): Cat | undefined => CATS.find(c => c.id === id);
export const catOf = (fid: string): Cat => CATS.find(c => c.f.includes(fid)) ?? CATS[0];
export const catFolders = (c: Cat): Folder[] => c.f.map(fById).filter((f): f is Folder => !!f);

/** legacy searchFolders: 주제 이름·표현은 대소문자 무시, 뜻은 그대로 비교 */
export function searchFolders(q: string): Folder[] {
  if(!q) return FOLDERS;
  const ql = q.toLowerCase();
  return FOLDERS.filter(f => f.titleKo.toLowerCase().includes(ql)
    || f.cards.some(c => c.expression.toLowerCase().includes(ql) || (c.meaningKo || '').includes(q)));
}
