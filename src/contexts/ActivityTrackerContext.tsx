import { createContext, useContext, ReactNode } from 'react';
import useActivityTracker from '@/hooks/useActivityTracker';

interface ActivityTrackerContextType {
  trackFeatureClick: (featureName: string) => void;
}

const ActivityTrackerContext = createContext<ActivityTrackerContextType>({
  trackFeatureClick: () => {},
});

export const ActivityTrackerProvider = ({ children }: { children: ReactNode }) => {
  const { trackFeatureClick } = useActivityTracker();
  return (
    <ActivityTrackerContext.Provider value={{ trackFeatureClick }}>
      {children}
    </ActivityTrackerContext.Provider>
  );
};

export const useTracker = () => useContext(ActivityTrackerContext);
