import { useState } from "react";
import "./App.css";

import WelcomeScreen from "./components/WelcomeScreen";
import MainPage from "./components/MainPage";
import type { ButtonMode } from "./components/TypeButton";
import { themeByMode } from "./modes/themeByMode";

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeMode, setActiveMode] = useState<ButtonMode>("lockIn");

  const theme = themeByMode[activeMode];
  const themeStyle = {
    ["--customGreen" as any]: theme.darkerColor,
    ["--lighterGreen" as any]: theme.lighterColor,
    ["--classicWhite" as any]: theme.lightestColor,
  } as any;

  return (
    <div style={themeStyle}>
      {showWelcome ? (
        <WelcomeScreen onContinue={() => setShowWelcome(false)} />
      ) : (
        <MainPage activeMode={activeMode} onModeChange={setActiveMode} />
      )}
    </div>
  );
}

export default App;
