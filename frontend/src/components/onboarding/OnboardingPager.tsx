import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import OnboardingFooter from '@/components/onboarding/OnboardingFooter';
import {
  FeaturesPage,
  GetStartedPage,
  PersonalizePage,
  WelcomePage,
} from '@/components/onboarding/OnboardingPages';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth } from '@/constants/theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { saveAccessibilityPreference } from '@/utils/onboardingStorage';

const PAGE_COUNT = 4;

type OnboardingPage = { key: 'welcome' | 'features' | 'personalize' | 'get-started' };

const pages: OnboardingPage[] = [
  { key: 'welcome' },
  { key: 'features' },
  { key: 'personalize' },
  { key: 'get-started' },
];

export default function OnboardingPager() {
  const router = useRouter();
  const { completeOnboarding } = useBootstrap();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const scrollX = useSharedValue(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const finishOnboarding = async () => {
    if (selectedOption) {
      await saveAccessibilityPreference(selectedOption);
    }
    await completeOnboarding();
    router.replace('/login');
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const syncPageIndex = (offsetX: number) => {
    if (!pagerWidth) {
      return;
    }
    const nextPage = Math.round(offsetX / pagerWidth);
    setCurrentPage(Math.max(0, Math.min(nextPage, PAGE_COUNT - 1)));
  };

  const goToPage = (page: number) => {
    const nextPage = Math.max(0, Math.min(page, PAGE_COUNT - 1));
    listRef.current?.scrollToIndex({ index: nextPage, animated: true });
    setCurrentPage(nextPage);
  };

  const handleNext = () => {
    if (currentPage === PAGE_COUNT - 1) {
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

  const nextDisabled = currentPage === 2 && !selectedOption;
  const nextLabel = currentPage === PAGE_COUNT - 1 ? "Let's Begin" : 'Next';

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
            onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              syncPageIndex(event.nativeEvent.contentOffset.x);
            }}
            onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              syncPageIndex(event.nativeEvent.contentOffset.x);
            }}
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
        totalSteps={PAGE_COUNT}
        pageWidth={pagerWidth}
        scrollX={scrollX}
        onSkip={() => void finishOnboarding()}
        onNext={handleNext}
        nextLabel={nextLabel}
        nextDisabled={nextDisabled}
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
