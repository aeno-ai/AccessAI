import { router } from 'expo-router';

/** Opens a lesson from the start (`opened` makes the player begin fresh, even for the same lesson). */
export const openLesson = (lessonId: string) =>
  router.navigate({ pathname: '/learn-lesson', params: { lessonId, opened: String(Date.now()) } });
