import OptimizedCanvasEditor from './components/CanvasEditor';
import TitleBar from './components/TitleBar';
import MuralDemo from './components/mural';

export default function App() {
  return (
    <div className="app">
      {/* <OptimizedCanvasEditor />
      <TitleBar/> */}
      <MuralDemo/>
      <TitleBar/>
    </div>
  );
}