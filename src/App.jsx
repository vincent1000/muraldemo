import OptimizedCanvasEditor from './components/CanvasEditor';
import TitleBar from './components/TitleBar';
// import EditableCardList from './components/EditableCard';

export default function App() {
  return (
    <div className="app">
      <OptimizedCanvasEditor />
      <TitleBar/>
    </div>
  );
}