import "./App.css";

function App() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/


  return (
    <main className="flex justify-center items-center h-screen bg-[var(--customGreen)] flex-col">
      <h2 className="text-4xl text-[var(--lighterGreen)]">Welcome to</h2>
      <h1 className="text-5xl text-[var(--classicWhite)]">LockIn Buddy!</h1>
      <p className="text-xl mt-5 text-[var(--lighterGreen)]">lock in with the help of a 'friendly' face...</p>
    </main>
  );
}

export default App;
