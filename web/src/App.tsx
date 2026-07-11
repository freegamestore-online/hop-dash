import { GameShell, GameTopbar } from "@freegamestore/games";
import { useEffect, useRef, useState } from "react";
import { startGame } from "./game";
import { useHighScore } from "./hooks/useHighScore";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore("hopdash_highscore");

  // Keep a ref so the callbacks passed into KAPLAY always read the latest value
  // without needing to tear down and recreate the engine on every render.
  const highScoreRef = useRef(highScore);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stop = startGame(canvas, {
      onScore: setScore,
      onHighScore: updateHighScore,
      getHighScore: () => highScoreRef.current,
    });
    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="Hop Dash" score={score} />}>
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />
    </GameShell>
  );
}
