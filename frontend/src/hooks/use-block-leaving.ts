import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from 'expo-router';

// Going back — what the back button, back gesture and "Back" do. The app's
// own moves (e.g. on into onboarding once an email is verified) are other
// actions and are never blocked.
const BACK_ACTIONS = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

/**
 * While `blocked` (e.g. a new password is being saved), the screen can't be
 * left by going back: Android's back button and back gestures do nothing, so
 * the person only moves on once the server has answered.
 */
export function useBlockLeaving(blocked: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!blocked) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (BACK_ACTIONS.has(event.data.action.type)) event.preventDefault();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      unsubscribe();
      back.remove();
    };
  }, [blocked, navigation]);
}
