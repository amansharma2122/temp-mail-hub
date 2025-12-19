import { useCallback } from "react";

export const useConfetti = () => {
  const fireConfetti = useCallback(async (options?: {
    particleCount?: number;
    spread?: number;
    origin?: { x: number; y: number };
    colors?: string[];
  }) => {
    try {
      const confetti = (await import("canvas-confetti")).default;
      
      const defaults = {
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#00d4aa", "#a855f7", "#f472b6", "#38bdf8"],
        ...options,
      };

      confetti({
        ...defaults,
        zIndex: 9999,
      });
    } catch (error) {
      console.error("Confetti failed to load:", error);
    }
  }, []);

  const fireSuccessConfetti = useCallback(async () => {
    try {
      const confetti = (await import("canvas-confetti")).default;
      
      // Fire from left
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#00d4aa", "#10b981", "#22c55e"],
        zIndex: 9999,
      });
      
      // Fire from right
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#00d4aa", "#10b981", "#22c55e"],
        zIndex: 9999,
      });
    } catch (error) {
      console.error("Confetti failed to load:", error);
    }
  }, []);

  const fireStarConfetti = useCallback(async () => {
    try {
      const confetti = (await import("canvas-confetti")).default;
      
      confetti({
        particleCount: 30,
        spread: 360,
        ticks: 60,
        gravity: 0,
        decay: 0.94,
        startVelocity: 20,
        shapes: ["star"],
        colors: ["#fbbf24", "#f59e0b", "#d97706"],
        scalar: 1.2,
        origin: { x: 0.5, y: 0.5 },
        zIndex: 9999,
      });
    } catch (error) {
      console.error("Confetti failed to load:", error);
    }
  }, []);

  return {
    fireConfetti,
    fireSuccessConfetti,
    fireStarConfetti,
  };
};

export default useConfetti;
