import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import OnboardingFooter from '@/components/onboarding/OnboardingFooter';
import {
  FeaturesPage,
  GetStartedPage,
  PersonalizePage,
  WelcomePage,
} from '@/components/onboarding/OnboardingPages';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth } from '@/constants/theme';
import { useBootstrap, type UserRole } from '@/hooks/use-bootstrap';
import { saveAccessibilityPreference } from '@/utils/onboardingStorage';

type OnboardingPage = { key: 'welcome' | 'features' | 'personalize' | 'get-started' };

// The accessibility-needs page only makes sense for PWD accounts — non-PWD
// users never see it.
function pagesForRole(role: UserRole | null): OnboardingPage[] {
  return [
    { key: 'welcome' },
    { key: 'features' },
    ...(role === 'pwd' ? [{ key: 'personalize' } as const] : []),
    { key: 'get-started' },
  ];
}

export default function OnboardingPager() {
  const { completeOnboarding, role } = useBootstrap();
  const pages = useMemo(() => pagesForRole(role), [role]);
  const pageCount = pages.length;
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const scrollX = useSharedValue(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // No navigation needed: once onboarding is marked complete, the root
  // layout's guards switch this (already logged-in) user over to the app.
  const finishOnboarding = async () => {
    if (selectedOption) {
      await saveAccessibilityPreference(selectedOption);
    }
    await completeOnboarding();
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // The footer's step dots read `scrollX` directly, so they always match what's
  // on screen while swiping. `currentPage` (which the Next button uses to decide
  // where to go) used to be updated separately, only when a swipe "ended" —
  // those end-of-swipe events don't always fire reliably, so it could drift out
  // of sync with what the dots (and the user) were actually showing. Deriving
  // `currentPage` from the same `scrollX` value the dots use guarantees they can
  // never disagree.
  useAnimatedReaction(
    () => (pagerWidth > 0 ? Math.round(scrollX.value / pagerWidth) : 0),
    (page, previousPage) => {
      if (page !== previousPage) {
        scheduleOnRN(setCurrentPage, Math.max(0, Math.min(page, pageCount - 1)));
      }
    },
    [pagerWidth, pageCount],
  );

  const goToPage = (page: number) => {
    const nextPage = Math.max(0, Math.min(page, pageCount - 1));
    listRef.current?.scrollToIndex({ index: nextPage, animated: true });
    setCurrentPage(nextPage);
  };

  const handleNext = () => {
    if (currentPage === pageCount - 1) {
      void finishOnboarding();
      return;
    }
    goToPage(currentPage + 1);
  };

  const renderPage = ({ item }: { item: OnboardingPage }) => {
    switch (item.key) {
      case 'welcome':
        return <WelcomePage width={pagerWidth} />;
      case 'features':
        return <FeaturesPage width={pagerWidth} />;
      case 'personalize':
        return (
          <PersonalizePage
            width={pagerWidth}
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
          />
        );
      case 'get-started':
        return <GetStartedPage width={pagerWidth} />;
      default:
        return null;
    }
  };

  // Personalization is optional, so Next is never disabled.
  const nextLabel = currentPage === pageCount - 1 ? "Let's Begin" : 'Next';

  return (
    <ScreenShell maxWidth={MaxContentWidth.onboarding}>
      <View
        style={styles.pager}
        onLayout={(event: LayoutChangeEvent) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth && nextWidth !== pagerWidth) {
            setPagerWidth(nextWidth);
          }
        }}
      >
        {pagerWidth > 0 ? (
          <Animated.FlatList
            ref={listRef}
            data={pages}
            renderItem={renderPage}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: pagerWidth,
              offset: pagerWidth * index,
              index,
            })}
            extraData={{ currentPage, selectedOption, pagerWidth }}
            style={styles.list}
          />
        ) : null}
      </View>
      <OnboardingFooter
        currentStep={currentPage}
        totalSteps={pageCount}
        pageWidth={pagerWidth}
        scrollX={scrollX}
        onSkip={() => void finishOnboarding()}
        onNext={handleNext}
        nextLabel={nextLabel}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
});
