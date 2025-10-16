import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: true,
      accentColor: 'cyan',
      animations: true,
      glassEffect: true,

      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setAccentColor: (color) => set({ accentColor: color }),
      toggleAnimations: () => set((state) => ({ animations: !state.animations })),
      toggleGlassEffect: () => set((state) => ({ glassEffect: !state.glassEffect })),

      getThemeClasses: () => {
        const { isDark, accentColor, glassEffect } = get();
        return {
          isDark,
          accentColor,
          glassEffect,
          rootClass: isDark ? 'dark' : 'light',
        };
      },
    }),
    {
      name: 'smartvision-theme',
      partialize: (state) => ({
        isDark: state.isDark,
        accentColor: state.accentColor,
        animations: state.animations,
        glassEffect: state.glassEffect,
      }),
    }
  )
);

export default useThemeStore;
